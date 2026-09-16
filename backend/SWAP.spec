from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_submodules


backend_dir = Path(SPECPATH)
project_root = backend_dir.parent
frontend_dist = project_root / "frontend" / "dist"
timetables_dir = project_root / "Timetables"
seed_db = backend_dir / "classcover.db"

pdf_datas, pdf_binaries, pdf_hiddenimports = collect_all("pdfplumber")
hiddenimports = pdf_hiddenimports + collect_submodules("uvicorn")


a = Analysis(
    [str(backend_dir / "app" / "launcher.py")],
    pathex=[str(backend_dir)],
    binaries=pdf_binaries,
    datas=pdf_datas + [
        (str(frontend_dist), "frontend/dist"),
        (str(seed_db), "seed_data"),
        (str(timetables_dir), "Timetables"),
    ],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="SWAP",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)