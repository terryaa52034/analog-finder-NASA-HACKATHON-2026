// Rebuild compact planetary evidence from the challenge's NASA PDS resources.
// Run: node pipeline/fetch_planetary_profiles.cjs
// Set PLAYWRIGHT_MODULE to an installed Playwright module if it is not on PATH.
// TLS validation stays enabled. No API keys or science data are fabricated.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const prp =
  'https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south';
const mola =
  'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg032/megt90n000fb';
const rems = 'https://science.nasa.gov/resource/taking-mars-temperature/';
const sd = (values) => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
};
const sha = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const requests = [];
    async function get(url, range) {
      const response = await context.request.get(url, {
        headers: range ? { Range: `bytes=${range[0]}-${range[1]}` } : {},
        timeout: 60000,
      });
      assert.equal(response.status(), range ? 206 : 200, `Unexpected HTTP status: ${url}`);
      const buffer = await response.body();
      if (range) {
        assert.equal(buffer.length, range[1] - range[0] + 1);
        assert.ok(response.headers()['content-range'].startsWith(`bytes ${range[0]}-${range[1]}/`));
      }
      requests.push({ url, range: range || null, bytes: buffer.length, sha256: sha(buffer) });
      return buffer;
    }
    const features = {};
    for (const [body, name] of [
      ['moon', 'Cabeus'],
      ['mars', 'Gale'],
    ]) {
      const url = `https://oderest.rsl.wustl.edu/live2/?query=featuredata&odemetadb=${body}&featurename=${name}&output=json`;
      const result = JSON.parse((await get(url)).toString()).ODEResults;
      assert.equal(result.Status, 'Success');
      assert.equal(Number(result.Count), 1);
      features[name] = { url, feature: result.Features.Feature };
    }
    const prpLabel = (await get(prp + '.xml')).toString();
    assert.ok(prpLabel.includes('<record_length unit="byte">210</record_length>'));
    assert.ok(prpLabel.includes('annual maximum temperature'));
    // A selected triangle in Cabeus, NOT claimed to be the LCROSS impact point.
    // Index in the archived south polar mesh, verified using its returned coordinates.
    const i = 388,
      j = 358,
      index = 2 * (i * 1200 + j),
      start = 210 + 210 * index;
    const central = (await get(prp + '.tab', [start, start + 209]))
      .toString()
      .trim()
      .split(',')
      .map(Number);
    assert.equal(central.length, 15);
    assert.ok(central.every(Number.isFinite));
    assert.ok(central[10] > -86 && central[10] < -84 && central[9] > -51 && central[9] < -47);
    assert.ok(central[13] > 20 && central[13] < 273.15);
    // Sample 11 mesh strips, ~5 km apart, across an approximately 55 km square.
    // Archive-derived terrain statistic, not a measured rover-scale roughness.
    const lunarRows = [];
    for (let di = -50; di <= 50; di += 10) {
      const rowIndex = 2 * ((i + di) * 1200 + j - 55),
        offset = 210 + 210 * rowIndex;
      const bytes = await get(prp + '.tab', [offset, offset + 210 * 222 - 1]);
      for (let n = 0; n < 222; n++) {
        const row = bytes
          .toString('ascii', n * 210, (n + 1) * 210)
          .trim()
          .split(',')
          .map(Number);
        assert.equal(row.length, 15);
        assert.ok(row.every(Number.isFinite));
        lunarRows.push({
          record: rowIndex + n,
          lon: row[9],
          lat: row[10],
          elevationM: row[11] * 1000,
        });
      }
    }
    const molaLabel = (await get(mola + '.lbl')).toString();
    assert.ok(/LINE_SAMPLES\s*=\s*11520/.test(molaLabel));
    assert.ok(/SAMPLE_TYPE\s*=\s*MSB_INTEGER/.test(molaLabel));
    // Gale: reference point near Curiosity's landing area; pixel-centre sampling.
    const lat = -4.59,
      lon = 137.44,
      ppd = 32,
      width = 11520;
    const row0 = Math.floor((90 - lat) * ppd),
      col0 = Math.floor(lon * ppd);
    const radiusLat = 27.5 / ((3396 * Math.PI) / 180),
      radiusLon = radiusLat / Math.cos((lat * Math.PI) / 180);
    const terrain = [];
    for (
      let row = Math.ceil((90 - lat - radiusLat) * ppd - 0.5);
      row <= Math.floor((90 - lat + radiusLat) * ppd - 0.5);
      row++
    ) {
      const c0 = Math.ceil((lon - radiusLon) * ppd - 0.5),
        c1 = Math.floor((lon + radiusLon) * ppd - 0.5);
      const offset = 2 * (row * width + c0),
        buffer = await get(mola + '.img', [offset, offset + 2 * (c1 - c0 + 1) - 1]);
      for (let col = c0; col <= c1; col++) {
        const value = buffer.readInt16BE(2 * (col - c0));
        assert.ok(value >= -8206 && value <= 21181);
        terrain.push({ lat: 90 - (row + 0.5) / ppd, lon: (col + 0.5) / ppd, elevationM: value });
      }
    }
    const centreOffset = 2 * (row0 * width + col0);
    const elevationM = (await get(mola + '.img', [centreOffset, centreOffset + 1])).readInt16BE();
    // These are published observations, not a live weather API or a full climatology.
    const article = (await get(rems)).toString();
    assert.ok(
      article.includes('minus 91') &&
        article.includes('3 degrees Celsius') &&
        article.includes('Aug. 16'),
    );
    const result = {
      retrievedAt: new Date().toISOString(),
      challenge:
        'https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/?tab=resources',
      features,
      cabeus: {
        lat: central[10],
        lon: central[9],
        record: index,
        maximumSurfaceTemperatureC: central[13] - 273.15,
        annualMeanAt2cmC: central[12] - 273.15,
        elevationM: central[11] * 1000,
        roughnessM: sd(lunarRows.map((x) => x.elevationM)),
        terrainSamples: lunarRows.length,
        source: prp + '.xml',
        data: prp + '.tab',
        status:
          'PDS Diviner PRP thermal model; terrain from archived triangle altitudes. Mean at 2 cm is NOT minimum surface temperature.',
        terrain: lunarRows,
      },
      gale: {
        lat,
        lon,
        elevationM,
        roughnessM: sd(terrain.map((x) => x.elevationM)),
        terrainSamples: terrain.length,
        groundMaximumC: 3,
        groundMinimumC: -91,
        temperaturePeriod: '2012-08-16 to 2012-08-17',
        temperatureSource: rems,
        terrainSource: mola + '.lbl',
        terrainData: mola + '.img',
        status:
          'MOLA gridded altimetry (1997–2001; product 2003, includes interpolated bins); REMS published ground-temperature observations for two dates, not annual extremes.',
        terrain,
      },
      requests,
    };
    await fs.writeFile(
      path.join(root, 'web/data/planetary-evidence.json'),
      JSON.stringify(result, null, 2) + '\n',
    );
    const compact = JSON.parse(JSON.stringify(result));
    delete compact.requests;
    delete compact.cabeus.terrain;
    delete compact.gale.terrain;
    await fs.writeFile(
      path.join(root, 'web/planetary-profiles.js'),
      '// Generated by pipeline/fetch_planetary_profiles.cjs; see data/planetary-evidence.json.\nexport const PLANETARY_PROFILES = ' +
        JSON.stringify(compact, null, 2) +
        ';\n',
    );
    console.log(
      JSON.stringify(
        { cabeus: compact.cabeus, gale: compact.gale, requests: requests.length },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
