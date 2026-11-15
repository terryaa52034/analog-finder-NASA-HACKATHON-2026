# Third-party code, imagery and data

This application includes the software, data and imagery credited below.
Third-party licences remain with their respective owners.

## Distributed libraries

| Component                                    | Source and licence                                   | Retained notice                  |
| -------------------------------------------- | ---------------------------------------------------- | -------------------------------- |
| Three.js                                     | https://github.com/mrdoob/three.js — MIT             | `web/vendor/THREE-LICENSE.txt`   |
| agent-mascots, by Kyle Oliveiro/contributors | https://github.com/comfycomputer/agent-mascots — MIT | `web/vendor/MASCOT-LICENSE.txt`  |
| Leaflet, loaded from cdnjs                   | https://github.com/Leaflet/Leaflet — BSD-2-Clause    | `web/vendor/LEAFLET-LICENSE.txt` |

Three.js and agent-mascots are vendored with their original licence notices.
LUMA configures the mascot library as a local guide. The application extends the
supplied repository, https://github.com/sufi4414/analog-finder . The Lunaris interface
was a design reference; no scientific backend from that project is used here.

## Country boundaries

`web/data/countries.geo.json` now comes directly from the Natural Earth vector
distribution, 1:110m Admin 0 countries:
https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson .
Geometry is retained; properties are normalized to a display name and ISO codes.
Natural Earth states that its map data is public domain:
https://www.naturalearthdata.com/about/terms-of-use/ .

## City and state/region names

GeoNames, https://www.geonames.org/ — Creative Commons Attribution 4.0:
https://creativecommons.org/licenses/by/4.0/ . Source files:
https://download.geonames.org/export/dump/cities15000.zip ,
https://download.geonames.org/export/dump/admin1CodesASCII.txt ,
https://download.geonames.org/export/dump/countryInfo.txt .

`pipeline/build_places.py` selects coordinates, place names, first-level admin
names, country codes and GeoNames IDs into `web/data/places.json`. Alternate names
and other unused fields are omitted. Source hashes and build time are in that file.
Names and nearest-place distances are reference information. Administrative names
describe the reference city; a remote grid cell may be outside that jurisdiction.
The source is a selected gazetteer, not every settlement in the world.

## Earth imagery and environmental data

NASA GIBS / Blue Marble Shaded Relief and Bathymetry supplies the live satellite
basemap and decorative intro Earth. The intro image was downloaded directly from
NASA WMS; its URL and SHA-256 are in `web/data/provenance.json`.
NASA GIBS service documentation: https://nasa-gibs.github.io/gibs-api-docs/ .

The bundled Earth grid declares NASA MODIS Terra L3, NASA GMAO MERRA-2, and
NASA/METI ASTER GDEM via GIBS colour-mapped visualizations. Their respective dataset
credits remain applicable. WMS imagery and MODIS colormap access were checked; the bundled Earth grid was
not regenerated during submission preparation. NASA media
guidance: https://www.nasa.gov/nasa-brand-center/images-and-media/ . NASA-origin
media, third-party data, NASA names and marks have different applicable terms;
neither the software licence nor this notice grants NASA endorsement.

The optional dark basemap is streamed from Esri with the provider's required
attribution (Esri, HERE, Garmin, OpenStreetMap contributors). Streaming tiles does
not relicense them under the application's source licence. See
https://www.esri.com/en-us/legal/terms/full-master-agreement .

## Typography and design references

DM Sans and Space Grotesk are loaded through Google Fonts, with system fallbacks.
The fonts are distributed under SIL Open Font License 1.1; their upstream source
and licence files are at https://github.com/google/fonts/tree/main/ofl/dmsans and
https://github.com/google/fonts/tree/main/ofl/spacegrotesk . No Apple font, icon,
logo, product screenshot or proprietary Liquid Glass implementation was copied.
Apple's public material/motion guidance informed the CSS design direction:
https://developer.apple.com/design/human-interface-guidelines/materials .

## Simulation and scientific claims

Drone geometry, terrain and animations are procedural demonstration code.
The retained Orbit view's Moon/Mars textures and orbital light/trail are authored
procedural illustrations. The new cinematic uses the separately credited texture
pack below. Both trajectories are decorative rather than physical ephemerides.
Captured pictures and instantaneous telemetry are simulations. Cabeus/Gale profiles
now use documented NASA evidence with labelled simulated/assumed missing traits;
the other three profiles remain approximate presets. No profile is live telemetry.
Similarity is a research/demo heuristic, not proof of landing safety, resource
availability, permission to visit, or a scientifically validated new analogue.

## Cinematic planetary maps and bloom addons

Solar System Scope textures by INOVE, https://www.solarsystemscope.com/textures/ ,
distributed under Creative Commons Attribution 4.0 International:
https://creativecommons.org/licenses/by/4.0/ . Downloaded original 2048×1024 JPEGs:

- `web/assets/moon.jpg`: https://www.solarsystemscope.com/textures/download/2k_moon.jpg
- `web/assets/mars.jpg`: https://www.solarsystemscope.com/textures/download/2k_mars.jpg
- `web/assets/earth-clouds.jpg`: https://www.solarsystemscope.com/textures/download/2k_earth_clouds.jpg

The source describes NASA-derived imagery/elevation, tuned colour and some filled
terrain gaps. These are rendered illustrations, not primary mission DEM products.
Files are retained as downloaded. Runtime changes: spherical projection, lighting,
texture-contrast bump shading, a small authored surface perturbation, cloud alpha,
atmosphere, pulses and colour processing. These changes do not create measured
planetary terrain or change the Earth analogue matcher. The Earth day map remains
the separately credited direct NASA GIBS image. Asset hashes are recorded in
`web/assets/cinematic-assets.json`.

The MIT Three.js r172 addon modules under `web/vendor/addons/` implement
EffectComposer, RenderPass, UnrealBloomPass, OutputPass and their dependencies.
They come from the installed Three.js distribution with source headers retained
and the existing `web/vendor/THREE-LICENSE.txt`. `pipeline/vendor_postprocessing.py`
copies just their dependency closure. An import map resolves `three` to the same
vendored r172 module; no CDN or new runtime package is required.

## Cabeus and Gale planetary evidence (15 November 2026)

Credit NASA / LRO / Diviner team (UCLA), NASA / GSFC / MGS MOLA team,
NASA / JPL-Caltech / Curiosity REMS team, and the PDS Geosciences Node at
Washington University in St. Louis. PDS ODE feature records derive from USGS
planetary feature information. Exact product URLs, versions, units, time coverage,
datums, sampling changes and interpretation are documented in `PLANETARY_DATA.md`.
Retrieved subset coordinates, elevations and response hashes are preserved in
`web/data/planetary-evidence.json`. Temperature values for Gale come from NASA's
published REMS summary; the raw REMS time series was not downloaded. Cabeus PRP
temperatures are scientific model products, not direct measured extrema.
Simulation and assumptions are identified separately in `web/planetary-targets.js`
and the UI. These data additions do not change the licensing status of the
original project or third-party software.

## AI assistance disclosure

OpenAI ChatGPT/Codex assisted with research, interface design, code implementation
and formatting, debugging, automated checks, documentation, presentation planning,
and scripts for capturing screenshots and GIFs. These captures show the running
application rather than AI-generated representations of its interface.

AI assistance does not establish scientific validity or replace the dataset
sources credited above. Simulated and assumed planetary conditions remain
labelled separately from retrieved evidence. LUMA uses local rules and application
state; no external language-model API powers LUMA or the analogue matcher.
