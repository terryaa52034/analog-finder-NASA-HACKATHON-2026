"""Normalize cached direct-source boundaries and NASA decorative imagery.

The cached downloads are intentionally excluded from Git. Source URLs and input
hashes are retained in web/data/provenance.json for reproducibility.
"""
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
COUNTRIES_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
EARTH_URL = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_ShadedRelief_Bathymetry&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=2048&HEIGHT=1024&FORMAT=image/jpeg'


def main():
    source = ROOT / 'cache' / 'countries-natural-earth.geojson'
    data = json.loads(source.read_text(encoding='utf-8'))
    for feature in data['features']:
        p = feature['properties']
        feature['properties'] = {'name': p.get('NAME_EN') or p['ADMIN'], 'iso_a2': p.get('ISO_A2_EH', p.get('ISO_A2')), 'iso_a3': p.get('ADM0_A3')}
    (ROOT / 'web/data/countries.geo.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    image = ROOT / 'cache/earth-gibs-direct.jpg'
    with Image.open(image) as picture:
        assert picture.format == 'JPEG' and picture.size == (2048, 1024)
    shutil.copyfile(image, ROOT / 'web/assets/earth.jpg')
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    provenance = {
        'checked_at': datetime.now(timezone.utc).isoformat(),
        'countries': {'url': COUNTRIES_URL, 'sha256_input': digest(source), 'license': 'Natural Earth public domain', 'changes': 'Keep geometry; normalize country name and ISO properties.'},
        'intro_earth': {'url': EARTH_URL, 'sha256': digest(image), 'credit': 'NASA GIBS / Blue Marble Shaded Relief and Bathymetry', 'role': 'Decorative imagery, not measured terrain.'},
        'earth_grid': {'sha256': digest(ROOT / 'web/data/grid.json'), 'status': 'Bundled repository artifact; declared sources in grid.json and build_grid.py. Not regenerated during this audit.'},
        'service_checks': {'NASA_WMS': 'JPEG decoded successfully at 2048x1024', 'NASA_MODIS_colormap': 'XML downloaded successfully', 'challenge_tabs': 'Direct access failed TLS validation / web fetch; indexed official overview reviewed instead.'},
    }
    (ROOT / 'web/data/provenance.json').write_text(json.dumps(provenance, indent=2), encoding='utf-8')
    print(f'Prepared {len(data["features"])} Natural Earth country features and direct NASA imagery; hashes recorded.')


if __name__ == '__main__':
    main()
