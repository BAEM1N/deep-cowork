"""
PyInstaller build script for DeepCoWork agent server.

Usage:
    python bundle.py                  # Build for current platform
    python bundle.py --platform all   # Instructions for cross-platform

Output: dist/agent-server (single executable)
Place in app/src-tauri/binaries/agent-server-{target-triple}
"""
import subprocess
import sys
import platform


def get_target_triple() -> str:
    """Get Rust-style target triple for current platform."""
    system = platform.system()
    machine = platform.machine().lower()

    if system == "Darwin":
        arch = "aarch64" if machine == "arm64" else "x86_64"
        return f"{arch}-apple-darwin"
    elif system == "Linux":
        return "x86_64-unknown-linux-gnu"
    elif system == "Windows":
        return "x86_64-pc-windows-msvc"
    else:
        return f"{machine}-unknown-{system.lower()}"


def build():
    target = get_target_triple()
    exe_suffix = ".exe" if platform.system() == "Windows" else ""
    output_name = f"agent-server-{target}{exe_suffix}"

    print(f"Building agent-server for {target}...")
    print(f"Output: {output_name}")

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--name", f"agent-server-{target}",
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan.on",
        "--hidden-import", "aiosqlite",
        "--hidden-import", "langchain_anthropic",
        "--hidden-import", "langchain_openai",
        "--hidden-import", "deepagents",
        "--hidden-import", "deepagents.backends",
        "--hidden-import", "deepagents.middleware",
        "--collect-submodules", "deepagents",
        "--collect-submodules", "langgraph",
        "--collect-submodules", "langchain_core",
        "main.py",
    ]

    result = subprocess.run(cmd, cwd=".")
    if result.returncode != 0:
        print("Build failed!")
        sys.exit(1)

    # Copy to Tauri binaries dir
    import shutil
    from pathlib import Path

    src = Path(f"dist/agent-server-{target}{exe_suffix}")
    dst_dir = Path("../app/src-tauri/binaries")
    dst_dir.mkdir(parents=True, exist_ok=True)
    dst = dst_dir / output_name

    if src.exists():
        shutil.copy2(src, dst)
        print(f"\nCopied to {dst}")
        print(f"Size: {dst.stat().st_size // (1024*1024)}MB")
    else:
        print(f"ERROR: {src} not found")
        sys.exit(1)

    print(f"\nDone! Tauri will bundle this as sidecar 'agent-server'")


if __name__ == "__main__":
    build()
