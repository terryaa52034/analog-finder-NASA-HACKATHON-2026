import * as THREE from './vendor/three.module.js';
import { EffectComposer } from './vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/addons/postprocessing/OutputPass.js';

export const CINEMATIC_DURATION = 13.5;
export const BODY_CENTRES = { Moon: [-5, 0, 0], Mars: [0, 0, 0], Earth: [5, 0, 0] };
const clamp = THREE.MathUtils.clamp;
const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a.map((value, i) => THREE.MathUtils.lerp(value, b[i], t));

// Pure timeline: continuous camera positions and a single, exact beam axis.
export function sampleCinematic(time, aspect = 1.5) {
  const wide = aspect < 0.85 ? 30 : Math.max(20, 7.6 / (Math.tan((21 * Math.PI) / 180) * aspect));
  const keys = [
    [0, [-7, 1.15, 7.2], [-5, 0, 0]],
    [1.9, [-4.45, 0.4, 3.9], [-5, 0, 0]],
    [4.2, [0.55, 0.5, 4.6], [0, 0, 0]],
    [6.5, [5.7, 0.55, 5.3], [5, 0, 0]],
    [8.5, [0, 1.3, wide], [0, 0, 0]],
    [10.5, [0, 1.3, wide], [0, 0, 0]],
    [12, [5.7, 0.5, 5.2], [5, 0, 0]],
    [13.5, [6.8, 0.65, 4.8], [5, 0, 0]],
  ];
  let segment = keys.length - 2;
  for (let i = 0; i < keys.length - 1; i++)
    if (time < keys[i + 1][0]) {
      segment = i;
      break;
    }
  const a = keys[segment],
    b = keys[segment + 1],
    t = smooth((time - a[0]) / (b[0] - a[0]));
  const stage =
    time < 2.1
      ? 'moon'
      : time < 4.4
        ? 'mars'
        : time < 6.7
          ? 'earth'
          : time < 8.5
            ? 'alignment'
            : time < 10.5
              ? 'connection'
              : time < 12
                ? 'arrival'
                : 'orbit';
  return {
    stage,
    camera: mix(a[1], b[1], t),
    target: mix(a[2], b[2], t),
    beamHead: -8 + 16 * clamp((time - 8.5) / 1.8, 0, 1),
    beamOpacity: smooth((time - 8.45) / 0.2) * (1 - smooth((time - 10.5) / 1.5)),
    otherOpacity: 1 - smooth((time - 10.5) / 1.5),
    reveal: smooth((time - 12.15) / 1.35),
    progress: clamp(time / CINEMATIC_DURATION, 0, 1),
  };
}

