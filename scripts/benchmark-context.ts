import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { cpus, platform, arch } from 'node:os';
import type { BenchmarkReport } from './benchmark-report.ts';

export const execute = promisify(execFile);

async function sourceFiles(path: string): Promise<string[]> {
  const result: string[] = [];
  for (const item of await readdir(path, { withFileTypes: true })) {
    const child = join(path, item.name);
    if (item.isDirectory()) result.push(...await sourceFiles(child));
    else if (item.name.endsWith('.mbt') || item.name === 'moon.pkg') result.push(child);
  }
  return result.sort();
}

export async function benchmarkContext(suite: string, target: string, workloadFile: string, fixtureNames: string[]) {
  const fixtures: Record<string, string> = {};
  for (const name of fixtureNames) fixtures[name] = createHash('sha256').update(await readFile(join('fixtures', name))).digest('hex');
  const hash = createHash('sha256');
  for (const file of await sourceFiles('src')) { hash.update(file); hash.update(await readFile(file)); }
  for (const file of ['browser/font.js', 'browser/fit.js']) { hash.update(file); hash.update(await readFile(file)); }
  const { stdout: commit } = await execute('git', ['rev-parse', 'HEAD']);
  const { stdout: status } = await execute('git', ['status', '--porcelain']);
  const { stdout: moon } = await execute('moon', ['version', '--all']);
  const result: Omit<BenchmarkReport, 'results'> = {
    schemaVersion: 1, suite,
    config: { target, build: 'release', workload: createHash('sha256').update(await readFile(workloadFile)).digest('hex'), fixtures },
    environment: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model ?? 'unknown', moon: moon.trim(), node: process.version },
    source: { commit: commit.trim(), dirty: !!status.trim(), fingerprint: hash.digest('hex') },
  };
  return result;
}
