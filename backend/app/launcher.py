"""Start the packaged S.W.A.P. server and open it in the default browser."""
import os
import sys
import threading
import webbrowser
from pathlib import Path


def _application_directory() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[2]


def _open_browser() -> None:
    webbrowser.open("http://127.0.0.1:8000")


def main() -> None:
    application_directory = _application_directory()
    data_directory = Path(os.environ.get("LOCALAPPDATA", application_directory)) / "SWAP"
    data_directory.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{(data_directory / 'classcover.db').as_posix()}")
    os.environ.setdefault("UPLOAD_DIR", str(data_directory / "uploads"))

    import uvicorn
    from app.main import app

    threading.Timer(1.5, _open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=8000)


if __name__ == "__main__":
    main()