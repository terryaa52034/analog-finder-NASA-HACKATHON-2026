# Cabeus and Gale evidence

Retrieved 15 November 2026 through resources reached from the official challenge
Resources tab. Cabeus and Gale are used in the target selector and drone scenario
list. The other three targets remain legacy
approximate presets; they have not been scientifically revalidated.

## What was retrieved

- PDS ODE REST `featuredata` records for Cabeus (Moon) and Gale (Mars), confirming
  named crater bounds. These are geographic metadata, not climate measurements.
- LRO Diviner **South Polar Resource Product**, PDS4 identifier
  `urn:nasa:pds:lro_diviner_derived1:data_derived_prp:dlre_prp_south`, version 1.0;
  underlying product version 2, created 21 February 2018. Source label:
  https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.xml
- MGS MOLA **MEGT90N000FB**, dataset `MGS-M-MOLA-5-MEGDR-L3-V1.0`, product version
  2.0, created 11 April 2003. Observation range in label: 15 September 1997 to
  30 June 2001. Resolution 1/32 degree, signed big-endian 16-bit metres relative
  to the Martian areoid. Bins without observations can be interpolated. Label:
  https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg032/megt90n000fb.lbl
- NASA's **Taking Mars' Temperature** summary of Curiosity REMS ground
  observations for **16–17 August 2012**: high **3 °C**, low **−91 °C**. These are
  ground, not air, temperatures and not annual extremes:
  https://science.nasa.gov/resource/taking-mars-temperature/

## Interpretation

The Cabeus reference triangle is at −84.63969°, −48.83087°, inside the retrieved
crater bounds. It is a selected cold-trap model cell, **not the exact LCROSS impact
point or the entire crater**. Diviner PRP provides a **calculated** surface annual
maximum of 47.687 K (−225.463 °C) and annual mean at 2 cm of 39.312 K
(−233.838 °C). The mean is retained as context, never substituted for a minimum.
Minimum surface temperature is explicitly simulated as 30 K; the displayed range
therefore combines a model maximum with a simulated minimum. In permanent shadow,
this is not a measured day/night cycle. A below-freezing fraction of 1 is inferred
from the model annual maximum, not a measured soil/permafrost seasonal fraction.

Cabeus triangle altitude is −3805.45 m relative to a **1737.4 km lunar sphere**.
Its terrain statistic is the population SD of 2442 archived triangle-centre
altitudes sampled from 11 strips (~5 km spacing) across a roughly 55 km square:
**1424.70 m**. This is sampled regional relief, not a high-resolution rover hazard
metric. The source is the PRP triangle geometry, not a separately retrieved LOLA
DEM; no claim of independent LOLA ingestion is made.

Gale uses a reference point near Curiosity's landing area, −4.59°, 137.44°.
The MOLA reference pixel is −4508 m relative to the Martian areoid. Population SD
over 900 pixel centres in a roughly 55 km square is **1284.29 m**. Regional relief
includes the basin and surrounding slopes; the coarse bins are not local landing
pad roughness. The REMS range of 94 °C is derived from a two-date published
summary, **not** a long-term time series downloaded from the REMS archive.

Earth relief and seasonal temperature proxies use different resolutions and time
windows. Matching is exploratory, not a validated site suitability estimate.
Absolute planetary elevations are shown as context; matching Earth altitude
remains a thin-air testing proxy and never equates the planetary datums.

## Filled fields and simulation

Each new target fills all nine trait entries. Cabeus airborne dust is N/A and
cannot be enabled for scoring. Vegetation/rainfall zeros are explicitly assumed
planetary reference conditions, not NDVI or rain-gauge measurements. Gale seasonal
frozen fraction (0.6) and dust concentration (40 µg/m³) are simulated assumptions.
The UI labels each field and provides source links. Drone imagery and instant
telemetry remain entirely simulated even when the selected profile has evidence.

## Rebuild and verify

With Node.js and Playwright/Chromium installed:

```powershell
# Optional: point this to an existing installation instead of installing packages.
$env:PLAYWRIGHT_MODULE = 'C:\path\to\node_modules\playwright'
node pipeline/fetch_planetary_profiles.cjs
```

TLS validation stays enabled. The script validates the API status, label fields,
coordinate bounds, HTTP 206 byte ranges and lengths before producing artifacts.
It requests small subsets instead of the 605 MB Diviner/133 MB MOLA full files.
`web/data/planetary-evidence.json` retains sampled coordinates/elevations,
request URLs/ranges and response SHA-256 hashes. `web/planetary-profiles.js` is
the compact generated runtime snapshot. Failures are not replaced with fake data.
The application uses this bundled snapshot; it does not require NASA availability
or API keys on each page visit. `planetary-check.cjs` verifies the data arithmetic,
selector replacement, evidence labels, matching, drone anchors and mobile overflow.

Credit: NASA / LRO / Diviner team, UCLA, PDS Geosciences Node (Washington
University); NASA / GSFC / MGS MOLA team; NASA / JPL-Caltech / Curiosity REMS team.
See source product labels for producer identities and definitions.
