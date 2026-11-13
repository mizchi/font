import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoonSummaries, compareBenchmarks, type BenchmarkReport } from '../scripts/benchmark-report.ts';

const timing = { name: 'width/basic', mean: 4, median: 4, min: 3, max: 5, std_dev: 0.2, runs: 10, batch_size: 100 };
function report(median: number): BenchmarkReport {
  return { schemaVersion: 1, suite: 'moonbit-font',
    config: { target: 'js', build: 'release', workload: 'same-workload', fixtures: { font: 'same-font' } },
    environment: { platform: 'test', arch: 'test', cpu: 'test', moon: 'test', node: 'test' },
    source: { commit: 'test', dirty: false, fingerprint: 'test' },
    results: [{ ...timing, mean: median, median, min: median, max: median }] };
}

test('benchmark output must contain real, finite, uniquely named measurements', () => {
  assert.deepEqual(parseMoonSummaries(`noise\nFONT_BENCH_JSON ${JSON.stringify([timing])}\n`), [timing]);
  for (const value of ['', 'FONT_BENCH_JSON []', `FONT_BENCH_JSON ${JSON.stringify([timing, timing])}`,
    `FONT_BENCH_JSON ${JSON.stringify([{ ...timing, median: null }])}`]) {
    assert.throws(() => parseMoonSummaries(value));
  }
});

test('comparisons report both speedups and regressions without losing case names', () => {
  const baseline = report(4), current = report(2);
  const [improved] = compareBenchmarks(baseline, current);
  assert.equal(improved.name, 'width/basic');
  assert.equal(improved.speedup, 2);
  assert.equal(improved.changePercent, -50);
  const [regressed] = compareBenchmarks(current, baseline);
  assert.equal(regressed.speedup, 0.5);
  assert.equal(regressed.changePercent, 100);
});

test('incompatible workloads, fixtures, targets and environments cannot be compared silently', () => {
  const baseline = report(4);
  for (const change of [
    (value: BenchmarkReport) => { value.config.target = 'wasm-gc'; },
    (value: BenchmarkReport) => { value.config.workload = 'different'; },
    (value: BenchmarkReport) => { value.config.fixtures.font = 'different'; },
    (value: BenchmarkReport) => { value.environment.cpu = 'different'; },
    (value: BenchmarkReport) => { value.results = []; },
  ]) {
    const current = structuredClone(baseline); change(current);
    assert.throws(() => compareBenchmarks(baseline, current));
  }
});
