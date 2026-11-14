import * as THREE from './vendor/three.module.js';

// A disposable opening scene. The dashboard and its mission state stay intact.
export function createMissionIntro({ onEnter }) {
  const root = document.createElement('section');
  root.className = 'mission-intro'; root.id = 'mission-intro';
  root.setAttribute('role','dialog'); root.setAttribute('aria-modal','true'); root.setAttribute('aria-labelledby','intro-title');
  root.innerHTML = `<div class="intro-cosmos" aria-hidden="true"><div class="intro-earth-fallback"></div></div><header class="intro-header"><span class="intro-wordmark">◉ ANALOG FINDER</span></header><div class="intro-copy"><span class="intro-pill"><i></i> A NEW MISSION AWAITS</span><h1 id="intro-title">Other worlds.<br><span>One extraordinary</span><br>Earth.</h1><p>The next frontier might be closer than you think.<br>Discover the Earth environments that echo the Moon and Mars.</p><div class="intro-actions"><button id="intro-drone" type="button">Start a drone mission <span>↗</span></button><button id="intro-enter" type="button">Explore Earth <span>→</span></button></div><div class="intro-capabilities"><span>◌ TWO WORLDS</span><span>⌁ DRONE MISSIONS</span><span>⊕ EARTH DISCOVERIES</span></div></div><aside class="intro-guide"><agent-mascot shape="orb" material="glass" color="#a6f4d9" accent="#c9b5ff" accessories="ring antenna sheen" mood="speaking" motion="0.6" float="0.5" track="window" aria-label="LUMA mission companion"></agent-mascot><div><span class="eyebrow">LUMA · YOUR MISSION COMPANION</span><p>We have a mission, explorer. Scout another world, capture its surface, and let’s find where we can rehearse right here on Earth.</p></div></aside><footer class="intro-footer"><span>EARTH / MOON / MARS</span><span>AN OPEN INVITATION TO EXPLORE</span></footer>`;
  const cosmos = root.querySelector('.intro-cosmos');
  root.querySelector('.intro-header').insertAdjacentHTML('beforeend','<button id="intro-orbit" type="button">Skip cinematic ↗</button>');
  root.insertAdjacentHTML('beforeend','<div class="cinematic-hud"><span class="eyebrow" id="cinematic-kicker">01 / LUNAR RECONNAISSANCE</span><h2 id="cinematic-title">Moon</h2><p id="cinematic-caption">A world of quiet extremes.</p><div class="cinematic-progress" role="progressbar" aria-label="Cinematic journey progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><span class="cinematic-route">MOON <b>—</b> MARS <b>—</b> EARTH</span></div><p class="cinematic-credit">Cinematic alignment · not to scale · Imagery: NASA / <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener">Solar System Scope, CC BY 4.0</a></p>');
  cosmos.insertAdjacentHTML('beforeend', '<div class="intro-moon-fallback"></div><div class="intro-mars-fallback"></div><span class="intro-body-label" data-body-label="Earth">EARTH<small>OUR HOME · YOUR DESTINATION</small></span><span class="intro-body-label" data-body-label="Moon">MOON<small>LUNAR EXPLORATION</small></span><span class="intro-body-label" data-body-label="Mars">MARS<small>THE NEXT FRONTIER</small></span><span class="intro-orbit-note">MISSION TRAJECTORY · ILLUSTRATIVE / NOT TO SCALE</span>');
  // Keep the briefing and companion in one flow so text/zoom cannot collide.
  const sky = document.createElement('div'); sky.className = 'intro-sky';
  sky.append(root.querySelector('.intro-cosmos')); root.prepend(sky);
  const content = document.createElement('div'); content.className = 'intro-content';
  content.append(root.querySelector('.intro-copy'), root.querySelector('.intro-guide'));
  root.insertBefore(content, root.querySelector('.intro-footer'));
  document.body.appendChild(root);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let renderer, scene, camera, earth, observer, events, timer, orbitArrivalTimer, journey, sceneEpoch=0, opened = false, transitioning = false, disposed = true, zoomStart = null;
  const inertNodes = () => [...document.body.children].filter(node => node !== root && !['SCRIPT','LINK'].includes(node.tagName));
  function dispose() {
    clearTimeout(orbitArrivalTimer);
    journey?.dispose();journey=null;
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
      const ownedRenderer=renderer;
      root.querySelector('.intro-cosmos').appendChild(renderer.domElement);
      renderer.domElement.addEventListener('webglcontextlost', event => {event.preventDefault();if(renderer===ownedRenderer)dispose();},{once:true});
      scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(38,1,.1,100); camera.position.set(0,0,12);
      const ownedScene = scene;
      earth = new THREE.Group(); earth.rotation.set(.12,-.5,-.14); scene.add(earth);
      earth.scale.setScalar(.72);
      const material = new THREE.MeshPhongMaterial({color:'#4d8f9e',shininess:12});
      earth.add(new THREE.Mesh(new THREE.SphereGeometry(2.15,80,64),material));
      new THREE.TextureLoader().load('assets/earth.jpg',texture=>{if(disposed || scene !== ownedScene){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;material.color.set('#ffffff');material.needsUpdate=true;},undefined,()=>{});
      scene.add(new THREE.AmbientLight(0xadc8e5,1.05));
      const sun=new THREE.DirectionalLight(0xe3f7ff,3.2);sun.position.set(-3,3,5);scene.add(sun);
      const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(2.22,64,48),new THREE.ShaderMaterial({uniforms:{glowColor:{value:new THREE.Color('#7ecbdd')}},vertexShader:'varying vec3 vNormal; varying vec3 vEye; void main(){ vec4 p=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vEye=normalize(-p.xyz); gl_Position=projectionMatrix*p; }',fragmentShader:'uniform vec3 glowColor; varying vec3 vNormal; varying vec3 vEye; void main(){ float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vEye))),3.0); gl_FragColor=vec4(glowColor,rim*0.5); }',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));earth.add(atmosphere);
      const moonTexture=planetTexture('Moon'), marsTexture=planetTexture('Mars');
      const moon=new THREE.Mesh(new THREE.SphereGeometry(.52,40,32),new THREE.MeshStandardMaterial({map:moonTexture,bumpMap:moonTexture,bumpScale:.04,roughness:1}));
      moon.position.set(-2.5,1.45,.15);scene.add(moon);
      const mars=new THREE.Mesh(new THREE.SphereGeometry(.85,48,36),new THREE.MeshStandardMaterial({map:marsTexture,bumpMap:marsTexture,bumpScale:.025,roughness:.95}));
      mars.position.set(2.7,-.8,-.6);mars.rotation.z=.12;scene.add(mars);
      const orbitPoint=angle=>new THREE.Vector3(3.45*Math.cos(angle),1.65*Math.sin(angle),.7*Math.sin(angle+.4));
      const orbitGeometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:193},(_,i)=>orbitPoint(i/192*Math.PI*2)));
      scene.add(new THREE.Line(orbitGeometry,new THREE.LineBasicMaterial({color:'#a4e8dc',transparent:true,opacity:.24})));
      const outerGeometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:193},(_,i)=>{const p=orbitPoint(i/192*Math.PI*2);p.y*=1.28;p.z-=.8;return p;}));
      scene.add(new THREE.Line(outerGeometry,new THREE.LineBasicMaterial({color:'#c7b5fb',transparent:true,opacity:.12})));
      const beacon=new THREE.Group();
      beacon.add(new THREE.Mesh(new THREE.SphereGeometry(.045,12,10),new THREE.MeshBasicMaterial({color:'#edfff8'})));
      const glowCanvas=document.createElement('canvas');glowCanvas.width=64;glowCanvas.height=64;
      const glowContext=glowCanvas.getContext('2d'),gradient=glowContext.createRadialGradient(32,32,0,32,32,32);
      gradient.addColorStop(0,'#eafff8');gradient.addColorStop(.18,'#9fffe3aa');gradient.addColorStop(1,'#9fffe300');glowContext.fillStyle=gradient;glowContext.fillRect(0,0,64,64);
      const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowCanvas),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));glow.scale.set(.5,.5,1);beacon.add(glow);
      beacon.add(new THREE.PointLight('#aaffdf',2,3));scene.add(beacon);
      const trailGeometry=new THREE.BufferGeometry(),trailPositions=new Float32Array(64*3),trailColors=new Float32Array(64*3);
      for(let i=0;i<64;i++){const strength=(1-i/64)**2;trailColors.set([.65*strength,strength,.85*strength],i*3);}
      trailGeometry.setAttribute('position',new THREE.BufferAttribute(trailPositions,3));trailGeometry.setAttribute('color',new THREE.BufferAttribute(trailColors,3));
      const trail=new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));trail.frustumCulled=false;scene.add(trail);
      const bodyLabels=[{mesh:earth,radius:1.55,label:root.querySelector('[data-body-label="Earth"]')},{mesh:moon,radius:.52,label:root.querySelector('[data-body-label="Moon"]')},{mesh:mars,radius:.85,label:root.querySelector('[data-body-label="Mars"]')}];
      const stars=[];let seed=39;for(let i=0;i<600;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed/4294967296;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed/4294967296;stars.push((x-.5)*38,(y-.5)*25,-8-(i%7));}
      const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));scene.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#cce5fa',size:.025,transparent:true,opacity:.6})));
      const host=root.querySelector('.intro-cosmos');
      let startDistance=9.5;
      const resize=()=>{const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer?.setSize(width,height);camera.aspect=width/height;startDistance=width<821&&height<400?10.5:Math.max(8.6,3.25/(Math.tan(19*Math.PI/180)*camera.aspect));if(zoomStart===null)camera.position.z=startDistance;camera.updateProjectionMatrix();};
      observer=new ResizeObserver(resize);observer.observe(host);resize();
      let last=performance.now(),orbitAngle=1.05;
      renderer.setAnimationLoop(now=>{
        if(disposed||document.hidden)return;
        const dt=Math.min((now-last)/1000,.1);last=now;
        if(!reduced.matches){earth.rotation.y+=dt*.035;moon.rotation.y+=dt*.04;mars.rotation.y+=dt*.06;orbitAngle+=dt*.3;}
        beacon.position.copy(orbitPoint(orbitAngle));
        for(let i=0;i<64;i++)orbitPoint(orbitAngle-i*.012).toArray(trailPositions,i*3);
        trailGeometry.attributes.position.needsUpdate=true;
        if(zoomStart!==null){const t=Math.min(1,(now-zoomStart)/1800),ease=t*t*(3-2*t);camera.position.z=startDistance-(startDistance-2)*ease;earth.rotation.y+=dt*.12;}
        const {width,height}=host.getBoundingClientRect();
        for(const body of bodyLabels){const p=body.mesh.position.clone();p.y-=body.radius+.18;p.project(camera);body.label.style.left=`${(p.x*.5+.5)*width}px`;body.label.style.top=`${(-p.y*.5+.5)*height}px`;}
        renderer.render(scene,camera);
      });
      root.classList.add('has-webgl');
    }catch(error){console.warn('Intro uses the static Earth fallback:',error.message);dispose();}
  }
  async function enter(mode, skip=false) {
    if(transitioning||!opened)return;
    const fromCinematic=root.classList.contains('cinematic-playing');
    ++sceneEpoch;
    transitioning=true;root.querySelectorAll('button').forEach(button=>button.disabled=true);
    if(!skip&&!reduced.matches){zoomStart=performance.now();journey?.zoomToEarth();root.classList.add('departing');await new Promise(resolve=>timer=setTimeout(resolve,1800));}
    dispose(); resetReveal(); opened=false; root.hidden=true; document.body.classList.remove('intro-open');
    inertNodes().forEach(node=>node.inert=false);events?.abort();
    if(!fromCinematic)document.body.classList.add('mission-arriving');
    timer=setTimeout(()=>document.body.classList.remove('mission-arriving'),900);
    document.querySelector('#earth-mode')?.focus();
    await onEnter(mode);
  }
  root.querySelector('#intro-enter').onclick=()=>enter('earth');
  root.querySelector('#intro-drone').onclick=()=>enter('drone');
  const captions={
    moon:['01 / LUNAR RECONNAISSANCE','Moon','Cratered landscapes. Extraordinary extremes.'],
    mars:['02 / THE NEXT FRONTIER','Mars','Across ancient basins and rust-red worlds.'],
    earth:['03 / OUR SHARED HOME','Earth','Oceans. Continents. A world of possibilities.'],
    alignment:['04 / A SHARED MISSION','Three worlds. One connection.','Different environments. A common thread of discovery.'],
    connection:['05 / CONNECTING WORLDS','Follow the connection.','From extraterrestrial conditions to Earth analogues.'],
    arrival:['06 / EARTH APPROACH','Bringing discovery home.','Your mission continues here on Earth.'],
    orbit:['MISSION CONTROL / ONLINE','Welcome home, explorer.','Entering your exploration atlas…'],
  };
  function resetReveal(){root.classList.remove('cinematic-playing','orbit-arriving');document.body.classList.remove('cinematic-reveal');document.body.style.removeProperty('--arrival-progress');root.style.removeProperty('--cinematic-opacity');}
  function orbitView(){
    ++sceneEpoch;
    const continued=journey?.enterOrbit();
    if(!continued)dispose();
    resetReveal();root.dataset.view='orbit';root.querySelector('#intro-orbit').textContent='Replay cinematic';zoomStart=null;root.scrollTop=0;
    if(!continued)createScene();
    clearTimeout(orbitArrivalTimer);root.classList.add('orbit-arriving');orbitArrivalTimer=setTimeout(()=>root.classList.remove('orbit-arriving'),1400);
    root.querySelector('#intro-enter').focus({preventScroll:true});
  }
  async function startCinematic(){
    const token=++sceneEpoch;dispose();resetReveal();root.dataset.view='cinematic';root.classList.add('cinematic-playing');root.querySelector('#intro-orbit').textContent='Skip cinematic ↗';root.scrollTop=0;
    root.dataset.cinematicStage='moon';root.dataset.cinematicTime='0';let previousStage='';
    const [initialKicker,initialTitle,initialCaption]=captions.moon;
    root.querySelector('#cinematic-kicker').textContent=initialKicker;root.querySelector('#cinematic-title').textContent=initialTitle;root.querySelector('#cinematic-caption').textContent=initialCaption;
    root.querySelector('.cinematic-progress i').style.width='0%';root.querySelector('.cinematic-progress').setAttribute('aria-valuenow','0');
    try{
      const {createCinematicIntro}=await import('./cinematic-intro.js');
      if(token!==sceneEpoch||!opened)return;
      journey=createCinematicIntro(root.querySelector('.intro-cosmos'),{
        onFrame:frame=>{
          if(frame.orbitMode){if(opened&&root.dataset.view==='orbit'){const box=root.querySelector('.intro-cosmos').getBoundingClientRect();for(const [name,p]of Object.entries(frame.labels)){const label=root.querySelector(`[data-body-label="${name}"]`);label.style.left=`${p.x*box.width}px`;label.style.top=`${p.y*box.height}px`;}}return;}
          if(token!==sceneEpoch||!opened)return;
          root.dataset.cinematicStage=frame.stage;root.dataset.cinematicTime=frame.time.toFixed(2);
          if(frame.stage!==previousStage){previousStage=frame.stage;const [kicker,title,caption]=captions[frame.stage];root.querySelector('#cinematic-kicker').textContent=kicker;root.querySelector('#cinematic-title').textContent=title;root.querySelector('#cinematic-caption').textContent=caption;}
          root.querySelector('.cinematic-progress i').style.width=`${frame.progress*100}%`;root.querySelector('.cinematic-progress').setAttribute('aria-valuenow',String(Math.round(frame.progress*100)));
          // The film ends in the orbit briefing; the app opens only on a mission choice.
        },
        onComplete:()=>{if(token===sceneEpoch&&opened)orbitView();},
        onError:message=>{if(opened&&(token===sceneEpoch||root.dataset.view==='orbit')){orbitView();root.querySelector('.intro-copy>p').textContent=message;}},
      });
      root.classList.add('has-webgl');
    }catch(error){if(token===sceneEpoch&&opened){console.warn('Cinematic unavailable; preserving the orbit briefing:',error.message);orbitView();}}
  }
  root.querySelector('#intro-orbit').onclick=()=>root.classList.contains('cinematic-playing')?orbitView():startCinematic();
  function open() {
    if(opened)return;
    clearTimeout(timer);document.body.classList.remove('mission-arriving');
    opened=true;transitioning=false;zoomStart=null;root.hidden=false;root.classList.remove('departing');
    root.querySelectorAll('button').forEach(button=>button.disabled=false);
    document.body.classList.add('intro-open');inertNodes().forEach(node=>node.inert=true);
    root.querySelector('agent-mascot').setAttribute('motion',reduced.matches?'0':'0.6');
    events=new AbortController();
    root.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();if(root.classList.contains('cinematic-playing'))orbitView();}
      if(event.key!=='Tab')return;
      const buttons=[...root.querySelectorAll('button:not(:disabled)')].filter(button=>button.getClientRects().length),first=buttons[0],last=buttons.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    },{signal:events.signal});
    root.scrollTop=0;
    if(reduced.matches)orbitView();else startCinematic();
    if(!reduced.matches)root.querySelector('#intro-orbit').focus({preventScroll:true});
  }
  open();
  return {open};
}

