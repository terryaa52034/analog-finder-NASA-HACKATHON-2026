"""Build a compact, attributed offline GeoNames city/admin gazetteer.

Uses cities15000 (cities >15k population OR administrative capitals), not every
settlement. Nearest place names are reference points, not cell containment claims.
Run: python pipeline/build_places.py
"""
import hashlib
import json
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'cache' / 'places'
BASE = 'https://download.geonames.org/export/dump/'


def fetch(name):
    path = CACHE / name
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(BASE + name, path)
    return path


def main():
    files = {name: fetch(name) for name in ['cities15000.zip', 'admin1CodesASCII.txt', 'countryInfo.txt']}
    admins = {}
    for line in files['admin1CodesASCII.txt'].read_text(encoding='utf-8').splitlines():
        parts = line.split('\t')
        if len(parts) >= 4:
            admins[parts[0]] = parts[1]
    countries = {}
    for line in files['countryInfo.txt'].read_text(encoding='utf-8').splitlines():
        if line and not line.startswith('#'):
            parts = line.split('\t')
            countries[parts[0]] = parts[4]
    places = []
    with zipfile.ZipFile(files['cities15000.zip']) as archive:
        for line in archive.read('cities15000.txt').decode('utf-8').splitlines():
            p = line.split('\t')
            if len(p) >= 19 and p[6] == 'P' and p[7] not in {'PPLX', 'PPLQ', 'PPLW', 'PPLH'}:
                places.append([round(float(p[4]), 5), round(float(p[5]), 5), p[1],
                               admins.get(p[8] + '.' + p[10], ''), p[8], int(p[0])])
    output = {
        'source': 'GeoNames cities15000 + admin1CodesASCII + countryInfo',
        'source_url': BASE,
        'license': 'CC BY 4.0', 'attribution': 'GeoNames — https://www.geonames.org/',
        'built_at': datetime.now(timezone.utc).isoformat(),
        'sha256': {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in files.items()},
        'fields': ['lat', 'lon', 'name', 'admin1', 'country_code', 'geoname_id'],
        'coverage': 'cities above 15000 population and administrative capitals; excludes urban sections and historical/abandoned places; not all settlements',
        'countries': countries, 'places': places,
    }
    destination = ROOT / 'web' / 'data' / 'places.json'
    destination.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Built {len(places):,} recorded places ({destination.stat().st_size:,} bytes).')


if __name__ == '__main__':
    main()
