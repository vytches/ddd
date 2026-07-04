/**
 * VD-006a — example-matrix CLI entry point (tsx-runnable).
 *
 * Usage:
 *   tsx tools/example-matrix/src/cli.ts            regenerate docs/coverage-matrix.json
 *                                                   + docs/COVERAGE-MATRIX.md in place
 *   tsx tools/example-matrix/src/cli.ts --check     verify without writing (CI mode)
 *
 * `--check` exit codes:
 *   0 — no hard failures (soft D-7 warnings, if any, are printed but do not
 *       affect the exit code)
 *   1 — at least one hard failure:
 *       (a) a manifest-declared combination's file exists but no passing
 *           test imports it (EXAMPLE_ONLY)
 *       (b) a manifest-declared combination has no matching file
 *           (DECLARED_MISSING)
 *       (c) the committed docs/coverage-matrix.json / COVERAGE-MATRIX.md is
 *           stale relative to what a fresh run would produce
 *
 * Manifest entries marked `planned: true` (see types.ts) are KNOWN,
 * intentional future work — their EXAMPLE_ONLY/DECLARED_MISSING status is
 * reported as a soft warning instead of case (a)/(b) above, so declaring an
 * aspirational combination (D-4's baseline list) does not permanently block
 * CI until every combination in the library is authored.
 *
 * This matrix is an ADDITIONAL report alongside the existing L1/L2/L3
 * test-pyramid coverage gate (`vitest --coverage`) — see report.ts's
 * Markdown header for the full disclaimer. `--check` failing does NOT mean
 * unit test coverage regressed; it means an example/combination promise
 * (expected-combinations.yaml) is unmet or the committed report drifted.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { discoverExamples } from './scanner.js';
import { buildMatrix } from './matrix.js';
import { loadManifest } from './manifest.js';
import { matrixDataEquals, renderCoverageMarkdown, writeReport } from './report.js';
import type { Matrix } from './types.js';

/** Filesystem locations the CLI reads/writes — an explicit parameter object
 * (not hardcoded `process.cwd()`-relative paths) so tests can point it at a
 * temp fixture directory instead of the real repo. */
export interface CliPaths {
  examplesRoot: string;
  manifestPath: string;
  jsonPath: string;
  mdPath: string;
}

/** The real repo's conventional layout, given its root. */
export function resolveDefaultPaths(repoRoot: string): CliPaths {
  return {
    examplesRoot: resolve(repoRoot, 'examples'),
    manifestPath: resolve(repoRoot, 'tools/example-matrix/expected-combinations.yaml'),
    jsonPath: resolve(repoRoot, 'docs/coverage-matrix.json'),
    mdPath: resolve(repoRoot, 'docs/COVERAGE-MATRIX.md'),
  };
}

/** Run Discover + Extract + Correlate against `paths`, fully in-memory —
 * never writes anything. Repo root is derived as the parent of
 * `examplesRoot` (matches `resolveDefaultPaths`'s own convention, and holds
 * for test fixtures built the same way). */
export function buildFreshMatrix(paths: CliPaths): Matrix {
  const repoRoot = dirname(paths.examplesRoot);
  const discovered = discoverExamples(paths.examplesRoot);
  const manifest = loadManifest(paths.manifestPath);
  return buildMatrix(discovered, repoRoot, manifest);
}

/** Regenerate both artifacts in place and return the matrix that was written. */
export function runGenerate(paths: CliPaths): Matrix {
  const matrix = buildFreshMatrix(paths);
  writeReport(matrix, paths);
  return matrix;
}

export interface CheckReport {
  ok: boolean;
  hardFailures: string[];
  softWarnings: string[];
}

/**
 * `--check` mode (D-3 + D-7): hard-fail on (a) EXAMPLE_ONLY manifest cells,
 * (b) DECLARED_MISSING manifest cells, (c) stale committed artifacts;
 * soft-warn (never fails) on D-7 undeclared combinations.
 */
export function checkMatrix(paths: CliPaths): CheckReport {
  const fresh = buildFreshMatrix(paths);
  const hardFailures: string[] = [];
  const softWarnings: string[] = [];

  for (const cell of fresh.cells) {
    if (cell.status === 'EXAMPLE_ONLY') {
      const message = `(a) "${cell.name}" (${cell.file}) has a file but no passing test imports it — EXAMPLE_ONLY.`;
      if (cell.planned) {
        softWarnings.push(`[soft, planned] ${message}`);
      } else {
        hardFailures.push(message);
      }
    } else if (cell.status === 'DECLARED_MISSING') {
      const message = `(b) "${cell.name}" is declared in expected-combinations.yaml but no matching file exists on disk.`;
      if (cell.planned) {
        softWarnings.push(`[soft, planned] ${message}`);
      } else {
        hardFailures.push(message);
      }
    }
  }

  hardFailures.push(...checkStaleness(paths, fresh));

  for (const entry of fresh.undeclared) {
    softWarnings.push(
      `[soft] ${entry.file} combines ${entry.packages.join(' + ')} — not declared in expected-combinations.yaml (D-7).`
    );
  }

  return { ok: hardFailures.length === 0, hardFailures, softWarnings };
}

/** (c): compares committed docs/coverage-matrix.json + COVERAGE-MATRIX.md
 * against a fresh run, ignoring `generatedAt` (a fresh timestamp alone is
 * not "stale" — only cell/undeclared DATA drift is). */
function checkStaleness(paths: CliPaths, fresh: Matrix): string[] {
  if (!existsSync(paths.jsonPath) || !existsSync(paths.mdPath)) {
    return [
      `(c) ${paths.jsonPath} and/or ${paths.mdPath} do not exist yet — run without --check to generate them.`,
    ];
  }

  const committedJson = JSON.parse(readFileSync(paths.jsonPath, 'utf8')) as Matrix;
  if (!matrixDataEquals(committedJson, fresh)) {
    return [
      `(c) ${paths.jsonPath} is stale relative to current repo state — re-run without --check to regenerate.`,
    ];
  }

  // Data matches — Markdown must also match byte-for-byte, rendered with the
  // COMMITTED timestamp so this comparison never fails on timestamp alone.
  const committedMd = readFileSync(paths.mdPath, 'utf8');
  const expectedMd = renderCoverageMarkdown({ ...fresh, generatedAt: committedJson.generatedAt });
  if (committedMd !== expectedMd) {
    return [
      `(c) ${paths.mdPath} is stale relative to ${paths.jsonPath} — re-run without --check to regenerate.`,
    ];
  }

  return [];
}

/** Process-level entrypoint, exported so tests can call it directly against
 * a `CliPaths` fixture instead of spawning a subprocess. */
export function main(argv: readonly string[], repoRoot: string): number {
  const paths = resolveDefaultPaths(repoRoot);
  const isCheck = argv.includes('--check');

  if (isCheck) {
    const report = checkMatrix(paths);
    for (const warning of report.softWarnings) console.warn(warning);
    for (const failure of report.hardFailures) console.error(failure);

    if (report.ok) {
      console.log(`example-matrix --check: clean (${report.softWarnings.length} soft warning(s)).`);
      return 0;
    }
    console.error(`example-matrix --check: ${report.hardFailures.length} hard failure(s).`);
    return 1;
  }

  const matrix = runGenerate(paths);
  console.log(
    `example-matrix: wrote ${paths.jsonPath} and ${paths.mdPath} ` +
      `(${matrix.cells.length} cell(s), ${matrix.undeclared.length} undeclared combination(s)).`
  );
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
  process.exit(main(process.argv.slice(2), repoRoot));
}
