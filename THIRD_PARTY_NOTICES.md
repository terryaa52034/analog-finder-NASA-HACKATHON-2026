# Third-party code, imagery and data

Audited 2026-11-14. This application includes third-party material. It is not a
claim of entirely original or copyright-free software.

## Distributed libraries

| Component | Source and licence | Retained notice |
| --- | --- | --- |
| Three.js | https://github.com/mrdoob/three.js — MIT | `web/vendor/THREE-LICENSE.txt` |
| agent-mascots, by Kyle Oliveiro/contributors | https://github.com/comfycomputer/agent-mascots — MIT | `web/vendor/MASCOT-LICENSE.txt` |
| Leaflet, loaded from cdnjs | https://github.com/Leaflet/Leaflet — BSD-2-Clause | `web/vendor/LEAFLET-LICENSE.txt` |

The installed Three.js and mascot distributions were copied from the local
Lunaris project's dependencies; their original licence texts remain. LUMA is an
application configuration of that mascot, not a claim to authorship of the library.
Lunaris's interface was a design reference. No other project's scientific API or
backend was imported into this application's browser matcher during this session.

## Country boundaries

`web/data/countries.geo.json` now comes directly from the Natural Earth vector
distribution, 1:110m Admin 0 countries:
https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson .
Geometry is retained; properties are normalized to a display name and ISO codes.
Natural Earth states that its map data is public domain:
https://www.naturalearthdata.com/about/terms-of-use/ .

The earlier `johan/world.geo.json` copy was replaced during this audit because its
README questions the dataset's underlying legal provenance. The active boundary
file no longer comes from that intermediary. Historical Git revisions can retain
the former file; this audit does not rewrite repository history.

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

NASA GIBS / Blue Marble Shaded Relief and Bathymetry is used by the live satellite
basemap and decorative intro Earth. `web/assets/earth.jpg` was replaced during this
audit by a fresh, direct NASA WMS download. It no longer depends on the image
previously copied from Lunaris (whose notices traced it through TerraNova).
The exact direct URL, dimensions and SHA-256 are in `web/data/provenance.json`.
NASA GIBS service documentation: https://nasa-gibs.github.io/gibs-api-docs/ .

The bundled Earth grid declares NASA MODIS Terra L3, NASA GMAO MERRA-2, and
NASA/METI ASTER GDEM via GIBS colour-mapped visualizations. Their respective dataset
credits remain applicable. The audit verified live WMS imagery and MODIS colormap
access, but did not regenerate the repository's entire bundled grid. NASA media
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
Captured pictures and instantaneous telemetry are simulations. Moon/Mars climate
values are approximate scenario presets, not live mission API measurements.
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
