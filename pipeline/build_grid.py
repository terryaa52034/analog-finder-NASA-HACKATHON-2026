"""Build a global 0.5-degree grid of Earth surface traits from open NASA data.

Data comes from NASA GIBS (Global Imagery Browse Services), which needs no login.
GIBS serves colour-mapped images; every layer publishes the exact colour -> value
table it used, so each pixel is converted back into a physical value.

Usage:  .venv/bin/python pipeline/build_grid.py
Output: web/data/grid.json
"""

from __future__ import annotations

import io
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache"
OUT = ROOT / "web" / "data" / "grid.json"

WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
COLORMAPS = "https://gibs.earthdata.nasa.gov/colormaps/v1.3/{}.xml"

RES = 0.5                      # output grid, degrees
NLAT, NLON = int(180 / RES), int(360 / RES)
YEAR = 2025
SEASON_MONTHS = [f"{YEAR}-{m:02d}-01" for m in (1, 4, 7, 10)]
ALL_MONTHS = [f"{YEAR}-{m:02d}-01" for m in range(1, 13)]


# ---------------------------------------------------------------- download

def fetch(url: str, dest: Path) -> bytes:
    if dest.exists() and dest.stat().st_size > 0:
        return dest.read_bytes()
    dest.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "analog-finder/0.1"})
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
            dest.write_bytes(data)
            return data
        except Exception as exc:  # network hiccup: back off and retry
            print(f"  retry {attempt + 1} for {dest.name}: {exc}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"failed to download {url}")


def colormap(name: str) -> dict[int, float]:
    """Map packed RGB -> physical value (interval midpoint). No-data colours are left out."""
    xml = fetch(COLORMAPS.format(name), CACHE / "colormaps" / f"{name}.xml").decode()
    table: dict[int, float] = {}
    for m in re.finditer(r"<ColorMapEntry ([^>]*)/>", xml):
        attrs = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
        if attrs.get("nodata") == "true" or "value" not in attrs:
            continue
        lo, hi = attrs["value"].strip("[]()").split(",")
        lo_f = None if "INF" in lo else float(lo)
        hi_f = None if "INF" in hi else float(hi)
        if lo_f is None and hi_f is None:
            continue
        v = hi_f if lo_f is None else lo_f if hi_f is None or hi_f == lo_f else (lo_f + hi_f) / 2
        r, g, b = (int(x) for x in attrs["rgb"].split(","))
        table.setdefault((r << 16) | (g << 8) | b, v)
    return table


def layer(name: str, cmap: str, when: str | None, w: int, h: int) -> np.ndarray:
    """Download one global layer and decode it into a float array (NaN = no data)."""
    params = (f"SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS={name}&CRS=EPSG:4326"
              f"&BBOX=-90,-180,90,180&WIDTH={w}&HEIGHT={h}&FORMAT=image/png")
    if when:
        params += f"&TIME={when}"
    tag = f"{name}_{when or 'static'}_{w}.png"
    png = fetch(f"{WMS}?{params}", CACHE / "layers" / tag)
    rgba = np.asarray(Image.open(io.BytesIO(png)).convert("RGBA"))
    packed = (rgba[..., 0].astype(np.int32) << 16) | (rgba[..., 1].astype(np.int32) << 8) | rgba[..., 2]
    table = colormap(cmap)
    uniq, inv = np.unique(packed, return_inverse=True)
    lut = np.array([table.get(int(c), np.nan) for c in uniq], dtype=np.float64)
    out = lut[inv].reshape(packed.shape)
    out[rgba[..., 3] == 0] = np.nan
    return out


def block(a: np.ndarray, func=np.nanmean, min_valid: float = 0.3) -> np.ndarray:
    """Aggregate a fine grid to the 0.5-degree output grid."""
    f = a.shape[0] // NLAT
    b = a.reshape(NLAT, f, NLON, f).transpose(0, 2, 1, 3).reshape(NLAT, NLON, f * f)
    valid = np.isfinite(b).mean(axis=2)
    with np.errstate(all="ignore"), _quiet():
        out = func(b, axis=2)
    out[valid < min_valid] = np.nan
    return out


class _quiet:
    def __enter__(self):
        import warnings
        self._w = warnings.catch_warnings()
        self._w.__enter__()
        warnings.simplefilter("ignore", RuntimeWarning)

    def __exit__(self, *exc):
        self._w.__exit__(*exc)


def stack(arrays: list[np.ndarray], func) -> np.ndarray:
    with _quiet():
        return func(np.stack(arrays), axis=0)


# ---------------------------------------------------------------- traits

def main() -> None:
    print("Land surface temperature (MODIS Terra, monthly day/night) ...")
    day, night = [], []
    for m in SEASON_MONTHS:
        day.append(block(layer("MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day", "MODIS_Land_Surface_Temp", m, 3600, 1800)) - 273.15)
        night.append(block(layer("MODIS_Terra_L3_Land_Surface_Temp_Monthly_Night", "MODIS_Land_Surface_Temp", m, 3600, 1800)) - 273.15)
    t_max = stack(day, np.nanmax)
    t_min = stack(night, np.nanmin)
    swing = stack([d - n for d, n in zip(day, night)], np.nanmax)
    frozen = stack([(d < 0).astype(float) + np.where(np.isfinite(d), 0, np.nan) for d in day], np.nanmean)

    print("Vegetation (MODIS Terra NDVI, monthly) ...")
    ndvi = stack([block(layer("MODIS_Terra_L3_NDVI_Monthly", "MODIS_L3_NDVI", m, 3600, 1800)) for m in SEASON_MONTHS], np.nanmax)

    print("Precipitation (MERRA-2, monthly) ...")
    rain = stack([layer("MERRA2_Precipitation_Bias_Corrected_Monthly", "MERRA2_Precipitation_Bias_Corrected_Monthly", m, NLON, NLAT)
                  for m in ALL_MONTHS], np.nanmean) * 86400 * 365  # kg/m2/s -> mm/yr

    print("Surface dust (MERRA-2, monthly) ...")
    dust = stack([layer("MERRA2_Dust_Surface_Mass_Concentration_Monthly", "MERRA2_Dust_Surface_Mass_Concentration_Monthly", m, NLON, NLAT)
                  for m in ALL_MONTHS], np.nanmean) * 1e9  # kg/m3 -> ug/m3

    print("Elevation and roughness (ASTER GDEM) ...")
    dem = layer("ASTER_GDEM_Color_Index", "ASTER_GDEM_Color_Index", None, 7200, 3600)
    elev = block(dem, np.nanmean)
    rough = block(dem, np.nanstd)

    # Land cells = land-surface temperature observed in at least two seasons (day or night).
    seen = np.sum([np.isfinite(d) | np.isfinite(n) for d, n in zip(day, night)], axis=0)
    land = (seen >= 2) & np.isfinite(t_max) & np.isfinite(t_min)
    # MODIS NDVI has no value over ice sheets and snow: treat those land cells as bare (0).
    ndvi = np.where(land & ~np.isfinite(ndvi), 0.0, ndvi)
    traits = {
        "t_max": (t_max, 1), "t_min": (t_min, 1), "swing": (swing, 1), "frozen": (frozen, 2),
        "ndvi": (ndvi, 3), "rain": (rain, 0), "dust": (dust, 1), "elev": (elev, 0), "rough": (rough, 0),
    }
    # Terrain may be missing (ASTER GDEM stops at 83 S); every other trait is required.
    for name, (arr, _) in traits.items():
        if name not in ("elev", "rough"):
            land &= np.isfinite(arr)

    def column(a: np.ndarray, digits: int) -> list:
        v = np.round(a.ravel()[idx], digits)
        return [None if not np.isfinite(x) else (int(x) if digits == 0 else float(x)) for x in v]

    idx = np.flatnonzero(land)
    out = {
        "res": RES, "nlat": NLAT, "nlon": NLON, "year": YEAR,
        "idx": idx.tolist(),
        "traits": {k: column(a, d) for k, (a, d) in traits.items()},
        "sources": {
            "t_max/t_min/swing/frozen": "MODIS Terra L3 Land Surface Temperature, monthly day & night (Jan/Apr/Jul/Oct)",
            "ndvi": "MODIS Terra L3 NDVI, monthly (max of Jan/Apr/Jul/Oct)",
            "rain": "MERRA-2 bias-corrected total precipitation, monthly (12-month mean)",
            "dust": "MERRA-2 dust surface mass concentration, monthly (12-month mean)",
            "elev/rough": "ASTER GDEM (mean and standard deviation within each 0.5 deg cell)",
            "access": "NASA GIBS WMS, decoded with the published GIBS colormaps",
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"Wrote {len(idx):,} land cells to {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1e6:.1f} MB)")
    for k, (a, _) in traits.items():
        v = a.ravel()[idx]
        v = v[np.isfinite(v)]
        print(f"  {k:7s} p1={np.percentile(v, 1):9.2f}  median={np.median(v):9.2f}  p99={np.percentile(v, 99):9.2f}")


if __name__ == "__main__":
    main()
