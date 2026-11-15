import { TARGETS } from './targets.js';
import { SITE_ANCHORS, analyseCapture } from './drone-model.js';

const coord = (value) => `${value.lat.toFixed(5)}°, ${value.lon.toFixed(5)}°`;
export function createDroneExplorer({ getContext, onMatch, onClose }) {
  const root = document.createElement('section');
  root.id = 'drone-explorer';
  root.className = 'drone-explorer';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'drone-title');
  root.innerHTML = `<header class="drone-header"><div><span class="eyebrow">ANALOG FINDER / EXPLORATION DIVISION</span><h2 id="drone-title">Beyond the horizon.</h2></div><span class="drone-demo-badge">INTERACTIVE SIMULATION</span><button id="drone-close" class="drone-quiet" aria-label="Close drone exploration">Back to Earth ↗</button></header>
    <div class="drone-layout"><aside class="drone-controls"><div class="eyebrow">01 / MISSION CONFIGURATION</div>
    <div class="drone-body-tabs" role="group" aria-label="Select drone"><button data-body="Moon" aria-pressed="true">◒ Lunar Drone<small>THRUSTER EXPLORER</small></button><button data-body="Mars" aria-pressed="false">◉ Mars Drone<small>COAXIAL ROTORCRAFT</small></button></div>
    <label class="drone-field">Scenario region<select id="drone-site"></select></label>
    <details class="drone-planner" open><summary>Planetary deployment coordinates</summary><p>Click this schematic coordinate map or enter a position. North is up; longitude is east-positive.</p><button id="planet-planner" aria-label="Choose planetary landing coordinates on schematic map"><span class="planner-equator"></span><span id="planner-pin">⊕</span><span class="planner-label">SCHEMATIC · NOT ORBITAL IMAGERY</span></button>
    <div class="drone-coordinate-fields"><label>Latitude °<input id="drone-lat" type="number" min="-90" max="90" step="0.00001"></label><label>Longitude °<input id="drone-lon" type="number" min="-180" max="180" step="0.00001"></label></div><button id="drone-deploy" class="drone-quiet">Set deployment point ↗</button></details>
    <p id="drone-earth-reference" class="drone-note"></p><button id="drone-use-reference" class="drone-quiet">Attach selected Earth map site</button>
    <div class="drone-action-stack"><button id="drone-launch" class="drone-primary">Launch Drone ↗</button><button id="drone-return" class="drone-secondary">Return to Base</button></div>
    <div class="eyebrow drone-flight-heading">02 / FLIGHT CONTROLS</div><div class="drone-dpad" aria-label="Drone movement"><button data-move="w" aria-label="Fly north">↑</button><button data-move="a" aria-label="Fly west">←</button><button data-move="s" aria-label="Fly south">↓</button><button data-move="d" aria-label="Fly east">→</button><button data-move="e" aria-label="Ascend">＋</button><button data-move="q" aria-label="Descend">−</button></div>
    <p class="drone-note">Hold arrows or WASD to fly. Q / E change altitude. Drag the scene to orbit.</p><p class="drone-note">Stylized vehicle and flight dynamics. No real drone connection.</p></aside>
    <main class="drone-stage"><div id="drone-canvas"></div><div class="drone-stage-top"><span id="drone-callsign">SELENE / LUNAR SURVEY</span><span id="drone-flight-status">Ready at base</span></div><div id="drone-notice" role="status">Preparing exploration environment…</div><div class="drone-reticle" aria-hidden="true"><i></i></div><div class="drone-view-controls" role="group" aria-label="Drone camera view"><button data-view="chase" aria-pressed="true">Third person</button><button data-view="fpv" aria-pressed="false">First person</button><button data-view="down" aria-pressed="false">Downward camera</button></div><div class="drone-telemetry"><div><small>PLANETARY POSITION</small><strong id="drone-position">—</strong></div><div><small>FLIGHT ALTITUDE / SIM</small><strong id="drone-altitude">0 m AGL</strong></div><div><small>GROUND ELEVATION / SIM</small><strong id="drone-ground">—</strong></div></div><span class="drone-feed-label">↓ NADIR CAMERA / SIMULATED</span><div id="drone-flash" aria-hidden="true"></div><div id="drone-matching" hidden><div class="drone-scan-orbit"></div><h3>Scanning Earth’s environments</h3><p>Comparing the capture profile with NASA’s Earth grid…</p></div></main>
    <aside class="drone-analysis"><span class="eyebrow">03 / CAPTURE & DISCOVERY</span><div class="drone-analysis-heading"><h3>Mission intelligence</h3><span id="drone-capture-count">0 frames</span></div><button id="drone-capture" class="drone-primary">◎ Capture Image</button><div id="drone-capture-content"><div class="drone-empty"><span>⌖</span><h4>Your next discovery starts here.</h4><p>Launch, explore and capture a surface image to prepare an Earth analogue search.</p></div></div><button id="drone-match" class="drone-primary" disabled>Find Earth Analogues ↗</button><button id="drone-show-results" class="drone-quiet" hidden>View previous Earth results ↗</button><div class="drone-history-heading"><h4>Flight recorder</h4><span>THIS TAB</span></div><div id="drone-history"></div><div class="drone-science-note"><strong>SIMULATION / DATA PROVENANCE</strong><p>Images, relative elevation, temperature and terrain are procedural. Climate traits are assumptions from the selected scenario. Earth matches use the existing NASA grid. Coordinates track the selected planetary location; they are never mapped directly to Earth.</p></div></aside></div>`;
  document.body.appendChild(root);
  const $ = (selector) => root.querySelector(selector);
  const emptyCaptureContent = $('#drone-capture-content').innerHTML;
  const sessions = new Map(),
    captures = [];
  let body = 'Moon',
    scene = null,
    currentCapture = null,
    sequence = 0,
    mountVersion = 0,
    openingButton = null,
    focusController = null,
    busy = false,
    latestResult = null,
    transitionTimer = null,
    transitionResolve = null;
  function sessionFor(planet) {
    if (!sessions.has(planet)) {
      const context = getContext();
      const target =
        context.target?.body === planet && !context.target.id.startsWith('drone-')
          ? context.target
          : TARGETS.find((t) => t.body === planet);
      const [lat, lon] = SITE_ANCHORS[target.id];
      sessions.set(planet, {
        body: planet,
        target,
        origin: { lat, lon },
        pose: null,
        reference: null,
      });
    }
    return sessions.get(planet);
  }
  function notice(text, error = false) {
    $('#drone-notice').textContent = text;
    $('#drone-notice').classList.toggle('error', error);
  }
  function setBusy(value) {
    busy = value;
    $('#drone-matching').hidden = !value;
    refreshButtons();
  }
  function refreshButtons() {
    const status = scene?.pose().status;
    const canCapture = ['Hovering', 'Exploring'].includes(status);
    const grounded = !scene || scene.pose().altitude < 1;
    $('#drone-launch').disabled = !scene || !grounded || busy;
    $('#drone-return').disabled =
      !scene || grounded || busy || ['Returning to base', 'Landing'].includes(status);
    $('#drone-capture').disabled = !scene || !canCapture || busy;
    $('#drone-match').disabled = !currentCapture || busy;
    $('#drone-deploy').disabled = busy;
    root
      .querySelectorAll('[data-body],#drone-site,#drone-lat,#drone-lon,#planet-planner')
      .forEach((button) => (button.disabled = busy));
    root
      .querySelectorAll('[data-move]')
      .forEach((button) => (button.disabled = !scene || !canCapture || busy));
  }
  function updatePin() {
    const session = sessionFor(body);
    $('#planner-pin').style.left = `${((session.origin.lon + 180) / 360) * 100}%`;
    $('#planner-pin').style.top = `${((90 - session.origin.lat) / 180) * 100}%`;
  }
  function renderReference() {
    const ref = sessionFor(body).reference;
    $('#drone-earth-reference').textContent = ref
      ? `Earth comparison reference: ${ref.name} (${coord(ref)}). This is not the planetary deployment location.`
      : 'Optionally select land on the Earth map and attach it as a comparison reference. Planetary deployment uses the coordinate planner above.';
  }
  function configure() {
    const session = sessionFor(body);
    root.dataset.body = body;
    root
      .querySelectorAll('[data-body]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.body === body)));
    $('#drone-site').replaceChildren(
      ...TARGETS.filter((t) => t.body === body).map((t) => {
        const o = document.createElement('option');
        o.value = t.id;
        o.textContent = t.name;
        return o;
      }),
    );
    $('#drone-site').value = session.target.id;
    $('#drone-lat').value = session.origin.lat.toFixed(5);
    $('#drone-lon').value = session.origin.lon.toFixed(5);
    updatePin();
    renderReference();
    $('#drone-callsign').textContent =
      body === 'Moon' ? 'SELENE / LUNAR SURVEY' : 'ARES / MARTIAN SURVEY';
    $('#drone-position').textContent = coord(session.origin);
    $('#drone-altitude').textContent = `${Math.round((session.pose?.altitude || 0) * 10)} m AGL`;
    $('#drone-flight-status').textContent = session.pose?.status || 'Ready at base';
    root
      .querySelectorAll('[data-view]')
      .forEach((button) =>
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.view === (session.view || 'chase')),
        ),
      );
  }
  async function mount() {
    const version = ++mountVersion;
    scene?.dispose();
    scene = null;
    refreshButtons();
    $('#drone-canvas').replaceChildren();
    notice('Preparing simulated terrain…');
    try {
      const { createDroneScene } = await import('./drone-scene.js');
      if (version !== mountVersion || root.hidden) return;
      scene = createDroneScene(
        $('#drone-canvas'),
        sessionFor(body),
        (telemetry) => {
          $('#drone-flight-status').textContent = telemetry.status;
          $('#drone-position').textContent = coord(telemetry);
          $('#drone-position').dataset.lat = telemetry.lat;
          $('#drone-position').dataset.lon = telemetry.lon;
          $('#drone-altitude').textContent = `${Math.round(telemetry.altitude * 10)} m AGL`;
          $('#drone-ground').textContent = `${Math.round(telemetry.ground)} m · relative`;
          refreshButtons();
        },
        (message) => {
          notice(message, true);
          scene?.dispose();
          scene = null;
          refreshButtons();
        },
      );
      notice('Mission ready. Launch to explore the selected planetary position.');
      refreshButtons();
    } catch (error) {
      if (version === mountVersion) {
        notice(
          `3D unavailable: ${error.message}. Enable WebGL, then close and reopen this mode. Earth exploration remains available.`,
          true,
        );
        refreshButtons();
      }
    }
  }
  function renderCapture() {
    $('#drone-capture-count').textContent =
      `${captures.length} frame${captures.length === 1 ? '' : 's'}`;
    if (!currentCapture) {
      $('#drone-capture-content').innerHTML = emptyCaptureContent;
      renderHistory();
      refreshButtons();
      return;
    }
    const capture = currentCapture;
    $('#drone-capture-content').innerHTML =
      `<figure class="drone-captured-frame"><img alt="Simulated ${capture.body} downward terrain capture" src="${capture.image}"><figcaption>SIMULATED FRAME ${capture.id} / ${capture.body.toUpperCase()}</figcaption></figure><dl class="drone-capture-data"><div><dt>Planet</dt><dd>${capture.body}</dd></div><div><dt>Latitude / north +</dt><dd>${capture.coordinates.lat.toFixed(5)}°</dd></div><div><dt>Longitude / east +</dt><dd>${capture.coordinates.lon.toFixed(5)}°</dd></div><div><dt>Elevation / simulated</dt><dd>${Math.round(capture.elevation)} m relative</dd></div><div><dt>Temperature / simulated</dt><dd>${capture.temperature.toFixed(1)} °C</dd></div><div><dt>Relief / simulated, 55 km</dt><dd>${Math.round(capture.roughness)} m SD</dd></div><div><dt>Mission timestamp</dt><dd>${new Date(capture.timestamp).toLocaleString(undefined, { timeZone: 'Asia/Singapore', hour12: false })} SGT</dd></div><div><dt>Capture status</dt><dd>${capture.status}</dd></div></dl><p class="drone-note">Scenario: ${capture.targetName}. These are demonstration assumptions, not measurements at these coordinates. Relative elevation is excluded from matching.</p>`;
    renderHistory();
    refreshButtons();
  }
  function renderHistory() {
    $('#drone-history').replaceChildren(
      ...captures
        .slice()
        .reverse()
        .map((c) => {
          const button = document.createElement('button');
          button.className = 'drone-history-item';
          button.setAttribute('aria-pressed', String(c === currentCapture));
          button.innerHTML = `<img src="${c.image}" alt=""><span>${c.body} / Frame ${c.id}<small>${coord(c.coordinates)}</small></span>`;
          button.onclick = () => {
            currentCapture = c;
            renderCapture();
            refreshButtons();
          };
          return button;
        }),
    );
  }
  function close() {
    if (transitionTimer) {
      clearTimeout(transitionTimer);
      transitionTimer = null;
      transitionResolve?.();
      transitionResolve = null;
    }
    ++mountVersion;
    scene?.dispose();
    scene = null;
    root.hidden = true;
    document.body.classList.remove('drone-open');
    focusController?.abort();
    setBusy(false);
    onClose?.();
    openingButton?.focus();
  }
  root.querySelectorAll('[data-body]').forEach(
    (button) =>
      (button.onclick = () => {
        body = button.dataset.body;
        currentCapture = captures.findLast((c) => c.body === body) || null;
        configure();
        renderCapture();
        mount();
      }),
  );
  $('#drone-site').onchange = (e) => {
    const session = sessionFor(body);
    session.target = TARGETS.find((t) => t.id === e.target.value);
    const [lat, lon] = SITE_ANCHORS[session.target.id];
    session.origin = { lat, lon };
    scene?.dispose();
    scene = null;
    session.pose = null;
    configure();
    mount();
  };
  $('#planet-planner').onclick = (e) => {
    if (!e.detail) {
      notice('Use the latitude and longitude fields to choose an exact deployment point.');
      $('#drone-lat').focus();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    $('#drone-lat').value = (90 - ((e.clientY - rect.top) / rect.height) * 180).toFixed(5);
    $('#drone-lon').value = (((e.clientX - rect.left) / rect.width) * 360 - 180).toFixed(5);
    deploy();
  };
  function deploy() {
    const latInput = $('#drone-lat'),
      lonInput = $('#drone-lon');
    if (
      !latInput.checkValidity() ||
      !lonInput.checkValidity() ||
      latInput.value === '' ||
      lonInput.value === ''
    ) {
      notice('Enter a latitude from −90 to 90 and a longitude from −180 to 180.', true);
      return;
    }
    const session = sessionFor(body);
    scene?.dispose();
    scene = null;
    session.origin = { lat: Number(latInput.value), lon: Number(lonInput.value) };
    session.pose = null;
    configure();
    mount();
  }
  $('#drone-deploy').onclick = deploy;
  $('#drone-use-reference').onclick = () => {
    sessionFor(body).reference = getContext().reference;
    renderReference();
    notice(
      sessionFor(body).reference
        ? 'Earth reference attached. Planetary coordinates are unchanged.'
        : 'Select a land cell on Earth first, then reopen the drone mode.',
    );
  };
  $('#drone-launch').onclick = () => {
    scene?.launch();
    notice('Exploration drone deployed. Ascending to survey altitude.');
    refreshButtons();
    $('#drone-canvas canvas')?.focus();
  };
  $('#drone-return').onclick = () => {
    scene?.returnToBase();
    notice('Returning to base. Navigation and landing sequence active.');
    refreshButtons();
  };
  root.querySelectorAll('[data-move]').forEach((button) => {
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      scene?.hold(button.dataset.move, true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'])
      button.addEventListener(type, () => scene?.hold(button.dataset.move, false));
    button.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        scene?.hold(button.dataset.move, true);
      }
    });
    button.addEventListener('keyup', () => scene?.hold(button.dataset.move, false));
  });
  root.querySelectorAll('[data-view]').forEach(
    (button) =>
      (button.onclick = () => {
        scene?.setView(button.dataset.view);
        root
          .querySelectorAll('[data-view]')
          .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      }),
  );
  $('#drone-capture').onclick = () => {
    try {
      const { image, pose } = scene.capture();
      const session = sessionFor(body);
      currentCapture = {
        ...analyseCapture(session, pose, ++sequence),
        image,
        reference: session.reference,
      };
      captures.push(currentCapture);
      // Bound memory use while keeping each body's last mission state.
      if (captures.length > 20) captures.shift();
      renderCapture();
      $('#drone-flash').classList.remove('active');
      void $('#drone-flash').offsetWidth;
      $('#drone-flash').classList.add('active');
      notice('Terrain image captured. Surface profile ready for analysis.');
    } catch (error) {
      notice(error.message, true);
    }
  };
  $('#drone-match').onclick = async () => {
    if (!currentCapture || busy) return;
    const capture = currentCapture,
      version = mountVersion;
    setBusy(true);
    notice('Terrain image captured. Analysing surface characteristics…');
    try {
      await new Promise((resolve) => {
        transitionResolve = resolve;
        transitionTimer = setTimeout(() => {
          transitionTimer = null;
          transitionResolve = null;
          resolve();
        }, 700);
      });
      if (root.hidden || version !== mountVersion) return;
      const result = await onMatch(capture);
      if (root.hidden || version !== mountVersion) return;
      capture.results = result;
      latestResult = capture;
      $('#drone-show-results').hidden = false;
      close();
    } catch (error) {
      notice(
        `Earth matching unavailable: ${error.message}. Your capture is retained; try again.`,
        true,
      );
    } finally {
      if (version === mountVersion) setBusy(false);
    }
  };
  $('#drone-show-results').onclick = async () => {
    if (!latestResult || busy) return;
    setBusy(true);
    try {
      await onMatch(latestResult);
      close();
    } catch (error) {
      notice(error.message, true);
    } finally {
      setBusy(false);
    }
  };
  $('#drone-close').onclick = close;
  return {
    open({ attachReference = false } = {}) {
      if (!root.hidden) return;
      openingButton = document.activeElement;
      const context = getContext();
      if (!sessions.size) body = context.target?.body || 'Moon';
      root.hidden = false;
      document.body.classList.add('drone-open');
      if (context.reference && (attachReference || !sessionFor(body).reference))
        sessionFor(body).reference = context.reference;
      configure();
      renderCapture();
      mount();
      $('#drone-close').focus();
      focusController = new AbortController();
      root.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
            return;
          }
          if (e.key !== 'Tab') return;
          const nodes = [
            ...root.querySelectorAll(
              'button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,canvas',
            ),
          ].filter((n) => n.getClientRects().length);
          const first = nodes[0],
            last = nodes.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        },
        { signal: focusController.signal },
      );
    },
  };
}
