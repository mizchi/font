// @ts-check
import * as raw from '../_build/js/release/build/js/js.js';
import { loadFont } from './font.js';
import { checkTextFit, inspectTextFit } from './fit.js';

/** @param {string} name @param {number[]} samples @param {number} batchSize
 * @returns {import('../scripts/benchmark-report.ts').Timing} */
function statistics(name, samples, batchSize) {
  const sorted = samples.toSorted((a, b) => a - b);
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return { name, mean, median: (sorted[5] + sorted[6]) / 2, min: sorted[0], max: sorted.at(-1) ?? 0,
    std_dev: Math.sqrt(samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length),
    runs: samples.length, batch_size: batchSize };
}

/** Browser/DOM timing only. Excludes startup and font loading. Every sync
 * operation consumes a rotating text input; raster timing forces pixel readback.
 */
export async function runBrowserBenchmarks() {
  const font = await loadFont('/fixtures/shaping-reference/roboto-variable.ttf');
  const pool = ['Hello world office AV', 'office AV Hello world', 'AV office Hello world', 'world Hello office AV'];
  const long = pool.map(text => `${text} `.repeat(32));
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 96;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  ctx.font = `24px "${font.family}"`; ctx.textRendering = 'geometricPrecision';
  const box = document.createElement('div');
  Object.assign(box.style, { width: '240px', font: `24px "${font.family}"`, lineHeight: '32px', position: 'absolute', left: '-100000px' });
  document.body.append(box);
  let sink = 0;
  /** @type {import('../scripts/benchmark-report.ts').Timing[]} */
  const results = [];
  const sync = (/** @type {string} */ name, /** @type {(index: number) => number} */ operation) => {
    const run = (/** @type {number} */ count) => {
      const start = performance.now();
      for (let i = 0; i < count; i++) sink = operation(i);
      return performance.now() - start;
    };
    run(128);
    let count = 1;
    while (run(count) < 15 && count < 65536) count *= 2;
    results.push(statistics(name, Array.from({ length: 12 }, () => run(count) * 1000 / count), count));
  };
  const asynchronous = async (/** @type {string} */ name, /** @type {(index: number) => Promise<number>} */ operation) => {
    const run = async (/** @type {number} */ count) => {
      const start = performance.now();
      for (let i = 0; i < count; i++) sink = await operation(i);
      return performance.now() - start;
    };
    await run(4);
    let count = 1;
    while (await run(count) < 15 && count < 256) count *= 2;
    const samples = [];
    for (let i = 0; i < 12; i++) samples.push(await run(count) * 1000 / count);
    results.push(statistics(name, samples, count));
  };
  try {
    for (const text of pool) if (font.measure(text, 24).missingCodepoints.length) throw new Error('Benchmark fixture lacks sample glyphs');
    sync('width/moonbit-js-binding/short', i => raw.measureText(pool[i % pool.length], 24));
    sync('width/moonbit-js-binding/long', i => raw.measureText(long[i % pool.length], 24));
    sync('bounds/moonbit-js-json/long', i => raw.shapeTextWithWeight(long[i % pool.length], 24, 'auto', 'und', true, true, 700).length);
    sync('width/canvas/short', i => ctx.measureText(pool[i % pool.length]).width);
    sync('width/canvas/long', i => ctx.measureText(long[i % pool.length]).width);
    sync('render/canvas-draw-readback', i => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillText(pool[i % pool.length], 0, 40);
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data.byteLength;
    });
    await asynchronous('fit/existing-wrapped-dom', async i => {
      box.textContent = long[i % pool.length];
      return (await inspectTextFit(box)).layout.requiredHeight ?? -1;
    });
    await asynchronous('fit/temporary-dom', async i => (await checkTextFit(pool[i % pool.length], {
      maxWidth: 240, style: { fontFamily: `"${font.family}"`, fontSize: '24px', lineHeight: '32px' },
    })).intrinsic.maxContentWidth ?? -1);
    return { results, sink };
  } finally { box.remove(); font.dispose(); }
}
