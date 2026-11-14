import { TRAITS, TARGETS, KNOWN_ANALOGS } from "./targets.js";

const TRAIT_KEYS = Object.keys(TRAITS);
const TOP_N = 15;
const MIN_SPACING_KM = 500;   // results are spread out so the list isn't 15 cells of the same desert
const KNOWN_RADIUS_KM = 200;

const state = { grid: null, stats: {}, target: TARGETS[0], weights: {}, scores: null, top: [], selected: null };
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
  const g = state.grid, order = Array.from(state.scores.keys()).sort((a, b) => state.scores[b] - state.scores[a]);
  const hideKnown = $("#hide-known").checked, top = [];
  for (const i of order) {
    if (hideKnown && g.known[i]) continue;
    if (top.some((j) => km(g.lat[i], g.lon[i], g.lat[j], g.lon[j]) < MIN_SPACING_KM)) continue;
    top.push(i);
    if (top.length === TOP_N) break;
  }
  state.top = top;
}

// ------------------------------------------------------------------ map

let map, overlay, marker;

function initMap() {
  map = L.map("map", { worldCopyJump: true, minZoom: 2, maxZoom: 8, zoomControl: true }).setView([20, 10], 2);
  L.tileLayer(
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
    { maxNativeZoom: 8, attribution: "Imagery: NASA GIBS / Blue Marble" },
  ).addTo(map);
  map.on("click", (e) => {
    const i = cellAt(e.latlng.lat, e.latlng.lng);
    if (i >= 0) select(i, false);
  });
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
  const g = state.grid, sorted = Float32Array.from(state.scores).sort();
  const q = (p) => sorted[Math.floor(p * (sorted.length - 1))];
  const lo = q(0.6), hi = q(0.998);
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
      const t = Math.min(1, Math.max(0, (state.scores[i] - lo) / (hi - lo)));
      if (t <= 0) continue;
      const c = colour(t), o = (y * W + x) * 4;
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = c[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL("image/png"), bounds = [[-85.0511, -180], [85.0511, 180]];
  if (overlay) overlay.setUrl(url);
  else overlay = L.imageOverlay(url, bounds, { opacity: 1, interactive: false }).addTo(map);
}

// ------------------------------------------------------------------ UI

function renderTargets() {
  const box = $("#targets");
  box.innerHTML = "";
  for (const t of TARGETS) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "target"; b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(t === state.target));
    b.innerHTML = `<div class="body">${t.body}</div><div class="name">${t.name}</div><div class="region">${t.region}</div>`;
    b.onclick = () => setTarget(t);
    box.appendChild(b);
  }
  $("#target-blurb").textContent = state.target.blurb;
}

function renderWeights() {
  const box = $("#weights");
  box.innerHTML = "";
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
  state.top.forEach((i, r) => {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button";
    if (i === state.selected) b.classList.add("active");
    b.innerHTML = `<span class="rank">${r + 1}</span>
      <span class="where">${coord(g.lat[i], g.lon[i])}${g.known[i] ? `<span class="tag">near ${g.known[i]}</span>` : ""}</span>
      <span class="score">${pct(state.scores[i])}</span>`;
    b.onclick = () => select(i, true);
    li.appendChild(b); box.appendChild(li);
  });
}

function select(i, fly) {
  const g = state.grid;
  state.selected = i;
  if (marker) marker.remove();
  marker = L.circleMarker([g.lat[i], g.lon[i]], { radius: 9, color: "#fff", weight: 2, fillColor: "#eb6834", fillOpacity: 0.9 }).addTo(map);
  if (fly) map.flyTo([g.lat[i], g.lon[i]], Math.max(map.getZoom(), 5), { duration: 0.8 });
  renderCard(i);
  renderResults();
}

function renderCard(i) {
  const g = state.grid, t = state.target, card = $("#card");
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
    <h3>${rank >= 0 ? `#${rank + 1} · ` : ""}${coord(la, lo)}</h3>
    <div class="sub">Earth analog for ${t.name} (${t.body}) · 0.5° cell (~55 km)</div>
    ${g.known[i] ? `<span class="known">⚑ Near a well-known analog: ${g.known[i]}</span>` : ""}
    <div class="overall"><b>${pct(state.scores[i])}</b><span class="muted">overall match</span></div>
    <h4>Trait by trait</h4>${rows.join("")}
    <h4>Good for testing</h4><ul>${uses}</ul>
    <h4>Where the analogy breaks down</h4><ul>${breaks}</ul>
    <div class="links">
      <a target="_blank" rel="noopener" href="https://worldview.earthdata.nasa.gov/?v=${lo - 3},${la - 2},${lo + 3},${la + 2}">Open in NASA Worldview</a>
      <a target="_blank" rel="noopener" href="https://www.google.com/maps/@${la},${lo},9z/data=!3m1!1e3">Satellite view</a>
    </div>`;
  card.hidden = false;
  card.querySelector(".close").onclick = () => { card.hidden = true; if (marker) marker.remove(); state.selected = null; renderResults(); };
}

function exportCsv() {
  const g = state.grid, head = ["rank", "lat", "lon", "match", ...TRAIT_KEYS, "near_known_analog"];
  const lines = [head.join(",")];
  state.top.forEach((i, r) => {
    lines.push([r + 1, g.lat[i], g.lon[i], state.scores[i].toFixed(3), ...TRAIT_KEYS.map((k) => g.traits[k][i] ?? ""), `"${g.known[i] || ""}"`].join(","));
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
  scoreAll();
  pickTop();
  drawOverlay();
  renderResults();
  if (state.selected !== null && !$("#card").hidden) renderCard(state.selected);
}

function setTarget(t) {
  state.target = t;
  state.weights = Object.fromEntries(TRAIT_KEYS.map((k) => [k, t.traits[k].weight]));
  history.replaceState(null, "", `#${t.id}`);
  renderTargets();
  renderWeights();
  update();
  if (state.top.length) select(state.top[0], true);
}

async function main() {
  initMap();
  try {
    state.grid = await loadGrid();
  } catch (err) {
    $("#loading").textContent = "Couldn't load the Earth data grid. Run pipeline/build_grid.py, then serve the web folder.";
    console.error(err);
    return;
  }
  computeStats(state.grid);
  $("#data-year").textContent = state.grid.year;
  $("#hide-known").onchange = () => { pickTop(); renderResults(); };
  $("#reset-weights").onclick = () => setTarget(state.target);
  $("#export").onclick = exportCsv;
  const fromHash = TARGETS.find((t) => `#${t.id}` === location.hash);
  setTarget(fromHash || TARGETS[0]);
  $("#loading").hidden = true;
}

// ------------------------------------------------------------------ helpers

function km(la1, lo1, la2, lo2) {
  const r = Math.PI / 180, dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const pct = (s) => `${Math.round(s * 100)}%`;
const coord = (la, lo) => `${Math.abs(la).toFixed(2)}°${la >= 0 ? "N" : "S"}, ${Math.abs(lo).toFixed(2)}°${lo >= 0 ? "E" : "W"}`;
function fmt(k, x) {
  if (x === null || x === undefined) return "no data";
  const d = TRAITS[k], v = x * (d.scale || 1);
  return `${v.toFixed(d.digits)}${d.unit ? (d.unit === "%" ? "%" : ` ${d.unit}`) : ""}`;
}

main();
