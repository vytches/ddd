/**
 * Shared types for ddd-lint rule engine.
 *
 * VF-001 MVP (2026-05-09).
 */

export type Severity = 'error' | 'warning' | 'info';

export interface LintIssue {
  /** Stable identifier — `ddd-001`, `ddd-002`, `ddd-003`. */
  ruleId: string;
  severity: Severity;
  message: string;
  /** Absolute or repo-relative file path. */
  file: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column number. */
  column: number;
  /** Short hint pointing the user at the fix (one line). */
  fix?: string;
}

export interface LintRule {
  id: string;
  description: string;
  /**
   * Inspect a TypeScript SourceFile and return any violations found.
   * Pure: no I/O, no globals — the runner provides the source file.
   */
  run(input: { sourceFile: import('typescript').SourceFile; filePath: string }): LintIssue[];
}

export interface LintResult {
  issues: LintIssue[];
  scannedFiles: number;
  durationMs: number;
}
