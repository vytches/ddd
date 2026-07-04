import { describe, it, expect } from 'vitest';

import { discoverExamples } from '../src/scanner.js';
import { makeTempRepo, writePackageJson, writeSrcFile, writeTestFile } from './test-helpers.js';

describe('discoverExamples', () => {
  it('discovers a directory with package.json, src files, and test files', () => {
    const { root, examplesRoot, cleanup } = makeTempRepo();
    try {
      writePackageJson(examplesRoot, 'policies', '@vytches/examples-policies');
      writeSrcFile(examplesRoot, 'policies', '01-basic.ts', `export const x = 1;`);
      writeTestFile(examplesRoot, 'policies', '01-basic.test.ts', `export {};`);

      const discovered = discoverExamples(examplesRoot);

      expect(discovered).toHaveLength(1);
      const [entry] = discovered;
      expect(entry.dir).toBe('policies');
      expect(entry.root).toBe('examples/policies');
      expect(entry.hasPackageJson).toBe(true);
      expect(entry.srcFiles).toEqual(['examples/policies/src/01-basic.ts']);
      expect(entry.testFiles).toEqual(['examples/policies/tests/01-basic.test.ts']);
      void root;
    } finally {
      cleanup();
    }
  });

  it('reports hasPackageJson: false when no package.json exists', () => {
    const { examplesRoot, cleanup } = makeTempRepo();
    try {
      writeSrcFile(examplesRoot, 'orphan', 'a.ts', `export const a = 1;`);

      const discovered = discoverExamples(examplesRoot);

      expect(discovered).toHaveLength(1);
      expect(discovered[0].hasPackageJson).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('excludes .d.ts files from srcFiles and only matches *.test.ts under tests/', () => {
    const { examplesRoot, cleanup } = makeTempRepo();
    try {
      writePackageJson(examplesRoot, 'foo', '@vytches/examples-foo');
      writeSrcFile(examplesRoot, 'foo', 'a.ts', `export const a = 1;`);
      writeSrcFile(examplesRoot, 'foo', 'a.d.ts', `export declare const a: number;`);
      writeTestFile(examplesRoot, 'foo', 'a.test.ts', `export {};`);
      writeTestFile(examplesRoot, 'foo', 'helper.ts', `export {};`);

      const discovered = discoverExamples(examplesRoot);

      expect(discovered[0].srcFiles).toEqual(['examples/foo/src/a.ts']);
      expect(discovered[0].testFiles).toEqual(['examples/foo/tests/a.test.ts']);
    } finally {
      cleanup();
    }
  });

  it('skips node_modules, dist, and other skip-dirs while walking', () => {
    const { examplesRoot, cleanup } = makeTempRepo();
    try {
      writePackageJson(examplesRoot, 'foo', '@vytches/examples-foo');
      writeSrcFile(examplesRoot, 'foo', 'a.ts', `export const a = 1;`);
      writeSrcFile(examplesRoot, 'foo', 'node_modules/somedep/index.ts', `export {};`);

      const discovered = discoverExamples(examplesRoot);

      expect(discovered[0].srcFiles).toEqual(['examples/foo/src/a.ts']);
    } finally {
      cleanup();
    }
  });

  it('returns an empty array when the examples root does not exist', () => {
    const discovered = discoverExamples('/nonexistent/path/that/does/not/exist');
    expect(discovered).toEqual([]);
  });

  it('discovers multiple example directories, sorted by name', () => {
    const { examplesRoot, cleanup } = makeTempRepo();
    try {
      writePackageJson(examplesRoot, 'zeta', '@vytches/examples-zeta');
      writePackageJson(examplesRoot, 'alpha', '@vytches/examples-alpha');

      const discovered = discoverExamples(examplesRoot);

      expect(discovered.map(d => d.dir)).toEqual(['alpha', 'zeta']);
    } finally {
      cleanup();
    }
  });
});
