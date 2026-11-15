const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1536, height: 1000 } }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Capture the map only inside this test, without exposing an app debug global.
    await page.route('**/leaflet.min.js', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body:
          (await response.text()) +
          '\nL.Map.addInitHook(function(){window.__boundsTestMap=this;});',
      });
    });
    await page.goto('http://127.0.0.1:8765');
    await page.locator('#intro-orbit').click();
    await page.locator('#intro-enter').click();
    await page.waitForSelector('#targets button');
    assert.equal(await page.locator('#mascot-toggle').getAttribute('aria-expanded'), 'true');
    assert.ok(await page.locator('#guide-message').isVisible());
    async function assertBounds(label) {
      const b = await page.evaluate(() => {
        const m = window.__boundsTestMap,
          b = m.getBounds();
        return {
          north: b.getNorth(),
          south: b.getSouth(),
          west: b.getWest(),
          east: b.getEast(),
          zoom: m.getZoom(),
          min: m.getMinZoom(),
        };
      });
      assert.ok(
        b.north <= 85.051129 && b.south >= -85.051129,
        `${label}: vertical bounds ${JSON.stringify(b)}`,
      );
      assert.ok(
        b.west >= -180.00001 && b.east <= 180.00001,
        `${label}: horizontal bounds ${JSON.stringify(b)}`,
      );
      assert.ok(b.zoom >= b.min);
    }
    for (const [width, height] of [
      [1536, 1000],
      [1920, 700],
      [390, 844],
      [390, 1600],
    ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150);
      for (const lat of [-89, 89]) {
        await page.evaluate(
          (lat) => window.__boundsTestMap.setView([lat, 0], 0, { animate: false }),
          lat,
        );
        await assertBounds(`${width}x${height}, ${lat}`);
      }
      for (const offset of [
        [0, 100000],
        [0, -100000],
        [100000, 0],
        [-100000, 0],
      ]) {
        await page.evaluate(
          (offset) => window.__boundsTestMap.panBy(offset, { animate: false }),
          offset,
        );
        await assertBounds(`extreme pan ${offset}`);
      }
    }
    await page.setViewportSize({ width: 1536, height: 1000 });
    await page.locator('#world-view').click();
    await page.waitForTimeout(150);
    await assertBounds('World view');
    await page.locator('.target').filter({ hasText: 'Jezero crater' }).click();
    assert.equal(await page.locator('#mascot-toggle').getAttribute('aria-expanded'), 'true');
    await page.locator('#mascot-toggle').click();
    assert.equal(await page.locator('#mascot-toggle').getAttribute('aria-expanded'), 'false');
    await page.locator('.target').filter({ hasText: 'Utopia Planitia' }).click();
    assert.equal(
      await page.locator('#mascot-toggle').getAttribute('aria-expanded'),
      'false',
      'Only user action changes guide visibility',
    );
    await page.locator('#mascot-toggle').click();
    assert.equal(await page.locator('#mascot-toggle').getAttribute('aria-expanded'), 'true');
    assert.deepEqual(errors, []);
    console.log(
      'PASS: bounded map at four viewport sizes, polar/extreme pans and zoom-out, World view, expanded LUMA default, and user-controlled visibility.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
