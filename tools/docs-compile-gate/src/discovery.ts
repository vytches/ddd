/**
 * VD-005 (AC11) — finds README.md / LLMGUIDE.md files to scan (Discover
 * phase). Mirrors tools/ddd-lint's `walk()` directory-skip convention.
 */

import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULT_SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.nx',
  '.git',
  'coverage',
  '.changeset',
]);

const DOC_FILE_NAMES = new Set(['README.md', 'LLMGUIDE.md']);

/**
 * Find every README.md / LLMGUIDE.md under `repoRoot`, or — if `targets` is
 * given and non-empty — under each entry of `targets` (a target may itself
 * be a single Markdown file, checked regardless of its basename, or a
 * directory scanned recursively for README.md/LLMGUIDE.md). Returns
 * absolute paths, deduplicated and sorted.
 */
export function findDocFiles(repoRoot: string, targets?: readonly string[]): string[] {
  const roots = targets && targets.length > 0 ? targets.map(t => resolve(repoRoot, t)) : [repoRoot];

  const found: string[] = [];
  for (const root of roots) {
    let stat;
    try {
      stat = statSync(root);
    } catch {
      continue; // Nonexistent target — nothing to scan, not a hard error.
    }
    if (stat.isFile()) {
      found.push(root);
      continue;
    }
    if (stat.isDirectory()) {
      found.push(...walk(root));
    }
  }

  return [...new Set(found)].sort();
}

function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const results: string[] = [];
  for (const entry of entries) {
    if (DEFAULT_SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);

    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      results.push(...walk(full));
    } else if (stat.isFile() && DOC_FILE_NAMES.has(entry)) {
      results.push(full);
    }
  }
  return results;
}
