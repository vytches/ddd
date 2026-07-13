import { describe, it, expect } from 'vitest';

import { COMPILE_CHECK_MARKER, extractFences, extractFencesFromFile } from '../src/extractor.js';
import { makeTempDir, writeDocFile } from './test-helpers.js';

describe('extractFences — marker detection', () => {
  it('flags a ```ts compile-check fence as compileCheck: true', () => {
    const md = ['# Title', '', '```ts compile-check', 'const x: number = 1;', '```', ''].join('\n');
    const fences = extractFences('doc.md', md);

    expect(fences).toHaveLength(1);
    expect(fences[0]).toMatchObject({ lang: 'ts', compileCheck: true, index: 1 });
    expect(fences[0]?.code).toBe('const x: number = 1;');
  });

  it('leaves a plain ```ts fence unmarked — v1 is opt-in, not hard-fail-on-every-fence', () => {
    const md = ['```ts', 'const x = doesNotExist();', '```'].join('\n');
    const fences = extractFences('doc.md', md);

    expect(fences[0]?.compileCheck).toBe(false);
  });

  it('accepts the "typescript" language alias with the marker', () => {
    const md = ['```typescript compile-check', 'const x = 1;', '```'].join('\n');
    const fences = extractFences('doc.md', md);

    expect(fences[0]).toMatchObject({ lang: 'typescript', compileCheck: true });
  });

  it('ignores the marker token on a non-TypeScript fence (e.g. bash) — never accidentally compiled', () => {
    const md = ['```bash compile-check', 'echo hi', '```'].join('\n');
    const fences = extractFences('doc.md', md);

    expect(fences[0]).toMatchObject({ lang: 'bash', compileCheck: false });
    expect(fences[0]?.modifiers).toEqual([COMPILE_CHECK_MARKER]);
  });

  it('requires the exact marker token — a near-miss does not opt in', () => {
    const md = ['```ts compile-checked', 'const x = 1;', '```'].join('\n');
    const fences = extractFences('doc.md', md);

    expect(fences[0]?.compileCheck).toBe(false);
  });

  it('treats a fence with no info string as lang: "" and never marked', () => {
    const md = ['```', 'plain text block', '```'].join('\n');
    const fences = extractFences('doc.md', md);

    expect(fences[0]).toMatchObject({ lang: '', modifiers: [], compileCheck: false });
  });
});

describe('extractFences — multi-fence-per-file', () => {
  it('extracts every fence in a file with a correct 1-based sequential index, regardless of language', () => {
    const md = [
      '```ts',
      'const a = 1;',
      '```',
      'some prose in between',
      '```bash',
      'echo hi',
      '```',
      '```ts compile-check',
      'const b: number = 2;',
      '```',
    ].join('\n');
    const fences = extractFences('doc.md', md);

    expect(fences.map(f => f.index)).toEqual([1, 2, 3]);
    expect(fences.map(f => f.lang)).toEqual(['ts', 'bash', 'ts']);
    expect(fences.map(f => f.compileCheck)).toEqual([false, false, true]);
  });

  it('tracks the correct 1-based startLine for each fence, for diagnostic mapping', () => {
    const md = [
      'line1',
      '```ts',
      'body1', // line 3
      '```',
      'line5',
      '```ts',
      'bodyA', // line 7
      'bodyB',
      '```',
    ].join('\n');
    const fences = extractFences('doc.md', md);

    expect(fences[0]?.startLine).toBe(3);
    expect(fences[1]?.startLine).toBe(7);
  });

  it('respects fence length when closing: a 4-backtick fence can safely contain a literal triple-backtick line', () => {
    const md = ['````ts compile-check', 'const s = "```not a close```";', '````'].join('\n');
    const fences = extractFences('doc.md', md);

    expect(fences).toHaveLength(1);
    expect(fences[0]?.code).toBe('const s = "```not a close```";');
  });

  it('handles a file with zero fences', () => {
    const fences = extractFences('doc.md', '# Just prose\n\nNo code here.\n');
    expect(fences).toEqual([]);
  });
});

describe('extractFencesFromFile — multi-file', () => {
  it('extracts fences independently across multiple real files on disk', () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const fileA = writeDocFile(
        dir,
        'a/README.md',
        ['```ts compile-check', 'const x = 1;', '```'].join('\n')
      );
      const fileB = writeDocFile(
        dir,
        'b/LLMGUIDE.md',
        [
          '```ts',
          'const y = 2;',
          '```',
          '```ts compile-check',
          'const z: string = "ok";',
          '```',
        ].join('\n')
      );

      const fencesA = extractFencesFromFile(fileA);
      const fencesB = extractFencesFromFile(fileB);

      expect(fencesA).toHaveLength(1);
      expect(fencesA[0]?.file).toBe(fileA);
      expect(fencesA[0]?.compileCheck).toBe(true);

      expect(fencesB).toHaveLength(2);
      expect(fencesB.filter(f => f.compileCheck)).toHaveLength(1);
      expect(fencesB.filter(f => f.compileCheck)[0]?.file).toBe(fileB);
    } finally {
      cleanup();
    }
  });
});
