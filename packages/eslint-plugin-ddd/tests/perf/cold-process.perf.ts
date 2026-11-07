// Cold-process latency of the agent lane (D17). Lives outside the `test` glob: it is timing-based
// and unstable under the parallel pre-commit run, so only the `perf` target (DDD_PLUGIN_PERF=1)
// picks it up. Each sample is a NEW node process that loads the built `dist/agent.js`, creates a
// linter and lints one file with violations, i.e. what a project hook pays on every edit.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  DIST_AGENT_ENTRY,
  PACKAGE_DIR,
  ensureBuiltPackage,
} from '../contract/helpers/built-package';

/** Budgets in milliseconds; generous enough for a shared CI runner, tight enough to catch a regression. */
const COLD_PROCESS_BUDGET_MS = 6_000;
const MEDIAN_BUDGET_MS = 4_000;
const SAMPLES = 5;
const SAMPLE_TIMEOUT_MS = 30_000;
const CONSUMER_DIR = join(PACKAGE_DIR, 'tests', 'fixtures', 'consumer');

const CHILD_SCRIPT = `
import { pathToFileURL } from 'node:url';
const { createAgentLinter } = await import(pathToFileURL(process.argv[1]).href);
const parser = await import('@typescript-eslint/parser');
const { configs, plugin } = await import(pathToFileURL(process.argv[2]).href);
const linter = createAgentLinter({
  cwd: process.argv[3],
  config: [
    { files: ['**/*.ts'], languageOptions: { parser, ecmaVersion: 2022, sourceType: 'module' }, settings: { ddd: { tsconfig: false } } },
    configs.recommended,
  ],
});
const text = "import { Result } from '@vytches/ddd-contracts';\\nexport const x = (v: unknown) => v instanceof Result;\\n";
const result = await linter.lintText(text, process.argv[3] + '/src/cold.ts');
process.stdout.write(JSON.stringify(result));
`;

interface Sample {
  readonly wallMs: number;
  readonly result: {
    readonly status: string;
    readonly findings?: readonly { readonly ruleId: string }[];
  };
}

function coldSample(): Sample {
  const started = performance.now();
  const run = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      CHILD_SCRIPT,
      DIST_AGENT_ENTRY,
      join(PACKAGE_DIR, 'dist', 'index.js'),
      CONSUMER_DIR,
    ],
    { cwd: CONSUMER_DIR, encoding: 'utf8', timeout: SAMPLE_TIMEOUT_MS }
  );
  const wallMs = performance.now() - started;
  if (run.status !== 0)
    throw new Error(`cold process failed (exit ${String(run.status)}):\n${run.stderr}`);
  return { wallMs, result: JSON.parse(run.stdout) as Sample['result'] };
}

describe('cold-process lintText latency', () => {
  const samples: Sample[] = [];

  beforeAll(
    () => {
      ensureBuiltPackage();
      for (let i = 0; i < SAMPLES; i += 1) samples.push(coldSample());
    },
    SAMPLES * SAMPLE_TIMEOUT_MS + 240_000
  );

  it('measures a real lint: every cold run finds the violation (a fast no-op does not count)', () => {
    for (const s of samples) {
      expect(s.result.status).toBe('ok');
      expect(s.result.findings?.map(f => f.ruleId)).toEqual(['ddd/no-instanceof-result']);
    }
  });

  it(`stays within ${COLD_PROCESS_BUDGET_MS} ms for the slowest cold run and ${MEDIAN_BUDGET_MS} ms median`, () => {
    const sorted = samples.map(s => s.wallMs).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? Number.POSITIVE_INFINITY;
    const slowest = sorted[sorted.length - 1] ?? Number.POSITIVE_INFINITY;
    console.info(
      `cold lintText process, ${SAMPLES} runs (ms): ${sorted.map(v => Math.round(v)).join(', ')}`
    );
    expect(median, 'median cold run').toBeLessThan(MEDIAN_BUDGET_MS);
    expect(slowest, 'slowest cold run').toBeLessThan(COLD_PROCESS_BUDGET_MS);
  });
});
