import { resolve } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ResolverWarning } from '../../../src/resolver';
import { resolveProjectFile } from '../../../src/resolver/specifier';
import { loadTsconfigPaths } from '../../../src/resolver/tsconfig';
import { createMemoryFs } from '../helpers/memory-fs';

const CWD = '/proj';

function load(files: Record<string, string>, tsconfig?: string | false) {
  const warnings: ResolverWarning[] = [];
  const fs = createMemoryFs(files);
  const paths = loadTsconfigPaths(CWD, fs, tsconfig, w => warnings.push(w));
  return { paths, warnings, fs };
}

const resolveSpec = (files: Record<string, string>, spec: string, tsconfig?: string | false) => {
  const { paths, fs } = load(files, tsconfig);
  return resolveProjectFile(spec, '/proj/src/app/main.ts', paths, fs, new Map());
};

describe('loadTsconfigPaths', () => {
  it('returns no mappings for tsconfig: false and for a missing file, without touching the disk', () => {
    expect(load({}, false).paths).toEqual({ baseUrl: undefined, mappings: [] });
    const { paths, fs } = load({});
    expect(paths.mappings).toEqual([]);
    expect(fs.totalReads()).toBe(0);
  });

  it('reads paths relative to baseUrl and baseUrl relative to the config', () => {
    const { paths } = load({
      '/proj/tsconfig.json':
        '{"compilerOptions":{"baseUrl":"src","paths":{"@app/*":["app/*"],"@cfg":["config/index"]}}}',
    });
    expect(paths.baseUrl).toBe('/proj/src');
    expect(paths.mappings).toEqual([
      { prefix: '@app/', suffix: '', wildcard: true, targets: ['/proj/src/app/*'] },
      { prefix: '@cfg', suffix: '', wildcard: false, targets: ['/proj/src/config/index'] },
    ]);
  });

  it('resolves paths against the config directory when there is no baseUrl', () => {
    const { paths } = load({
      '/proj/tsconfig.json': '{"compilerOptions":{"paths":{"@a/*":["lib/*"]}}}',
    });
    expect(paths.mappings[0]?.targets).toEqual(['/proj/lib/*']);
  });

  it('lets the child override paths and baseUrl of an extended config', () => {
    const { paths } = load({
      '/proj/tsconfig.base.json':
        '{"compilerOptions":{"baseUrl":".","paths":{"@old/*":["old/*"]}}}',
      '/proj/tsconfig.json':
        '{"extends":"./tsconfig.base","compilerOptions":{"paths":{"@new/*":["new/*"]}}}',
    });
    expect(paths.baseUrl).toBe('/proj');
    expect(paths.mappings.map(m => m.prefix)).toEqual(['@new/']);
  });

  it('inherits paths from every config in an extends array, the last one winning', () => {
    const { paths } = load({
      '/proj/a.json': '{"compilerOptions":{"baseUrl":".","paths":{"@a/*":["a/*"]}}}',
      '/proj/b.json': '{"compilerOptions":{"baseUrl":"b","paths":{"@b/*":["b/*"]}}}',
      '/proj/tsconfig.json': '{"extends":["./a.json","./b.json"]}',
    });
    expect(paths.baseUrl).toBe('/proj/b');
    expect(paths.mappings.map(m => m.prefix)).toEqual(['@b/']);
  });

  it('follows an extends into a package under node_modules', () => {
    const { paths } = load({
      '/proj/node_modules/@org/tsconfig/base.json':
        '{"compilerOptions":{"baseUrl":".","paths":{"@lib/*":["lib/*"]}}}',
      '/proj/tsconfig.json': '{"extends":"@org/tsconfig/base.json"}',
    });
    expect(paths.mappings.map(m => m.prefix)).toEqual(['@lib/']);
  });

  it('orders mappings longest prefix first', () => {
    const { paths } = load({
      '/proj/tsconfig.json':
        '{"compilerOptions":{"baseUrl":".","paths":{"@a/*":["a/*"],"@a/deep/*":["d/*"],"*":["x/*"]}}}',
    });
    expect(paths.mappings.map(m => m.prefix)).toEqual(['@a/deep/', '@a/', '']);
  });

  it('survives an extends cycle', () => {
    const { paths, warnings } = load({
      '/proj/a.json':
        '{"extends":"./b.json","compilerOptions":{"baseUrl":".","paths":{"@a/*":["a/*"]}}}',
      '/proj/b.json': '{"extends":"./a.json"}',
      '/proj/tsconfig.json': '{"extends":"./a.json"}',
    });
    expect(paths.mappings.map(m => m.prefix)).toEqual(['@a/']);
    expect(warnings).toEqual([]);
  });

  it('warns and returns no mappings for a config that is not JSON', () => {
    const { paths, warnings } = load({ '/proj/tsconfig.json': '{ nope' });
    expect(paths.mappings).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ code: 'tsconfig', file: '/proj/tsconfig.json' });
  });

  it('ignores an extends target that does not exist', () => {
    const { paths, warnings } = load({
      '/proj/tsconfig.json':
        '{"extends":"./missing.json","compilerOptions":{"baseUrl":".","paths":{"@a/*":["a/*"]}}}',
    });
    expect(paths.mappings.map(m => m.prefix)).toEqual(['@a/']);
    expect(warnings).toEqual([]);
  });

  it('reads a custom tsconfig name relative to cwd', () => {
    const { paths } = load(
      { '/proj/tsconfig.app.json': '{"compilerOptions":{"baseUrl":".","paths":{"@a/*":["a/*"]}}}' },
      'tsconfig.app.json'
    );
    expect(paths.mappings).toHaveLength(1);
  });
});

