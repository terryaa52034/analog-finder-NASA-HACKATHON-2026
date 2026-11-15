import { PLANETARY_PROFILES as evidence } from './planetary-profiles.js';

// Assumptions remain explicit even where a value is zero. Planetary altitude is
// context only: matching Earth altitude still represents a thin-air proxy.
export function createPlanetaryTargets(moonLimits, marsLimits) {
  const c = evidence.cabeus,
    g = evidence.gale;
  const simulated = (body, weight, note, extra = {}) => ({
    body,
    weight,
    status: 'Simulated',
    note: `Simulated assumption: ${note}`,
    ...extra,
  });
  const assumed = (body, weight, note) => ({ body, weight, status: 'Assumed', note });
  const proxy = {
    body: null,
    weight: 0.5,
    ideal: 'max',
    status: 'Proxy',
    note: 'Higher Earth altitude is a thin-air testing proxy. Planetary elevation is not compared with Earth elevation.',
  };
  const terrain = (record) => ({
    body: record.roughnessM,
    weight: 1.5,
    status: 'Derived',
    source: record.terrainSource || record.source,
    note: `Archive-derived elevation standard deviation across an approximately 55 km window (${record.terrainSamples} samples). Different planetary and Earth resolutions limit comparability; this is not rover-scale roughness.`,
  });
  return {
    cabeus: {
      id: 'moon-cabeus',
      body: 'Moon',
      name: 'Cabeus cold-trap region',
      region: 'Lunar south pole · Diviner / LCROSS region',
      blurb:
        'Explore a selected cold-trap model cell inside Cabeus. Its PDS thermal model and terrain are retrieved; missing minimum temperature is simulated. This cell is not the exact LCROSS impact point.',
      provenance:
        'Mixed evidence: NASA PDS Diviner thermal model and archived terrain, plus labelled simulated and assumed traits. Match percentages describe this mixed scenario, not validated site suitability.',
      sources: [
        { label: 'Diviner PRP label and units', url: c.source },
        { label: 'PDS crater record', url: evidence.features.Cabeus.url },
        { label: 'LCROSS mission', url: 'https://science.nasa.gov/mission/lcross/' },
      ],
      coordinates: { lat: c.lat, lon: c.lon },
      planetaryElevationM: c.elevationM,
      context: `Reference cell: ${c.lat.toFixed(5)}°, ${c.lon.toFixed(5)}°. Archive model annual mean at 2 cm: ${c.annualMeanAt2cmC.toFixed(1)} °C; surface maximum: ${c.maximumSurfaceTemperatureC.toFixed(1)} °C. Elevation ${Math.round(c.elevationM)} m relative to the lunar 1737.4 km sphere. The subsurface mean is not a surface minimum.`,
      traits: {
        t_max: {
          body: c.maximumSurfaceTemperatureC,
          weight: 1,
          status: 'Model-derived',
          source: c.source,
          note: 'Diviner PRP calculated annual maximum surface temperature at the selected triangle. Kelvin converted to Celsius; not a daytime observation.',
        },
        t_min: simulated(
          -243.15,
          1,
          '30 K surface minimum chosen for this demonstration; no minimum was supplied by the retrieved PRP product.',
        ),
        swing: simulated(
          c.maximumSurfaceTemperatureC + 243.15,
          0.5,
          'Model maximum minus simulated minimum. This is an assumed thermal range, not a measured day–night cycle in permanent shadow.',
        ),
        frozen: {
          body: 1,
          weight: 1.5,
          status: 'Model-derived',
          source: c.source,
          note: 'The model annual surface maximum is below 0 °C, implying a below-freezing surface throughout its model year. Not a measured seasonal soil-ice fraction.',
        },
        ndvi: assumed(
          0,
          1,
          'Assumed vegetation-free reference; not a lunar NDVI measurement or proof about biology.',
        ),
        rain: assumed(
          0,
          1,
          'Assumed absence of liquid rainfall on the airless Moon; not a rain-gauge observation.',
        ),
        dust: {
          body: null,
          weight: 0,
          status: 'Not applicable',
          note: 'Earth airborne dust concentration is not comparable to regolith on the airless Moon; excluded from scoring.',
        },
        elev: { ...proxy },
        rough: terrain(c),
      },
      limits: [
        ...moonLimits.filter((line) => !line.startsWith('Day and night')),
        'This selected permanently shadowed cell has no ordinary lunar day/night illumination cycle.',
        'Selected cold-trap model cell only; conditions vary across Cabeus. Diviner PRP temperatures are model outputs, not live telemetry.',
      ],
    },
    gale: {
      id: 'mars-gale',
      body: 'Mars',
      name: 'Gale crater',
      region: 'Mars · Curiosity / REMS landing region',
      blurb:
        'Curiosity’s ancient lake basin. Published REMS ground-temperature observations and MOLA terrain anchor this profile; missing seasonal and dust traits remain simulated.',
      provenance:
        'Mixed evidence: published NASA REMS ground observations (16–17 August 2012), NASA PDS MOLA terrain, and labelled simulated and assumed traits. These temperatures are a short historical sample, not annual extremes or live weather.',
      sources: [
        { label: 'NASA REMS ground temperatures', url: g.temperatureSource },
        { label: 'MOLA terrain label and units', url: g.terrainSource },
        { label: 'PDS crater record', url: evidence.features.Gale.url },
      ],
      coordinates: { lat: g.lat, lon: g.lon },
      planetaryElevationM: g.elevationM,
      context: `Reference area: ${g.lat.toFixed(5)}°, ${g.lon.toFixed(5)}°. MOLA reference-pixel elevation ${Math.round(g.elevationM)} m relative to the Martian areoid, not Earth sea level. Terrain resolution 1/32 degree; some MOLA bins are interpolated.`,
      traits: {
        t_max: {
          body: g.groundMaximumC,
          weight: 1,
          status: 'Observed summary',
          source: g.temperatureSource,
          note: 'NASA’s published REMS ground-temperature high for 16–17 August 2012. Short-period observation, not the annual hottest ground.',
        },
        t_min: {
          body: g.groundMinimumC,
          weight: 1,
          status: 'Observed summary',
          source: g.temperatureSource,
          note: 'NASA’s published REMS ground-temperature low for 16–17 August 2012. Short-period observation, not the annual coldest ground.',
        },
        swing: {
          body: g.groundMaximumC - g.groundMinimumC,
          weight: 1.5,
          status: 'Derived',
          source: g.temperatureSource,
          note: 'Difference between the published high and low over 16–17 August 2012 (94 °C), not a full-year statistic.',
        },
        frozen: simulated(
          0.6,
          0.5,
          '60% seasonal below-freezing fraction; not inferred from the two-day REMS temperature range.',
        ),
        ndvi: assumed(
          0,
          1,
          'Assumed vegetation-free reference; not a measured Martian NDVI or a life-detection result.',
        ),
        rain: assumed(
          0,
          1.5,
          'Present-day liquid rainfall assumed absent. Ancient lake deposits do not imply modern rain.',
        ),
        dust: simulated(
          40,
          0.5,
          '40 µg/m³ is a demonstration value, not retrieved REMS aerosol mass concentration.',
        ),
        elev: { ...proxy },
        rough: terrain(g),
      },
      limits: [
        ...marsLimits,
        'REMS temperatures cover only two dates in 2012; Earth comparisons use broader seasonal proxies. MOLA terrain includes interpolated bins.',
      ],
    },
  };
}
