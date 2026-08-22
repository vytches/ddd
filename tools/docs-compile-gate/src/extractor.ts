/**
 * VD-005 (AC11) — Markdown code-fence extractor (Discover + Extract phase).
 *
 * Deliberately regex/line-scan based, not a full Markdown parser — the only
 * structure this tool needs is "fenced code block boundaries + info
 * string", and CommonMark's fence rule is simple enough to implement
 * directly: a fence opens on a line of 3+ backticks (or tildes) and closes
 * on the next line consisting solely of AT LEAST as many of the same
 * fence character, nothing else. Tracking the fence length/character lets a
 * longer fence safely contain a literal triple-backtick example inside it.
 */

import { readFileSync } from 'node:fs';

import type { CodeFence } from './types.js';

/** The opt-in marker (D-2): only a fence carrying this token in its info
 * string, on a recognized TypeScript language tag, is type-checked. */
export const COMPILE_CHECK_MARKER = 'compile-check';

/** Language tags treated as TypeScript for marker purposes. A
 * `compile-check` marker on any other tag (e.g. `bash compile-check`,
 * probably a copy-paste mistake) is never honored. */
const TS_LANGS = new Set(['ts', 'typescript']);

const FENCE_OPEN_RE = /^(`{3,}|~{3,})[ \t]*(.*)$/;

function closeRe(fenceChar: string, minLen: number): RegExp {
  const escaped = fenceChar === '`' ? '`' : '~';
  return new RegExp(`^${escaped}{${minLen},}[ \\t]*$`);
}

/**
 * Extract every fenced code block from `source`, in document order.
 * `filePath` is stored verbatim on each fence (not read from) — callers
 * decide whether it's absolute, repo-relative, or a synthetic test label.
 */
export function extractFences(filePath: string, source: string): CodeFence[] {
  const lines = source.split(/\r\n|\n/);
  const fences: CodeFence[] = [];
  let sequence = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const open = FENCE_OPEN_RE.exec(line);
    if (!open) {
      i++;
      continue;
    }

    const fenceChar = open[1]?.[0] ?? '`';
    const fenceLen = open[1]?.length ?? 3;
    const info = (open[2] ?? '').trim();
    const infoTokens = info.length > 0 ? info.split(/\s+/) : [];
    const lang = (infoTokens[0] ?? '').toLowerCase();
    const modifiers = infoTokens.slice(1);

    const startLine = i + 2; // 1-based line number of the first body line
    const body: string[] = [];
    const closing = closeRe(fenceChar, fenceLen);

    i++;
    while (i < lines.length && !closing.test(lines[i] ?? '')) {
      body.push(lines[i] ?? '');
      i++;
    }
    // If the fence never closes (malformed doc / EOF), still record what was
    // captured — better to surface a truncated fence than silently drop it.
    if (i < lines.length) i++; // consume the closing delimiter line

    sequence++;
    fences.push({
      file: filePath,
      index: sequence,
      lang,
      modifiers,
      compileCheck: modifiers.includes(COMPILE_CHECK_MARKER) && TS_LANGS.has(lang),
      code: body.join('\n'),
      startLine,
    });
  }

  return fences;
}

/** Read `filePath` from disk and extract its fences. */
export function extractFencesFromFile(filePath: string): CodeFence[] {
  return extractFences(filePath, readFileSync(filePath, 'utf8'));
}
