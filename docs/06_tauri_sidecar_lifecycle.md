# Tauri 앱 실행 시 FastAPI 사이드카 자동 시작
> 작성일: 2026-04-01

---

## 전체 흐름

```
앱 실행
  └─ Tauri setup 훅
       └─ FastAPI 사이드카 spawn (포트 8008)
            └─ 헬스체크 (준비될 때까지 대기)
                 └─ 프론트엔드에 "서버 준비" 이벤트 전송
                      └─ 사용자에게 UI 표시

앱 종료
  └─ ExitRequested 이벤트
       └─ 사이드카 kill
            └─ 프로세스 완전 종료
```

---

## 1. 앱 시작 시 자동 실행 (main.rs)

```rust
use std::sync::{Arc, Mutex};
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

// 사이드카 핸들 전역 상태로 보관
struct SidecarState {
    child: Arc<Mutex<Option<CommandChild>>>,
    port: Arc<Mutex<u16>>,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState {
            child: Arc::new(Mutex::new(None)),
            port: Arc::new(Mutex::new(8008)),
        })
        .setup(|app| {
            let app_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                // 1. 사용 가능한 포트 찾기
                let port = find_available_port(8008).unwrap_or(8008);

                // 2. FastAPI 사이드카 실행
                let (mut rx, child) = app_handle
                    .shell()
                    .sidecar("agent-server")           // binaries/agent-server-{target}
                    .expect("사이드카 바이너리 없음")
                    .args(["--port", &port.to_string()])
                    .spawn()
                    .expect("사이드카 실행 실패");

                // 3. 핸들 저장 (종료 시 kill 용)
                let state = app_handle.state::<SidecarState>();
                *state.child.lock().unwrap() = Some(child);
                *state.port.lock().unwrap() = port;

                // 4. 서버 준비될 때까지 대기 (헬스체크)
                match wait_for_health(port, 30).await {
                    Ok(()) => {
                        // 프론트엔드에 준비 완료 알림
                        let _ = app_handle.emit("server_ready", port);
                    }
                    Err(e) => {
                        let _ = app_handle.emit("server_error", e);
                    }
                }

                // 5. stdout 로그 수집 (디버깅용)
                while let Some(event) = rx.recv().await {
                    if let tauri_plugin_shell::process::CommandEvent::Stdout(line) = event {
                        println!("[FastAPI] {}", line);
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("앱 빌드 실패")
        .run(|app_handle, event| {
            // 앱 종료 시 사이드카 kill
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                let state = app_handle.state::<SidecarState>();
                if let Some(child) = state.child.lock().unwrap().take() {
                    let _ = child.kill();
                }
                // Windows: 포트 점유 프로세스 강제 종료
                #[cfg(target_os = "windows")]
                {
                    let port = *state.port.lock().unwrap();
                    kill_port_windows(port);
                }
            }
        });
}
```

---

## 2. 헬스체크 (서버 준비 대기)

```rust
async fn wait_for_health(port: u16, max_retries: u32) -> Result<(), String> {
    let url = format!("http://127.0.0.1:{}/health", port);

    for attempt in 0..max_retries {
        match reqwest::get(&url).await {
            Ok(res) if res.status().is_success() => return Ok(()),
            _ => {
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
        }
        println!("헬스체크 대기 중... ({}/{})", attempt + 1, max_retries);
    }

    Err(format!("{}초 안에 서버가 시작되지 않았습니다", max_retries / 2))
}
```

FastAPI 쪽 헬스체크 엔드포인트:
```python
@app.get("/health")
async def health():
    return {"status": "ok"}
```

---

## 3. 프론트엔드 — 서버 준비 기다렸다가 UI 표시

```typescript
import { listen } from '@tauri-apps/api/event'
import { useState, useEffect } from 'react'

function App() {
  const [ready, setReady] = useState(false)
  const [port, setPort] = useState<number>(8008)

  useEffect(() => {
    // 서버 준비 이벤트 구독
    const unlisten = listen<number>('server_ready', (event) => {
      setPort(event.payload)
      setReady(true)
    })

    listen('server_error', (event) => {
      console.error('서버 시작 실패:', event.payload)
    })

    return () => { unlisten.then(f => f()) }
  }, [])

  if (!ready) return <LoadingScreen message="에이전트 서버 시작 중..." />
  return <MainApp port={port} />
}
```

---

## 4. Windows 고려사항

### 포트 점유 프로세스 강제 종료
```rust
#[cfg(target_os = "windows")]
fn kill_port_windows(port: u16) {
    // netstat으로 PID 찾기 → taskkill로 종료
    use std::process::Command;
    let output = Command::new("netstat")
        .args(["-ano"])
        .output()
        .unwrap();

    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        if line.contains(&format!(":{}", port)) {
            if let Some(pid) = line.split_whitespace().last() {
                let _ = Command::new("taskkill")
                    .args(["/PID", pid, "/F"])
                    .output();
            }
        }
    }
}
```

### 고아 프로세스 방지 (PyInstaller 주의)
PyInstaller로 빌드한 Python 바이너리는 내부적으로 자식 프로세스를 더 생성함.
Tauri의 `child.kill()`만으로는 완전히 안 죽을 수 있음.

```rust
// command_group 크레이트 사용 → 프로세스 그룹 통째로 kill
use command_group::CommandGroup;

let child = std::process::Command::new("agent-server")
    .args(["--port", "8008"])
    .group_spawn()  // CREATE_NEW_PROCESS_GROUP (Windows)
    .expect("실행 실패");

// 종료 시
child.kill().unwrap();  // 하위 프로세스 전체 종료
```

---

## 5. 포트 동적 할당

```rust
fn find_available_port(preferred: u16) -> Option<u16> {
    for port in preferred..preferred + 100 {
        if std::net::TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok() {
            return Some(port);
        }
    }
    None
}
```

FastAPI에서 포트를 환경변수로 받아도 됨:
```python
import os, uvicorn
port = int(os.getenv("PORT", 8008))
uvicorn.run(app, host="127.0.0.1", port=port)
```

---

## 6. 전체 타임라인

```
T+0ms    앱 실행
T+100ms  Tauri setup 훅 → sidecar spawn
T+500ms  FastAPI uvicorn 시작
T+800ms  /health 응답 성공
T+850ms  프론트엔드 'server_ready' 이벤트 수신
T+900ms  채팅 UI 표시 (사용자 입력 가능)

앱 종료 클릭
T+0ms    RunEvent::ExitRequested
T+10ms   child.kill() → FastAPI 프로세스 종료
T+50ms   앱 완전 종료
```

---

## 핵심 정리

| 시점 | Rust 코드 | 동작 |
|------|-----------|------|
| 앱 시작 | `setup` 훅 | 사이드카 spawn + 헬스체크 |
| 서버 준비 | `emit("server_ready")` | 프론트엔드 UI 활성화 |
| 앱 종료 | `RunEvent::ExitRequested` | `child.kill()` |
| Windows 잔여 프로세스 | `taskkill /PID /F` | 강제 종료 |
