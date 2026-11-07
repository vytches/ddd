import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { globToRegExp } from '../../../src/resolver';

describe('globToRegExp', () => {
  it.each([
    ['src/*.ts', 'src/a.ts', true],
    ['src/*.ts', 'src/a/b.ts', false],
    ['src/**/*.ts', 'src/a.ts', true],
    ['src/**/*.ts', 'src/a/b/c.ts', true],
    ['src/**', 'src/a/b/c.ts', true],
    ['src/**/*.ts', 'lib/a.ts', false],
    ['**/*.controller.ts', 'a/b/user.controller.ts', true],
    ['**/*.controller.ts', 'user.controller.ts', true],
    ['src/?.ts', 'src/a.ts', true],
    ['src/?.ts', 'src/ab.ts', false],
    ['src/*.{ts,tsx}', 'src/a.tsx', true],
    ['src/*.{ts,tsx}', 'src/a.js', false],
    ['src/a.b.ts', 'src/aXb.ts', false],
  ])('%s vs %s -> %s', (glob, path, expected) => {
    expect(globToRegExp(glob).test(path)).toBe(expected);
  });

  it('anchors the match on both ends', () => {
    expect(globToRegExp('a.ts').test('xa.ts')).toBe(false);
    expect(globToRegExp('a.ts').test('a.tsx')).toBe(false);
  });

  it('throws on an unbalanced brace', () => {
    expect(() => globToRegExp('src/{a,b')).toThrow(/Unbalanced/);
  });

  it('treats regular-expression metacharacters as literal text', () => {
    expect(globToRegExp('src/a+b(1).ts').test('src/a+b(1).ts')).toBe(true);
    expect(globToRegExp('src/a+b(1).ts').test('src/aab1.ts')).toBe(false);
  });
});

describe('globToRegExp properties', () => {
  const segment = fc.stringMatching(/^[a-z0-9_-]{1,8}$/);
  const segments = fc.array(segment, { minLength: 1, maxLength: 5 });

  it('a glob without wildcards matches exactly itself', () => {
    fc.assert(
      fc.property(segments, other => {
        const path = other.join('/');
        const re = globToRegExp(path);
        expect(re.test(path)).toBe(true);
        expect(re.test(`${path}x`)).toBe(false);
        expect(re.test(`x${path}`)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('"*" never crosses a directory boundary and "**" always does', () => {
    fc.assert(
      fc.property(segment, segments, (name, dirs) => {
        const nested = `${dirs.join('/')}/${name}.ts`;
        expect(globToRegExp('*.ts').test(nested)).toBe(false);
        expect(globToRegExp('**/*.ts').test(nested)).toBe(true);
        expect(globToRegExp('**/*.ts').test(`${name}.ts`)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('a brace alternation matches each alternative and nothing else', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(segment, { minLength: 2, maxLength: 4 }),
        segment,
        (alternatives, stranger) => {
          const re = globToRegExp(`src/{${alternatives.join(',')}}.ts`);
          for (const alternative of alternatives)
            expect(re.test(`src/${alternative}.ts`)).toBe(true);
          fc.pre(!alternatives.includes(stranger));
          expect(re.test(`src/${stranger}.ts`)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