export function createCinematicIntro(host, { onFrame, onComplete, onError }) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(42, 1, 0.05, 300);
  const controller = new AbortController();
  let composer,
    bloom,
    renderPass,
    output,
    observer,
    assetTimer,
    disposed = false,
    completed = false,
    ready = false,
    paused = false;
  const textures = new Set(),
    planets = [],
    effects = [];
  const mobile = matchMedia('(max-width: 820px)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1 : 1.25));
  renderer.setClearColor('#01030a', 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.domElement.setAttribute(
    'aria-label',
    'Cinematic journey from the Moon to Mars and Earth',
  );
  host.appendChild(renderer.domElement);

  function dispose() {
    if (disposed) return;
    disposed = true;
    controller.abort();
    clearTimeout(assetTimer);
    observer?.disconnect();
    renderer.setAnimationLoop(null);
    const geometries = new Set(),
      materials = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material)
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(
          (material) => {
            materials.add(material);
            for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
          },
        );
    });
    geometries.forEach((value) => value.dispose());
    materials.forEach((value) => value.dispose());
    textures.forEach((value) => value.dispose());
    bloom?.dispose();
    bloom?.materialHighPassFilter?.dispose();
    renderPass?.dispose();
    output?.dispose();
    composer?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }
  try {
    const universe = new THREE.Group();
    scene.add(universe);
    scene.add(new THREE.AmbientLight('#9db7d7', 0.55));
    const key = new THREE.DirectionalLight('#e7f0ff', 3.2);
    key.position.set(-7, 5, 8);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#719bca', 0.35);
    fill.position.set(8, -2, 1);
    scene.add(fill);
    const loader = new THREE.TextureLoader(),
      loads = [];
    function loadTexture(url, apply, colorSpace = THREE.SRGBColorSpace) {
      const promise = loader
        .loadAsync(url)
        .then((texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = colorSpace;
          texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
          textures.add(texture);
          apply(texture);
        })
        .catch((error) => {
          if (!disposed) console.warn(`Cinematic texture unavailable: ${url}`, error.message);
        });
      loads.push(promise);
    }
    function atmosphere(radius, color, strength) {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          glow: { value: new THREE.Color(color) },
          strength: { value: strength },
          pulse: { value: 0 },
          fade: { value: 1 },
        },
        vertexShader:
          'varying vec3 n; varying vec3 eye; varying vec3 local; void main(){vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal);eye=normalize(-p.xyz);local=normalize(position);gl_Position=projectionMatrix*p;}',
        fragmentShader:
          'uniform vec3 glow;uniform float strength;uniform float pulse;uniform float fade;varying vec3 n;varying vec3 eye;varying vec3 local;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(eye))),3.);float band=pow(max(0.,1.-abs(local.x)),8.);float a=(rim*strength+pulse*(rim+band*.3))*fade;gl_FragColor=vec4(glow*(1.+pulse*3.),a);}',
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      return new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), material);
    }
    for (const [name, radius, color, url] of [
      ['Moon', 1.05, '#a7adb8', 'assets/moon.jpg'],
      ['Mars', 1.32, '#bc7856', 'assets/mars.jpg'],
      ['Earth', 1.62, '#4c839d', 'assets/earth.jpg'],
    ]) {
      const group = new THREE.Group();
      group.position.fromArray(BODY_CENTRES[name]);
      universe.add(group);
      const geometry = new THREE.SphereGeometry(radius, mobile ? 64 : 96, mobile ? 40 : 64);
      if (name !== 'Earth') {
        const position = geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
          const x = position.getX(i),
            y = position.getY(i),
            z = position.getZ(i),
            relief = 1 + 0.0025 * Math.sin(x * 31 + z * 19) * Math.cos(y * 37);
          position.setXYZ(i, x * relief, y * relief, z * relief);
        }
        geometry.computeVertexNormals();
      }
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: name === 'Earth' ? 0.78 : 0.96,
        metalness: 0,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.y = name === 'Earth' ? -0.5 : 0.6;
      group.add(mesh);
      loadTexture(url, (texture) => {
        material.map = texture;
        material.color.set('#ffffff');
        if (name !== 'Earth') {
          material.bumpMap = texture;
          material.bumpScale = 0.035;
        }
        material.needsUpdate = true;
      });
      const halo = atmosphere(
        radius * 1.025,
        name === 'Mars' ? '#e89568' : '#78cfff',
        name === 'Earth' ? 0.38 : name === 'Mars' ? 0.12 : 0,
      );
      group.add(halo);
      const planet = { name, group, mesh, halo, radius };
      planets.push(planet);
      if (name === 'Earth') {
        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(radius * 1.012, 64, 40),
          new THREE.MeshStandardMaterial({
            color: '#ffffff',
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            roughness: 1,
          }),
        );
        loadTexture(
          'assets/earth-clouds.jpg',
          (texture) => {
            clouds.material.alphaMap = texture;
            clouds.material.needsUpdate = true;
          },
          THREE.NoColorSpace,
        );
        group.add(clouds);
        planet.clouds = clouds;
      }
    }
    // Seeded, layered starfield. All objects live beyond the camera journey.
    let seed = 8497;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const points = [],
      colors = [];
    for (let i = 0; i < (mobile ? 1600 : 2600); i++) {
      const theta = random() * Math.PI * 2,
        z = random() * 2 - 1,
        r = 70 + random() * 75,
        s = Math.sqrt(1 - z * z);
      points.push(r * s * Math.cos(theta), r * z, r * s * Math.sin(theta));
      const c = new THREE.Color().setHSL(
        0.56 + random() * 0.15,
        0.12 + random() * 0.25,
        0.55 + random() * 0.4,
      );
      colors.push(c.r, c.g, c.b);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    scene.add(
      new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({
          size: 0.12,
          vertexColors: true,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        }),
      ),
    );
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const ctx = glowCanvas.getContext('2d'),
      gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, '#ffffffff');
    gradient.addColorStop(0.15, '#ffffff66');
    gradient.addColorStop(0.5, '#ffffff11');
    gradient.addColorStop(1, '#ffffff00');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    textures.add(glowTexture);
    for (const [x, y, z, color, sx, sy] of [
      [-20, 12, -48, '#5a568a', 85, 43],
      [30, -14, -65, '#1c6174', 95, 55],
      [-40, -15, -90, '#3c335b', 75, 70],
    ]) {
      const nebula = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color,
          transparent: true,
          opacity: 0.055,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      nebula.position.set(x, y, z);
      nebula.scale.set(sx, sy, 1);
      scene.add(nebula);
    }
    // Beam endpoints and every planet centre share local y=0,z=0 exactly.
    const beam = new THREE.Group();
    universe.add(beam);
    for (const [radius, color, opacity] of [
      [0.018, new THREE.Color(3, 4, 5), 1],
      [0.055, new THREE.Color(0.2, 2.5, 5), 0.28],
      [0.12, new THREE.Color(0.05, 0.8, 2), 0.07],
    ]) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, 1, 12),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      mesh.rotation.z = -Math.PI / 2;
      mesh.renderOrder = 20;
      beam.add(mesh);
      effects.push({ mesh, opacity });
    }
    const head = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: new THREE.Color(0.7, 3, 5),
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    head.scale.set(1, 1, 1);
    head.renderOrder = 21;
    universe.add(head);
    const flare = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: new THREE.Color(0.5, 2, 4),
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    flare.scale.set(6, 0.12, 1);
    flare.renderOrder = 22;
    universe.add(flare);
    const particles = new Float32Array(120 * 3),
      particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: new THREE.Color(2, 4, 5),
      size: 0.045,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const particleMesh = new THREE.Points(particleGeometry, particleMaterial);
    particleMesh.frustumCulled = false;
    particleMesh.renderOrder = 23;
    universe.add(particleMesh);
    // Retain an orbiting Earth as the journey settles into mission control.
    const orbitPoints = Array.from({ length: 129 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return new THREE.Vector3(5 + 2.45 * Math.cos(a), 0.42 * Math.sin(a), 1.05 * Math.sin(a));
    });
    const orbit = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(orbitPoints),
      new THREE.LineBasicMaterial({ color: '#a6f4d9', transparent: true, opacity: 0 }),
    );
    universe.add(orbit);
    const orbitalLight = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: new THREE.Color(0.6, 2.5, 2),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
        toneMapped: false,
      }),
    );
    orbitalLight.scale.set(0.35, 0.35, 1);
    universe.add(orbitalLight);
    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(scene, camera);
    bloom = new UnrealBloomPass(new THREE.Vector2(640, 360), 0.65, 0.35, 1.6);
    output = new OutputPass();
    composer.addPass(renderPass);
    composer.addPass(bloom);
    composer.addPass(output);
    composer.setPixelRatio(mobile ? 0.8 : 1);
    function resize() {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      composer.setSize(width, height);
      universe.rotation.z = camera.aspect < 0.85 ? -Math.PI / 2 : 0;
    }
    observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let elapsed = 0,
      last = performance.now(),
      samples = 0,
      totalFrame = 0,
      qualityReduced = false,
      orbitState = null,
      orbitZoom = null;
    const rotatedCamera = new THREE.Vector3(),
      rotatedTarget = new THREE.Vector3(),
      rotation = new THREE.Euler();
    rotation.z = universe.rotation.z;
    rotatedCamera.fromArray(sampleCinematic(0, camera.aspect).camera).applyEuler(rotation);
    rotatedTarget.fromArray(BODY_CENTRES.Moon).applyEuler(rotation);
    camera.position.copy(rotatedCamera);
    camera.lookAt(rotatedTarget);
    Promise.allSettled(loads).then(() => {
      if (!disposed) ready = true;
    });
    assetTimer = setTimeout(() => {
      ready = true;
    }, 900);
    renderer.domElement.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        dispose();
        onError?.(
          'Graphics connection interrupted. You can enter the app or return to the static briefing.',
        );
      },
      { signal: controller.signal },
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        last = performance.now();
      },
      { signal: controller.signal },
    );
    renderer.setAnimationLoop((now) => {
      if (disposed || completed) return;
      const delta = (now - last) / 1000;
      last = now;
      if (document.hidden) return;
      if (orbitState) {
        orbitState.time += delta;
        const blend = smooth(orbitState.time / 1.35);
        universe.rotation.z = THREE.MathUtils.lerp(orbitState.rotation, 0, blend);
        const destinations = {
          Moon: [-2.8, 1.65, -0.25],
          Mars: [2.8, -1.1, -0.45],
          Earth: [0, 0, 0],
        };
        for (const planet of planets) {
          planet.group.position.lerpVectors(
            new THREE.Vector3(...BODY_CENTRES[planet.name]),
            new THREE.Vector3(...destinations[planet.name]),
            blend,
          );
          planet.group.scale.setScalar(
            THREE.MathUtils.lerp(
              1,
              planet.name === 'Moon' ? 0.65 : planet.name === 'Mars' ? 0.82 : 1,
              blend,
            ),
          );
          planet.group.visible = true;
          planet.mesh.material.opacity = planet.name === 'Earth' ? 1 : blend;
          planet.mesh.material.emissive.setRGB(0, 0, 0);
          planet.mesh.rotation.y += Math.min(delta, 0.1) * 0.035;
          planet.halo.material.uniforms.pulse.value = 0;
          planet.halo.material.uniforms.fade.value = planet.name === 'Earth' ? 1 : blend;
          if (planet.clouds) planet.clouds.rotation.y += Math.min(delta, 0.1) * 0.012;
        }
        let distance = Math.max(7.6, 2.75 / (Math.tan((21 * Math.PI) / 180) * camera.aspect));
        if (orbitZoom !== null)
          distance = THREE.MathUtils.lerp(distance, 2, smooth((now - orbitZoom) / 1800));
        camera.position.lerpVectors(orbitState.camera, new THREE.Vector3(-0.5, 0, distance), blend);
        rotatedTarget.lerpVectors(orbitState.target, new THREE.Vector3(-0.5, 0, 0), blend);
        camera.lookAt(rotatedTarget);
        camera.updateMatrixWorld();
        beam.visible = false;
        head.material.opacity = 0;
        flare.material.opacity = 0;
        particleMaterial.opacity = 0;
        orbit.position.x = -5 * blend;
        orbit.material.opacity = 0.25;
        orbitalLight.material.opacity = 0.8;
        orbitalLight.position.set(
          5 * (1 - blend) + 2.45 * Math.cos(elapsed * 0.5 + orbitState.time * 0.3),
          0.42 * Math.sin(elapsed * 0.5 + orbitState.time * 0.3),
          1.05 * Math.sin(elapsed * 0.5 + orbitState.time * 0.3),
        );
        const labels = {};
        for (const planet of planets) {
          const p = planet.group.getWorldPosition(new THREE.Vector3());
          p.y -= planet.radius * planet.group.scale.x + 0.17;
          p.project(camera);
          labels[planet.name] = { x: p.x * 0.5 + 0.5, y: -p.y * 0.5 + 0.5 };
        }
        onFrame?.({ orbitMode: true, labels });
        composer.render();
        return;
      }
      if (ready && !paused) elapsed = Math.min(CINEMATIC_DURATION, elapsed + delta);
      const frame = sampleCinematic(elapsed, camera.aspect);
      rotation.z = universe.rotation.z;
      rotatedCamera.fromArray(frame.camera).applyEuler(rotation);
      rotatedTarget.fromArray(frame.target).applyEuler(rotation);
      if (camera.aspect < 0.85) {
        const framing = smooth((elapsed - 6.5) / 2) * (1 - smooth((elapsed - 10.5) / 1.5));
        const short = host.clientHeight < 700;
        rotatedTarget.y -= 0.25 + ((short ? 4.3 : 2.4) - 0.25) * framing;
        rotatedCamera.z *= 1 + (short ? 0.25 : 0) * framing;
      }
      camera.position.copy(rotatedCamera);
      camera.lookAt(rotatedTarget);
      for (const planet of planets) {
        const crossTime = 8.5 + ((planet.group.position.x + 8) / 16) * 1.8;
        const pulse =
          elapsed >= crossTime && elapsed < crossTime + 0.7
            ? Math.sin(((elapsed - crossTime) / 0.7) * Math.PI)
            : 0;
        const opacity = planet.name === 'Earth' ? 1 : frame.otherOpacity;
        planet.group.visible = opacity > 0.001;
        planet.mesh.material.opacity = opacity;
        planet.mesh.material.emissive.setRGB(0.03 * pulse, 0.18 * pulse, 0.3 * pulse);
        planet.mesh.rotation.y += Math.min(delta, 0.1) * 0.04;
        planet.halo.material.uniforms.pulse.value = pulse * 0.35;
        planet.halo.material.uniforms.fade.value = opacity;
        if (planet.clouds) planet.clouds.rotation.y += Math.min(delta, 0.1) * 0.012;
      }
      const length = Math.max(0, frame.beamHead + 8);
      beam.position.x = -8 + length / 2;
      beam.scale.y = 1;
      for (const effect of effects) {
        effect.mesh.scale.y = length;
        effect.mesh.material.opacity = effect.opacity * frame.beamOpacity;
      }
      beam.visible = length > 0 && frame.beamOpacity > 0;
      head.position.set(frame.beamHead, 0, 0);
      flare.position.copy(head.position);
      head.material.opacity = frame.beamOpacity;
      flare.material.opacity = frame.beamOpacity * 0.7;
      for (let i = 0; i < 120; i++) {
        const along = (elapsed * 3.5 + i * 0.137) % 16;
        particles[i * 3] = -8 + along;
        particles[i * 3 + 1] = Math.sin(i * 19.3) * 0.065;
        particles[i * 3 + 2] = Math.cos(i * 7.1) * 0.065;
      }
      particleGeometry.attributes.position.needsUpdate = true;
      particleMaterial.opacity = frame.beamOpacity;
      const orbitOpacity = smooth((elapsed - 11.65) / 0.8);
      orbit.material.opacity = orbitOpacity * 0.35;
      orbitalLight.material.opacity = orbitOpacity;
      orbitalLight.position.set(
        5 + 2.45 * Math.cos(elapsed * 0.5),
        0.42 * Math.sin(elapsed * 0.5),
        1.05 * Math.sin(elapsed * 0.5),
      );
      onFrame?.({ ...frame, time: elapsed, ready, qualityReduced });
      const before = performance.now();
      composer.render();
      totalFrame += performance.now() - before;
      samples++;
      if (
        !qualityReduced &&
        samples >= 20 &&
        (totalFrame / samples > 28 || (!paused && elapsed > 1 && elapsed / samples > 0.05))
      ) {
        qualityReduced = true;
        composer.setPixelRatio(mobile ? 0.6 : 0.75);
      }
      if (!paused && elapsed >= CINEMATIC_DURATION) {
        completed = true;
        onComplete?.();
      }
    });
    return {
      dispose,
      enterOrbit() {
        if (disposed) return false;
        orbitState = {
          time: 0,
          camera: camera.position.clone(),
          target: rotatedTarget.clone(),
          rotation: universe.rotation.z,
        };
        completed = false;
        paused = false;
        last = performance.now();
        bloom.strength = 0.25;
        return true;
      },
      zoomToEarth() {
        orbitZoom = performance.now();
      },
      pause() {
        paused = true;
      },
      resume() {
        paused = false;
        last = performance.now();
      },
      seek(time) {
        elapsed = clamp(time, 0, CINEMATIC_DURATION);
        completed = false;
        last = performance.now();
      },
      snapshot: () => ({
        elapsed,
        ready,
        qualityReduced,
        completed,
        disposed,
        orbitMode: !!orbitState,
        bodyCentres: BODY_CENTRES,
      }),
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
