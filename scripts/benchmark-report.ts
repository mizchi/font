export interface Timing {
  name: string;
  mean: number;
  median: number;
  min: number;
  max: number;
  std_dev: number;
  runs: number;
  batch_size: number;
}

export interface BenchmarkReport {
  schemaVersion: 1;
  suite: string;
  config: { target: string; build: string; workload: string; fixtures: Record<string, string> };
  environment: { platform: string; arch: string; cpu: string; moon: string; node: string; browser?: string };
  source: { commit: string; dirty: boolean; fingerprint: string };
  results: Timing[];
}

function validateTimings(values: unknown): asserts values is Timing[] {
  if (!Array.isArray(values) || !values.length) throw new Error('No benchmark measurements found');
  const names = new Set<string>();
  for (const value of values) {
    if (!value || typeof value.name !== 'string' || !value.name || names.has(value.name)) throw new Error('Benchmark names must be nonempty and unique');
    names.add(value.name);
    for (const key of ['mean', 'median', 'min', 'max', 'std_dev'] as const) {
      if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < 0) throw new Error(`Invalid timing: ${value.name}.${key}`);
    }
    if (value.mean <= 0 || value.median <= 0 || value.min > value.max || value.median < value.min || value.median > value.max ||
      !Number.isInteger(value.runs) || value.runs < 2 || !Number.isInteger(value.batch_size) || value.batch_size < 1) throw new Error(`Invalid benchmark samples: ${value.name}`);
  }
}

export function parseMoonSummaries(output: string): Timing[] {
  const lines = [...output.matchAll(/^FONT_BENCH_JSON (.+)$/gm)];
  if (lines.length !== 1) throw new Error('Expected exactly one FONT_BENCH_JSON record; check that benchmarks actually ran');
  const values: unknown = JSON.parse(lines[0][1]);
  validateTimings(values);
  return values;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

export function compareBenchmarks(baseline: BenchmarkReport, current: BenchmarkReport) {
  if (baseline.schemaVersion !== 1 || current.schemaVersion !== 1 || baseline.suite !== current.suite ||
    canonical(baseline.config) !== canonical(current.config) || canonical(baseline.environment) !== canonical(current.environment)) {
    throw new Error('Incompatible benchmark workload, fixture, backend or environment');
  }
  validateTimings(baseline.results); validateTimings(current.results);
  const previous = new Map(baseline.results.map(value => [value.name, value]));
  if (previous.size !== current.results.length || current.results.some(value => !previous.has(value.name))) throw new Error('Benchmark case sets differ');
  return current.results.map(value => {
    const before = previous.get(value.name)!;
    return { name: value.name, baselineMedianUs: before.median, currentMedianUs: value.median,
      speedup: before.median / value.median, changePercent: (value.median / before.median - 1) * 100 };
  });
}