describe('resolveProjectFile', () => {
  const CONFIG = {
    '/proj/tsconfig.json':
      '{"compilerOptions":{"baseUrl":".","paths":{"@app/*":["nope/*","src/app/*"],"@cfg":["src/config"],"@app/deep/*":["src/deep/*"]}}}',
  };

  it('resolves relative specifiers with .js, index and declaration fallbacks', () => {
    const files = {
      '/proj/src/app/util.ts': '',
      '/proj/src/app/dir/index.ts': '',
      '/proj/src/app/types.d.ts': '',
    };
    const at = (spec: string) => resolveSpec(files, spec);
    expect(at('./util')).toBe('/proj/src/app/util.ts');
    expect(at('./util.js')).toBe('/proj/src/app/util.ts');
    expect(at('./dir')).toBe('/proj/src/app/dir/index.ts');
    expect(at('./types')).toBe('/proj/src/app/types.d.ts');
    expect(at('./missing')).toBeUndefined();
  });

  it('tries every target of a mapping and prefers the longest matching pattern', () => {
    const files = {
      ...CONFIG,
      '/proj/src/app/a.ts': '',
      '/proj/src/deep/b.ts': '',
      '/proj/src/config/index.ts': '',
    };
    expect(resolveSpec(files, '@app/a')).toBe('/proj/src/app/a.ts');
    expect(resolveSpec(files, '@app/deep/b')).toBe('/proj/src/deep/b.ts');
    expect(resolveSpec(files, '@cfg')).toBe('/proj/src/config/index.ts');
  });

  it('treats a package specifier as not a project file', () => {
    expect(
      resolveSpec({ ...CONFIG, '/proj/src/app/a.ts': '' }, '@vytches/ddd-contracts')
    ).toBeUndefined();
  });

  it('falls back to baseUrl for bare specifiers', () => {
    const files = { ...CONFIG, '/proj/shared/x.ts': '' };
    expect(resolveSpec(files, 'shared/x')).toBe('/proj/shared/x.ts');
  });

  it('caches lookups per candidate path', () => {
    const { paths, fs } = load({ '/proj/src/app/util.ts': '' });
    const cache = new Map<string, string | undefined>();
    resolveProjectFile('./util', '/proj/src/app/main.ts', paths, fs, cache);
    const statsAfterFirst = fs.stats.get('/proj/src/app/util.ts') ?? 0;
    resolveProjectFile('./util', '/proj/src/app/main.ts', paths, fs, cache);
    expect(fs.stats.get('/proj/src/app/util.ts') ?? 0).toBe(statsAfterFirst);
  });
});

describe('tsconfig paths properties', () => {
  const word = fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/);
  const rest = fc.array(word, { minLength: 1, maxLength: 3 }).map(parts => parts.join('/'));

  it('maps any "@scope/*" alias onto its target directory', () => {
    fc.assert(
      fc.property(word, word, rest, (scope, dir, tail) => {
        const target = `/proj/src/${dir}/${tail}.ts`;
        const files = {
          '/proj/tsconfig.json': JSON.stringify({
            compilerOptions: { baseUrl: '.', paths: { [`@${scope}/*`]: [`src/${dir}/*`] } },
          }),
          [target]: '',
        };
        expect(resolveSpec(files, `@${scope}/${tail}`)).toBe(resolve(target));
      }),
      { numRuns: 100 }
    );
  });

  it('survives comments and trailing commas around any alias key', () => {
    fc.assert(
      fc.property(word, word, (scope, dir) => {
        const text = `{ // c\n "compilerOptions": { /* b */ "baseUrl": ".", "paths": { "@${scope}/*": ["src/${dir}/*",], }, }, }`;
        const { paths } = load({ '/proj/tsconfig.json': text });
        expect(paths.mappings).toEqual([
          { prefix: `@${scope}/`, suffix: '', wildcard: true, targets: [`/proj/src/${dir}/*`] },
        ]);
      }),
      { numRuns: 100 }
    );
  });

  it('picks the longest prefix whatever order the keys are written in', () => {
    fc.assert(
      fc.property(word, word, fc.boolean(), (scope, deepDir, shortFirst) => {
        const entries: [string, string[]][] = [
          [`@${scope}/*`, ['src/short/*']],
          [`@${scope}/${deepDir}/*`, ['src/long/*']],
        ];
        if (!shortFirst) entries.reverse();
        const files = {
          '/proj/tsconfig.json': JSON.stringify({
            compilerOptions: { baseUrl: '.', paths: Object.fromEntries(entries) },
          }),
          '/proj/src/long/x.ts': '',
          '/proj/src/short/x.ts': '',
        };
        expect(resolveSpec(files, `@${scope}/${deepDir}/x`)).toBe('/proj/src/long/x.ts');
        expect(resolveSpec(files, `@${scope}/x`)).toBe('/proj/src/short/x.ts');
      }),
      { numRuns: 100 }
    );
  });
});
