// Mission coordinates are geographic positions, never Earth-match coordinates.
// Terrain and telemetry are procedural demo values, NOT planetary observations.
export const METRES_PER_UNIT = 10;
export const SITE_ANCHORS = {
  'moon-shackleton': [-89.3, 129.78], // approximate rim area, not a landing assessment
  'moon-tranquillitatis': [0.67, 23.47],
  'mars-jezero': [18.4, 77.5],
  'mars-utopia': [25, 110],
  'mars-valles': [-14, -59],
};
const RADII = { Moon: 1737400, Mars: 3389500 };
export const wrapLongitude = lon => ((lon + 180) % 360 + 360) % 360 - 180;

// A local east/north displacement follows a great circle on the selected body.
// This remains well-defined at poles and across the longitude seam.
export function coordinatesAt(body, origin, x, z) {
  const east = x * METRES_PER_UNIT, north = -z * METRES_PER_UNIT;
  const distance = Math.hypot(east, north) / RADII[body];
  if (!distance) return { lat: origin.lat, lon: origin.lon };
  const bearing = Math.atan2(east, north), lat = origin.lat * Math.PI / 180, lon = origin.lon * Math.PI / 180;
  const nextLat = Math.asin(Math.max(-1, Math.min(1, Math.sin(lat) * Math.cos(distance) + Math.cos(lat) * Math.sin(distance) * Math.cos(bearing))));
  const nextLon = lon + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(lat), Math.cos(distance) - Math.sin(lat) * Math.sin(nextLat));
  return { lat: nextLat * 180 / Math.PI, lon: wrapLongitude(nextLon * 180 / Math.PI) };
}

export function makeTerrain(body, origin) {
  let seed = (Math.round((origin.lat + 90) * 1000) ^ Math.round((origin.lon + 180) * 10000) ^ (body === 'Moon' ? 421 : 937)) >>> 0;
  const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
  const craters = Array.from({ length: body === 'Moon' ? 24 : 7 }, () => ({ x: (random()-.5)*1100, z:(random()-.5)*1100, r: 22+random()*100, depth:.13+random()*.15 }));
  const phase = random() * 10;
  const rawHeight = (x, z) => {
    let h = Math.sin(x*.009+phase)*Math.cos(z*.007)* (body === 'Moon' ? 11 : 23)
      + Math.sin(x*.032+z*.012)*3 + Math.cos(z*.071-x*.039)*1.3;
    if (body === 'Mars') h += 30 * Math.sin(x*.003-z*.005+phase)**4;
    for (const crater of craters) {
      const d = Math.hypot(x-crater.x, z-crater.z)/crater.r;
      if (d < 1.6) h += crater.r * (0.12 * Math.exp(-(((d-1)/.14)**2)) - crater.depth * Math.exp(-((d/.72)**4)));
    }
    return h;
  };
  const baseHeight = rawHeight(0,0);
  const height = (x,z) => {
    const t = Math.max(0, Math.min(1,(Math.hypot(x,z)-10)/10));
    return baseHeight + (rawHeight(x,z)-baseHeight) * t*t*(3-2*t);
  };
  return { height, random };
}

export function analyseCapture(session, pose, id) {
  const { body, origin, target } = session;
  const { height } = makeTerrain(body, origin);
  const coordinates = coordinatesAt(body, origin, pose.x, pose.z);
  // 55 km window matches the approximate Earth grid footprint. It is a
  // procedural standard deviation, not a derived MOLA/LOLA elevation product.
  let sum = 0, sumSquares = 0, count = 0;
  for (let z = -2750; z <= 2750; z += 137.5) for (let x = -2750; x <= 2750; x += 137.5) {
    const h = height(pose.x+x, pose.z+z) * METRES_PER_UNIT;
    sum += h; sumSquares += h*h; count++;
  }
  const roughness = Math.sqrt(Math.max(0, sumSquares/count-(sum/count)**2));
  const groundHeight = height(pose.x, pose.z) * METRES_PER_UNIT;
  const temperature = (target.traits.t_max.body + target.traits.t_min.body)/2 + 8*Math.sin(pose.x*.01)*Math.cos(pose.z*.01);
  return {
    id, body, origin: {...origin}, pose: {...pose}, coordinates, targetId: target.id,
    targetName: target.name, elevation: groundHeight, temperature, roughness,
    timestamp: new Date().toISOString(), status: 'Hovering · image captured',
    provenance: 'Simulation: procedural image, relative elevation, temperature and relief. Climate traits are scenario assumptions from the selected target preset; no live planetary telemetry or image inference.',
    matchTarget: {
      ...target, id: `drone-${id}`, name: `${body} drone capture ${id}`,
      region: `${coordinates.lat.toFixed(5)}°, ${coordinates.lon.toFixed(5)}° · simulated survey`,
      blurb: `Captured near scenario ${target.name}. Matching uses preset climate assumptions and procedural 55 km terrain relief. It does not infer environmental traits from the image.`,
      provenance: `SIMULATED SURVEY · ${target.name} scenario. Climate is assumed, relief is procedural. Absolute planetary elevation is excluded; Earth altitude remains a thin-air proxy.`,
      traits: Object.fromEntries(Object.entries(target.traits).map(([key, trait]) => [key, {
        ...trait,
        ...(key === 'rough' ? { body: roughness, note: 'Simulated terrain standard deviation over a 55 km window, not a planetary DEM measurement.' } : {}),
      }])),
    },
  };
}
