/**
 * Parses JSON with comments and trailing commas (tsconfig dialect). String-aware: a naive
 * comment stripper corrupts entries such as `"@scope/*"`. Tolerates a BOM.
 */
export function parseJsonc(text: string): unknown {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i] as string;
    if (c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== '"') j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
    } else {
      out += c;
      i++;
    }
  }
  return JSON.parse(removeTrailingCommas(out));
}

function removeTrailingCommas(json: string): string {
  let out = '';
  let i = 0;
  const n = json.length;
  while (i < n) {
    const c = json[i] as string;
    if (c === '"') {
      let j = i + 1;
      while (j < n && json[j] !== '"') j += json[j] === '\\' ? 2 : 1;
      out += json.slice(i, j + 1);
      i = j + 1;
    } else if (c === ',') {
      let j = i + 1;
      while (j < n && /\s/.test(json[j] as string)) j++;
      if (json[j] !== '}' && json[j] !== ']') out += c;
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}
