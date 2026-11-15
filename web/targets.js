import { createPlanetaryTargets } from './planetary-targets.js';

// Traits measured on Earth (see pipeline/build_grid.py) and the Moon/Mars targets we compare against.
//
// Legacy target values are approximate, unverified scenario presets.
// Cabeus and Gale use retrieved evidence with per-trait simulation/assumption labels.
// See planetary-targets.js and data/planetary-evidence.json for provenance.
//
// For each target trait:
//   body   - the value on the Moon/Mars, in the trait's unit (shown in the report card)
//   weight - how much the trait counts (0 = ignored for this target)
//   ideal  - optional override of what to look for on Earth ("max" / "min" / number).
//            Defaults to `body`, clamped into the range Earth actually has.
//   note   - one line explaining the comparison

export const TRAITS = {
  t_max: {
    label: 'Hottest daytime ground',
    unit: '°C',
    digits: 0,
    use: 'Thermal tests of electronics and batteries at the hot end',
  },
  t_min: {
    label: 'Coldest night ground',
    unit: '°C',
    digits: 0,
    use: 'Cold-survival tests for power systems, batteries and seals',
  },
  swing: {
    label: 'Day–night temperature swing',
    unit: '°C',
    digits: 0,
    use: 'Thermal-cycling stress tests for materials and structures',
  },
  frozen: {
    label: 'Frozen ground (share of seasons)',
    unit: '%',
    digits: 0,
    scale: 100,
    use: 'Drilling and ice-prospecting rehearsals (resources from ice)',
  },
  ndvi: {
    label: 'Plant cover (NDVI)',
    unit: '',
    digits: 2,
    use: 'Clean, near-lifeless background for testing life-detection instruments',
  },
  rain: {
    label: 'Yearly rainfall',
    unit: 'mm',
    digits: 0,
    log: true,
    use: 'Hyper-dry soils for testing sample handling and soil chemistry',
  },
  dust: {
    label: 'Airborne dust',
    unit: 'µg/m³',
    digits: 0,
    log: true,
    use: 'Dust-mitigation tests for seals, solar panels and suits',
  },
  elev: {
    label: 'Altitude (thinner air)',
    unit: 'm',
    digits: 0,
    use: 'Low-pressure, high-UV operations for crews and equipment',
  },
  rough: {
    label: 'Terrain roughness (relief)',
    unit: 'm',
    digits: 0,
    log: true,
    use: 'Rover driving, navigation and landing-hazard trials',
  },
};

const MOON_LIMITS = [
  "Gravity is 1/6 of Earth's — no place on Earth reproduces it.",
  'Hard vacuum: no air to carry heat or sound, nothing to stop micrometeorites.',
  'No magnetic field or atmosphere to block solar and cosmic radiation.',
  'Day and night each last about two Earth weeks.',
  'Lunar dust (regolith) is sharp and electrostatically clingy — unlike wind-worn Earth dust.',
];

const MARS_LIMITS = [
  "Gravity is about 0.38 of Earth's.",
  "Air pressure is under 1% of Earth's and mostly carbon dioxide.",
  'Much higher surface radiation (thin air, no global magnetic field).',
  'Soils contain perchlorates, which are toxic and affect life detection.',
];

const newTargets = createPlanetaryTargets(MOON_LIMITS, MARS_LIMITS);

