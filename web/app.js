import { TRAITS, TARGETS, KNOWN_ANALOGS } from "./targets.js";
import { loadGeography, countryAt, placeAt, locationAt } from './geography.js';
import { createMissionIntro } from './mission-intro.js';

const TRAIT_KEYS = Object.keys(TRAITS);
const TOP_N = 15;
const MIN_SPACING_KM = 500;   // results are spread out so the list isn't 15 cells of the same desert
const KNOWN_RADIUS_KM = 200;

const state = { grid: null, stats: {}, target: null, weights: {}, scores: null, top: [], selected: null, topLimit: TOP_N, capture: null };
const $ = (sel) => document.querySelector(sel);

// ------------------------------------------------------------------ data

async function loadGrid() {
  const res = await fetch("data/grid.json");
  if (!res.ok) throw new Error(`grid.json: ${res.status}`);
  const g = await res.json();
  const n = g.idx.length;
  g.lat = new Float32Array(n);
  g.lon = new Float32Array(n);
  g.pos = new Int32Array(g.nlat * g.nlon).fill(-1);
  for (let i = 0; i < n; i++) {
    const cell = g.idx[i], row = Math.floor(cell / g.nlon), col = cell % g.nlon;
    g.lat[i] = 90 - (row + 0.5) * g.res;
    g.lon[i] = -180 + (col + 0.5) * g.res;
    g.pos[cell] = i;
  }
  g.known = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    for (const [name, la, lo] of KNOWN_ANALOGS) {
      if (Math.abs(la - g.lat[i]) < 2.5 && km(la, lo, g.lat[i], g.lon[i]) < KNOWN_RADIUS_KM) { g.known[i] = name; break; }
    }
  }
  return g;
}

const transform = (key, x) => (TRAITS[key].log ? Math.log10(Math.max(x, 0) + 1) : x);

function computeStats(g) {
  for (const k of TRAIT_KEYS) {
    const v = g.traits[k].filter((x) => x !== null).map((x) => transform(k, x)).sort((a, b) => a - b);
    const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
    state.stats[k] = { lo: q(0.02), hi: q(0.98), min: v[0], max: v[v.length - 1] };
  }
}

// ------------------------------------------------------------------ scoring

/** Where on Earth's scale we aim for each trait, and whether the target lies beyond Earth's range. */
function aims(target) {
  const out = {};
  for (const k of TRAIT_KEYS) {
    const t = target.traits[k], s = state.stats[k];
    let ideal, beyond = 0;
    if (t.ideal === "max") ideal = s.hi, beyond = 1;
    else if (t.ideal === "min") ideal = s.lo, beyond = -1;
    else {
      const v = transform(k, t.body);
      if (v > s.hi) { ideal = s.hi; beyond = 1; }
      else if (v < s.lo) { ideal = s.lo; beyond = -1; }
      else ideal = v;
    }
    out[k] = { ideal, beyond, sigma: (s.hi - s.lo) * 0.22 };
  }
  return out;
}

function similarity(k, x, aim) {
  if (x === null) return null;
  const v = transform(k, x);
  // When the target is more extreme than anywhere on Earth, Earth's extremes count as a full match.
  if ((aim.beyond > 0 && v >= aim.ideal) || (aim.beyond < 0 && v <= aim.ideal)) return 1;
  const z = (v - aim.ideal) / aim.sigma;
  return Math.exp(-0.5 * z * z);
}

function scoreAll() {
  const g = state.grid, n = g.idx.length, a = aims(state.target);
  const scores = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0, wsum = 0;
    for (const k of TRAIT_KEYS) {
      const w = state.weights[k];
      if (!w) continue;
      const s = similarity(k, g.traits[k][i], a[k]);
      if (s === null) continue;
      sum += w * s; wsum += w;
    }
    scores[i] = wsum ? sum / wsum : 0;
  }
  state.scores = scores;
  state.aims = a;
}

