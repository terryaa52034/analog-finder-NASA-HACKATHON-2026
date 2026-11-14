// Natural Earth public-domain boundaries; GeoNames CC BY 4.0 reference places.
let countries = [];
let gazetteer = null, vectors = null;
const locationCache = new Map();
export async function loadGeography() {
  const placesPromise = fetch('data/places.json').then(response => {
    if (!response.ok) throw new Error(`places.json: ${response.status}`);
    return response.json();
  }).then(data => {
    gazetteer = data; vectors = new Float64Array(data.places.length * 3);
    data.places.forEach(([lat,lon],i) => { const a=lat*Math.PI/180,b=lon*Math.PI/180;vectors[i*3]=Math.cos(a)*Math.cos(b);vectors[i*3+1]=Math.cos(a)*Math.sin(b);vectors[i*3+2]=Math.sin(a); });
  }).catch(error => { console.warn('Reference places unavailable; keeping coordinate/country labels.', error); });
  const response = await fetch('data/countries.geo.json');
  if (!response.ok) throw new Error('Country boundaries unavailable');
  const data = await response.json();
  countries = data.features.map(feature => {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    return { feature, polygons, boxes: polygons.map(p => {
      const xs = p[0].map(c => c[0]), ys = p[0].map(c => c[1]);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }) };
  });
  await placesPromise;
  return data;
}
function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function countryAt(lat, lon) {
  for (const country of countries) {
    for (let j = 0; j < country.polygons.length; j++) {
      const [w, s, e, n] = country.boxes[j], rings = country.polygons[j];
      if (lon < w || lon > e || lat < s || lat > n) continue;
      if (inRing(lon, lat, rings[0]) && !rings.slice(1).some(r => inRing(lon, lat, r))) return country.feature;
    }
  }
  return null;
}
export function placeAt(lat, lon) {
  return locationAt(lat,lon).title;
}

export function locationAt(lat,lon) {
  const key=`${lat.toFixed(5)},${lon.toFixed(5)}`;
  if(locationCache.has(key))return locationCache.get(key);
  const mappedCountry=countryAt(lat,lon)?.properties.name;
  const country=mappedCountry || (lat <= -75 ? 'Antarctic region' : 'Country unresolved at this map scale');
  let result={title:country,city:null,region:'',country,distanceKm:null,id:null,context:'Reference place data unavailable; coordinates identify the analysed cell.'};
  if(gazetteer?.places.length) {
    const a=lat*Math.PI/180,b=lon*Math.PI/180,x=Math.cos(a)*Math.cos(b),y=Math.cos(a)*Math.sin(b),z=Math.sin(a);
    let best=-Infinity,index=0;
    for(let i=0;i<gazetteer.places.length;i++){const dot=x*vectors[i*3]+y*vectors[i*3+1]+z*vectors[i*3+2];if(dot>best){best=dot;index=i;}}
    const [cityLat,cityLon,city,region,code,id]=gazetteer.places[index];
    const cityCountry=gazetteer.countries[code]||code;
    const distanceKm=6371*Math.acos(Math.min(1,Math.max(-1,best)));
    const distance=distanceKm<1?'<1':Math.round(distanceKm).toLocaleString('en');
    const jurisdiction=[region,cityCountry].filter((part,i,all)=>part&&all.indexOf(part)===i).join(', ');
    const remote=distanceKm>100;
    const area=country==='Country unresolved at this map scale'?'Remote land cell':country;
    result={title:remote?area:`Near ${city}`,city,region,country:cityCountry,cellCountry:country,distanceKm,id,cityLat,cityLon,remote,
      context:remote?`Remote site · no recorded city within 100 km · closest ${distance} km away`:`${jurisdiction} · ${distance} km from analysed cell`,
      referenceContext:`${city}, ${jurisdiction} · ${distance} km away · reference only`,
      note:'Nearest recorded city/town in GeoNames cities15000. The state/region belongs to that reference place, not necessarily to the analysed cell.'};
  }
  if(locationCache.size>=512)locationCache.delete(locationCache.keys().next().value);
  locationCache.set(key,result);return result;
}
