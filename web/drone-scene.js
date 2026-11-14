import * as THREE from './vendor/three.module.js';
import { makeTerrain, coordinatesAt, METRES_PER_UNIT } from './drone-model.js';

// Owns every GPU resource and input listener. UI/capture history live elsewhere.
export function createDroneScene(container, session, onTelemetry, onError) {
  const controller = new AbortController(), { signal } = controller;
  const renderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(session.body === 'Moon' ? '#050b14' : '#392326');
  const canvas = renderer.domElement; container.appendChild(canvas);
  canvas.tabIndex = 0; canvas.setAttribute('aria-label','Drone flight view. Use W A S D or arrow keys to move, Q and E for altitude.');
  const scene = new THREE.Scene();
  const moon = session.body === 'Moon';
  scene.fog = new THREE.FogExp2(moon ? '#050b14' : '#61403a', moon ? .00115 : .0018);
  scene.add(new THREE.HemisphereLight(moon ? 0xb8ceff : 0xf1bda0, moon ? 0x1c2231 : 0x34202a, moon ? 1.2 : 2.5));
  const sun = new THREE.DirectionalLight(moon ? 0xdfe8ff : 0xffd4ab, 3.7);
  sun.position.set(-150,200,-110); sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-110,right:110,top:110,bottom:-110,near:1,far:600});
  sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.001;scene.add(sun);
  const {height,random} = makeTerrain(session.body,session.origin);
  const geometry = new THREE.PlaneGeometry(1200,1200,160,160); geometry.rotateX(-Math.PI/2);
  const positions=geometry.attributes.position, colours=[];
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),z=positions.getZ(i),h=height(x,z);positions.setY(i,h);
    const shade=THREE.MathUtils.clamp(.52+h*.003+Math.sin(x*2+z)*.04,.25,.85);
    const c = new THREE.Color(moon ? '#a3a9b6' : '#b96342').multiplyScalar(shade);
    colours.push(c.r,c.g,c.b);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3)); geometry.computeVertexNormals();
  const terrain = new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,flatShading:true}));
  terrain.receiveShadow=true; scene.add(terrain);
  const rockGeometry = new THREE.IcosahedronGeometry(1,0),rockMaterial = new THREE.MeshStandardMaterial({color:moon ? '#535968' : '#6c3e32',roughness:1});
  const rocks=new THREE.InstancedMesh(rockGeometry,rockMaterial,240),dummy=new THREE.Object3D();
  for(let i=0;i<240;i++) {const x=(random()-.5)*1050,z=(random()-.5)*1050,size=.4+random()*3;dummy.position.set(x,height(x,z)+size*.25,z);dummy.scale.set(size*1.3,size*.7,size);dummy.rotation.set(random(),random()*6,random());dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}
  rocks.castShadow=true;scene.add(rocks);
  const padHeight=height(0,0),pad=new THREE.Group();pad.position.set(0,padHeight+.2,0);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(9,9,.3,48),new THREE.MeshStandardMaterial({color:'#25394b',metalness:.5,roughness:.45}));pad.add(disc);
  const padRing = new THREE.Mesh(new THREE.TorusGeometry(7.8,.09,6,64),new THREE.MeshBasicMaterial({color:0xa6f4d9}));padRing.rotation.x=-Math.PI/2;padRing.position.y=.25;pad.add(padRing);
  for(const x of [-2,2]) {const stripe=new THREE.Mesh(new THREE.BoxGeometry(.3,.1,4),new THREE.MeshBasicMaterial({color:0xa6f4d9}));stripe.position.set(x,.4,0);pad.add(stripe);}
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(4,.1,.3),new THREE.MeshBasicMaterial({color:0xa6f4d9}));stripe.position.y=.4;pad.add(stripe);scene.add(pad);
  // Procedural lightweight exploration vehicles: thrusters in vacuum, coaxial
  // rotor craft on Mars. Dimensions and flight dynamics are stylized for a demo.
  const drone=new THREE.Group(),rotors=[],jets=[];
  function mesh(geo,colour,x,y,z,metal=.3) {const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:colour,metalness:metal,roughness:.4}));m.position.set(x,y,z);m.castShadow=true;drone.add(m);return m;}
  mesh(new THREE.BoxGeometry(3.5,1.3,2.6),moon ? '#dde4ea' : '#dbc8a1',0,0,0);
  mesh(new THREE.BoxGeometry(2.8,.12,2), '#bc914d',0,.74,0,.8);
  mesh(new THREE.SphereGeometry(.65,16,10),'#203646',0,-.6,-1.2,.8);
  const lens=mesh(new THREE.CylinderGeometry(.25,.25,.35,16),'#89ffe0',0,-1.1,-1.2);lens.material.emissive.set('#389982');
  if(moon) {
    for(const x of [-2.7,2.7])for(const z of [-2.2,2.2]) {
      mesh(new THREE.BoxGeometry(3,.25,.25),'#708698',x*.65,0,z*.6);
      mesh(new THREE.CylinderGeometry(.7,.5,1.3,12),'#9aa9be',x,-.25,z);
      const jet=new THREE.Mesh(new THREE.ConeGeometry(.4,2.8,12),new THREE.MeshBasicMaterial({color:'#8fffe7',transparent:true,opacity:.65}));jet.rotation.z=Math.PI;jet.position.set(x,-2,z);drone.add(jet);jets.push(jet);
    }
    mesh(new THREE.CylinderGeometry(.07,.07,1.8,6),'#d5b476',0,1.5,0);
  } else {
    mesh(new THREE.BoxGeometry(5.8,.12,3),'#293d62',0,1.3,0);
    mesh(new THREE.CylinderGeometry(.12,.12,4,8),'#b4c3d5',0,2,0);
    for(const y of [2.7,3.5]) {const group=new THREE.Group();group.position.y=y; const blade=new THREE.Mesh(new THREE.BoxGeometry(12,.05,.38),new THREE.MeshStandardMaterial({color:'#a5adbf',metalness:.6,roughness:.4}));group.add(blade);drone.add(group);rotors.push(group);}
  }
  for(const x of [-2.2,2.2])for(const z of [-1.8,1.8]) {const leg=mesh(new THREE.CylinderGeometry(.08,.08,2.6,6),'#8996a7',x,-1.7,z);leg.rotation.z=x>0 ? -.28 : .28;mesh(new THREE.BoxGeometry(1.3,.1,.6),'#c1ccd8',x,-3,z);}
  scene.add(drone);
  const scan=new THREE.Mesh(new THREE.RingGeometry(2,2.15,64),new THREE.MeshBasicMaterial({color:'#94ffe1',side:THREE.DoubleSide,transparent:true,opacity:0}));scan.rotation.x=-Math.PI/2;scene.add(scan);
  const starsGeometry=new THREE.BufferGeometry(),stars=[];
  for(let i=0;i<500;i++)stars.push((random()-.5)*1700,100+random()*600,(random()-.5)*1700);
  starsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
  scene.add(new THREE.Points(starsGeometry,new THREE.PointsMaterial({color:'#d8e4f8',size:moon ? 1.1 : .4,transparent:true,opacity:moon ? .8 : .2})));
  if(moon) {const earth =new THREE.Mesh(new THREE.SphereGeometry(17,24,16),new THREE.MeshStandardMaterial({color:'#4985a9',emissive:'#12364c',roughness:.8}));earth.position.set(-240,170,-450);scene.add(earth);}
  const camera=new THREE.PerspectiveCamera(52,1,.2,1800),downCamera=new THREE.PerspectiveCamera(68,4/3,.2,1500);
  const pose=session.pose || {x:0,z:0,altitude:0,status:'Ready at base'};
  let x=pose.x,z=pose.z,altitude=pose.altitude,status=pose.status||'Ready at base';
  let targetAltitude=['Taking off','Returning to base'].includes(status)?22:status==='Landing'?0:altitude;
  let view=session.view||'chase',disposed=false,last=performance.now(),telemetryTime=0,scanning=0, yaw=.38,pitch=.3;
  const keys=new Set(),held=new Set();
  const look=new THREE.Vector3(),desired=new THREE.Vector3();
  drone.position.set(x,height(x,z)+3.5+altitude,z);camera.position.copy(drone.position).add(new THREE.Vector3(38,23,48));
  const inputTarget=event=> /INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName);
  const allowed=new Set(['w','a','s','d','q','e','arrowup','arrowleft','arrowdown','arrowright']);
  window.addEventListener('keydown',e=>{if(inputTarget(e))return;const key=e.key.toLowerCase();if(allowed.has(key)){e.preventDefault();keys.add(key);}},{signal});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()),{signal});
  window.addEventListener('blur',()=>{keys.clear();held.clear();},{signal});
  let pointer=null;
  canvas.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.focus();},{signal});
  canvas.addEventListener('pointermove',e=>{if(!pointer)return;yaw+=(e.clientX-pointer.x)*.005;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-pointer.y)*.003,.08,1.1);pointer={x:e.clientX,y:e.clientY};},{signal});
  canvas.addEventListener('pointerup',()=>pointer=null,{signal});canvas.addEventListener('pointercancel',()=>pointer=null,{signal});
  const resize=()=>{const{width,height:h}=container.getBoundingClientRect();if(!width||!h)return;renderer.setSize(width,h);camera.aspect=width/h;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  let contextLost=false;
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;renderer.setAnimationLoop(null);onError('The 3D graphics context was lost. Close and reopen Drone Exploration to reconnect.');},{signal});
  function cameraDown(){downCamera.position.set(x,height(x,z)+3.5+altitude-.6,z);downCamera.up.set(0,0,-1);downCamera.lookAt(x,height(x,z)-1,z);downCamera.updateMatrixWorld();}
  function flightPose(){return {x,z,altitude,status};}
  function render(now) {
    if(disposed||contextLost)return;
    const dt=Math.min((now-last)/1000,.05);last=now;
    if(document.hidden){keys.clear();held.clear();return;}
    const active=key=>keys.has(key)||held.has(key);
    const airborne=['Taking off','Hovering','Exploring'].includes(status);
    if(airborne){
      let dx=Number(active('d')||active('arrowright'))-Number(active('a')||active('arrowleft'));
      let dz=Number(active('s')||active('arrowdown'))-Number(active('w')||active('arrowup'));
      const magnitude=Math.hypot(dx,dz)||1;
      x=THREE.MathUtils.clamp(x+dx/magnitude*dt*22,-480,480);z=THREE.MathUtils.clamp(z+dz/magnitude*dt*22,-480,480);
      targetAltitude=THREE.MathUtils.clamp(targetAltitude+(Number(active('e'))-Number(active('q')))*dt*12,8,65);
      if(status!=='Taking off')status=dx||dz?'Exploring':'Hovering';
    }
    if(status==='Returning to base') {x=THREE.MathUtils.damp(x,0,.7,dt);z=THREE.MathUtils.damp(z,0,.7,dt);targetAltitude=22;if(Math.hypot(x,z)<.5){x=0;z=0;status='Landing';targetAltitude=0;}}
    altitude=THREE.MathUtils.damp(altitude,targetAltitude,2,dt);
    if(status==='Taking off'&&Math.abs(altitude-targetAltitude)<.5)status='Hovering';
    if(status==='Landing'&&altitude<.08){altitude=0;status='Landed at base';}
    const flying=altitude>1;
    drone.position.set(x,height(x,z)+3.5+altitude+(flying?Math.sin(now*.002)*.15:0),z);
    drone.rotation.z=THREE.MathUtils.damp(drone.rotation.z,active('a')?.08:active('d')?-.08:0,4,dt);
    drone.rotation.x=THREE.MathUtils.damp(drone.rotation.x,active('w')?-.06:active('s')?.06:0,4,dt);
    rotors.forEach((r,i)=>r.rotation.y+=(i?-1:1)*dt*(flying?48:1));
    jets.forEach((jet,i)=>{jet.visible=flying;jet.scale.y=1+Math.sin(now*.03+i)*.15;});
    cameraDown();
    if(view==='down') {desired.copy(downCamera.position);look.set(x,height(x,z)-4,z);camera.up.lerp(new THREE.Vector3(0,0,-1),1-Math.exp(-dt*4));}
    else if(view==='fpv'){desired.copy(drone.position).add(new THREE.Vector3(0,0,-1.7));look.copy(drone.position).add(new THREE.Vector3(0,-5,-50));camera.up.lerp(new THREE.Vector3(0,1,0),1-Math.exp(-dt*4));}
    else {desired.copy(drone.position).add(new THREE.Vector3(Math.sin(yaw)*60,20+pitch*40,Math.cos(yaw)*60));look.copy(drone.position);camera.up.lerp(new THREE.Vector3(0,1,0),1-Math.exp(-dt*4));}
    camera.position.lerp(desired,1-Math.exp(-dt*4));camera.lookAt(look);
    if(scanning>0){scanning-=dt;scan.position.set(x,height(x,z)+.4,z);scan.scale.setScalar(1+(1.1-scanning)*20);scan.material.opacity=Math.max(0,scanning*.8);}
    else scan.material.opacity=0;
    const width=canvas.width/renderer.getPixelRatio(),heightPx=canvas.height/renderer.getPixelRatio();
    renderer.setScissorTest(false);renderer.setViewport(0,0,width,heightPx);renderer.render(scene,camera);
    // A true, downward camera feed in the same WebGL context (no extra loop).
    if(width>500){const w=Math.round(width*.23),h=Math.round(w*.75);renderer.setScissorTest(true);renderer.setScissor(width-w-12,110,w,h);renderer.setViewport(width-w-12,110,w,h);drone.visible=false;renderer.render(scene,downCamera);drone.visible=true;renderer.setScissorTest(false);}
    if(now-telemetryTime>100){telemetryTime=now;session.pose=flightPose();onTelemetry({...flightPose(),...coordinatesAt(session.body,session.origin,x,z),ground:height(x,z)*METRES_PER_UNIT});}
  }
  renderer.setAnimationLoop(render);
  return {
    launch(){if(altitude<1){targetAltitude=22;status='Taking off';}},
    returnToBase(){if(altitude>1){keys.clear();held.clear();status='Returning to base';}},
    hold(key,value){value?held.add(key):held.delete(key);},
    setView(value){view=value;session.view=value;},
    pose:flightPose,
    capture(){
      if(!['Hovering','Exploring'].includes(status))throw new Error('Launch and wait for the drone to hover before capturing.');
      keys.clear();held.clear();status='Hovering';scanning=1.1;cameraDown();
      const target=new THREE.WebGLRenderTarget(800,600);
      const oldSize=renderer.getSize(new THREE.Vector2());
      try {
        renderer.setScissorTest(false);renderer.setRenderTarget(target);drone.visible=false;scan.visible=false;
        renderer.render(scene,downCamera);
        const pixels=new Uint8Array(800*600*4);renderer.readRenderTargetPixels(target,0,0,800,600,pixels);
        const imageCanvas=document.createElement('canvas');imageCanvas.width=800;imageCanvas.height=600;
        const ctx=imageCanvas.getContext('2d'),data=ctx.createImageData(800,600);
        for(let row=0;row<600;row++)data.data.set(pixels.subarray((599-row)*800*4,(600-row)*800*4),row*800*4);
        ctx.putImageData(data,0,0);ctx.fillStyle='rgba(5,15,25,.7)';ctx.fillRect(0,555,800,45);ctx.fillStyle='#c4ffe7';ctx.font='14px monospace';
        const c=coordinatesAt(session.body,session.origin,x,z);ctx.fillText(`SIMULATED ${session.body.toUpperCase()} SURVEY / ${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}`,20,583);
        return {image:imageCanvas.toDataURL('image/jpeg',.86),pose:flightPose()};
      } finally {drone.visible=true;scan.visible=true;renderer.setRenderTarget(null);renderer.setViewport(0,0,oldSize.x,oldSize.y);target.dispose();}
    },
    dispose(){
      session.pose=flightPose();disposed=true;controller.abort();observer.disconnect();renderer.setAnimationLoop(null);
      const geometries=new Set(),materials=new Set();
      scene.traverse(obj=>{if(obj.geometry)geometries.add(obj.geometry);if(obj.material)(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>materials.add(m));if(obj.isInstancedMesh)obj.dispose();});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());sun.shadow.map?.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
    },
  };
}
