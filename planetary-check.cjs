const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const evidence = require('./web/data/planetary-evidence.json');
const sd = (values) => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
};
(async () => {
  assert.equal(evidence.features.Cabeus.feature.FeatureName, 'Cabeus');
  assert.equal(evidence.features.Gale.feature.FeatureName, 'Gale');
  for (const site of [evidence.cabeus, evidence.gale])
    assert.ok(Math.abs(sd(site.terrain.map((x) => x.elevationM)) - site.roughnessM) < 1e-8);
  assert.equal(evidence.gale.groundMaximumC - evidence.gale.groundMinimumC, 94);
  assert.ok(evidence.requests.every((x) => x.sha256.length === 64 && x.url.startsWith('https://')));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:8765');
    await page.locator('#intro-orbit').click();
    await page.locator('#intro-enter').click();
    await page.waitForFunction(() => !document.querySelector('#drone-open').disabled);
    const targets = await page.evaluate(async () => {
      const { TARGETS } = await import('./targets.js');
      const { SITE_ANCHORS } = await import('./drone-model.js');
      return TARGETS.map((t) => ({ id: t.id, anchor: SITE_ANCHORS[t.id], traits: t.traits }));
    });
    assert.equal(targets.length, 5);
    assert.ok(!targets.some((t) => /shackleton|utopia/.test(t.id)));
    for (const t of targets) assert.ok(t.anchor.every(Number.isFinite));
    for (const name of ['Cabeus cold-trap region', 'Gale crater']) {
      await page.locator('.target').filter({ hasText: name }).click();
      await page.waitForFunction(() => document.querySelectorAll('#results button').length > 0);
      await page.locator('#results button').first().click();
      await page.locator('#card .target-evidence summary').click();
      assert.ok((await page.locator('#card .target-evidence a').count()) >= 3);
      const text = await page.locator('#card').innerText();
      assert.match(text, /Simulated/);
      assert.match(text, /Source/);
      assert.doesNotMatch(text, /NaN|undefined/);
      if (name.startsWith('Cabeus')) {
        assert.match(text, /Model-derived/);
        assert.equal(await page.locator('#weights input:disabled').count(), 1);
      } else assert.match(text, /Observed summary/);
      await page.locator('#drone-open').click();
      await page.waitForSelector('#drone-canvas canvas');
      if (name === 'Gale crater') await page.locator('[data-body="Mars"]').click();
      assert.equal(
        await page.locator('#drone-site').inputValue(),
        name.startsWith('Cabeus') ? 'moon-cabeus' : 'mars-gale',
      );
      await page.locator('#drone-close').click();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      'Planetary evidence, source labels, scoring, drone anchors and mobile overflow checks passed.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
