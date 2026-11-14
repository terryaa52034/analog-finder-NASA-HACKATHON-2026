const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  await page.goto('http://127.0.0.1:8765');await page.locator('#intro-orbit').click();await page.locator('#intro-enter').click();await page.waitForSelector('#targets button');
  const names=await page.evaluate(async()=>{
   const {locationAt}=await import('./geography.js');
   return {coast:locationAt(-20.25,-70.25),paris:locationAt(48.8566,2.3522),remote:locationAt(-80.25,41.75),southland:locationAt(-82.75,135.25),southGeorgia:locationAt(-85.25,50.25),seam:locationAt(0,-179.999),pole:locationAt(90,180)};
  });
  assert.equal(names.coast.country,'Chile');assert.ok(names.coast.distanceKm<30);assert.ok(names.coast.city&&names.coast.region);
  assert.match(names.paris.city,/^Paris(?:\s|$)/);assert.ok(names.paris.distanceKm<5);
  for(const location of Object.values(names)){assert.ok(Number.isFinite(location.distanceKm));assert.ok(location.city&&location.id);}
  for(const key of ['remote','southland','southGeorgia']){assert.match(names[key].title,/Antarct/);assert.ok(names[key].remote);assert.ok(names[key].distanceKm>100);assert.doesNotMatch(names[key].title,/Invercargill|Grytviken|Southland|South Georgia/);}
  await page.locator('.target').filter({hasText:'Jezero crater'}).click();
  assert.equal(await page.locator('#results .location-context').count(),15);
  assert.match(await page.locator('#results .location-context').first().textContent(),/km (from analysed cell|away)/);
  assert.match(await page.locator('#card .location-disclaimer').last().textContent(),/GeoNames/);
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;
  const stream=await download.createReadStream();let csv='';for await(const chunk of stream)csv+=chunk.toString();
  assert.match(csv,/reference_city,reference_region,reference_country,reference_distance_km,geonames_id/);
  assert.equal(csv.trim().split('\n').length,16);
  assert.ok(requests.some(url=>url.includes('gibs.earthdata.nasa.gov/wmts/')),'NASA WMTS imagery requested at runtime');
  assert.ok(requests.some(url=>url.endsWith('/data/grid.json')),'Matcher loads the cached Earth grid');
  assert.ok(!requests.some(url=>/api.geonames|nominatim/.test(url)),'Place lookup is local');
  await page.screenshot({path:'analog-finder/places-preview.png'});
  // A failed reference-place download must preserve working country/coordinate results.
  const fallback=await browser.newPage();await fallback.route('**/data/places.json',route=>route.fulfill({status:503,body:'unavailable'}));
  await fallback.goto('http://127.0.0.1:8765');await fallback.locator('#intro-orbit').click();await fallback.locator('#intro-enter').click();await fallback.waitForSelector('#targets button');await fallback.locator('.target').first().click();assert.equal(await fallback.locator('#results button').count(),15);
  assert.deepEqual(errors,[]);
  console.log('PASS: city/state/distance lookup, Chile coastal cell, Paris, poles/date line, remote-place honesty, result/report labels, CSV metadata, NASA request paths, and gazetteer outage fallback.');
  console.log(JSON.stringify({coastalExample:names.coast,remoteExample:names.remote},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
