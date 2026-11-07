import { describe, expect, it } from 'vitest';
import {
  createSettingsResolver,
  DddConfigError,
  parseSettings,
  roleConfigFromSettings,
  SETTINGS_KEY,
} from '../../../src/config';
import { createMemoryFs } from '../helpers/memory-fs';

function problems(raw: unknown): readonly string[] {
  try {
    parseSettings(raw);
  } catch (error) {
    if (error instanceof DddConfigError) return error.problems.map(p => p.message);
    throw error;
  }
  return [];
}

describe('parseSettings', () => {
  it('treats missing settings as no configuration', () => {
    expect(parseSettings(undefined)).toEqual({});
    expect(SETTINGS_KEY).toBe('ddd');
  });

  it('returns a normalised copy of valid settings', () => {
    const raw = {
      tsconfig: false,
      maxDepth: 3,
      includeLibraryRoles: false,
      bindings: [
        {
          role: 'Aggregate2',
          extends: [{ from: 'src/a.ts', name: 'A' }],
          decorator: { from: 'pkg', name: 'D' },
          files: 'src/**/*.ts',
          implies: ['Entity'],
        },
      ],
    };
    const parsed = parseSettings(raw);
    expect(parsed).toEqual(raw);
    expect(parsed.bindings).not.toBe(raw.bindings);
  });

  it.each([
    ['a non-object', 'x', 'expected an object'],
    ['an array', [], 'expected an object'],
    ['a bad maxDepth', { maxDepth: 0 }, 'maxDepth: must be an integer >= 1'],
    ['a fractional maxDepth', { maxDepth: 1.5 }, 'maxDepth: must be an integer >= 1'],
    ['a bad tsconfig', { tsconfig: '' }, 'tsconfig: must be a non-empty path string or false'],
    ['a bad includeLibraryRoles', { includeLibraryRoles: 'yes' }, 'must be a boolean'],
    ['non-array bindings', { bindings: {} }, 'bindings: must be an array'],
    ['a binding that is not an object', { bindings: ['x'] }, 'bindings[0]: expected an object'],
    [
      'a binding without a role',
      { bindings: [{ files: 'a' }] },
      'bindings[0].role: must be a non-empty string',
    ],
    [
      'a target without a name',
      { bindings: [{ role: 'R', extends: { from: 'p' } }] },
      'extends.name: must be a non-empty string',
    ],
    [
      'an empty files glob',
      { bindings: [{ role: 'R', files: ' ' }] },
      'files: must be a non-empty glob string',
    ],
    [
      'bad implies',
      { bindings: [{ role: 'R', implies: [1] }] },
      'implies: must be an array of non-empty role names',
    ],
  ])('rejects %s', (_label, raw, expected) => {
    const found = problems(raw);
    expect(found.length).toBeGreaterThan(0);
    expect(found.join('\n')).toContain(expected);
  });

  it('suggests the closest key for a typo', () => {
    expect(problems({ bindngs: [] }).join('\n')).toContain('did you mean "bindings"');
    expect(
      problems({ bindings: [{ role: 'R', extend: { from: 'a', name: 'B' } }] }).join('\n')
    ).toContain('did you mean "extends"');
  });

  it('lists every problem at once', () => {
    expect(problems({ maxDepth: 0, tsconfig: '', nope: 1 }).length).toBeGreaterThanOrEqual(3);
  });

  it('puts the problems in the error message and on the error', () => {
    try {
      parseSettings({ maxDepth: 0 });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DddConfigError);
      expect((error as DddConfigError).message).toContain(
        'Invalid @vytches/eslint-plugin-ddd configuration'
      );
      expect((error as DddConfigError).problems[0]?.code).toBe('invalid-settings');
    }
  });
});

describe('roleConfigFromSettings', () => {
  it('maps only the provided settings onto resolver options', () => {
    expect(roleConfigFromSettings('/proj', undefined)).toEqual({ cwd: '/proj' });
    expect(roleConfigFromSettings('/proj', { tsconfig: false, maxDepth: 2 })).toEqual({
      cwd: '/proj',
      tsconfig: false,
      maxDepth: 2,
    });
  });
});

describe('createSettingsResolver', () => {
  const BINDING = { role: 'Audited', extends: { from: 'src/base.ts', name: 'Base' } };
  const context = (settings: unknown) => ({
    cwd: '/proj',
    settings: { ddd: settings } as Record<string, unknown>,
  });

  it('builds the resolver once per cwd and settings pair', () => {
    const fs = createMemoryFs({ '/proj/src/base.ts': 'export class Base {}' });
    const provider = createSettingsResolver({ fs });
    const first = provider(context({ bindings: [BINDING], tsconfig: false }));
    expect(provider(context({ bindings: [BINDING], tsconfig: false }))).toBe(first);
    expect(provider(context({ bindings: [BINDING] }))).not.toBe(first);
  });

  it('throws a DddConfigError while a binding is unresolvable and does not cache the failure', () => {
    const fs = createMemoryFs({});
    const provider = createSettingsResolver({ fs });
    const ctx = context({ bindings: [BINDING], tsconfig: false });
    expect(() => provider(ctx)).toThrow(DddConfigError);
    fs.write('/proj/src/base.ts', 'export class Base {}');
    expect(() => provider(ctx)).not.toThrow();
  });

  it('throws a DddConfigError for settings that cannot be serialised', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(() => createSettingsResolver()(context(circular))).toThrow(/not serializable/);
  });

  it('drops cached resolvers on reset()', () => {
    const provider = createSettingsResolver({ fs: createMemoryFs({}) });
    const ctx = context({ tsconfig: false });
    const first = provider(ctx);
    provider.reset();
    expect(provider(ctx)).not.toBe(first);
  });
});
