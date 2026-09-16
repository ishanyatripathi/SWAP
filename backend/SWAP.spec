from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_submodules


backend_dir = Path(SPECPATH)
frontend_dist = backend_dir.parent / "frontend" / "dist"
pdf_datas, pdf_binaries, pdf_hiddenimports = collect_all("pdfplumber")
hiddenimports = pdf_hiddenimports + collect_submodules("uvicorn")


a = Analysis(
    [str(backend_dir / "app" / "launcher.py")],
    pathex=[str(backend_dir)],
    binaries=pdf_binaries,
    datas=pdf_datas + [(str(frontend_dist), "frontend/dist")],
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