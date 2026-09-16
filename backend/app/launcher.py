"""Start the packaged S.W.A.P. server and open it in the default browser."""
import os
import socket
import sys
import threading
import webbrowser
from pathlib import Path


def _application_directory() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[2]


def _find_free_port(start_port: int = 8000, end_port: int = 8100) -> int:
    for port in range(start_port, end_port + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("No free localhost port available between 8000 and 8100.")


def _open_browser(url: str) -> None:
    webbrowser.open(url)


def main() -> None:
    application_directory = _application_directory()
    data_directory = Path(os.environ.get("LOCALAPPDATA", application_directory)) / "SWAP"
    data_directory.mkdir(parents=True, exist_ok=True)
    target_db = data_directory / "classcover.db"

    # If the user's local database does not exist or is empty, seed it from bundled master db
    if not target_db.exists() or target_db.stat().st_size == 0:
        import shutil
        meipass = getattr(sys, "_MEIPASS", None)
        seed_candidates = []
        if meipass:
            seed_candidates.append(Path(meipass) / "seed_data" / "classcover.db")
        seed_candidates.append(application_directory / "classcover.db")
        seed_candidates.append(Path(__file__).resolve().parents[1] / "classcover.db")

        for seed_path in seed_candidates:
            if seed_path.is_file() and seed_path.stat().st_size > 0:
                try:
                    shutil.copy2(seed_path, target_db)
                    break
                except Exception:
                    pass

    os.environ.setdefault("DATABASE_URL", f"sqlite:///{target_db.as_posix()}")
    os.environ.setdefault("UPLOAD_DIR", str(data_directory / "uploads"))

    port = _find_free_port()
    url = f"http://127.0.0.1:{port}"

    import uvicorn
    from app.main import app

    threading.Timer(1.5, _open_browser, args=(url,)).start()
    uvicorn.run(app, host="127.0.0.1", port=port)


if __name__ == "__main__":
    main()