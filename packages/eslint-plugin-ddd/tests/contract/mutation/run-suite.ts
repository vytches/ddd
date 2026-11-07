import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as tsParser from '@typescript-eslint/parser';
import { Linter } from 'eslint';
import { plugin, rules } from '../../../src';
import type { MutationCase, SuiteReport } from './types';

const CONSUMER_PACKAGE_JSON = `${JSON.stringify({ name: 'mutation-consumer', private: true })}\n`;

function lintCase(root: string, c: MutationCase): { count: number; fatal: string | undefined } {
  const dir = join(root, c.id.replace(/[^A-Za-z0-9._-]+/g, '_'));
  for (const [path, text] of Object.entries(c.files)) {
    const file = join(dir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  const linter = new Linter({ cwd: dir, configType: 'flat' });
  const messages = linter.verify(
    c.files[c.entry] as string,
    [
      {
        files: ['**/*.ts'],
        plugins: { ddd: plugin as never },
        languageOptions: { parser: tsParser as never, ecmaVersion: 2022, sourceType: 'module' },
        settings: { ddd: { tsconfig: false } },
        rules: { [`ddd/${c.rule}`]: 'error' },
      },
    ],
    { filename: join(dir, c.entry) }
  );
  const fatal = messages.find(m => m.fatal);
  return {
    count: messages.filter(m => m.ruleId === `ddd/${c.rule}`).length,
    fatal: fatal ? `${fatal.line}:${fatal.column} ${fatal.message}` : undefined,
  };
}

/**
 * Lints every case of the corpus with the plugin's real rules (Linter, TypeScript parser, real
 * files on disk so facades are followed) and returns what the rules got wrong. Passing means
 * 100% of the violations found and no false alarm on any valid variant.
 */
export function runMutationSuite(cases: readonly MutationCase[]): SuiteReport {
  const root = mkdtempSync(join(tmpdir(), 'ddd-plugin-mutation-'));
  writeFileSync(join(root, 'package.json'), CONSUMER_PACKAGE_JSON);
  const missed: string[] = [];
  const falseAlarms: string[] = [];
  const parseErrors: string[] = [];
  try {
    for (const c of cases) {
      if (!(c.rule in rules)) throw new Error(`Corpus case ${c.id} names unknown rule ${c.rule}`);
      const { count, fatal } = lintCase(root, c);
      if (fatal !== undefined) parseErrors.push(`${c.id}: ${fatal}`);
      else if (c.kind === 'violation' && count !== c.expected)
        missed.push(`${c.id} (reports: ${count}, expected ${c.expected})`);
      else if (c.kind === 'valid' && count > 0) falseAlarms.push(`${c.id} (reports: ${count})`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  const violations = cases.filter(c => c.kind === 'violation').length;
  return {
    total: cases.length,
    violations,
    valid: cases.length - violations,
    missed,
    falseAlarms,
    parseErrors,
  };
}
