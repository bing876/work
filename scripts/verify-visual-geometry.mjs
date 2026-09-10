import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { stat, createReadStream } from 'node:fs';
import { chromium } from 'playwright';

const [prototypePath] = process.argv.slice(2);
const vnextUrl = process.env.WORKBENCH_VNEXT_URL ?? 'http://127.0.0.1:4173';

if (!prototypePath) throw new Error('Usage: node scripts/verify-visual-geometry.mjs <prototype-workbench.work.html>');
await new Promise((resolve, reject) => stat(prototypePath, (error) => error ? reject(error) : resolve()));

const server = createServer((request, response) => {
  if (request.url === '/' || request.url === '/workbench.work.html') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    createReadStream(prototypePath).pipe(response);
    return;
  }
  response.writeHead(404).end();
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const prototypeUrl = `http://127.0.0.1:${address.port}/workbench.work.html`;

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const [prototype, vnext] = await Promise.all([context.newPage(), context.newPage()]);
  await Promise.all([prototype.goto(prototypeUrl), vnext.goto(vnextUrl)]);
  await Promise.all([prototype.waitForTimeout(1200), vnext.waitForTimeout(1200)]);

  const readGeometry = (page, normalized) => page.evaluate((useStageScale) => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const value = element.getBoundingClientRect();
      return { left: value.left, top: value.top, width: value.width, height: value.height };
    };
    const frame = rect('.frame');
    const stage = document.querySelector('.stage');
    const transform = stage ? getComputedStyle(stage).transform : 'none';
    const scale = useStageScale ? Number(transform.match(/^matrix\(([^,]+)/)?.[1] ?? 1) : 1;
    const local = (selector) => {
      const value = rect(selector);
      return { x: (value.left - frame.left) / scale, y: (value.top - frame.top) / scale, width: value.width / scale, height: value.height / scale };
    };
    return { scale, frame: { width: frame.width / scale, height: frame.height / scale }, rail: local('.rail'), sidebar: local('.sidebar'), main: local('.main-area'), inputbar: local('.inputbar'), tokenOutside: local('.token-outside') };
  }, normalized);

  const [source, current] = await Promise.all([readGeometry(prototype, true), readGeometry(vnext, false)]);
  const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 0.2, `${label}: expected ${expected}, got ${actual}`);
  for (const [name, geometry] of Object.entries({ source, current })) {
    near(geometry.rail.x, 0, `${name}.rail.x`); near(geometry.rail.width, 60, `${name}.rail.width`);
    near(geometry.sidebar.x, 60, `${name}.sidebar.x`); near(geometry.sidebar.width, 250, `${name}.sidebar.width`);
    near(geometry.main.x, 310, `${name}.main.x`); assert.ok(geometry.main.width >= 889.8, `${name}.main.width: expected at least 890, got ${geometry.main.width}`);
    near(geometry.inputbar.x, 322, `${name}.inputbar.x`); near(geometry.inputbar.width, 695, `${name}.inputbar.width`); near(geometry.inputbar.height, 47, `${name}.inputbar.height`);
    near(geometry.tokenOutside.x, 1027, `${name}.tokenOutside.x`); near(geometry.tokenOutside.width, 161, `${name}.tokenOutside.width`); near(geometry.tokenOutside.height, 47, `${name}.tokenOutside.height`);
  }
  near(source.frame.width, 1200, 'source.frame.width'); near(source.frame.height, 770, 'source.frame.height');
  console.log(JSON.stringify({ viewport: '1440x900', stabilizationMs: 1200, source, current, result: 'PASS', note: 'vNext frame viewport size is reported, not asserted; Electron Window/Viewport Contract is deferred.' }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
