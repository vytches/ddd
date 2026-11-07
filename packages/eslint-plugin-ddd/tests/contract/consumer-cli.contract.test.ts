// Fixture consumer through the REAL ESLint CLI (LT7, D16): the built package is loaded by a flat
// config exactly as a project would load it, ESLint is spawned as a process, and the JSON report
// is checked rule by rule. Zero findings over the whole run is a failure, not a pass: a blind
// gate (config not applied, rules not registered, files not matched) would otherwise look green.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { PACKAGE_DIR, ensureBuiltPackage, eslintCliPath } from './helpers/built-package';

const FIXTURE_DIR = join(PACKAGE_DIR, 'tests', 'fixtures', 'consumer');
const BUILD_AND_RUN_TIMEOUT_MS = 240_000;

interface CliMessage {
  readonly ruleId: string | null;
  readonly severity: 1 | 2;
  readonly line: number;
  readonly message: string;
}
interface CliFileResult {
  readonly filePath: string;
  readonly messages: readonly CliMessage[];
}

/** Rule -> severity -> expected count, for `violations.ts`: one entry per rule of the plugin. */
const EXPECTED_VIOLATIONS: Readonly<
  Record<string, { readonly severity: 1 | 2; readonly count: number }>
> = {
  'ddd/no-instanceof-result': { severity: 2, count: 1 },
  'ddd/no-new-entity-id': { severity: 2, count: 1 },
  'ddd/no-deprecated-entity-id-factories': { severity: 1, count: 1 },
  'ddd/event-handler-requires-handle': { severity: 2, count: 1 },
  'ddd/policy-builder-required-calls': { severity: 2, count: 1 },
  // the static import of `internalLogger` and the dynamic `import('.../internal')`
  'ddd/no-internal-imports': { severity: 2, count: 2 },
};

/** Both entries of the package: `import` (ESM config) and `require` (CJS config). */
const CONFIG_FILES = ['eslint.config.mjs', 'eslint.config.cjs'] as const;

function runCli(configFile: string): readonly CliFileResult[] {
  const result = spawnSync(
    process.execPath,
    [eslintCliPath(), '--config', configFile, '--format', 'json', '--no-warn-ignored', 'src'],
    { cwd: FIXTURE_DIR, encoding: 'utf8', timeout: BUILD_AND_RUN_TIMEOUT_MS }
  );
  // ESLint exits 1 when there are errors and 2 on a crash; only the crash has no JSON report.
  if (result.status === null || result.status > 1) {
    throw new Error(
      `eslint CLI crashed (exit ${String(result.status)}) with ${configFile}:\n${result.stderr}`
    );
  }
  return JSON.parse(result.stdout) as readonly CliFileResult[];
}

function messagesOf(results: readonly CliFileResult[], file: string): readonly CliMessage[] {
  const hit = results.find(r => r.filePath.endsWith(`/src/${file}`));
  if (!hit)
    throw new Error(
      `ESLint did not lint src/${file}; files seen: ${results.map(r => r.filePath).join(', ')}`
    );
  return hit.messages;
}

describe.each(CONFIG_FILES)('fixture consumer through the real ESLint CLI (%s)', configFile => {
  let results: readonly CliFileResult[] = [];

  beforeAll(() => {
    ensureBuiltPackage();
    results = runCli(configFile);
  }, BUILD_AND_RUN_TIMEOUT_MS);

  it('lints all four fixture files and finds something overall', () => {
    expect(results.map(r => r.filePath.split('/').pop()).sort()).toEqual([
      'clean.ts',
      'facade.ts',
      'shadowed.ts',
      'violations.ts',
    ]);
    const total = results.reduce((sum, r) => sum + r.messages.length, 0);
    expect(total, 'zero findings over the whole run means the gate is blind').toBeGreaterThan(0);
  });

  it('reports no parse error or config problem (every message carries a rule id)', () => {
    for (const r of results) {
      for (const m of r.messages)
        expect(m.ruleId, `${r.filePath}:${m.line} ${m.message}`).not.toBeNull();
    }
  });

  it('finds every rule of the plugin in violations.ts with the expected severity and count', () => {
    const messages = messagesOf(results, 'violations.ts');
    const byRule = new Map<string, CliMessage[]>();
    for (const m of messages)
      byRule.set(m.ruleId ?? '', [...(byRule.get(m.ruleId ?? '') ?? []), m]);

    expect([...byRule.keys()].sort()).toEqual(Object.keys(EXPECTED_VIOLATIONS).sort());
    for (const [rule, expected] of Object.entries(EXPECTED_VIOLATIONS)) {
      const own = byRule.get(rule) ?? [];
      expect(own.length, `${rule}: findings`).toBe(expected.count);
      expect(new Set(own.map(m => m.severity)), `${rule}: severity`).toEqual(
        new Set([expected.severity])
      );
    }
  });

  it('keeps the agent-format message (Fix / See) on the findings', () => {
    for (const m of messagesOf(results, 'violations.ts')) {
      expect(m.message, m.ruleId ?? '').toMatch(/Fix:/);
    }
  });

  it.each(['clean.ts', 'shadowed.ts', 'facade.ts'])(
    'has zero findings in %s (no false alarm)',
    file => {
      expect(messagesOf(results, file)).toEqual([]);
    }
  );
});
