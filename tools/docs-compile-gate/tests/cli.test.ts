import { describe, it, expect } from 'vitest';
import ts from 'typescript';

import { main, run } from '../src/cli.js';
import { makeTempDir, writeDocFile } from './test-helpers.js';

/** Same hermetic options as checker.test.ts — no real `@vytches/ddd-*`
 * paths needed to prove the discovery -> extraction -> check pipeline
 * wires together correctly end to end. */
const TEST_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  lib: ['ES2022'],
};

describe('run — end-to-end discovery + extraction + check', () => {
  it('is clean (ok: true) when no doc file contains a marked fence', () => {
    const { dir, cleanup } = makeTempDir();
    try {
      writeDocFile(
        dir,
        'packages/foo/README.md',
        ['```ts', 'const x = doesNotExist();', '```'].join('\n')
      );

      const result = run(dir, { compilerOptions: TEST_OPTIONS });

      expect(result.ok).toBe(true);
      expect(result.filesScanned).toBe(1);
      expect(result.fencesFound).toBe(1);
      expect(result.fencesChecked).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('fails (ok: false) when a marked fence anywhere under the repo root has a type error', () => {
    const { dir, cleanup } = makeTempDir();
    try {
      writeDocFile(
        dir,
        'packages/bar/LLMGUIDE.md',
        ['```ts compile-check', 'const total: number = "12";', '```'].join('\n')
      );

      const result = run(dir, { compilerOptions: TEST_OPTIONS });

      expect(result.ok).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
    } finally {
      cleanup();
    }
  });

  it('restricts discovery to given targets only, ignoring doc files elsewhere in the repo', () => {
    const { dir, cleanup } = makeTempDir();
    try {
      writeDocFile(
        dir,
        'packages/a/README.md',
        ['```ts compile-check', 'const x: number = "bad";', '```'].join('\n')
      );
      writeDocFile(
        dir,
        'packages/b/README.md',
        ['```ts compile-check', 'const y = 1;', '```'].join('\n')
      );

      const result = run(dir, { targets: ['packages/b'], compilerOptions: TEST_OPTIONS });

      expect(result.filesScanned).toBe(1);
      expect(result.ok).toBe(true);
    } finally {
      cleanup();
    }
  });
});

/** main() always resolves compiler options via `loadRepoCompilerOptions`
 * (no injection point — that's intentional, real CLI usage must use the
 * repo's real tsconfig.base.json). To exercise it hermetically we write a
 * minimal, self-contained `tsconfig.base.json` fixture into the temp repo
 * root, exactly what `loadRepoCompilerOptions` expects to find there. */
function writeMinimalTsconfigBase(dir: string): void {
  writeDocFile(
    dir,
    'tsconfig.base.json',
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        lib: ['ES2022'],
        strict: true,
        skipLibCheck: true,
      },
    })
  );
}

describe('main — process-level exit codes', () => {
  it('returns 0 for a repo with no marked fences', () => {
    const { dir, cleanup } = makeTempDir();
    try {
      writeMinimalTsconfigBase(dir);
      writeDocFile(dir, 'README.md', ['```ts', 'const x = doesNotExist();', '```'].join('\n'));

      expect(main([], dir)).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('returns 1 when a marked fence fails to compile', () => {
    const { dir, cleanup } = makeTempDir();
    try {
      writeMinimalTsconfigBase(dir);
      writeDocFile(
        dir,
        'README.md',
        ['```ts compile-check', 'const total: number = "12";', '```'].join('\n')
      );

      expect(main([], dir)).toBe(1);
    } finally {
      cleanup();
    }
  });

  it('returns 0 when a marked fence is correct', () => {
    const { dir, cleanup } = makeTempDir();
    try {
      writeMinimalTsconfigBase(dir);
      writeDocFile(
        dir,
        'README.md',
        ['```ts compile-check', 'const total: number = 12;', '```'].join('\n')
      );

      expect(main([], dir)).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('accepts and ignores the --check flag as a plain positional filter (no path named "--check")', () => {
    const { dir, cleanup } = makeTempDir();
    try {
      writeMinimalTsconfigBase(dir);
      writeDocFile(dir, 'README.md', ['```ts compile-check', 'const x = 1;', '```'].join('\n'));

      expect(main(['--check'], dir)).toBe(0);
    } finally {
      cleanup();
    }
  });
});
