/**
 * VD-005 (AC11) — loads the repo's real `tsconfig.base.json` compiler
 * options for use by the checker. This is what makes the gate meaningful:
 * `tsconfig.base.json`'s `paths` map every `@vytches/ddd-*` specifier to its
 * REAL package source (`packages/<pkg>/src/index.ts`), so a marked fence
 * importing `AggregateRoot` or `CircuitBreaker` is checked against the
 * actual, current public API — not a stale copy — which is exactly what
 * catches the AC10 drift class (wrong constructor argument order, renamed
 * methods, renamed config fields).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import ts from 'typescript';

/** Options that only make sense for a real multi-file project BUILD
 * (composite project references, incremental build-info caching, emit) —
 * meaningless (and, for some, actively invalid) for in-memory,
 * noEmit-diagnostics-only checking of standalone snippets. Stripped rather
 * than left in place so `ts.createProgram` never tries to read/write
 * `.tsbuildinfo` or resolve project references for a program that doesn't
 * correspond to any file on disk. */
const PROJECT_BUILD_ONLY_OPTIONS = [
  'composite',
  'declaration',
  'declarationMap',
  'incremental',
  'tsBuildInfoFile',
  'outDir',
  'rootDir',
] as const;

/**
 * Load `<repoRoot>/tsconfig.base.json`, resolve its `paths`/`baseUrl`
 * against `repoRoot`, and adapt the result for the checker: no emit, no
 * project-build bookkeeping, everything else (strict flags, `lib`, the
 * `@vytches/ddd-*` path map) preserved as-is.
 */
export function loadRepoCompilerOptions(repoRoot: string): ts.CompilerOptions {
  const configPath = resolve(repoRoot, 'tsconfig.base.json');
  const configFile = ts.readConfigFile(configPath, path => readFileSync(path, 'utf8'));
  if (configFile.error) {
    throw new Error(
      `docs-compile-gate: failed to read ${configPath}: ` +
        ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n')
    );
  }

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, repoRoot);
  const options = { ...parsed.options };
  for (const key of PROJECT_BUILD_ONLY_OPTIONS) {
    delete options[key];
  }

  return {
    ...options,
    noEmit: true,
    skipLibCheck: true,
  };
}
