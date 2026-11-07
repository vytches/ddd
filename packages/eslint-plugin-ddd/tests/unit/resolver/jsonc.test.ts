import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseJsonc } from '../../../src/resolver';

describe('parseJsonc', () => {
  it('reads plain JSON', () => {
    expect(parseJsonc('{"a":[1,2,{"b":null}]}')).toEqual({ a: [1, 2, { b: null }] });
  });

  it('drops line and block comments', () => {
    expect(parseJsonc('{ // one\n "a": 1, /* two */ "b": /* three */ 2 }')).toEqual({ a: 1, b: 2 });
  });

  it('keeps comment-like text inside strings, such as the "@scope/*" path keys', () => {
    const text =
      '{ "paths": { "@scope/*": ["src/*"], "@x/*/y": ["a//b", "/* not a comment */"] } }';
    expect(parseJsonc(text)).toEqual({
      paths: { '@scope/*': ['src/*'], '@x/*/y': ['a//b', '/* not a comment */'] },
    });
  });

  it('handles escaped quotes and backslashes before a comment marker', () => {
    expect(parseJsonc('{ "a": "he said \\"//\\"", "b": "c:\\\\" } // tail')).toEqual({
      a: 'he said "//"',
      b: 'c:\\',
    });
  });

  it('removes trailing commas in objects and arrays but not commas inside strings', () => {
    expect(parseJsonc('{ "a": [1, 2, ], "b": "x,}", }')).toEqual({ a: [1, 2], b: 'x,}' });
  });

  it('tolerates a byte order mark', () => {
    expect(parseJsonc('\uFEFF{"a":1}')).toEqual({ a: 1 });
  });

  it('tolerates an unterminated block comment at the end', () => {
    expect(parseJsonc('{"a":1} /* never closed')).toEqual({ a: 1 });
  });

  it('throws on content that is not JSON after cleaning', () => {
    expect(() => parseJsonc('{ a: 1 }')).toThrow();
    expect(() => parseJsonc('')).toThrow();
  });
});

describe('parseJsonc properties', () => {
  const json = fc.jsonValue({ maxDepth: 3 });
  /** What `JSON.parse` returns for the text, which normalises quirks such as -0. */
  const normalized = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

  it('reads any JSON document exactly as JSON.parse does', () => {
    fc.assert(
      fc.property(json, value => {
        const text = JSON.stringify(value);
        expect(parseJsonc(text)).toEqual(JSON.parse(text));
      }),
      { numRuns: 200 }
    );
  });

  it('ignores a byte order mark in front of any document', () => {
    fc.assert(
      fc.property(json, value => {
        expect(parseJsonc(`\uFEFF${JSON.stringify(value)}`)).toEqual(normalized(value));
      }),
      { numRuns: 100 }
    );
  });

  it('ignores comments placed around every line of a pretty-printed document', () => {
    fc.assert(
      fc.property(
        json,
        fc.constantFrom('// note', '/* note */', '/* a // b */', '// "quoted" /* x */'),
        (value, comment) => {
          const lineComment = comment.startsWith('//');
          const text = JSON.stringify(value, null, 2)
            .split('\n')
            .map(line => (lineComment ? `${line} ${comment}` : `${comment} ${line}`))
            .join('\n');
          expect(parseJsonc(text)).toEqual(normalized(value));
        }
      ),
      { numRuns: 150 }
    );
  });

  it('ignores a trailing comma before every closing bracket', () => {
    fc.assert(
      fc.property(json, value => {
        const lines = JSON.stringify(value, null, 2).split('\n');
        // a closer alone on its line can only be structural: string values cannot contain a raw newline
        const text = lines
          .map((line, i) => {
            const next = lines[i + 1];
            const closesNext = next !== undefined && /^\s*[}\]],?$/.test(next);
            const opens = /[{[]$/.test(line);
            return closesNext && !opens && !line.endsWith(',') ? `${line},` : line;
          })
          .join('\n');
        expect(parseJsonc(text)).toEqual(normalized(value));
      }),
      { numRuns: 150 }
    );
  });

  it('keeps any string value that contains comment markers', () => {
    const marker = fc.constantFrom('//', '/*', '*/', ',}', ',]', '"', '\\');
    fc.assert(
      fc.property(
        fc.array(fc.oneof(marker, fc.string({ maxLength: 4 })), { maxLength: 6 }),
        parts => {
          const value = { key: parts.join('') };
          expect(parseJsonc(`${JSON.stringify(value)} // end`)).toEqual(value);
        }
      ),
      { numRuns: 200 }
    );
  });
});
