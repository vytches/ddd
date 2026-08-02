/**
 * VD-005 (AC11) — shared types for the docs compile gate.
 *
 * The gate is deliberately OPT-IN (D-2, VD-005 analysis): most fences in
 * README/LLMGUIDE files are intentionally partial or illustrative, not
 * complete compilable units. Only a fence whose info string carries the
 * `compile-check` marker (e.g. ```ts compile-check) is ever type-checked;
 * everything else is discovered but left alone. See README.md for the full
 * convention.
 */

/** A single fenced code block extracted from a Markdown file. */
export interface CodeFence {
  /** Path (as given to the extractor — absolute or repo-relative) of the
   * Markdown file this fence was found in. */
  file: string;
  /** 1-based position of this fence among all fences in `file` (in document
   * order), regardless of language or marker — stable for diagnostics and
   * for referring to "the 2nd fence in packages/foo/README.md". */
  index: number;
  /** The fence's info-string language tag, lowercased (e.g. `ts`,
   * `typescript`, `bash`). Empty string if the fence has no info string. */
  lang: string;
  /** Whitespace-separated tokens in the info string AFTER the language tag,
   * verbatim (case-sensitive) — e.g. `['compile-check']`. */
  modifiers: string[];
  /** True only when `modifiers` contains the exact `compile-check` marker
   * AND `lang` is a recognized TypeScript tag (`ts`/`typescript`). A
   * `compile-check` marker on a non-TS fence (e.g. accidentally on a bash
   * fence) is never type-checked — it is not a valid opt-in. */
  compileCheck: boolean;
  /** The fence body exactly as it appears between the opening and closing
   * delimiter lines (no leading/trailing delimiter lines, joined with `\n`). */
  code: string;
  /** 1-based line number, in the ORIGINAL Markdown file, of the fence body's
   * first line — used to map compiler diagnostics back to a place a human
   * can find in the doc. */
  startLine: number;
}

/** A type-checker diagnostic attributed back to a specific marked fence and
 * a line/column within the ORIGINAL Markdown file (not the internal virtual
 * file used to run the compiler). */
export interface FenceDiagnostic {
  fence: CodeFence;
  message: string;
  /** 1-based line number in the source Markdown file. */
  line: number;
  /** 1-based column number. */
  column: number;
}