// Authored illustrative surfaces; no additional external planetary assets/data.
function planetTexture(body) {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const context=canvas.getContext('2d'),image=context.createImageData(512,256);
  let seed=body==='Moon'?139:781;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<256;y++)for(let x=0;x<512;x++){
    const n=.6+random()*.25+.1*Math.sin(x*.05)*Math.cos(y*.08),o=(y*512+x)*4;
    const base=body==='Moon'?[170,174,181]:[191,105,66];
    image.data[o]=base[0]*n;image.data[o+1]=base[1]*n;image.data[o+2]=base[2]*n;image.data[o+3]=255;
  }
  context.putImageData(image,0,0);
  for(let i=0;i<(body==='Moon'?160:60);i++){
    const x=random()*512,y=random()*256,r=2+random()*(body==='Moon'?15:28);
    const gradient=context.createRadialGradient(x-r*.2,y-r*.2,0,x,y,r);
    gradient.addColorStop(0,body==='Moon'?'#333b4844':'#5e332744');gradient.addColorStop(.75,'#00000012');gradient.addColorStop(.87,body==='Moon'?'#e2e5e52c':'#e8b48b24');gradient.addColorStop(1,'#00000000');
    context.fillStyle=gradient;context.fillRect(x-r,y-r,r*2,r*2);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
