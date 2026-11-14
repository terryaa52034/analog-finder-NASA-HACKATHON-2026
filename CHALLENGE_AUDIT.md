# Challenge, services and provenance audit

Checked 2026-11-14 (Singapore). This is an implementation audit, not an eligibility
decision by NASA or a blanket copyright clearance.

## What is actually connected

| Feature | Implementation | Status |
| --- | --- | --- |
| NASA satellite basemap | GIBS WMTS tile requests in `web/app.js` | Live external imagery service |
| Earth data pipeline | GIBS WMS GetMap and published XML colormaps in `pipeline/build_grid.py` | External NASA services when rebuilding |
| Earth matching and trait overlays | Bundled `web/data/grid.json`, client-side scoring in `app.js` | Cached data; no remote analogue API |
| Moon/Mars target conditions | Rounded presets in `web/targets.js` | Assumptions; no current lunar/Mars data ingestion |
| Drone terrain, capture and temperature | `drone-model.js` / `drone-scene.js` | Explicit simulation, not NASA telemetry or image inference |
| Nearest city/admin name | Attributed `web/data/places.json`, derived from GeoNames | Local/offline reference lookup; no reverse-geocoding API or key |
| Country polygons | Natural Earth public-domain GeoJSON | Local map context |
| LUMA | Event-driven agent-mascots component | Local guide; no LLM API |

Live checks: NASA WMS returned a decodable 2048×1024 Blue Marble JPEG and the
MODIS temperature colormap endpoint returned XML. The direct Earth texture and
country-data input hashes are recorded in `web/data/provenance.json`. The full
bundled Earth grid was **not** rebuilt in this audit; its declared provenance and
the downloader code were inspected. This distinction should be preserved in a demo.

## Fit to the official challenge overview

Source: https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/ .
The indexed official overview asks for open Earth, Moon and Mars data to identify
and characterize terrestrial analogues, presented through a map or other tool.

| Challenge aspect | Current evidence | Assessment |
| --- | --- | --- |
| Earth environments | Nine NASA-derived Earth grid traits, adjustable weights | Implemented prototype |
| Maps/visualization | Atlas, overlays, globe, reports and CSV | Implemented |
| Search beyond famous sites | Optional 200 km exclusion around a curated known-site list | Implemented heuristic, not proof of novelty |
| Characterization | Trait matches, test uses, physical limitations | Implemented with coarse 0.5° cells |
| Actual Moon/Mars observations | Approximate preset values with named missions | Significant gap: names/citations are not dataset ingestion |
| Geology/resources/caves | No lithology, mineralogy, resource inventory or cave catalogue | Not implemented |
| Validation of discoveries | No expert/field validation or benchmark study | Not implemented |
| Drone experience | Interactive simulated mission | Useful presentation; does not fill the planetary science gap |

Conclusion: the application addresses the challenge's theme and demonstrates a
plausible analogue-discovery workflow. It should be presented as a prototype,
not described as fully validated or as satisfying every judging criterion.

Direct reads of the supplied `?tab=details` and `?tab=resources` pages failed
(web fetch errors and a TLS trust failure). The indexed official overview was
reviewed instead. The full current resources tab, detailed requirements and any
challenge-specific judging rubric remain **unverified**. No claim is made that
every linked resource was used or that a particular listed API is mandatory.

## Highest-value work before a scientific submission

1. Obtain and cite specific measured lunar/Mars products for at least one target
   on each body, with product/version, units, time range, datum and download URLs.
2. Compare terrain at a justified common footprint; add geology/resources if
   claimed. Avoid treating Earth's thin-air proxy as equivalent to lunar vacuum.
3. Document a few candidate Earth cells with evidence, uncertainty, known-analogue
   checks and practical testing purpose. A nearest city is a navigation reference,
   not the location of the whole cell or a verified new field site.
4. Review the exact official resources/details tabs and submission instructions.
5. Confirm rights to the supplied baseline repository and choose its root licence.

## Copyright and reuse

See `THIRD_PARTY_NOTICES.md`. The project began from the user's supplied GitHub
repository; claiming no existing GitHub project was used would be inaccurate.
It also uses licensed Three.js, agent-mascots and Leaflet, attributed GeoNames
data, Natural Earth boundaries and NASA imagery. These are disclosed reuse.

The active older boundary intermediary was replaced with Natural Earth directly,
and the decorative Earth texture was fetched directly from NASA. Library notices
were preserved, including a Leaflet licence copy added in this audit. These actions
improve provenance, but do not certify authorship or permissions for the baseline
repository. It currently has no root `LICENSE`; its README has a placeholder.

Official participant terms: https://www.spaceappschallenge.org/legal/ . They address
rights to submitted material and open licensing of original contributions. Check
them for the actual submission; adding this audit does not confer permissions.