function pickTop() {
  if (!state.scores) { state.top = []; return; }
  const g = state.grid, order = Array.from(state.scores.keys()).sort((a, b) => state.scores[b] - state.scores[a]);
  const hideKnown = $("#hide-known").checked, top = [];
  for (const i of order) {
    if (hideKnown && g.known[i]) continue;
    if (top.some((j) => km(g.lat[i], g.lon[i], g.lat[j], g.lon[j]) < MIN_SPACING_KM)) continue;
    top.push(i);
    if (top.length === state.topLimit) break;
  }
  state.top = top;
}

// ------------------------------------------------------------------ map

let map, overlay, marker, borders, labels, sites, selectedArea, selectedCell, globe, geography;
let layerKey = 'match', opacity = 0.65, globeVisible = false, displayValues;
const baseLayers = {};

function initMap() {
  const mapHeader = document.createElement('div'); mapHeader.className = 'map-header';
  mapHeader.append($('.map-heading'), $('.map-tools')); $('.map-wrap').prepend(mapHeader);
  const headerObserver = new ResizeObserver(() => {
    $('.map-wrap').style.setProperty('--map-content-top', `${mapHeader.offsetTop + mapHeader.offsetHeight + 18}px`);
  });
  headerObserver.observe(mapHeader);
  // City names and explanations can make LUMA taller; reserve its actual height.
  const reserveCompanion = () => {
    const mapBox = $('.map-wrap').getBoundingClientRect(), guideBox = $('.companion').getBoundingClientRect();
    const bottom = matchMedia('(max-width: 820px)').matches ? 38 : Math.max(24, mapBox.bottom - guideBox.top + 18);
    $('.map-wrap').style.setProperty('--report-bottom', `${bottom}px`);
  };
  const companionObserver = new ResizeObserver(reserveCompanion);
  companionObserver.observe($('.companion')); companionObserver.observe($('.map-wrap'));
  map = L.map("map", { worldCopyJump: true, minZoom: 2, maxZoom: 8, zoomControl: true }).setView([20, 10], 2);
  baseLayers.satellite = L.tileLayer(
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
    { maxNativeZoom: 8, attribution: "Imagery: NASA GIBS / Blue Marble" },
  ).addTo(map);
  baseLayers.dark = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri, HERE, Garmin, OpenStreetMap contributors', maxZoom: 8 });
  map.createPane('placeLabels'); map.getPane('placeLabels').style.zIndex = 450;
  map.getPane('placeLabels').style.pointerEvents = 'none';
  labels = L.layerGroup().addTo(map);
  sites = L.layerGroup().addTo(map);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  map.on("click", (e) => {
    if (!state.grid) return;
    const i = cellAt(e.latlng.lat, e.latlng.lng);
    if (i >= 0) select(i, false);
  });
}

function initCountryLabels(data) {
  const entries = data.features.map(feature => {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const polygon = polygons.map(rings => {
      const bounds = L.latLngBounds(rings[0].map(([lon, lat]) => [lat, lon]));
      return { bounds, area: (bounds.getEast()-bounds.getWest())*(bounds.getNorth()-bounds.getSouth()) };
    }).sort((a,b) => b.area-a.area)[0];
    const name = feature.properties.name === 'United States of America' ? 'United States' : feature.properties.name;
    const span = document.createElement('span'); span.textContent = name;
    return { minZoom: polygon.area > 300 ? 2 : polygon.area > 35 ? 3 : 4, marker: L.marker(polygon.bounds.getCenter(), { interactive:false, keyboard:false, pane:'placeLabels', icon:L.divIcon({className:'country-label',html:span.outerHTML,iconSize:[120,20],iconAnchor:[60,10]}) }) };
  });
  const refresh = () => { labels.clearLayers(); entries.filter(entry => map.getZoom() >= entry.minZoom).forEach(entry => labels.addLayer(entry.marker)); };
  map.on('zoomend', refresh); refresh();
}

function cellAt(lat, lon) {
  const g = state.grid;
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  const row = Math.floor((90 - lat) / g.res), col = Math.floor((lon + 180) / g.res);
  if (row < 0 || row >= g.nlat) return -1;
  return g.pos[row * g.nlon + col];
}

