import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

import type { LintIssue, LintResult, LintRule } from './types.js';
import { noMutableStateInAggregate } from './rules/no-mutable-state-in-aggregate.js';
import { noThrowInDomain } from './rules/no-throw-in-domain.js';
import { factoryMustReturnResult } from './rules/factory-must-return-result.js';

/**
 * Built-in rule set. Add new rules here; the runner dispatches all of them
 * on every file.
 */
export const BUILT_IN_RULES: readonly LintRule[] = [
  noMutableStateInAggregate,
  noThrowInDomain,
  factoryMustReturnResult,
] as const;

export interface LintOptions {
  /** Root directory to scan recursively. */
  root: string;
  /**
   * File globs to skip — directory-name match, NOT path-glob. Defaults
   * cover node_modules / dist / build outputs.
   */
  skipDirs?: readonly string[];
  /** Override the rule set (used for testing). */
  rules?: readonly LintRule[];
  /**
   * If true, paths in issues are made relative to `root`. Useful for
   * reproducible CI output. Default true.
   */
  relativePaths?: boolean;
}

const DEFAULT_SKIP_DIRS: readonly string[] = [
  'node_modules',
  'dist',
  'build',
  '.nx',
  '.git',
  'coverage',
];

const TS_EXTENSIONS = ['.ts', '.tsx'] as const;

/**
 * Scan a directory tree, parse every TypeScript source file once, and run
 * the rule set against each. Synchronous I/O — fast enough for the MVP
 * and avoids needing a worker pool.
 */
export function runLint(options: LintOptions): LintResult {
  const start = Date.now();
  const root = resolve(options.root);
  const rules = options.rules ?? BUILT_IN_RULES;
  const skipDirs = new Set(options.skipDirs ?? DEFAULT_SKIP_DIRS);
  const relativePaths = options.relativePaths ?? true;

  const issues: LintIssue[] = [];
  let scanned = 0;

  for (const file of walk(root, skipDirs)) {
    scanned++;
    const filePath = relativePaths ? relative(root, file) : file;
    const sourceText = readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.ES2022, true);

    for (const rule of rules) {
      const ruleIssues = rule.run({ sourceFile, filePath });
      for (const issue of ruleIssues) {
        issues.push(issue);
      }
    }
  }

  return {
    issues,
    scannedFiles: scanned,
    durationMs: Date.now() - start,
  };
}

function* walk(dir: string, skipDirs: Set<string>): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (skipDirs.has(entry)) continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      yield* walk(full, skipDirs);
    } else if (stat.isFile() && TS_EXTENSIONS.some(ext => entry.endsWith(ext))) {
      // Skip `.d.ts` declaration files — they're public API surface, not source.
      if (entry.endsWith('.d.ts')) continue;
      yield full;
    }
  }
}

/**
 * Format a LintResult as a human-readable string suitable for stderr
 * output or PR comments. Group by file, sort by line.
 */
export function formatResult(result: LintResult): string {
  if (result.issues.length === 0) {
    return `ddd-lint: clean — scanned ${result.scannedFiles} files in ${result.durationMs}ms`;
  }

  const grouped = new Map<string, LintIssue[]>();
  for (const issue of result.issues) {
    const list = grouped.get(issue.file) ?? [];
    list.push(issue);
    grouped.set(issue.file, list);
  }

  const lines: string[] = [];
  for (const [file, fileIssues] of [...grouped.entries()].sort()) {
    lines.push(file);
    fileIssues.sort((a, b) => a.line - b.line || a.column - b.column);
    for (const issue of fileIssues) {
      const prefix =
        issue.severity === 'error' ? 'ERR' : issue.severity === 'warning' ? 'WARN' : 'INFO';
      lines.push(`  ${issue.line}:${issue.column}  [${prefix}]  ${issue.ruleId}  ${issue.message}`);
      if (issue.fix) lines.push(`        fix: ${issue.fix}`);
    }
  }

  const errorCount = result.issues.filter(i => i.severity === 'error').length;
  const warnCount = result.issues.filter(i => i.severity === 'warning').length;
  lines.push('');
  lines.push(
    `ddd-lint: ${errorCount} error(s), ${warnCount} warning(s) across ${grouped.size} file(s) ` +
      `(${result.scannedFiles} scanned, ${result.durationMs}ms)`
  );

  return lines.join('\n');
}
