# Analog Finder ? Project Submission

## 1. Project Summary

Preparing for missions to the Moon and Mars requires testing equipment and
operations on Earth. Finding suitable terrestrial environments is difficult:
places that look similar can differ in temperature, terrain and other conditions.

Analog Finder is an interactive prototype that helps users discover and compare
Earth environments against lunar and Martian reference scenarios. It ranks 90,701
Earth land cells using environmental traits, lets users adjust their priorities,
and explains both the similarities and the limits of each comparison. A 3D
planetary introduction, map overlays, a globe and simulated drone exploration make
the evidence approachable.

The potential impact is a more accessible starting point for education and early
mission-test planning: users can identify candidate environments, understand what
they might help test, and investigate the underlying evidence further. Results
are research leads rather than validated field sites or landing recommendations.


## 2. Project Details

The application combines Earth observations with lunar and Martian reference
profiles. A Python pipeline processes NASA GIBS visualizations using their
published colour tables and aggregates the results into a 0.5-degree Earth grid.
Users compare temperature, thermal range, below-freezing conditions, vegetation,
rainfall, airborne dust, altitude and regional terrain relief.

The browser calculates weighted similarity scores and separates ranked results
geographically. Trait reports describe useful testing activities and conditions
that Earth cannot reproduce. Filters help users look beyond established analogue
sites, although this does not establish that a result is scientifically novel.

The interface uses JavaScript, HTML and CSS; Leaflet provides the atlas, and
Three.js provides the cinematic, globe and drone simulation. The 13.5-second
opening flows into an orbit briefing, with a skip control and reduced-motion
fallback. Responsive layouts, country boundaries and distance-qualified place
names help users navigate the results. LUMA is a local rule-based companion.

Development included the Earth-data pipeline and matcher, map and report design,
3D exploration, source retrieval for Cabeus and Gale, and browser checks for
matching, drone capture, responsive layouts and map bounds. The prototype extends
the supplied Analog Finder repository and uses credited open-source components.

## 3. NASA Data & References

NASA data supports the actual comparison workflow, beyond decorative imagery:

| Resource                                                                                  | How the project uses it                                                                                                        |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [NASA GIBS / Worldview](https://nasa-gibs.github.io/gibs-api-docs/)                       | Satellite basemap and access to Earth environmental visualizations used by the grid-building pipeline.                         |
| MODIS Terra land-surface temperature and NDVI, accessed through GIBS                      | Ground-temperature, vegetation and seasonal proxy comparisons in the bundled 2025 Earth grid.                                  |
| NASA GMAO MERRA-2, accessed through GIBS                                                  | Rainfall and airborne-dust comparison layers.                                                                                  |
| NASA/METI ASTER GDEM, accessed through GIBS                                               | Earth elevation and regional terrain-relief summaries.                                                                         |
| [NASA PDS / LRO Diviner](https://pds-geosciences.wustl.edu/missions/lro/diviner.htm)      | Retrieved Cabeus polar thermal-model values and archived triangle terrain. These are model-derived values, not live telemetry. |
| [NASA PDS / MGS MOLA](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html)          | Retrieved Gale gridded elevation and regional relief. Some source bins are interpolated.                                       |
| [NASA Curiosity REMS summary](https://science.nasa.gov/resource/taking-mars-temperature/) | Published Gale ground-temperature high/low for 16?17 August 2012; not annual extremes.                                         |

Processed files are bundled with the prototype. A live planetary API call is not
required during use. The PDS ODE API was used for crater metadata, and archive
subsets were retrieved for the planetary profiles. Exact product URLs, dates,
units, datums, sample coordinates and request hashes are retained in
[PLANETARY_DATA.md](PLANETARY_DATA.md) and `web/data/planetary-evidence.json`.
The bundled Earth grid declares its sources and has a reproducible pipeline;
it was not regenerated during the final submission cleanup.

Missing planetary traits are labelled simulated or assumed. Mare Tranquillitatis,
Jezero and Valles Marineris remain approximate presets. Drone frames and telemetry
are procedural simulations, and Earth scores are an exploratory heuristic.

**AI disclosure:** OpenAI ChatGPT/Codex assisted with research, interface design,
code implementation and formatting, debugging, automated checks, documentation,
presentation planning, and scripts for capturing screenshots and GIFs. Screenshots
and GIFs show the running application. AI assistance is not scientific validation:
NASA evidence is cited separately, and simulated or assumed values are labelled.
LUMA is a local rule-based guide; the application does not call an external
language-model API for guidance or analogue matching.

**Supporting resources:** Leaflet, Three.js, agent-mascots, GeoNames, Natural Earth,
Esri basemap services, Google Fonts and Solar System Scope textures. Credits,
source links and applicable notices are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Challenge: https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/?tab=resources


