# Analog Finder

**NASA Space Apps Challenge 2026: Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars**

Analog Finder searches the whole Earth for places that match conditions at real Moon and Mars sites,
**trait by trait**. Instead of asking "does this look like Mars?", it scores each Earth location on
temperature extremes, day–night swing, frozen ground, plant cover, rainfall, dust, altitude and terrain
relief. For each location it shows:

- **what matches** (✓ Strong / ~ Partial / ✗ Weak for each trait)
- **what it is good for testing** (for example dust mitigation, cold survival or rover driving)
- **where the analogy breaks down**, including what Earth can never reproduce (gravity, vacuum, radiation)

Well-known analog sites (Atacama, Devon Island, the Dry Valleys and others) can be hidden, so the
results point to places that have received less attention.

## Targets

| Body | Site | Why it matters |
|---|---|---|
| Moon | Shackleton crater rim | South-pole region considered for Artemis bases; possible water ice |
| Moon | Mare Tranquillitatis | Flat equatorial basalt plains (Apollo 11) |
| Mars | Jezero crater | Ancient lake delta explored by Perseverance |
| Mars | Utopia Planitia | Ice-rich northern plains (Zhurong) |
| Mars | Valles Marineris | Giant canyon system with deep exposed layers |

Target values in `web/targets.js` are **approximate** figures from mission results (LRO Diviner,
LOLA, Perseverance MEDA, MRO SHARAD and others). Check them and cite exact sources in your write-up.

## Run it

```bash
python3 -m venv .venv && .venv/bin/pip install numpy pillow
.venv/bin/python pipeline/build_grid.py      # downloads NASA data (~30 MB, cached) and writes web/data/grid.json
python3 -m http.server 8765 --directory web  # then open http://localhost:8765
```

`web/` is a static site, so it can be hosted anywhere (for example GitHub Pages or Netlify).

## How it works

1. **Earth data** (`pipeline/build_grid.py`). The pipeline downloads global monthly layers for 2025
   from NASA GIBS, which needs no login. GIBS serves coloured images, but each layer publishes its
   exact colour-to-value table, so every pixel is converted back to a physical value. The data is
   then averaged onto a 0.5° grid (about 55 km cells, roughly 90,000 land cells).
2. **Scoring** (`web/app.js`). For each trait the app compares each Earth cell with the target's
   value, on the range Earth actually has. If the Moon or Mars is more extreme than anywhere on
   Earth (a 290 °C day–night swing, for example), Earth's most extreme places count as the best
   available match, and the report card says so. Trait scores are combined using the weights you set.
3. **Results.** The top 15 locations are spread at least 500 km apart, so one desert can't fill the
   whole list. Results can be downloaded as CSV.

## Data sources

| Trait | Dataset (via NASA GIBS) |
|---|---|
| Daytime / night-time ground temperature, day–night swing, frozen ground | MODIS Terra L3 Land Surface Temperature, monthly (Jan, Apr, Jul, Oct 2025) |
| Plant cover | MODIS Terra L3 NDVI, monthly |
| Rainfall | MERRA-2 bias-corrected precipitation, monthly (2025 mean) |
| Airborne dust | MERRA-2 dust surface mass concentration, monthly (2025 mean) |
| Altitude, terrain relief | ASTER GDEM (cell mean and standard deviation; no coverage south of 83° S) |
| Basemap | NASA Blue Marble shaded relief (GIBS) |

## Known limitations (MVP)

- Values are decoded from colour-mapped images, so precision is limited to each colormap's bins.
- A 0.5° cell is about 55 km across. Small features such as single craters, lava tubes or caves are below this resolution.
- Rock type and mineralogy are not included yet. Adding a global lithology map would separate volcanic and basalt analogs.
- Only one year (2025) and four months of temperature data are used.
- Target values are rounded literature figures, not computed from Moon and Mars datasets.

## Ideas for next steps

- Add rock type (for example the GLiM global lithology map) and compare with lunar mare and Mars geology maps.
- Compute target traits directly from PDS data (Diviner, LOLA, MOLA, THEMIS) instead of hand-entered values.
- Zoom in on the top results at higher resolution (Copernicus DEM 30 m, Sentinel-2) to find specific field sites.
- Add Earth processes such as dust-storm frequency or permafrost thaw as analogs for Mars processes.

## Licence and credits

Code: add a licence of your choice (for example MIT or Apache-2.0).
Data: NASA GIBS, MODIS (NASA LP DAAC), MERRA-2 (NASA GMAO), ASTER GDEM (NASA/METI). NASA data is
openly available. Credit the datasets above in your submission.
