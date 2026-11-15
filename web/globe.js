import * as THREE from './vendor/three.module.js';

const position = (lat, lon, radius = 2.01) => {
  const phi = (lat * Math.PI) / 180,
    theta = (lon * Math.PI) / 180;
  return new THREE.Vector3(
    radius * Math.cos(phi) * Math.sin(theta),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.cos(theta),
  );
};

export function createGlobe(container, grid, geography, onSelect) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.z = 7.8;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '3D Earth with selectable ranked analog sites');
  const earth = new THREE.Group();
  scene.add(earth);
  scene.add(new THREE.AmbientLight(0x8bceeb, 2));
  const light = new THREE.DirectionalLight(0xbbffe5, 3);
  light.position.set(-4, 3, 6);
  scene.add(light);
  earth.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(2, 64, 48),
      new THREE.MeshPhongMaterial({ color: 0x081b2b, shininess: 32 }),
    ),
  );
  const landGeometry = new THREE.BufferGeometry();
  const landPositions = [];
  for (let i = 0; i < grid.idx.length; i += 2)
    landPositions.push(...position(grid.lat[i], grid.lon[i]).toArray());
  landGeometry.setAttribute('position', new THREE.Float32BufferAttribute(landPositions, 3));
  const landMaterial = new THREE.PointsMaterial({
    size: 0.013,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
  });
  earth.add(new THREE.Points(landGeometry, landMaterial));
  if (geography) {
    const vertices = [];
    for (const f of geography.features) {
      const polygons =
        f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const rings of polygons)
        for (const ring of rings)
          for (let i = 1; i < ring.length; i++) {
            vertices.push(
              ...position(ring[i - 1][1], ring[i - 1][0], 2.025).toArray(),
              ...position(ring[i][1], ring[i][0], 2.025).toArray(),
            );
          }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    earth.add(
      new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x87edda, transparent: true, opacity: 0.28 }),
      ),
    );
  }
  const beacons = new THREE.Group();
  earth.add(beacons);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(2.06, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0x77dace,
      wireframe: true,
      transparent: true,
      opacity: 0.025,
    }),
  );
  earth.add(halo);
  let visible = false,
    dragging = false,
    moved = false,
    lastX = 0,
    lastY = 0;
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = false;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX,
      dy = e.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    earth.rotation.y += dx * 0.007;
    earth.rotation.x = THREE.MathUtils.clamp(earth.rotation.x + dy * 0.007, -1.2, 1.2);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener('pointercancel', () => {
    dragging = false;
  });
  canvas.addEventListener('pointerup', (e) => {
    dragging = false;
    if (moved) return;
    const rect = canvas.getBoundingClientRect(),
      ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hits = ray.intersectObjects(earth.children, true);
    const first = hits.find((hit) => hit.object.isMesh && hit.object !== halo);
    if (first?.object.userData.index !== undefined) onSelect(first.object.userData.index);
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + e.deltaY * 0.004, 5, 11);
    },
    { passive: false },
  );
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  renderer.setAnimationLoop(() => {
    if (!visible || document.hidden) return;
    if (!dragging && !reduced.matches) earth.rotation.y += 0.0007;
    renderer.render(scene, camera);
  });
  return {
    show(value) {
      visible = value;
      if (value) resize();
    },
    update(values, top, selected, showSites, opacity, focus = false, layer = 'match') {
      const colours = [],
        c = new THREE.Color();
      for (let i = 0; i < grid.idx.length; i += 2) {
        const value = values?.[i];
        c.set(value === null || value === undefined ? '#274855' : '#245362');
        if (Number.isFinite(value)) {
          const t = Math.max(0, Math.min(1, value));
          const tint =
            layer === 'match'
              ? new THREE.Color('#b8461c').lerp(new THREE.Color('#ffb38f'), t)
              : new THREE.Color('#2d78aa').lerp(new THREE.Color('#c3eba0'), t);
          c.lerp(tint, opacity * (layer === 'match' ? t : 1));
        }
        colours.push(c.r, c.g, c.b);
      }
      landGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
      for (const child of [...beacons.children]) {
        beacons.remove(child);
        child.geometry.dispose();
        child.material.dispose();
      }
      if (showSites)
        for (const index of new Set([...top, ...(selected === null ? [] : [selected])])) {
          const dot = new THREE.Mesh(
            new THREE.SphereGeometry(index === selected ? 0.043 : 0.028, 12, 10),
            new THREE.MeshBasicMaterial({ color: index === selected ? 0xffffff : 0xd4b0ff }),
          );
          dot.position.copy(position(grid.lat[index], grid.lon[index], 2.055));
          dot.userData.index = index;
          beacons.add(dot);
        }
      if (focus && selected !== null) {
        earth.rotation.set(
          (grid.lat[selected] * Math.PI) / 180,
          (-grid.lon[selected] * Math.PI) / 180,
          0,
        );
      }
    },
  };
}
