import { describe, it, expect } from 'vitest';
import ts from 'typescript';

import { checkFences } from '../src/checker.js';
import { extractFences, extractFencesFromFile } from '../src/extractor.js';
import { makeTempDir, writeDocFile } from './test-helpers.js';

/** Minimal, hermetic compiler options — deliberately NOT the repo's real
 * tsconfig.base.json (no `@vytches/ddd-*` paths), so these tests exercise
 * the checker's own mechanics without depending on the monorepo's package
 * graph. */
const BASE_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  lib: ['ES2022'],
};

describe('checkFences — happy path', () => {
  it('reports zero diagnostics for a correct marked fence', () => {
    const md = ['```ts compile-check', 'const x: number = 1;', 'console.log(x);', '```'].join('\n');
    const fences = extractFences('doc.md', md);

    const result = checkFences(fences, { compilerOptions: BASE_OPTIONS });

    expect(result.ok).toBe(true);
    expect(result.checkedCount).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });

  it('is a clean no-op when there are zero marked fences (opt-in default state)', () => {
    const fences = extractFences('doc.md', ['```ts', 'const x = 1;', '```'].join('\n'));

    const result = checkFences(fences, { compilerOptions: BASE_OPTIONS });

    expect(result).toEqual({ ok: true, checkedCount: 0, diagnostics: [] });
  });

  it('skips unmarked fences entirely, even ones containing a real type error', () => {
    const md = ['```ts', 'const x: number = "not a number";', '```'].join('\n');
    const fences = extractFences('doc.md', md);

    const result = checkFences(fences, { compilerOptions: BASE_OPTIONS });

    expect(result.ok).toBe(true);
    expect(result.checkedCount).toBe(0);
  });
});

describe('checkFences — FIXTURE: deliberately broken marked fence', () => {
  it('reports a failure for a marked fence with a wrong-type assignment', () => {
    const md = [
      '# Example',
      '',
      '```ts compile-check',
      'const total: number = "12"; // BUG: string assigned to number',
      '```',
    ].join('\n');
    const fences = extractFences('fixtures/broken-example.md', md);

    const result = checkFences(fences, { compilerOptions: BASE_OPTIONS });

    expect(result.ok).toBe(false);
    expect(result.checkedCount).toBe(1);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]?.message).toMatch(/not assignable/i);
    // Line maps back onto the ORIGINAL markdown file (line 4 is the body line).
    expect(result.diagnostics[0]?.line).toBe(4);
    expect(result.diagnostics[0]?.fence.file).toBe('fixtures/broken-example.md');
  });

  it('reports failure specifically for a non-existent method call — the exact drift class AC11 exists to catch', () => {
    const md = [
      '```ts compile-check',
      'const items: number[] = [1, 2, 3];',
      'items.doesNotExist();',
      '```',
    ].join('\n');
    const fences = extractFences('doc.md', md);

    const result = checkFences(fences, { compilerOptions: BASE_OPTIONS });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.message).toMatch(/doesNotExist/);
  });

  it('proves this is not a rubber-stamp: fixing the broken fence makes the same checker pass', () => {
    const brokenMd = ['```ts compile-check', 'const total: number = "12";', '```'].join('\n');
    const fixedMd = ['```ts compile-check', 'const total: number = 12;', '```'].join('\n');

    const brokenResult = checkFences(extractFences('doc.md', brokenMd), {
      compilerOptions: BASE_OPTIONS,
    });
    const fixedResult = checkFences(extractFences('doc.md', fixedMd), {
      compilerOptions: BASE_OPTIONS,
    });

    expect(brokenResult.ok).toBe(false);
    expect(fixedResult.ok).toBe(true);
  });

  it('FIXTURE (file-based): a README-shaped file with a correct and a broken marked fence — only the broken one fails, mapped to its own fence index', () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const file = writeDocFile(
        dir,
        'README.md',
        [
          '# Demo',
          '',
          'Correct:',
          '```ts compile-check',
          'function double(n: number): number { return n * 2; }',
          '```',
          '',
          'Broken — calls a method that does not exist:',
          '```ts compile-check',
          'const arr: number[] = [1, 2, 3];',
          'arr.doesNotExist();',
          '```',
        ].join('\n')
      );

      const fences = extractFencesFromFile(file);
      const result = checkFences(fences, { compilerOptions: BASE_OPTIONS });

      expect(result.checkedCount).toBe(2);
      expect(result.ok).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.fence.index).toBe(2);
      expect(result.diagnostics[0]?.message).toMatch(/doesNotExist/);
    } finally {
      cleanup();
    }
  });
});

describe('checkFences — diagnostic ordering', () => {
  it('sorts diagnostics deterministically by file, then fence index, then position', () => {
    const md = [
      '```ts compile-check',
      'const a: number = "bad-a";',
      '```',
      '```ts compile-check',
      'const b: number = "bad-b";',
      '```',
    ].join('\n');
    const fences = extractFences('doc.md', md);

    const result = checkFences(fences, { compilerOptions: BASE_OPTIONS });

    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics.map(d => d.fence.index)).toEqual([1, 2]);
  });
});
