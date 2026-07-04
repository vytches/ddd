/**
 * VD-006a — Discover phase.
 *
 * Walks `examples/<dir>/` for its `package.json`, every `.ts` file under
 * `src/` (recursively, excluding `.d.ts`), and every `*.test.ts` file under
 * `tests/` (recursively). Pure filesystem discovery — no AST parsing here,
 * see matrix.ts for the Extract phase.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { DiscoveredExample } from './types.js';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.nx', '.git', 'coverage']);

/**
 * Discover every `examples/<dir>/` subdirectory (one level deep) that looks
 * like an example package — i.e. has its own `package.json`.
 *
 * @param examplesRoot Absolute path to the repo's `examples/` directory.
 */
export function discoverExamples(examplesRoot: string): DiscoveredExample[] {
  let entries: string[];
  try {
    entries = readdirSync(examplesRoot);
  } catch {
    return [];
  }

  const discovered: DiscoveredExample[] = [];

  for (const dir of entries.sort()) {
    if (SKIP_DIRS.has(dir)) continue;
    const root = join(examplesRoot, dir);
    let stat;
    try {
      stat = statSync(root);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    const hasPackageJson = existsSync(join(root, 'package.json'));
    const srcFiles = walkTsFiles(join(root, 'src'), root, dir);
    const testFiles = walkTestFiles(join(root, 'tests'), root, dir);

    discovered.push({
      dir,
      root: `examples/${dir}`,
      hasPackageJson,
      srcFiles,
      testFiles,
    });
  }

  return discovered;
}

/**
 * Recursively collect every `.ts` file under `srcDir` (excluding `.d.ts`),
 * returned as repo-relative paths prefixed `examples/<dir>/...`.
 */
function walkTsFiles(srcDir: string, exampleRoot: string, dir: string): string[] {
  const results: string[] = [];
  for (const abs of walk(srcDir)) {
    if (!abs.endsWith('.ts') || abs.endsWith('.d.ts')) continue;
    results.push(toRepoRelative(abs, exampleRoot, dir));
  }
  return results.sort();
}

/**
 * Recursively collect every `*.test.ts` file under `testsDir`, returned as
 * repo-relative paths prefixed `examples/<dir>/...`.
 */
function walkTestFiles(testsDir: string, exampleRoot: string, dir: string): string[] {
  const results: string[] = [];
  for (const abs of walk(testsDir)) {
    if (!abs.endsWith('.test.ts')) continue;
    results.push(toRepoRelative(abs, exampleRoot, dir));
  }
  return results.sort();
}

function toRepoRelative(absPath: string, exampleRoot: string, dir: string): string {
  return `examples/${dir}/${relative(exampleRoot, absPath).split('\\').join('/')}`;
}

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      yield* walk(full);
    } else if (stat.isFile()) {
      yield full;
    }
  }
}
