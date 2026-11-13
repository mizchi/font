import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { startBrowserServer } from './browser-server.ts';
import { benchmarkContext } from './benchmark-context.ts';
import { compareBenchmarks, type BenchmarkReport } from './benchmark-report.ts';

const { values } = parseArgs({ options: {
  output: { type: 'string', default: '_build/benchmarks/browser-current.json' }, baseline: { type: 'string' },
} });
const context = await benchmarkContext('browser-font', 'chromium', 'browser/benchmark.js', ['shaping-reference/roboto-variable.ttf']);
const server = await startBrowserServer();
let browser: Browser | undefined;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 1000, height: 800 } });
  await page.goto(server.url);
  console.log('Benchmarking Chromium; startup/font loading excluded, raster timing includes pixel readback.');
  const measured = await page.evaluate(async () => {
    const { runBrowserBenchmarks } = await import(new URL('/browser/benchmark.js', location.href).href) as typeof import('../browser/benchmark.js');
    return runBrowserBenchmarks();
  });
  const report: BenchmarkReport = { ...context, environment: { ...context.environment, browser: browser.version() }, results: measured.results };
  const comparison = values.baseline ? compareBenchmarks(JSON.parse(await readFile(values.baseline, 'utf8')), report) : undefined;
  const output = resolve(values.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ ...report, measuredAt: new Date().toISOString(), unit: 'microseconds', sink: measured.sink, comparison }, null, 2) + '\n');
  console.table(report.results.map(value => ({ case: value.name, 'median µs': value.median.toFixed(3), 'std dev µs': value.std_dev.toFixed(3) })));
  if (comparison) console.table(comparison.map(value => ({ case: value.name, speedup: `${value.speedup.toFixed(2)}x` })));
  console.log(`Saved ${report.results.length} measurements to ${output}`);
} finally {
  try { await browser?.close(); } finally { await server.close(); }
}
