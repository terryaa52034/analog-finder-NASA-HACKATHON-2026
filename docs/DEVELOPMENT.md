# Development guide

## Structure

| Path                                             | Responsibility                                                  |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `web/app.js`                                     | Earth grid, scoring, map layers, ranked sites, reports and CSV. |
| `web/targets.js`, `web/planetary-targets.js`     | Reference scenarios and evidence labels.                        |
| `web/geography.js`                               | Country lookup and nearest GeoNames reference place.            |
| `web/globe.js`                                   | Interactive Earth globe using the same matching results.        |
| `web/mission-intro.js`, `web/cinematic-intro.js` | Opening controller, camera timeline and orbit transition.       |
| `web/drone-explorer.js`                          | Drone controls and retained session state.                      |
| `web/drone-model.js`                             | Coordinates and simulated capture profiles.                     |
| `web/drone-scene.js`                             | Terrain, craft, flight, cameras and GPU cleanup.                |
| `pipeline/`                                      | Reproducible data and asset preparation.                        |
| `web/data/`, `web/assets/`                       | Bundled datasets and credited imagery.                          |
| `web/vendor/`                                    | Third-party libraries and licence notices.                      |

## Matching

The Earth grid contains 90,701 land cells. Scoring compares traits within Earth's
observed display range, combines similarities using adjustable weights, and
separates top sites by at least 500 km. Values beyond Earth's range seek the closest
terrestrial extreme. Ordinary searches return 15 sites; drone searches return 10.
Colour-decoded values are approximate; seasonal frozen-ground and temperature
proxies do not establish subsurface ice or actual annual extrema.

Nearest-place names refer to the selected GeoNames gazetteer. Beyond 100 km, the
result title uses country/remote context instead of suggesting a distant city is
inside the analysed cell. Exact coordinates remain the location reference.

## Opening and drone lifecycle

The 13.5-second film moves through Moon, Mars, Earth, alignment and a straight
beam, then reuses the renderer for the orbit briefing. The alignment is artistic.
Skipping goes to orbit. Reduced motion and missing WebGL use the briefing fallback.
Exiting disposes temporary render resources. Drone sessions retain captures in
memory until the page refreshes; flight and imagery are simulations.

## Rebuild data

Running the app only needs Python's static server. Rebuilding the Earth grid needs
Python with NumPy and Pillow:

```powershell
python pipeline/build_grid.py
python pipeline/build_places.py
```

The planetary downloader needs Node.js and Playwright/Chromium. See
[PLANETARY_DATA.md](../PLANETARY_DATA.md) for its command, sampling and interpretation.
`web/planetary-profiles.js` is generated; edit the downloader to change retrieval.
Do not hand-edit generated datasets or vendor libraries for formatting.

## Checks and formatting

Start the static server from the repository root. With Playwright installed, run
checks from the parent workspace (screenshot paths expect that directory):

```powershell
# Optional when using an existing Playwright installation:
$env:PLAYWRIGHT_MODULE = 'C:\path\to\node_modules\playwright'
node analog-finder/preview-check.cjs
node analog-finder/planetary-check.cjs
node analog-finder/drone-check.cjs
node analog-finder/layout-check.cjs
node analog-finder/map-bounds-check.cjs
```

Other checks cover place names, design and the cinematic. Screenshots are local
review artifacts and ignored by Git. Prettier formats authored JS, CSS, HTML and
Markdown; generated data, generated profiles and vendor files stay excluded.
