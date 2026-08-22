from datetime import datetime
from pathlib import Path
import shutil


BACKEND_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BACKEND_DIR / "classcover.db"
UPLOADS_PATH = BACKEND_DIR / "uploads"
BACKUPS_PATH = BACKEND_DIR / "backups"
MAX_BACKUPS = 30


def main():
    if not DATABASE_PATH.is_file():
        raise FileNotFoundError(f"Database not found: {DATABASE_PATH}")

    BACKUPS_PATH.mkdir(exist_ok=True)
    backup_name = datetime.now().strftime("%Y-%m-%d_%H%M")
    backup_dir = BACKUPS_PATH / backup_name
    suffix = 1
    while backup_dir.exists():
        backup_dir = BACKUPS_PATH / f"{backup_name}_{suffix:02d}"
        suffix += 1

    backup_dir.mkdir()
    shutil.copy2(DATABASE_PATH, backup_dir / DATABASE_PATH.name)
    if UPLOADS_PATH.is_dir():
        shutil.copytree(UPLOADS_PATH, backup_dir / UPLOADS_PATH.name)
    else:
        (backup_dir / UPLOADS_PATH.name).mkdir()

    backups = sorted((path for path in BACKUPS_PATH.iterdir() if path.is_dir()), key=lambda path: path.name)
    for old_backup in backups[:-MAX_BACKUPS]:
        shutil.rmtree(old_backup)

    print(f"Backup created: {backup_dir}")


if __name__ == "__main__":
    main()
