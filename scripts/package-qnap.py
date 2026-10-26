"""Build NAS install/update packages from explicitly selected public files only."""
import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile
from zipfile import ZipFile, ZIP_DEFLATED

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--update', action='store_true', help='Only dashboard files; no Home Assistant configuration')
parser.add_argument('--output', type=Path, help='Output ZIP path')
args = parser.parse_args()
repo = Path(__file__).resolve().parent.parent
output = args.output or Path('/workspace/scratch') / ('HomeHub-QNAP-aggiornamento-Colonne.zip' if args.update else 'HomeHub-QNAP.zip')
output = output.resolve()
output.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='homehub-qnap-', dir=output.parent) as temp:
    root = Path(temp) / 'homehub'
    config = root / 'config'
    web = config / 'www' / 'homehub'
    web.mkdir(parents=True)
    source = repo / 'integrations' / 'home-assistant'
    if args.update:
        shutil.copy2(source / 'AGGIORNAMENTO.md', root / 'LEGGIMI.md')
    else:
        packages = config / 'packages'
        packages.mkdir(parents=True)
        shutil.copy2(source / 'configuration.example.yaml', config / 'configuration.yaml')
        shutil.copy2(source / 'homehub.yaml', packages / 'homehub.yaml')
        shutil.copy2(source / 'compose.yaml', root / 'compose.yaml')
        shutil.copy2(source / 'README.md', root / 'LEGGIMI.md')
        shutil.copy2(source / 'AGGIORNAMENTO.md', root / 'AGGIORNAMENTO.md')
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
    if args.update:
        assert all(name == 'homehub/LEGGIMI.md' or name.startswith('homehub/config/www/homehub/') for name in names)
        assert not any(name.endswith(('.yaml', '.yml')) for name in names)
    else:
        assert 'homehub/config/packages/homehub.yaml' in names
    assert not any('.storage' in name or 'credentials' in name or name.endswith(('.key', '.pem')) for name in names)
print(f'Pacchetto QNAP verificato: {output.name}, {len(names)} file, {output.stat().st_size} byte')
