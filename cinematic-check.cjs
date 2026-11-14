const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1536,height:864}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765');
  await page.waitForSelector('.cinematic-playing .intro-cosmos canvas');
  const initialCanvas=await page.locator('.intro-cosmos canvas').elementHandle();
  await page.evaluate(()=>{window.__journeyStages=[];new MutationObserver(()=>{const stage=document.querySelector('#mission-intro').dataset.cinematicStage;if(stage&&!window.__journeyStages.includes(stage))window.__journeyStages.push(stage);}).observe(document.querySelector('#mission-intro'),{attributes:true,attributeFilter:['data-cinematic-stage']});});
  const samples=await page.evaluate(async()=>{
   const {sampleCinematic,BODY_CENTRES}=await import('./cinematic-intro.js');
   return {centres:BODY_CENTRES,frames:[0,1.9,4.2,6.5,8.5,9.4,10.5,12,13.5].map(t=>sampleCinematic(t)),edgeA:sampleCinematic(8.5-.0001),edgeB:sampleCinematic(8.5+.0001)};
  });
  for(const c of Object.values(samples.centres)){assert.equal(c[1],0);assert.equal(c[2],0);}
  assert.ok(samples.frames.every(f=>f.camera.every(Number.isFinite)&&f.target.every(Number.isFinite)));
  assert.ok(Math.hypot(...samples.edgeA.camera.map((v,i)=>v-samples.edgeB.camera[i]))<.01,'Camera stays continuous through alignment');
  assert.ok(Math.abs(samples.frames[5].beamHead)<1e-10);
  assert.ok(await page.locator('#intro-orbit').isEnabled());
  assert.equal(await page.locator('#intro-skip').count(),0);
  await page.waitForSelector('#mission-intro[data-view=orbit]',{timeout:30000});
  const stages=await page.evaluate(()=>window.__journeyStages);
  for(const stage of ['mars','earth','alignment','connection','arrival','orbit'])assert.ok(stages.includes(stage),`Journey visited ${stage}`);
  assert.equal(await page.locator('.intro-cosmos canvas').count(),1,'Only the orbit renderer remains after the film');
  assert.ok(await page.evaluate(node=>node===document.querySelector('.intro-cosmos canvas'),initialCanvas),'Cinematic and orbit share one continuous renderer');
  assert.ok(await page.locator('.intro-guide').isVisible());
  await page.locator('#intro-enter').click();await page.locator('#mission-intro').waitFor({state:'hidden'});
  assert.equal(await page.locator('.intro-cosmos canvas').count(),0);
  assert.equal(await page.locator('#drone-open').isEnabled(),true);
  await page.locator('.target').filter({hasText:'Jezero crater'}).click();assert.equal(await page.locator('#results button').count(),15);
  await page.locator('#intro-replay').click();await page.waitForSelector('.cinematic-playing .intro-cosmos canvas');await page.locator('#intro-orbit').click();
  await page.waitForSelector('#mission-intro[data-view=orbit]');assert.equal(await page.locator('#results button').count(),15);
  await page.locator('#intro-enter').click();await page.locator('#mission-intro').waitFor({state:'hidden'});
  await page.locator('#intro-replay').click();await page.locator('#intro-orbit').click();await page.waitForSelector('#mission-intro:not(.cinematic-playing) .intro-cosmos canvas');
  assert.ok(await page.locator('.intro-guide').isVisible());await page.locator('#intro-enter').click();await page.locator('#mission-intro').waitFor({state:'hidden'});
  // Pause a separate reusable scene for reliable visual inspection; screenshots
  // can stall software GPUs and must not change the live journey's timing.
  await page.evaluate(async()=>{const {createCinematicIntro}=await import('./cinematic-intro.js');const host=document.createElement('div');host.id='cinematic-test-host';Object.assign(host.style,{position:'fixed',inset:0,zIndex:9999});document.body.append(host);window.__preview=createCinematicIntro(host,{onFrame:frame=>window.__previewFrame=frame});window.__preview.pause();});
  await page.waitForFunction(()=>window.__preview.snapshot().ready);
  for(const[name,time]of [['moon',1.6],['mars',4.1],['earth',6.3],['beam',9.95]]){await page.evaluate(time=>window.__preview.seek(time),time);await page.waitForFunction(time=>Math.abs(window.__previewFrame?.time-time)<.001,time);await page.screenshot({path:`analog-finder/cinematic-${name}.png`});}
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__preview.seek(9.95));await page.waitForTimeout(200);await page.screenshot({path:'analog-finder/cinematic-mobile.png'});
  await page.evaluate(()=>{window.__preview.dispose();document.querySelector('#cinematic-test-host').remove();});
  const mobile=await browser.newPage({viewport:{width:390,height:844}});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto('http://127.0.0.1:8765');await mobile.waitForSelector('.cinematic-playing .intro-cosmos canvas');
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.locator('#intro-orbit').click();await mobile.waitForSelector('#mission-intro[data-view=orbit]');await mobile.locator('#intro-enter').click();await mobile.locator('#mission-intro').waitFor({state:'hidden'});assert.equal(await mobile.locator('.intro-cosmos canvas').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: cinematic → orbit → app, camera continuity, straight beam, skip cinematic, no Skip Intro button, replay, mobile, retained results, and renderer cleanup.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
