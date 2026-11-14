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

## Mission interface

The opening mission briefing features a Three.js Earth and LUMA. Choose **Start a
drone mission** or **Explore Earth** for a camera zoom into the application; use
**Skip briefing** for an immediate handoff. **Mission briefing** in the top bar
replays the scene without clearing your current target or drone history. Reduced
motion skips the zoom, and a textured Earth fallback works without WebGL. The intro
releases its renderer, animation loop and GPU resources after handoff.

A fresh URL opens on an unselected Earth overview. No Shackleton target or match
overlay is applied automatically. An explicit target URL hash still opens that
target. The mission switcher and featured drone card make Drone Exploration a
primary workflow. Environmental controls expand after choosing a target; map layers
are available from the floating **Map layers** control. **Country labels** uses the
local country boundaries, rather than a tile layer mixing oceans, continents and
other place names.

The web glass treatment follows the separation, rounded geometry, legibility and
motion principles in Apple's [Materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials)
and [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/).
It is a CSS interpretation, not Apple's native platform material. The interface
supports reduced motion, reduced transparency where supported, increased contrast,
and keyboard focus. Styling lives in `web/liquid.css`; `web/mission-intro.js` owns
the disposable intro. Its decorative Earth texture is downloaded directly from
NASA GIBS Blue Marble; its source and hash are in `web/data/provenance.json`.
It is not an analysis dataset.

The design workflow can be checked with `node analog-finder/design-check.cjs`
from the parent workspace using the same Playwright setup described below.
`node analog-finder/layout-check.cjs` additionally checks ten viewport sizes for
overlapping intro content, consistent target card dimensions, map header spacing,
report/control separation, sticky report closing and horizontal overflow. The
responsive layout rules are in `web/layout.css`. Short intro windows scroll instead
of placing the companion over the mission actions.

The interface adds country names and highlighting, ranked map markers, country labels,
NASA satellite and Esri dark basemaps, and all nine measured Earth trait overlays.
The legend shows units and percentile display ranges. Rankings continue to use the
selected target and trait weights, regardless of the visible overlay.

**3D globe** uses the same Earth grid and ranked sites. Drag to orbit, scroll to zoom,
and click a beacon to inspect. WebGL is optional; the 2D map remains available.
LUMA is a local, rule-based guide using `@comfycomputer/agent-mascots` and the current
scores, with no external AI service. Three.js and the mascot are vendored with MIT
licences under `web/vendor/`.

Country boundaries use Natural Earth's public-domain Admin 0 data, directly from
the [Natural Earth distribution](https://github.com/nvkelso/natural-earth-vector).
Coastal and border cells can be ambiguous at this resolution.
Map tiles and fonts require internet access.

Results name the nearest recorded city/town, with its state/region, country and
distance from the analysed grid cell. Names use a local GeoNames cities15000 extract
under CC BY 4.0; no reverse-geocoding API or account is required. This is a reference
location, not a claim that the cell lies inside the named city/state. It is the
closest place in this selected gazetteer, which excludes many small settlements.
Remote sites can be hundreds or thousands of kilometres from a recorded city.
CSV exports preserve exact cell coordinates and include reference city/admin,
country, distance and GeoNames ID. Rebuild with `python pipeline/build_places.py`.

## Audit and attribution

[CHALLENGE_AUDIT.md](CHALLENGE_AUDIT.md) records actual API use, cached versus live
data, scientific gaps, and the limits of checking the official challenge tabs.
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) records third-party software/data
and the supplied baseline repository's unresolved root licence. This application
must not be described as entirely original, copyright-free or fully scientifically
validated. The current direct NASA image and boundary source hashes are recorded
in `web/data/provenance.json`.

Optional browser smoke check: with Playwright installed and the server running,
run `node analog-finder/preview-check.cjs` from the parent workspace.
Set `PLAYWRIGHT_MODULE` to an absolute installed Playwright path if needed.

## Drone Exploration

Open **Drone Exploration** in the top bar (or **Explore with drone** in a selected
Earth site's report). Select the lunar thruster craft or Mars rotorcraft, a scenario
region, and a deployment coordinate on the schematic planetary planner. You can
enter exact latitude/longitude instead. The planner is a coordinate selector, not
orbital imagery; preset anchors are approximate regional positions.

1. **Launch Drone** and wait for hover. Hold WASD / arrow keys or the on-screen
   direction buttons to fly. Q/E or −/+ change altitude. Drag to orbit the view.
2. Switch between third-person, first-person and downward cameras. The inset is
   a separate downward camera rendered in the same WebGL context.
3. **Capture Image** saves a real render of the procedural terrain, the drone's
   planetary coordinates, simulated relative elevation, temperature, 55 km terrain
   relief, and a timestamp displayed in Singapore time.
4. **Find Earth Analogues** passes a capture profile through the existing weighted
   similarity matcher and spatial separation rules, returning **10** Earth sites.
   The existing map, trait reports, overlays and CSV export show those results.
5. Reopen Drone Exploration to resume either planet, inspect earlier frames, return
   to base, or redisplay the last search. The flight recorder retains up to 20 frames
   in memory for the current tab; refreshing the page clears it.

**Data provenance:** the terrain, images, flight physics, relative elevation and
instantaneous temperature are simulated. No planetary telemetry, DEM service,
computer vision model, or analogue API exists in this static repository. The feature
therefore reuses the actual local matcher and NASA Earth grid. Capture profiles use
the selected scenario's approximate climate assumptions plus procedural terrain
standard deviation sampled over a 55 km window. The instantaneous simulated
temperature is informational, not substituted for day/night climate extremes.
Relative planetary elevation is not compared to Earth's altitude datum; the existing
thin-air proxy remains explicit. Climate assumptions are not verified at arbitrary
planner coordinates. Images are not used to infer environmental values.

Coordinates follow the chosen body's spherical radius and a great-circle displacement
from the deployment anchor. They remain valid at poles and across the date line.
An Earth map selection can be attached as a **comparison reference**, and is never
reinterpreted as a Moon/Mars location or used to convert planetary coordinates to
Earth search results. Select the actual planetary deployment position in the planner.

Implementation: `web/drone-model.js` owns coordinates and capture profiles;
`web/drone-scene.js` owns Three.js terrain, craft, cameras, flight and GPU cleanup;
`web/drone-explorer.js` owns controls and retained mission state; `web/drone.css`
extends the current design. `web/app.js` connects capture profiles to the matcher.
Closing the mode disposes animation loops, listeners, render targets, geometries,
materials, shadows, observers and the renderer. The Earth globe pauses during flight.
Unavailable WebGL leaves the Earth interface usable; capture/search errors retain
the flight recorder and offer a retry.

Run with the same static server: `python -m http.server 8765 --bind 127.0.0.1 --directory web`
from this repository, then open `http://localhost:8765`. No new installation or keys
are needed. With Playwright available, run `node analog-finder/drone-check.cjs` from
the parent workspace for both complete mission workflows and coordinate/error checks.

## Earth matching pipeline

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
