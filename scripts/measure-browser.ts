import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';
import { startBrowserServer } from './browser-server.ts';

const { values } = parseArgs({
  options: {
    font: { type: 'string', default: 'fixtures/NotoSansMono-Regular.ttf' },
    text: { type: 'string', multiple: true },
    size: { type: 'string', default: '16' },
    width: { type: 'string' },
    'line-height': { type: 'string' },
    direction: { type: 'string', default: 'auto' },
    language: { type: 'string', default: 'und' },
    'no-kerning': { type: 'boolean', default: false },
    'no-ligatures': { type: 'boolean', default: false },
    weight: { type: 'string' },
    axis: { type: 'string', multiple: true },
    stretch: { type: 'string' },
    output: { type: 'string', default: '_build/measurements/font-metrics.json' },
  },
});
const fontPath = resolve(values.font);
const bytes = await readFile(fontPath);
const fontSize = Number(values.size);
const axisValues: Record<string, number> = {};
for (const entry of values.axis ?? []) {
  const match = /^([\x20-\x7e]{4})=(-?(?:\d+(?:\.\d*)?|\.\d+))$/.exec(entry);
  if (!match || !Number.isFinite(Number(match[2]))) throw new RangeError('--axis must be a four-character tag and finite value, e.g. wdth=75');
  axisValues[match[1]] = Number(match[2]);
}
const options = {
  textRendering: 'geometricPrecision',
  axisValues,
  ...(values.stretch === undefined ? {} : { fontStretch: Number(values.stretch) }),
  ...(values.weight === undefined ? {} : { fontWeight: Number(values.weight) }),
  direction: values.direction as 'auto' | 'ltr' | 'rtl',
  language: values.language,
  kerning: !values['no-kerning'],
  ligatures: !values['no-ligatures'],
  ...(values.width === undefined ? {} : { maxWidth: Number(values.width) }),
  ...(values['line-height'] === undefined ? {} : { lineHeight: Number(values['line-height']) }),
};
if (!['auto', 'ltr', 'rtl'].includes(values.direction)) throw new RangeError('direction must be auto, ltr or rtl');
for (const [name, value] of Object.entries({ fontSize, maxWidth: options.maxWidth, lineHeight: options.lineHeight, fontStretch: options.fontStretch })) {
  if (value === undefined) continue;
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and positive`);
}
const texts = values.text ?? ['Hello, world!', 'Ag', ' AV ', '', '  ', '\u{10780}'];
if (options.fontWeight !== undefined && (!Number.isFinite(options.fontWeight) || options.fontWeight < 1 || options.fontWeight > 1000)) throw new RangeError('weight must be between 1 and 1000');
const server = await startBrowserServer(0, fontPath);
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 });
  await page.goto(server.url);
  const measurements = await page.evaluate(async ({ texts, fontSize, options }) => {
    const { loadFont } = await import(new URL('/browser/font.js', location.href).href) as typeof import('../browser/font.js');
    const font = await loadFont('/input-font');
    try {
      return await Promise.all(texts.map(text => Object.keys(options.axisValues).length || options.fontStretch !== undefined
        ? font.measureWithAxes(text, fontSize, options) : font.measure(text, fontSize, options)));
    }
    finally { font.dispose(); }
  }, { texts, fontSize, options });
  const { stdout: moonVersion } = await promisify(execFile)('moon', ['version', '--all']);
  const report = {
    schemaVersion: 4,
    options,
    font: { path: fontPath, sha256: createHash('sha256').update(bytes).digest('hex') },
    environment: {
      browser: 'chromium', browserVersion: browser.version(),
      moonVersion: moonVersion.trim(), nodeVersion: process.version,
      platform: process.platform, deviceScaleFactor: 1,
    },
    measurements,
  };
  const output = resolve(values.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`Saved ${measurements.length} measurements to ${output}`);
  console.log(`Maximum absolute advance delta: ${Math.max(0, ...measurements.map(m => Math.abs(m.widthDelta))).toFixed(6)}px`);
} finally {
  await browser?.close();
  await server.close();
}
