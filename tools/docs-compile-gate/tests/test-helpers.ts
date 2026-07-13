import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Build a throwaway directory so extractor/checker/cli tests can exercise
 * real filesystem I/O (multi-file discovery, real fence extraction from
 * disk) — mirrors tools/example-matrix/tests/test-helpers.ts's
 * `makeTempRepo()` pattern.
 */
export function makeTempDir(): { dir: string; cleanup: () => void } {
  const dir = join(
    tmpdir(),
    `docs-compile-gate-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Write `<root>/<relPath>` with `content`, creating parent dirs as needed.
 * Returns the absolute path written. */
export function writeDocFile(root: string, relPath: string, content: string): string {
  const full = join(root, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}
