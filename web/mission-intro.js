import * as THREE from './vendor/three.module.js';

// A disposable opening scene. The dashboard and its mission state stay intact.
export function createMissionIntro({ onEnter }) {
  const root = document.createElement('section');
  root.className = 'mission-intro'; root.id = 'mission-intro';
  root.setAttribute('role','dialog'); root.setAttribute('aria-modal','true'); root.setAttribute('aria-labelledby','intro-title');
  root.innerHTML = `<div class="intro-cosmos" aria-hidden="true"><div class="intro-earth-fallback"></div></div><header class="intro-header"><span class="intro-wordmark">◉ ANALOG FINDER</span><button id="intro-skip" type="button">Skip briefing ↗</button></header><div class="intro-copy"><span class="intro-pill"><i></i> A NEW MISSION AWAITS</span><h1 id="intro-title">Other worlds.<br><span>One extraordinary</span><br>Earth.</h1><p>The next frontier might be closer than you think.<br>Discover the Earth environments that echo the Moon and Mars.</p><div class="intro-actions"><button id="intro-drone" type="button">Start a drone mission <span>↗</span></button><button id="intro-enter" type="button">Explore Earth <span>→</span></button></div><div class="intro-capabilities"><span>◌ TWO WORLDS</span><span>⌁ DRONE MISSIONS</span><span>⊕ EARTH DISCOVERIES</span></div></div><aside class="intro-guide"><agent-mascot shape="orb" material="glass" color="#a6f4d9" accent="#c9b5ff" accessories="ring antenna sheen" mood="speaking" motion="0.6" float="0.5" track="window" aria-label="LUMA mission companion"></agent-mascot><div><span class="eyebrow">LUMA · YOUR MISSION COMPANION</span><p>We have a mission, explorer. Scout another world, capture its surface, and let’s find where we can rehearse right here on Earth.</p></div></aside><footer class="intro-footer"><span>EARTH / MOON / MARS</span><span>AN OPEN INVITATION TO EXPLORE</span></footer>`;
  // Keep the briefing and companion in one flow so text/zoom cannot collide.
  const sky = document.createElement('div'); sky.className = 'intro-sky';
  sky.append(root.querySelector('.intro-cosmos')); root.prepend(sky);
  const content = document.createElement('div'); content.className = 'intro-content';
  content.append(root.querySelector('.intro-copy'), root.querySelector('.intro-guide'));
  root.insertBefore(content, root.querySelector('.intro-footer'));
  document.body.appendChild(root);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let renderer, scene, camera, earth, observer, events, timer, opened = false, transitioning = false, disposed = true, zoomStart = null;
  const inertNodes = () => [...document.body.children].filter(node => node !== root && !['SCRIPT','LINK'].includes(node.tagName));
  function dispose() {
    disposed = true; observer?.disconnect(); renderer?.setAnimationLoop(null);
    if (scene) {
      const geometries = new Set(), materials = new Set(), textures = new Set();
      scene.traverse(object => { if(object.geometry)geometries.add(object.geometry); if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>{materials.add(material);if(material.map)textures.add(material.map);}); });
      geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose()); textures.forEach(t=>t.dispose());
    }
    renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove(); renderer = null; scene = null;
    root.classList.remove('has-webgl');
  }
  function createScene() {
    disposed = false;
    try {
      renderer = new THREE.WebGLRenderer({antialias:true,alpha:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
      root.querySelector('.intro-cosmos').appendChild(renderer.domElement);
      renderer.domElement.addEventListener('webglcontextlost', event => {event.preventDefault();dispose();},{once:true});
      scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(38,1,.1,100); camera.position.set(0,0,8.8);
      const ownedScene = scene;
      earth = new THREE.Group(); earth.rotation.set(.12,-.5,-.14); scene.add(earth);
      const material = new THREE.MeshPhongMaterial({color:'#4d8f9e',shininess:12});
      earth.add(new THREE.Mesh(new THREE.SphereGeometry(2.15,80,64),material));
      new THREE.TextureLoader().load('assets/earth.jpg',texture=>{if(disposed || scene !== ownedScene){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;material.color.set('#ffffff');material.needsUpdate=true;},undefined,()=>{});
      scene.add(new THREE.AmbientLight(0xadc8e5,1.05));
      const sun=new THREE.DirectionalLight(0xe3f7ff,3.2);sun.position.set(-3,3,5);scene.add(sun);
      const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(2.22,64,48),new THREE.ShaderMaterial({uniforms:{glowColor:{value:new THREE.Color('#7ecbdd')}},vertexShader:'varying vec3 vNormal; varying vec3 vEye; void main(){ vec4 p=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vEye=normalize(-p.xyz); gl_Position=projectionMatrix*p; }',fragmentShader:'uniform vec3 glowColor; varying vec3 vNormal; varying vec3 vEye; void main(){ float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vEye))),3.0); gl_FragColor=vec4(glowColor,rim*0.5); }',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));earth.add(atmosphere);
      const stars=[];let seed=39;for(let i=0;i<600;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed/4294967296;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed/4294967296;stars.push((x-.5)*38,(y-.5)*25,-8-(i%7));}
      const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));scene.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#cce5fa',size:.025,transparent:true,opacity:.6})));
      const host=root.querySelector('.intro-cosmos');
      const resize=()=>{const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer?.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();};
      observer=new ResizeObserver(resize);observer.observe(host);resize();
      let last=performance.now();
      renderer.setAnimationLoop(now=>{
        if(disposed||document.hidden)return;
        const dt=Math.min((now-last)/1000,.1);last=now;
        if(!reduced.matches)earth.rotation.y+=dt*.035;
        if(zoomStart!==null){const t=Math.min(1,(now-zoomStart)/1350),ease=t*t*(3-2*t);camera.position.z=8.8-6.15*ease;earth.rotation.y+=dt*.12;}
        renderer.render(scene,camera);
      });
      root.classList.add('has-webgl');
    }catch(error){console.warn('Intro uses the static Earth fallback:',error.message);dispose();}
  }
  async function enter(mode, skip=false) {
    if(transitioning||!opened)return;
    transitioning=true;root.querySelectorAll('button').forEach(button=>button.disabled=true);
    if(!skip&&!reduced.matches){zoomStart=performance.now();root.classList.add('departing');await new Promise(resolve=>timer=setTimeout(resolve,1350));}
    dispose(); opened=false; root.hidden=true; document.body.classList.remove('intro-open');
    inertNodes().forEach(node=>node.inert=false);events?.abort();
    document.body.classList.add('mission-arriving');
    timer=setTimeout(()=>document.body.classList.remove('mission-arriving'),900);
    document.querySelector('#earth-mode')?.focus();
    await onEnter(mode);
  }
  root.querySelector('#intro-enter').onclick=()=>enter('earth');
  root.querySelector('#intro-drone').onclick=()=>enter('drone');
  root.querySelector('#intro-skip').onclick=()=>enter('earth',true);
  function open() {
    if(opened)return;
    clearTimeout(timer);document.body.classList.remove('mission-arriving');
    opened=true;transitioning=false;zoomStart=null;root.hidden=false;root.classList.remove('departing');
    root.querySelectorAll('button').forEach(button=>button.disabled=false);
    document.body.classList.add('intro-open');inertNodes().forEach(node=>node.inert=true);
    root.querySelector('agent-mascot').setAttribute('motion',reduced.matches?'0':'0.6');
    events=new AbortController();
    root.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();enter('earth',true);}
      if(event.key!=='Tab')return;
      const buttons=[...root.querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    },{signal:events.signal});
    createScene();root.querySelector('#intro-enter').focus();
  }
  open();
  return {open};
}
