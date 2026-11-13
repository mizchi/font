import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, firefox, webkit } from '@playwright/test';
import { startBrowserServer } from './browser-server.ts';

const { values } = parseArgs({ options: {
  font: { type: 'string', default: 'fixtures/shaping-reference/roboto-variable.ttf' },
  text: { type: 'string', default: 'Hello world office AV' },
  url: { type: 'string' }, selector: { type: 'string' },
  browser: { type: 'string', default: 'chromium' },
  mode: { type: 'string', default: 'wrapped' },
  'min-width': { type: 'string', default: '0' },
  'max-width': { type: 'string', default: '160' },
  height: { type: 'string' }, size: { type: 'string', default: '16' },
  weight: { type: 'string', default: '400' },
  stretch: { type: 'string', default: '100%' },
  'optical-sizing': { type: 'string', default: 'auto' },
  'variation-settings': { type: 'string', default: 'normal' },
  'white-space': { type: 'string', default: 'normal' },
  'word-break': { type: 'string', default: 'normal' },
  'overflow-wrap': { type: 'string', default: 'normal' },
  'letter-spacing': { type: 'string', default: '0' },
  'line-height': { type: 'string' },
  overflow: { type: 'string', default: 'visible' },
  'text-overflow': { type: 'string', default: 'clip' },
  'line-clamp': { type: 'string' },
  'assert-fit': { type: 'boolean', default: false },
  'allow-truncation': { type: 'boolean', default: false },
  'require-font': { type: 'string', multiple: true },
  output: { type: 'string', default: '_build/measurements/fit.json' },
} });
if (!['single-line', 'wrapped'].includes(values.mode)) throw new RangeError('mode must be single-line or wrapped');
if (values.url && !values.selector) throw new Error('--url requires --selector');
if (values['line-clamp'] !== undefined && (!Number.isInteger(Number(values['line-clamp'])) || Number(values['line-clamp']) < 1)) {
  throw new RangeError('line-clamp must be a positive integer');
}
const engine = ({ chromium, firefox, webkit } as const)[values.browser as 'chromium' | 'firefox' | 'webkit'];
if (!engine) throw new RangeError('browser must be chromium, firefox or webkit');
const limits = { minWidth: Number(values['min-width']), maxWidth: Number(values['max-width']),
  allowTruncation: values['allow-truncation'], requiredFonts: values['require-font'] ?? [] };
if (!Number.isFinite(limits.minWidth) || !Number.isFinite(limits.maxWidth) || limits.minWidth < 0 || limits.maxWidth < limits.minWidth) {
  throw new RangeError('Width bounds must be finite, nonnegative and min <= max');
}
const fontPath = resolve(values.font);
const bytes = values.url ? undefined : await readFile(fontPath);
const server = values.url ? undefined : await startBrowserServer(0, fontPath);
let browser: Awaited<ReturnType<typeof engine.launch>> | undefined;
try {
  browser = await engine.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1, bypassCSP: true });
  await page.goto(values.url ?? server!.url, { waitUntil: 'domcontentloaded' });
  const inspection = values.url
    ? await (async () => {
      // Inject the self-contained inspector into the requested page. It has no
      // runtime imports and reads computed layout without changing the source.
      const source = await readFile(new URL('../browser/fit.js', import.meta.url), 'utf8');
      const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
      await page.locator(values.selector!).first().waitFor({ state: 'attached' });
      return page.evaluate(async ({ selector, moduleUrl, limits }) => {
        const { inspectTextFit } = await import(moduleUrl) as typeof import('../browser/fit.js');
        return inspectTextFit(document.querySelector(selector)! as HTMLElement, limits);
      }, { selector: values.selector!, moduleUrl, limits });
    })()
    : await page.evaluate(async ({ text, limits, height, size, weight, stretch, opticalSizing, variationSettings, whiteSpace, wordBreak, overflowWrap, letterSpacing, lineHeight, overflow, textOverflow, lineClamp }) => {
      const { loadFont } = await import(new URL('/browser/font.js', location.href).href) as typeof import('../browser/font.js');
      const { checkTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../browser/fit.js');
      const font = await loadFont('/input-font');
      try {
        return await checkTextFit(text, {
          ...limits, ...(height === undefined ? {} : { maxHeight: Number(height) }),
          style: {
            fontFamily: `"${font.family}"`, fontSize: `${size}px`, fontWeight: weight,
            fontStretch: stretch, fontOpticalSizing: opticalSizing, fontVariationSettings: variationSettings,
            fontStyle: font.info.italic ? 'italic' : 'normal', lineHeight: lineHeight === undefined ? '1.4' : `${lineHeight}px`,
            whiteSpace, wordBreak, overflowWrap, letterSpacing: `${letterSpacing}px`, overflow,
            textOverflow,
            ...(lineClamp === undefined ? {} : { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lineClamp }),
          },
        });
      } finally { font.dispose(); }
    }, {
      text: values.text, limits, height: values.height, size: values.size, weight: values.weight,
      stretch: values.stretch, opticalSizing: values['optical-sizing'], variationSettings: values['variation-settings'],
      whiteSpace: values['white-space'], wordBreak: values['word-break'], overflowWrap: values['overflow-wrap'],
      letterSpacing: values['letter-spacing'], lineHeight: values['line-height'], overflow: values.overflow,
      textOverflow: values['text-overflow'], lineClamp: values['line-clamp'],
    });
  const report = {
    schemaVersion: 2, mode: values.mode, limits,
    source: values.url ? { url: values.url, selector: values.selector } : {
      font: fontPath, sha256: createHash('sha256').update(bytes!).digest('hex'), text: values.text,
    },
    environment: { browser: values.browser, browserVersion: browser.version(), platform: process.platform, deviceScaleFactor: 1 },
    inspection,
  };
  const output = resolve(values.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`Unwrapped: ${inspection.unwrapped.status}; wrapped layout: ${inspection.layout.status}`);
  console.log(`Presentation: ${inspection.presentation.status}; accepted: ${inspection.accepted ?? 'unknown'}`);
  console.log(`Saved fit inspection to ${output}`);
  const status = values.mode === 'single-line' ? inspection.unwrapped.status : inspection.layout.status;
  if (values['assert-fit'] && (values.mode === 'single-line' ? status !== 'fits' : inspection.accepted !== true)) process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
}
