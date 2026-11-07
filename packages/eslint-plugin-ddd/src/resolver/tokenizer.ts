/**
 * Small TypeScript tokenizer: enough to find top-level import/export/class statements without
 * a parser dependency. Skips comments, strings, template literals and (heuristically) regex
 * literals; tolerates a BOM, a shebang line and CRLF.
 */
export interface Token {
  readonly t: 'id' | 'str' | 'p';
  readonly v: string;
}

const REGEX_AFTER_PUNCT = new Set('(,=:[!&|?{};+-*%<>~^'.split(''));
const REGEX_AFTER_KEYWORD = new Set([
  'return',
  'typeof',
  'case',
  'delete',
  'void',
  'throw',
  'new',
  'in',
  'of',
  'else',
  'do',
  'yield',
  'await',
]);
const ID_START = /[A-Za-z_$\u0080-￿]/;
const ID_PART = /[\w$\u0080-￿]/;

function skipString(src: string, start: number): number {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') i += 2;
    else if (c === quote || c === '\n') return i + 1;
    else i++;
  }
  return i;
}

function skipComment(src: string, i: number): number {
  if (src[i + 1] === '/') {
    const end = src.indexOf('\n', i);
    return end === -1 ? src.length : end;
  }
  const end = src.indexOf('*/', i + 2);
  return end === -1 ? src.length : end + 2;
}

function skipTemplate(src: string, start: number): number {
  let i = start + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') i += 2;
    else if (c === '`') return i + 1;
    else if (c === '$' && src[i + 1] === '{') i = skipBraces(src, i + 2);
    else i++;
  }
  return i;
}

function skipBraces(src: string, start: number): number {
  let depth = 1;
  let i = start;
  while (i < src.length) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i + 1;
    if (c === '"' || c === "'") i = skipString(src, i);
    else if (c === '`') i = skipTemplate(src, i);
    else if (c === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) i = skipComment(src, i);
    else i++;
  }
  return i;
}

function skipRegex(src: string, start: number): number {
  let i = start + 1;
  let inClass = false;
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') return start + 1;
    if (c === '\\') i += 2;
    else if (c === '[') {
      inClass = true;
      i++;
    } else if (c === ']') {
      inClass = false;
      i++;
    } else if (c === '/' && !inClass) {
      i++;
      while (i < src.length && ID_PART.test(src[i] as string)) i++;
      return i;
    } else i++;
  }
  return start + 1;
}

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  const n = src.length;
  let i = src.charCodeAt(0) === 0xfeff ? 1 : 0;
  if (src.startsWith('#!', i)) {
    const newline = src.indexOf('\n', i);
    i = newline === -1 ? n : newline + 1;
  }
  const regexAllowed = (): boolean => {
    const last = out[out.length - 1];
    if (!last) return true;
    if (last.t === 'p') return REGEX_AFTER_PUNCT.has(last.v);
    return last.t === 'id' && REGEX_AFTER_KEYWORD.has(last.v);
  };
  while (i < n) {
    const c = src[i] as string;
    if (c <= ' ' || c === ' ' || c === ' ' || c === ' ') {
      i++;
    } else if (c === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) {
      i = skipComment(src, i);
    } else if (c === '/' && regexAllowed()) {
      const end = skipRegex(src, i);
      if (end === i + 1) {
        out.push({ t: 'p', v: c });
        i++;
      } else {
        out.push({ t: 'str', v: '' });
        i = end;
      }
    } else if (c === '"' || c === "'") {
      const end = skipString(src, i);
      out.push({ t: 'str', v: src.slice(i + 1, end - 1) });
      i = end;
    } else if (c === '`') {
      out.push({ t: 'str', v: '' });
      i = skipTemplate(src, i);
    } else if (ID_START.test(c)) {
      let j = i + 1;
      while (j < n && ID_PART.test(src[j] as string)) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
    } else if (c >= '0' && c <= '9') {
      let j = i + 1;
      while (j < n && /[\w.]/.test(src[j] as string)) j++;
      out.push({ t: 'str', v: '' });
      i = j;
    } else {
      out.push({ t: 'p', v: c });
      i++;
    }
  }
  return out;
}
