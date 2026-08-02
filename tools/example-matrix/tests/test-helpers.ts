import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Build a temp `<root>/examples/` tree so scanner.ts/matrix.ts can be
 * exercised against real filesystem I/O, mirroring the pattern already used
 * by tools/ddd-lint/tests/runner.test.ts.
 */
export function makeTempRepo(): {
  root: string;
  examplesRoot: string;
  cleanup: () => void;
} {
  const root = join(
    tmpdir(),
    `example-matrix-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const examplesRoot = join(root, 'examples');
  mkdirSync(examplesRoot, { recursive: true });
  return {
    root,
    examplesRoot,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

/** Write `examples/<dir>/src/<name>` with `content`, creating dirs as needed. */
export function writeSrcFile(
  examplesRoot: string,
  dir: string,
  name: string,
  content: string
): void {
  const path = join(examplesRoot, dir, 'src', name);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
}

/** Write `examples/<dir>/tests/<name>` with `content`, creating dirs as needed. */
export function writeTestFile(
  examplesRoot: string,
  dir: string,
  name: string,
  content: string
): void {
  const path = join(examplesRoot, dir, 'tests', name);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
}

/** Write `examples/<dir>/package.json` so the dir is recognized as an example package. */
export function writePackageJson(examplesRoot: string, dir: string, name: string): void {
  const path = join(examplesRoot, dir, 'package.json');
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify({ name, private: true }, null, 2));
}

/** Write a raw `expected-combinations.yaml`-shaped fixture at `path` —
 * used by report.ts/cli.ts tests, which need a manifest file alongside the
 * temp `examples/` tree built by `makeTempRepo()`. */
export function writeManifest(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
}
