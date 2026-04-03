use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

struct SidecarState {
    child: Arc<Mutex<Option<CommandChild>>>,
    port: Arc<Mutex<u16>>,
}

fn find_available_port(preferred: u16) -> u16 {
    for port in preferred..preferred + 100 {
        if std::net::TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok() {
            return port;
        }
    }
    preferred
}

async fn wait_for_health(port: u16, max_retries: u32) -> Result<(), String> {
    let client = reqwest::Client::new();
    let url = format!("http://127.0.0.1:{}/health", port);
    for i in 0..max_retries {
        if let Ok(res) = client.get(&url).send().await {
            if res.status().is_success() {
                return Ok(());
            }
        }
        println!("[Tauri] 서버 대기 중... ({}/{})", i + 1, max_retries);
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
    Err(format!("{}초 안에 서버가 응답하지 않았습니다", max_retries / 2))
}

fn spawn_python(app: &tauri::AppHandle, port: u16) -> Result<CommandChild, String> {
    // 개발: `uv run python main.py` (agent/ 디렉토리 기준)
    // 배포: sidecar("agent-server") — PyInstaller 바이너리
    #[cfg(debug_assertions)]
    {
        // 프로젝트 루트에서 agent/ 경로 계산
        let agent_dir = std::env::current_exe()
            .ok()
            .and_then(|p| {
                // exe: app/src-tauri/target/debug/app  (5 levels under project root)
                // 5 parents → 2026_99_삼성전자MX_Cowork/
                p.parent()?.parent()?.parent()?.parent()?.parent()
                    .map(|root| root.join("agent"))
            })
            .unwrap_or_else(|| std::path::PathBuf::from("../../agent"));

        println!("[Tauri] Python 실행 경로: {:?}", agent_dir);

        let (_, child) = app
            .shell()
            .command("uv")
            .args(["run", "python", "main.py"])
            .env("PORT", port.to_string())
            .current_dir(&agent_dir)
            .spawn()
            .map_err(|e| format!("uv run 실패: {e}"))?;

        Ok(child)
    }

    #[cfg(not(debug_assertions))]
    {
        // 배포: PyInstaller로 빌드된 바이너리를 사이드카로 실행
        let (_, child) = app
            .shell()
            .sidecar("agent-server")
            .map_err(|e| format!("사이드카 없음: {e}"))?
            .args(["--port", &port.to_string()])
            .spawn()
            .map_err(|e| format!("사이드카 실행 실패: {e}"))?;

        Ok(child)
    }
}

#[tauri::command]
fn get_agent_port(state: tauri::State<'_, SidecarState>) -> u16 {
    *state.port.lock().unwrap()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let child_arc = Arc::new(Mutex::new(Option::<CommandChild>::None));
    let port_arc = Arc::new(Mutex::new(8008u16));

    let child_for_exit = child_arc.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState {
            child: child_arc,
            port: port_arc,
        })
        .setup(|app| {
            let handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                let port = find_available_port(8008);
                {
                    let state = handle.state::<SidecarState>();
                    *state.port.lock().unwrap() = port;
                }

                // Python 프로세스 실행
                match spawn_python(&handle, port) {
                    Ok(child) => {
                        let state = handle.state::<SidecarState>();
                        *state.child.lock().unwrap() = Some(child);
                        println!("[Tauri] Python 서버 시작됨 (포트 {})", port);
                    }
                    Err(e) => {
                        eprintln!("[Tauri] Python 실행 실패: {}", e);
                        let _ = handle.emit("server_error", e);
                        return;
                    }
                }

                // 준비될 때까지 대기
                match wait_for_health(port, 60).await {
                    Ok(()) => {
                        println!("[Tauri] 에이전트 서버 준비 완료 ✓");
                        let _ = handle.emit("server_ready", port);

                        // 주기적 헬스체크 — 에이전트 크래시 감지
                        let monitor_handle = handle.clone();
                        let monitor_port = port;
                        tauri::async_runtime::spawn(async move {
                            let client = reqwest::Client::new();
                            let url = format!("http://127.0.0.1:{}/health", monitor_port);
                            loop {
                                tokio::time::sleep(std::time::Duration::from_secs(10)).await;
                                match client.get(&url)
                                    .timeout(std::time::Duration::from_secs(5))
                                    .send()
                                    .await
                                {
                                    Ok(res) if res.status().is_success() => {}
                                    _ => {
                                        eprintln!("[Tauri] 에이전트 헬스체크 실패");
                                        let _ = monitor_handle.emit("agent_crashed", "에이전트 서버가 응답하지 않습니다");
                                        break;
                                    }
                                }
                            }
                        });
                    }
                    Err(e) => {
                        eprintln!("[Tauri] 헬스체크 실패: {}", e);
                        let _ = handle.emit("server_error", e);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_agent_port])
        .build(tauri::generate_context!())
        .expect("앱 빌드 실패")
        .run(move |_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                if let Some(child) = child_for_exit.lock().unwrap().take() {
                    let pid = child.pid();
                    // SIGTERM 먼저 전송 → 2초 대기 → SIGKILL (graceful shutdown)
                    #[cfg(unix)]
                    {
                        let _ = std::process::Command::new("kill")
                            .args(["-15", &pid.to_string()])
                            .output();
                        std::thread::sleep(std::time::Duration::from_millis(2000));
                    }
                    let _ = child.kill();
                    println!("[Tauri] Python 서버 종료됨 (pid={})", pid);
                }
            }
        });
}
