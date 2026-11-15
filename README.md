# Analog Finder

Find Earth environments that help us prepare to explore the Moon and Mars.

**Live app:** https://terryaa52034.github.io/analog-finder-NASA-HACKATHON-2026/

Built for NASA Space Apps Challenge 2026, Analog Finder compares 90,701 Earth land
cells with five planetary reference scenarios. Adjustable trait weights, map
layers and explainable reports help users see what matches, what could be tested,
and where the analogy breaks down.

## Run locally

From the `analog-finder` folder, run:

```powershell
python -m http.server 8765 --bind 127.0.0.1 --directory web
```

Open **http://127.0.0.1:8765/**. The supplied data is ready to use; no build step,
API key or Python packages are needed to run the app. Internet access is needed
for map tiles and fonts. Use **Ctrl + Shift + R** after updating the code.

## Explore

- Watch the cinematic, or skip directly to the orbit briefing.
- Choose Explore Earth or launch a simulated drone mission.
- Compare Cabeus, Mare Tranquillitatis, Jezero, Gale or Valles Marineris.
- Adjust environmental priorities and inspect ranked sites, overlays and reports.
- Explore the 3D globe or export results as CSV.

LUMA provides local, rule-based guidance. Drone flight, imagery and instantaneous
telemetry are simulated; captured images do not infer scientific measurements.

## Data and limitations

Earth matching uses a bundled 2025 grid derived from NASA GIBS MODIS, MERRA-2 and
NASA/METI ASTER visualizations. Colour decoding and 0.5-degree cells limit precision.
Cabeus and Gale combine retrieved NASA evidence with labelled assumptions and
simulations. The remaining three targets are approximate scenario presets.
Scores are exploratory comparisons, not verified landing safety or site suitability.
Earth cannot reproduce lunar or Martian gravity, vacuum or radiation conditions.

## Project guide

- [Submission text and checklist](SUBMISSION.md)
- [Planetary datasets, retrieval and interpretation](PLANETARY_DATA.md)
- [Third-party credits and licences](THIRD_PARTY_NOTICES.md)
- [Architecture, data rebuilds and checks](docs/DEVELOPMENT.md)

Source repository: https://github.com/terryaa52034/analog-finder-NASA-HACKATHON-2026

## Licence

Original contributions owned by terryaa52034 are available under the
[MIT License](LICENSE), allowing commercial use with the required notice retained.
The licence does not cover the pre-existing project or override third-party terms.
See [copyright and licence scope](COPYRIGHT.md) and
[third-party notices](THIRD_PARTY_NOTICES.md). The supplied baseline's missing root
licence remains unresolved; this is not a blanket MIT grant for the whole project.

## Presentation

[Download the project presentation](presentations/NASA_Space_App_Challenge_2026_SpaceConsultant.pptx)
