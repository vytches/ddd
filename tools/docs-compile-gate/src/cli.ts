/**
 * VD-005 (AC11) — docs-compile-gate CLI entry point (tsx-runnable).
 *
 * Type-checks TypeScript code fences embedded in README.md/LLMGUIDE.md files
 * — but ONLY fences whose info string carries the opt-in `compile-check`
 * marker (```ts compile-check / ```typescript compile-check). Everything
 * else is discovered but left untouched: v1 is opt-in, not
 * hard-fail-on-every-fence (D-2) — many fences in this repo are
 * intentionally partial/illustrative, and hard-failing on those would be a
 * flood of false positives. See README.md for the full convention.
 *
 * Usage:
 *   tsx tools/docs-compile-gate/src/cli.ts                 scan the whole repo
 *   tsx tools/docs-compile-gate/src/cli.ts --check          same (see below)
 *   tsx tools/docs-compile-gate/src/cli.ts packages/foo     restrict to a path
 *
 * There is no "generate" side effect here (unlike tools/example-matrix) —
 * scanning IS the check, there's nothing to write to disk. `--check` is
 * accepted (and is what's wired into CI) purely for command-line
 * consistency with tools/example-matrix/tools/ddd-lint's conventions; it
 * does not change behavior.
 *
 * Exit codes:
 *   0 — clean: every `compile-check` fence found compiled without error
 *       (including the common case of zero marked fences existing yet)
 *   1 — at least one marked fence failed to type-check
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type ts from 'typescript';

import { checkFences } from './checker.js';
import { loadRepoCompilerOptions } from './compiler-options.js';
import { findDocFiles } from './discovery.js';
import { extractFencesFromFile } from './extractor.js';
import { formatReport, type RunResult } from './report.js';
import type { CodeFence } from './types.js';

export interface RunOptions {
  /** Restrict discovery to these files/dirs (repo-relative or absolute).
   * Defaults to a full repo scan for README.md/LLMGUIDE.md. */
  targets?: readonly string[];
  /** Override compiler options — used by tests to avoid depending on a real
   * `tsconfig.base.json` fixture. Defaults to the repo's own
   * `tsconfig.base.json`, adapted for in-memory checking (see
   * compiler-options.ts) — this is what real `@vytches/ddd-*` imports in
   * marked fences resolve against. */
  compilerOptions?: ts.CompilerOptions;
}

/** Discover + Extract + Check, fully in-memory. Exported so tests (and any
 * future programmatic caller) can exercise the whole pipeline without going
 * through `main()`'s argv/exit-code plumbing. */
export function run(repoRoot: string, options: RunOptions = {}): RunResult {
  const files = findDocFiles(repoRoot, options.targets);
  const fences: CodeFence[] = files.flatMap(extractFencesFromFile);
  const compilerOptions = options.compilerOptions ?? loadRepoCompilerOptions(repoRoot);
  const result = checkFences(fences, { compilerOptions });

  return {
    ok: result.ok,
    filesScanned: files.length,
    fencesFound: fences.length,
    fencesChecked: result.checkedCount,
    diagnostics: result.diagnostics,
  };
}

/** Process-level entrypoint, exported so tests can call it directly instead
 * of spawning a subprocess (mirrors tools/example-matrix's `main()`). */
export function main(argv: readonly string[], repoRoot: string): number {
  const targets = argv.filter(arg => arg !== '--check');
  const result = run(repoRoot, { targets: targets.length > 0 ? targets : undefined });

  console.log(formatReport(result));
  if (!result.ok) {
    console.error(
      `docs-compile-gate: ${result.diagnostics.length} failure(s) in \`compile-check\`-marked fence(s).`
    );
    return 1;
  }
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
  process.exit(main(process.argv.slice(2), repoRoot));
}
