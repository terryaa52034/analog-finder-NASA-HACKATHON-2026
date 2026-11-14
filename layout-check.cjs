const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const intersects=(a,b)=>a.x<b.x+b.width-1&&a.x+a.width>b.x+1&&a.y<b.y+b.height-1&&a.y+a.height>b.y+1;
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765');await page.locator('#intro-orbit').click();await page.waitForSelector('.intro-guide');await page.waitForTimeout(1500);
  const sizes=[[1920,900],[1536,864],[1280,720],[1024,768],[954,869],[820,650],[768,1024],[390,844],[360,640],[320,568]];
  for(const[width,height]of sizes){
   await page.setViewportSize({width,height});
   const bounds={};for(const selector of ['.intro-header','.intro-copy','.intro-actions','.intro-capabilities','.intro-guide','.intro-footer'])bounds[selector]=await page.locator(selector).boundingBox();
   assert.ok(bounds['.intro-guide'].y>=bounds['.intro-copy'].y+bounds['.intro-copy'].height+23,`Briefing overlap at ${width}x${height}`);
   assert.equal(intersects(bounds['.intro-header'],bounds['.intro-copy']),false,`Header overlap at ${width}`);
   assert.equal(intersects(bounds['.intro-footer'],bounds['.intro-guide']),false,`Footer overlap at ${width}`);
   assert.equal(await page.locator('#mission-intro').evaluate(node=>node.scrollWidth>node.clientWidth),false,`Intro horizontal overflow at ${width}`);
   if(width===954)await page.screenshot({path:'analog-finder/layout-intro.png'});
  }
  await page.setViewportSize({width:1536,height:864});await page.locator('#intro-enter').click();await page.waitForSelector('#targets button');
  await page.locator('.target').first().click();
  for(const[width,height]of sizes){
   await page.setViewportSize({width,height});await page.mouse.move(0,0);await page.waitForTimeout(100);
   await page.waitForFunction(()=>{const header=document.querySelector('.map-header').getBoundingClientRect(),card=document.querySelector('#card').getBoundingClientRect();return card.top>=header.bottom+8;},{},{timeout:3000});
   assert.equal(intersects(await page.locator('.map-heading').boundingBox(),await page.locator('.map-tools').boundingBox()),false,`Map heading/toolbar overlap at ${width}`);
   const targets=await page.locator('.target').evaluateAll(nodes=>nodes.map(node=>({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height})));
   targets.forEach(rect=>{assert.ok(Math.abs(rect.width-targets[0].width)<1,`Unequal target widths at ${width}`);assert.ok(Math.abs(rect.height-targets[0].height)<1,`Unequal target heights at ${width}`)});
   const card=await page.locator('#card').boundingBox();
   assert.equal(intersects(card,await page.locator('.map-header').boundingBox()),false,`Map header/report overlap at ${width}`);
   const zoom=page.locator('.leaflet-control-zoom');if(await zoom.isVisible())assert.equal(intersects(card,await zoom.boundingBox()),false,`Zoom/report overlap at ${width}`);
   const mascot=page.locator('.companion');assert.equal(intersects(card,await mascot.boundingBox()),false,`Mascot/report overlap at ${width}`);
   await page.locator('#card').evaluate(node=>node.scrollTop=node.scrollHeight);
   const close=await page.locator('#card .close').boundingBox();assert.ok(close.y>=card.y&&close.y+close.height<=card.y+card.height,`Close button inaccessible at ${width}`);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Dashboard overflow at ${width}`);
   if(width===954)await page.screenshot({path:'analog-finder/layout-report.png'});
  }
  await page.setViewportSize({width:1536,height:864});if(await page.locator('#mascot-toggle').getAttribute('aria-expanded')==='false')await page.locator('#mascot-toggle').click();await page.waitForTimeout(150);
  assert.equal(intersects(await page.locator('#card').boundingBox(),await page.locator('.companion').boundingBox()),false,'Expanded guide overlaps report');
  assert.deepEqual(errors,[]);console.log('PASS: 10 viewport sizes; intro spacing, equal target cards, separate map controls/report/mascot, sticky report close, and no horizontal overflow.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
