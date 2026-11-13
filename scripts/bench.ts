import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { parseMoonSummaries, compareBenchmarks, type BenchmarkReport } from './benchmark-report.ts';
import { benchmarkContext, execute } from './benchmark-context.ts';

const { values } = parseArgs({ options: {
  target: { type: 'string', default: 'js' },
  output: { type: 'string', default: '_build/benchmarks/current.json' },
  baseline: { type: 'string' },
} });
if (!['js', 'wasm-gc', 'native'].includes(values.target)) throw new RangeError('target must be js, wasm-gc or native');
const output = resolve(values.output);
const context = await benchmarkContext('moonbit-font', values.target, 'src/performance_bench_wbtest.mbt',
  ['shaping-reference/serif-bold.ttf', 'shaping-reference/roboto-variable.ttf', 'shaping-reference/arabic.ttf',
    'shaping-reference/japanese-variable.ttf', 'shaping.ttf', 'NotoSans-subset.otf']);
console.log(`Benchmarking ${values.target} in release mode; font loading is outside timed callbacks.`);
const result = await execute('moon', ['bench', '--release', '--target', values.target, '--package', 'mizchi/font',
  '--file', 'performance_bench_wbtest.mbt', '--deny-warn', '--no-parallelize'], { maxBuffer: 8 * 1024 * 1024 });
const report: BenchmarkReport = { ...context, results: parseMoonSummaries(result.stdout) };
const comparison = values.baseline ? compareBenchmarks(JSON.parse(await readFile(values.baseline, 'utf8')), report) : undefined;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ ...report, measuredAt: new Date().toISOString(), unit: 'microseconds', comparison }, null, 2) + '\n');
await writeFile(output.replace(/\.json$/, '') + '.log', result.stdout + result.stderr);
if (comparison) console.table(comparison.map(value => ({ case: value.name,
  'before µs': value.baselineMedianUs.toFixed(3), 'after µs': value.currentMedianUs.toFixed(3), speedup: `${value.speedup.toFixed(2)}x` })));
else console.table(report.results.map(value => ({ case: value.name, 'median µs': value.median.toFixed(3), 'std dev µs': value.std_dev.toFixed(3) })));
console.log(`Saved ${report.results.length} measurements to ${output}`);
