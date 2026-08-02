import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { loadRepoCompilerOptions } from '../src/compiler-options.js';

const here = dirname(fileURLToPath(import.meta.url));
// tools/docs-compile-gate/tests -> tools/docs-compile-gate -> tools -> repo root
const REPO_ROOT = resolve(here, '..', '..', '..');

describe('loadRepoCompilerOptions', () => {
  it('loads the real @vytches/ddd-* path mapping from tsconfig.base.json', () => {
    const options = loadRepoCompilerOptions(REPO_ROOT);

    expect(options.paths?.['@vytches/ddd-aggregates']).toBeDefined();
    expect(options.paths?.['@vytches/ddd-validation']).toBeDefined();
  });

  it('forces noEmit and strips project-build-only options that are meaningless for in-memory checking', () => {
    const options = loadRepoCompilerOptions(REPO_ROOT);

    expect(options.noEmit).toBe(true);
    expect(options.composite).toBeUndefined();
    expect(options.declaration).toBeUndefined();
    expect(options.declarationMap).toBeUndefined();
    expect(options.incremental).toBeUndefined();
    expect(options.tsBuildInfoFile).toBeUndefined();
  });

  it('throws a clear error when tsconfig.base.json does not exist at the given root', () => {
    expect(() => loadRepoCompilerOptions('/nonexistent-repo-root')).toThrow(/tsconfig\.base\.json/);
  });
});
