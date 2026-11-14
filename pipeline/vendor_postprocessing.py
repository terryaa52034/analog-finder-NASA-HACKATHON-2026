"""Copy the required Three.js addon closure from an installed matching version.

Usage: python pipeline/vendor_postprocessing.py PATH/TO/node_modules/three
Original MIT copyright/license headers are preserved. No package installation.
"""
import re
import shutil
import sys
from pathlib import Path

source = Path(sys.argv[1]).resolve() / 'examples/jsm'
destination = Path(__file__).resolve().parent.parent / 'web/vendor/addons'
seen = set()


def copy(relative):
    path = (source / relative).resolve()
    path.relative_to(source)
    if path in seen:
        return
    seen.add(path)
    output = destination / path.relative_to(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, output)
    for dependency in re.findall(r"from\s+['\"]([^'\"]+)['\"]", path.read_text(encoding='utf-8')):
        if dependency.startswith('.'):
            copy((path.parent / dependency).relative_to(source))


for name in ['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'OutputPass']:
    copy(Path('postprocessing') / (name + '.js'))
print(f'Vendored {len(seen)} Three.js addon modules; retain web/vendor/THREE-LICENSE.txt.')