export const TARGETS = [
  newTargets.cabeus,
  {
    id: 'moon-tranquillitatis',
    body: 'Moon',
    name: 'Mare Tranquillitatis',
    region: 'Lunar near side · Apollo 11 landing area',
    blurb:
      "Smooth, dark basalt lava plains near the equator with the Moon's extreme day–night temperature swing.",
    sources: 'LRO Diviner (temperature), LOLA (topography), Apollo samples (basalt)',
    traits: {
      t_max: { body: 120, weight: 1, note: 'Noon ground temperature at the lunar equator.' },
      t_min: { body: -170, weight: 1, note: 'Ground temperature before lunar dawn.' },
      swing: { body: 290, weight: 1.5, note: 'Nearly 300 °C between day and night.' },
      frozen: { body: 0, weight: 0.5, note: 'No ground ice at the equator.' },
      ndvi: { body: 0, weight: 1, note: 'No life.' },
      rain: { body: 0, weight: 1, note: 'No liquid water or weather.' },
      dust: { body: 0, weight: 0, note: 'No wind on the Moon — airborne dust is not comparable.' },
      elev: {
        body: null,
        weight: 0.5,
        ideal: 'max',
        note: 'Vacuum: higher Earth sites get the closest (thinnest air).',
      },
      rough: { body: 40, weight: 1.5, note: 'Flat mare plains — good for landing and building.' },
    },
    limits: MOON_LIMITS,
  },
  {
    id: 'mars-jezero',
    body: 'Mars',
    name: 'Jezero crater',
    region: 'Mars · Perseverance rover landing site',
    blurb:
      'An ancient lake basin with a river delta — a prime place to look for signs of past life.',
    sources: 'Perseverance MEDA (weather), MRO HiRISE & CTX, MOLA (topography)',
    traits: {
      t_max: { body: 20, weight: 1, note: 'Summer midday ground temperature.' },
      t_min: { body: -85, weight: 1, note: 'Night-time ground temperature.' },
      swing: { body: 90, weight: 1.5, note: "Thin air can't hold heat, so nights are bitter." },
      frozen: { body: 0.6, weight: 0.5, note: 'Ground is below freezing most of the time.' },
      ndvi: { body: 0, weight: 1, note: 'No known life at the surface.' },
      rain: { body: 0, weight: 1.5, note: 'Once a lake; bone-dry for billions of years.' },
      dust: {
        body: 60,
        weight: 1,
        ideal: 'max',
        note: 'Frequent dust devils and seasonal dust storms.',
      },
      elev: {
        body: null,
        weight: 0.5,
        ideal: 'max',
        note: 'Very thin air: higher Earth sites get the closest.',
      },
      rough: { body: 250, weight: 1, note: 'Crater rim, delta cliffs and boulder fields.' },
    },
    limits: MARS_LIMITS,
  },
  newTargets.gale,
  {
    id: 'mars-valles',
    body: 'Mars',
    name: 'Valles Marineris',
    region: 'Mars · equatorial canyon system',
    blurb: "A canyon system up to 7 km deep that exposes layered rock — a record of Mars' history.",
    sources: 'MOLA (topography), MRO CRISM (minerals), THEMIS (temperature)',
    traits: {
      t_max: { body: 10, weight: 1, note: 'Daytime ground temperature near the equator.' },
      t_min: { body: -80, weight: 1, note: 'Night-time ground temperature.' },
      swing: { body: 90, weight: 1, note: 'Large daily swings from the thin atmosphere.' },
      frozen: { body: 0.5, weight: 0.5, note: 'Ground freezes nightly; little near-surface ice.' },
      ndvi: { body: 0, weight: 1, note: 'No known life at the surface.' },
      rain: { body: 0, weight: 1, note: 'No rain.' },
      dust: {
        body: 40,
        weight: 0.5,
        ideal: 'max',
        note: 'Dust storms often start or travel through the canyons.',
      },
      elev: {
        body: null,
        weight: 0.5,
        ideal: 'max',
        note: 'Very thin air: higher Earth sites get the closest.',
      },
      rough: {
        body: 3000,
        weight: 2,
        note: 'Kilometres of relief: cliffs, landslides and layered walls.',
      },
    },
    limits: MARS_LIMITS,
  },
];

// Well-studied analog sites. Results within ~200 km are tagged so you can hide them
// and focus on places that have received less attention.
export const KNOWN_ANALOGS = [
  ['Atacama Desert', -24.5, -69.25],
  ['Haughton Crater, Devon Island', 75.38, -89.68],
  ['Death Valley', 36.5, -117.0],
  ['McMurdo Dry Valleys', -77.5, 162.0],
  ['Mauna Kea', 19.82, -155.47],
  ['Kīlauea', 19.4, -155.3],
  ['Iceland highlands', 64.9, -17.5],
  ['Mars Desert Research Station, Utah', 38.41, -110.79],
  ['Río Tinto', 37.7, -6.6],
  ['Svalbard (AMASE)', 79.4, 13.4],
  ['Lanzarote', 29.0, -13.7],
  ['Pilbara', -21.5, 119.0],
  ['Meteor Crater', 35.03, -111.02],
  ['Mojave Desert', 35.0, -116.0],
  ['Arkaroola', -30.3, 139.3],
  ['Axel Heiberg Island', 79.4, -90.8],
  ['Qaidam Basin', 37.0, 94.0],
  ['Dallol / Danakil', 14.24, 40.3],
  ['Lonar Crater', 19.98, 76.51],
  ['Ries Crater', 48.88, 10.56],
];