const STOPS = [
  [0.0, [138, 52, 16, 0]], [0.25, [184, 70, 28, 110]], [0.6, [235, 104, 52, 200]], [1.0, [255, 179, 143, 240]],
];
function colour(t) {
  for (let s = 1; s < STOPS.length; s++) {
    if (t <= STOPS[s][0]) {
      const [t0, c0] = STOPS[s - 1], [t1, c1] = STOPS[s], f = (t - t0) / (t1 - t0);
      return c0.map((c, j) => c + (c1[j] - c) * f);
    }
  }
  return STOPS[STOPS.length - 1][1];
}

function drawOverlay() {
  const g = state.grid;
  if (layerKey === 'match' && !state.scores) { overlay?.remove(); displayValues = null; $('.legend').hidden = true; syncGlobe(); return; }
  $('.legend').hidden = false;
  const raw = layerKey === 'match' ? state.scores : g.traits[layerKey];
  const sorted = Float32Array.from(Array.from(raw).filter(Number.isFinite).map(x => layerKey === 'match' ? x : transform(layerKey, x))).sort();
  const q = (p) => sorted[Math.floor(p * (sorted.length - 1))];
  const lo = q(layerKey === 'match' ? 0.6 : 0.02), hi = q(layerKey === 'match' ? 0.998 : 0.98);
  displayValues = Array.from(raw, x => x === null ? null : Math.min(1, Math.max(0, ((layerKey === 'match' ? x : transform(layerKey, x)) - lo) / (hi - lo || 1))));
  $('#legend-low').textContent = layerKey === 'match' ? 'Lower match' : fmt(layerKey, TRAITS[layerKey].log ? 10 ** lo - 1 : lo);
  $('#legend-high').textContent = layerKey === 'match' ? 'Higher match' : fmt(layerKey, TRAITS[layerKey].log ? 10 ** hi - 1 : hi);
  $('#legend-note').textContent = layerKey === 'match' ? 'Relative match · top 40% of cells' : `${TRAITS[layerKey].label} · NASA data · 2nd–98th percentile`;
  const W = 1440, H = 1440, canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d"), img = ctx.createImageData(W, H), px = img.data;
  const colOf = new Int32Array(W);
  for (let x = 0; x < W; x++) colOf[x] = Math.floor(((x + 0.5) * 360) / W / g.res);
  for (let y = 0; y < H; y++) {
    // Web Mercator row -> latitude
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / H))) * 180) / Math.PI;
    const row = Math.floor((90 - lat) / g.res);
    for (let x = 0; x < W; x++) {
      const i = g.pos[row * g.nlon + colOf[x]];
      if (i < 0) continue;
      const t = displayValues[i];
      if (t === null) continue;
      if (t <= 0) continue;
      const c = layerKey === 'match' ? colour(t) : [45 + 150*t, 120 + 115*t, 170 - 10*t, 175], o = (y * W + x) * 4;
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = c[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL("image/png"), bounds = [[-85.0511, -180], [85.0511, 180]];
  if (overlay) overlay.setUrl(url);
  else overlay = L.imageOverlay(url, bounds, { opacity, interactive: false }).addTo(map);
  overlay.setOpacity(opacity);
  overlay.addTo(map);
  $('.legend .ramp').style.background = layerKey === 'match' ? '' : 'linear-gradient(90deg, #2d78aa, #c3eba0)';
  syncGlobe();
}

function syncGlobe(focus = false) {
  globe?.update(displayValues, state.top, state.selected, $('#show-sites').checked, opacity, focus, layerKey);
}

function renderSites() {
  sites.clearLayers();
  state.top.forEach((i, rank) => {
    L.marker([state.grid.lat[i], state.grid.lon[i]], {
      icon: L.divIcon({ className: `rank-marker ${state.selected === i ? 'selected' : ''}`, html: `<span>${rank + 1}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }),
      title: `${rank + 1}. ${siteName(i)}, ${pct(state.scores[i])} match`,
    }).bindTooltip(`${escapeHtml(siteName(i))} · ${pct(state.scores[i])}`).on('click', () => select(i, false)).addTo(sites);
  });
  syncGlobe();
}

function siteName(i) { return placeAt(state.grid.lat[i], state.grid.lon[i]); }

function guide(text, mood = 'listening') {
  $('#guide-message').textContent = text;
  $('agent-mascot').setAttribute('mood', mood);
}

function explainSite() {
  if (!state.target) return guide('We have a mission, explorer. Launch a Moon or Mars drone, or choose a planetary target to discover its Earth analogues.', 'speaking');
  if (state.selected === null) return guide('Choose a numbered beacon or click land on the map to inspect a site.');
  const i = state.selected;
  const strong = TRAIT_KEYS.filter(k => state.weights[k] && similarity(k, state.grid.traits[k][i], state.aims[k]) >= 0.75);
  guide(`${siteName(i)} scores ${pct(state.scores[i])} for ${state.target.name}. ${strong.length ? `Strong matches: ${strong.slice(0, 3).map(k => TRAITS[k].label.toLowerCase()).join(', ')}.` : 'No traits match strongly with these weights.'} Earth cannot reproduce ${state.target.body}'s gravity or radiation.`, 'speaking');
}

// ------------------------------------------------------------------ UI

function renderTargets() {
  const box = $("#targets");
  box.innerHTML = "";
  for (const t of (!state.target || TARGETS.includes(state.target) ? TARGETS : [state.target, ...TARGETS])) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "target"; b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(t === state.target));
    b.title = `${t.name} · ${t.region}`;
    b.innerHTML = `<div class="body">${t.body}</div><div class="name">${t.name}</div><div class="region">${t.region}</div>`;
    b.onclick = () => setTarget(t, t === state.target ? state.capture : null);
    box.appendChild(b);
  }
  $("#target-blurb").textContent = state.target?.blurb || 'No destination chosen. Start with a world above, or take the drone out for a survey.';
}

function renderWeights() {
  const box = $("#weights");
  box.innerHTML = "";
  if (!state.target) { box.innerHTML = '<p class="empty-state">Choose a target to unlock the environmental controls.</p>'; return; }
  for (const k of TRAIT_KEYS) {
    const row = document.createElement("label");
    row.className = "weight";
    row.innerHTML = `<span>${TRAITS[k].label}</span>
      <input type="range" min="0" max="3" step="0.25" value="${state.weights[k]}" aria-label="Weight for ${TRAITS[k].label}">
      <output>${state.weights[k]}</output>`;
    const input = row.querySelector("input"), out = row.querySelector("output");
    input.oninput = () => { state.weights[k] = Number(input.value); out.textContent = input.value; scheduleUpdate(); };
    box.appendChild(row);
  }
}

function renderResults() {
  const g = state.grid, box = $("#results");
  box.innerHTML = "";
  if (!state.target) { box.innerHTML = '<li class="empty-state">Your discoveries will appear here after a comparison or drone survey.</li>'; return; }
  state.top.forEach((i, r) => {
    const li = document.createElement("li"), b = document.createElement("button");
    const location = locationAt(g.lat[i],g.lon[i]);
    b.type = "button";
    b.title = `${location.title} · ${location.context}. The exact grid coordinates identify the match, not the reference city.`;
    if (i === state.selected) b.classList.add("active");
    b.innerHTML = `<span class="rank">${r + 1}</span>
      <span class="where">${escapeHtml(siteName(i))}<span class="tag location-context">${escapeHtml(location.context)}</span><span class="tag">${coord(g.lat[i], g.lon[i])}</span>${g.known[i] ? `<span class="tag">near ${g.known[i]}</span>` : ""}</span>
      <span class="score">${pct(state.scores[i])}</span>`;
    b.onclick = () => select(i, true);
    li.appendChild(b); box.appendChild(li);
  });
}

function select(i, fly) {
  const g = state.grid;
  state.selected = i;
  if (selectedArea) selectedArea.remove();
  if (selectedCell) selectedCell.remove();
  const country = countryAt(g.lat[i], g.lon[i]);
  if (country && $('#show-borders').checked) selectedArea = L.geoJSON(country, { interactive: false, style: { color: '#adffe0', weight: 2, fillColor: '#87edda', fillOpacity: 0.07 } }).addTo(map);
  const half = g.res / 2;
  selectedCell = L.rectangle([[g.lat[i]-half,g.lon[i]-half],[g.lat[i]+half,g.lon[i]+half]], { color: '#d8bdff', weight: 2, fillOpacity: 0.2, interactive: false }).addTo(map);
  $('#map-location').textContent = `${siteName(i)} · ${coord(g.lat[i], g.lon[i])}`;
  if (marker) marker.remove();
  marker = L.circleMarker([g.lat[i], g.lon[i]], { radius: 9, color: "#fff", weight: 2, fillColor: "#eb6834", fillOpacity: 0.9 }).addTo(map);
  if (fly) map.flyTo([g.lat[i], g.lon[i]], Math.max(map.getZoom(), 5), { duration: 0.8, animate: !matchMedia('(prefers-reduced-motion: reduce)').matches });
  renderCard(i);
  renderResults();
  renderSites(); syncGlobe(true); explainSite();
}

function renderCard(i) {
  const g = state.grid, t = state.target, card = $("#card");
  const location=locationAt(g.lat[i],g.lon[i]);
  if (!t) {
    card.innerHTML = `<button class="close" type="button" aria-label="Close">×</button><span class="eyebrow">EARTH REFERENCE</span><h3>${escapeHtml(siteName(i))}</h3><p class="sub">${escapeHtml(location.context)}</p><p class="sub">${coord(g.lat[i], g.lon[i])}</p><p class="empty-state">A place to explore. Choose a planetary target to compare this environment, or attach it to a drone mission as an Earth reference.</p><div class="links"><button class="link-btn" type="button" data-drone-reference>Start drone exploration ↗</button></div>`;
    card.hidden = false; card.querySelector('.close').onclick = () => { card.hidden = true; }; return;
  }
  const rank = state.top.indexOf(i);
  const rows = [], strong = [], weak = [];
  for (const k of TRAIT_KEYS) {
    const def = TRAITS[k], tt = t.traits[k], w = state.weights[k], x = g.traits[k][i];
    const s = similarity(k, x, state.aims[k]);
    let cls = "off", verdict = "Not scored";
    if (w && s !== null) {
      if (s >= 0.75) { cls = "good"; verdict = "✓ Strong"; strong.push(k); }
      else if (s >= 0.4) { cls = "mid"; verdict = "~ Partial"; }
      else { cls = "bad"; verdict = "✗ Weak"; weak.push({ k, x }); }
    } else if (s === null) verdict = "No data";
    const beyond = state.aims[k].beyond && tt.body !== null && tt.ideal === undefined
      ? " Beyond anything on Earth — scored against Earth's most extreme places." : "";
    rows.push(`<div class="trait">
      <div class="top"><span>${def.label}</span><span class="verdict ${cls}">${verdict}</span></div>
      <div class="bar"><i style="width:${s === null || !w ? 0 : Math.round(s * 100)}%"></i></div>
      <div class="vals"><span>Earth: ${fmt(k, x)}</span><span>${t.body}: ${tt.body === null ? "—" : fmt(k, tt.body)}</span></div>
      <div class="note">${tt.note}${beyond}</div>
    </div>`);
  }
  const uses = strong.map((k) => `<li>${TRAITS[k].use}</li>`).join("") || "<li>No trait matches strongly — try adjusting the weights.</li>";
  const breaks = weak.map(({ k, x }) => `<li>${TRAITS[k].label}: ${fmt(k, x)} here vs ${t.traits[k].body === null ? "—" : fmt(k, t.traits[k].body)} at ${t.name}.</li>`).join("")
    + t.limits.map((l) => `<li>${l}</li>`).join("");
  const la = g.lat[i], lo = g.lon[i];
  card.innerHTML = `<button class="close" type="button" aria-label="Close">×</button>
    <span class="eyebrow">SITE INTELLIGENCE ${rank >= 0 ? `/ RANK ${rank + 1}` : ''}</span><h3>${escapeHtml(siteName(i))}</h3><div class="sub">${escapeHtml(location.context)}</div><div class="sub">${coord(la, lo)}</div><p class="location-disclaimer">City/state names describe the nearest recorded place, not the full 0.5° cell. <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a> · CC BY 4.0.</p>
    <div class="sub">Earth analog for ${t.name} (${t.body}) · 0.5° cell (~55 km)</div>
    ${t.provenance ? `<p class="capture-provenance">${t.provenance}</p>` : ''}
    ${g.known[i] ? `<span class="known">⚑ Near a well-known analog: ${g.known[i]}</span>` : ""}
    <div class="overall"><b>${pct(state.scores[i])}</b><span class="muted">overall match</span></div>
    <h4>Trait by trait</h4>${rows.join("")}
    <h4>Good for testing</h4><ul>${uses}</ul>
    <h4>Where the analogy breaks down</h4><ul>${breaks}</ul>
    <div class="links">
      <button type="button" class="link-btn" data-drone-reference>Explore with drone ↗</button>
      <a target="_blank" rel="noopener" href="https://worldview.earthdata.nasa.gov/?v=${lo - 3},${la - 2},${lo + 3},${la + 2}">Open in NASA Worldview</a>
      <a target="_blank" rel="noopener" href="https://www.google.com/maps/@${la},${lo},9z/data=!3m1!1e3">Satellite view</a>
    </div>`;
  card.hidden = false;
  card.querySelector(".close").onclick = () => { card.hidden = true; };
}

function exportCsv() {
  const g = state.grid, head = ["rank", "lat", "lon", "match", "reference_city", "reference_region", "reference_country", "reference_distance_km", "geonames_id", ...TRAIT_KEYS, "near_known_analog"];
  const lines = [head.join(",")];
  state.top.forEach((i, r) => {
    const location=locationAt(g.lat[i],g.lon[i]);
    lines.push([r + 1, g.lat[i], g.lon[i], state.scores[i].toFixed(3),location.city||'',location.region,location.country,location.distanceKm?.toFixed(1)||'',location.id||'', ...TRAIT_KEYS.map((k) => g.traits[k][i] ?? ""), g.known[i] || ""].map(value=>`"${String(value).replaceAll('"','""')}"`).join(","));
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  a.download = `analogs-${state.target.id}.csv`;
  a.click();
}

// ------------------------------------------------------------------ flow

let pending = false;
function scheduleUpdate() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; update(); });
}

function update() {
  if (!state.target) return;
  scoreAll();
  pickTop();
  drawOverlay();
  renderResults();
  renderSites();
  if (state.selected !== null && !$("#card").hidden) renderCard(state.selected);
}

function setTarget(t, capture = null) {
  state.capture = capture;
  state.topLimit = capture ? 10 : TOP_N;
  state.target = t;
  $('#export').disabled = false; $('#reset-weights').disabled = false;
  $('.weight-section').open = true;
  const banner = $('#drone-result-banner');
  banner.hidden = !capture;
  if (capture) banner.textContent = `10 Earth analogues · ${capture.body} capture ${capture.id} at ${capture.coordinates.lat.toFixed(5)}°, ${capture.coordinates.lon.toFixed(5)}°. Simulation profile; Earth data from NASA. Return through Drone Exploration to continue.`;
  $('#mission-title').textContent = `${t.name} → Earth`;
  state.weights = Object.fromEntries(TRAIT_KEYS.map((k) => [k, t.traits[k].weight]));
  history.replaceState(null, "", `#${t.id}`);
  renderTargets();
  renderWeights();
  update();
  if (state.top.length) select(state.top[0], false);
  map.setView([15, 10], 2);
}

async function main() {
  initMap();
  try {
    geography = await loadGeography();
    borders = L.geoJSON(geography, { interactive: false, style: { color: '#bfd8e4', weight: 0.7, opacity: 0.45, fillOpacity: 0 } }).addTo(map);
    initCountryLabels(geography);
  } catch (error) { console.warn(error); guide('Country boundaries could not load. Coordinates and the science grid are still available.'); }
  try {
    state.grid = await loadGrid();
  } catch (err) {
    $("#loading").textContent = "Couldn't load the Earth data grid. Run pipeline/build_grid.py, then serve the web folder.";
    console.error(err);
    return;
  }
  computeStats(state.grid);
  $("#data-year").textContent = state.grid.year;
  initControls();
  $('#mascot-toggle').click();
  $("#hide-known").onchange = () => { pickTop(); renderResults(); renderSites(); if (state.selected !== null && !$('#card').hidden) renderCard(state.selected); };
  $("#reset-weights").onclick = () => { if (state.target) setTarget(state.target, state.capture); };
  $("#export").onclick = exportCsv;
  const fromHash = TARGETS.find((t) => `#${t.id}` === location.hash);
  if (fromHash) setTarget(fromHash);
  else { renderTargets(); renderWeights(); renderResults(); drawOverlay(); $('#export').disabled = true; $('#reset-weights').disabled = true; }
  $("#loading").hidden = true;
  $('#drone-open').disabled = false;
  $('#drone-mission-card').disabled = false;
}

let droneExplorer;
async function openDrone({ attachReference = false } = {}) {
  const button = $('#drone-open'); button.disabled = true;
  try {
    if (!droneExplorer) {
      const { createDroneExplorer } = await import('./drone-explorer.js');
      droneExplorer = createDroneExplorer({
        getContext: () => ({ target: state.target, reference: state.selected === null ? null : { name: siteName(state.selected), lat: state.grid.lat[state.selected], lon: state.grid.lon[state.selected] } }),
        onMatch: async capture => {
          if (!state.grid) throw new Error('Earth grid is not loaded yet.');
          // Existing similarity scoring and spatial separation, with a capture
          // profile as the target. Planetary coordinates never index Earth cells.
          setTarget(capture.matchTarget, capture);
          if (globeVisible) $('#globe-toggle').click();
          layerKey = 'match'; $('#overlay-layer').value = 'match'; drawOverlay();
          $('#show-sites').checked = true; sites.addTo(map);
          map.setView([15, 10], 2);
          guide(`Survey complete. ${state.top.length} Earth locations match the simulated ${capture.body} capture profile. Open a ranked site to compare the evidence.`, 'success');
          return state.top.map((i, rank) => ({ rank: rank+1, name: siteName(i), lat:state.grid.lat[i], lon:state.grid.lon[i], score:state.scores[i] }));
        },
        onClose: () => { map.invalidateSize(); globe?.show(globeVisible); },
      });
    }
    globe?.show(false);
    droneExplorer.open({ attachReference });
  } catch (error) { guide(`Drone mode could not open: ${error.message}. The Earth map is still available.`, 'error'); }
  finally { button.disabled = false; }
}
$('#drone-open').onclick = openDrone;
$('#drone-mission-card').onclick = openDrone;
$('#earth-mode').onclick = () => { if (globeVisible) $('#globe-toggle').click(); map.setView([15,10],2); };
document.addEventListener('click', event => { if (event.target.closest('[data-drone-reference]')) openDrone({ attachReference: true }); });

function initControls() {
  for (const k of TRAIT_KEYS) { const option = document.createElement('option'); option.value = k; option.textContent = TRAITS[k].label; $('#overlay-layer').appendChild(option); }
  $('#basemap').onchange = e => { Object.values(baseLayers).forEach(layer => map.removeLayer(layer)); baseLayers[e.target.value].addTo(map); };
  $('#overlay-layer').onchange = e => { layerKey = e.target.value; drawOverlay(); guide(layerKey === 'match' ? 'The warm overlay shows relative environmental similarity. Brighter cells score higher for your current target.' : `${TRAITS[layerKey].label}: this overlay shows measured Earth values, not similarity. Read the units in the legend.`, 'thinking'); };
  $('#overlay-opacity').oninput = e => { opacity = Number(e.target.value)/100; $('#opacity-value').textContent = `${e.target.value}%`; overlay?.setOpacity(opacity); syncGlobe(); };
  $('#show-labels').onchange = e => e.target.checked ? labels.addTo(map) : map.removeLayer(labels);
  $('#show-borders').onchange = e => { if (borders) e.target.checked ? borders.addTo(map) : map.removeLayer(borders); if (selectedArea) e.target.checked ? selectedArea.addTo(map) : map.removeLayer(selectedArea); };
  $('#show-sites').onchange = e => { e.target.checked ? sites.addTo(map) : map.removeLayer(sites); syncGlobe(); };
  $('#world-view').onclick = () => { map.setView([20, 10], 2); if (globeVisible) $('#globe-toggle').click(); };
  $('#details-toggle').onclick = () => { if (state.selected !== null) { if ($('#card').hidden) renderCard(state.selected); else $('#card').hidden = true; } };
  $('#guide-explain').onclick = explainSite;
  $('#guide-layers').onclick = () => {
    if (matchMedia('(max-width: 1250px)').matches) $('#card').hidden = true;
    $('.layer-dock').open = true; $('.layer-dock').classList.toggle('highlight'); $('#overlay-layer').focus();
    guide('Choose any Earth trait in Data overlay, then use opacity to compare it with the basemap. Rankings still use your target and trait weights.');
  };
  $('#mascot-toggle').onclick = () => { const compact = $('.companion').classList.toggle('compact'); $('#mascot-toggle').textContent = compact ? '+' : '−'; $('#mascot-toggle').setAttribute('aria-expanded', String(!compact)); $('#mascot-toggle').setAttribute('aria-label', compact ? 'Expand mission guide' : 'Minimize mission guide'); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) $('agent-mascot').setAttribute('motion', '0');
  $('#globe-toggle').onclick = async () => {
    const button = $('#globe-toggle');
    if (!globe) {
      button.disabled = true;
      try { const { createGlobe } = await import('./globe.js'); globe = createGlobe($('#globe-canvas'), state.grid, geography, i => select(i, false)); }
      catch (error) { guide('3D is unavailable in this browser. You can continue exploring all layers on the 2D map.', 'error'); console.warn(error); return; }
      finally { button.disabled = false; }
    }
    globeVisible = !globeVisible; $('#globe-view').hidden = !globeVisible; button.setAttribute('aria-pressed', String(globeVisible));
    $('.layer-dock').classList.toggle('globe-mode', globeVisible);
    $('#basemap').disabled = globeVisible; $('#show-labels').disabled = globeVisible; $('#show-borders').disabled = globeVisible;
    globe.show(globeVisible); syncGlobe(true);
    if (globeVisible) guide('Earth in 3D. Drag to orbit, scroll to zoom, or select a purple beacon. The same NASA grid powers both views.');
    else map.invalidateSize();
  };
}

// ------------------------------------------------------------------ helpers

function km(la1, lo1, la2, lo2) {
  const r = Math.PI / 180, dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const pct = (s) => `${Math.round(s * 100)}%`;
function escapeHtml(value) { const span=document.createElement('span');span.textContent=value;return span.innerHTML; }
const coord = (la, lo) => `${Math.abs(la).toFixed(2)}°${la >= 0 ? "N" : "S"}, ${Math.abs(lo).toFixed(2)}°${lo >= 0 ? "E" : "W"}`;
function fmt(k, x) {
  if (x === null || x === undefined) return "no data";
  const d = TRAITS[k], v = x * (d.scale || 1);
  return `${v.toFixed(d.digits)}${d.unit ? (d.unit === "%" ? "%" : ` ${d.unit}`) : ""}`;
}

const appReady = main();
const missionIntro = createMissionIntro({ onEnter: async mode => { await appReady; map.invalidateSize(); globe?.show(globeVisible); if (mode === 'drone' && state.grid) openDrone(); } });
$('#intro-replay').onclick = () => { globe?.show(false); missionIntro.open(); };
