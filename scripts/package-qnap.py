"""Build a NAS package from public, explicitly selected files only."""
from pathlib import Path
import shutil
import subprocess
import tempfile
from zipfile import ZipFile, ZIP_DEFLATED

repo = Path(__file__).resolve().parent.parent
output = Path('/workspace/scratch/HomeHub-QNAP.zip')
output.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='homehub-qnap-', dir=output.parent) as temp:
    root = Path(temp) / 'homehub'
    config = root / 'config'
    web = config / 'www' / 'homehub'
    packages = config / 'packages'
    packages.mkdir(parents=True)
    source = repo / 'integrations' / 'home-assistant'
    shutil.copy2(source / 'configuration.example.yaml', config / 'configuration.yaml')
    shutil.copy2(source / 'homehub.yaml', packages / 'homehub.yaml')
    shutil.copy2(source / 'compose.yaml', root / 'compose.yaml')
    shutil.copy2(source / 'README.md', root / 'LEGGIMI.md')
    subprocess.run(['npm', 'run', 'build', '--', '--base=/local/homehub/', '--outDir=' + str(web)], cwd=repo, check=True)
    assert '/local/homehub/assets/' in (web / 'index.html').read_text()
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        for file in sorted(root.rglob('*')):
            if file.is_file():
                archive.write(file, file.relative_to(root.parent))
with ZipFile(output) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert 'homehub/config/www/homehub/index.html' in names
    assert 'homehub/config/packages/homehub.yaml' in names
    assert not any('.storage' in name or 'credentials' in name or name.endswith(('.key', '.pem')) for name in names)
print(f'Pacchetto QNAP verificato: {output.name}, {len(names)} file, {output.stat().st_size} byte')
