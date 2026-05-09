import ts from 'typescript';

import type { LintIssue, LintRule } from '../types.js';
import { hasFileLevelSuppress } from './suppress.js';

const RULE_ID = 'ddd-002';
const RULE_SLUG = 'no-throw-in-domain';

/**
 * Flags `throw` statements inside files that look like domain code.
 *
 * Rationale (per CLAUDE.md project rules):
 * > Domain layer is PURE: no infrastructure imports, no thrown exceptions.
 * > Use Result<T> pattern for domain operations.
 *
 * Heuristic — a file is treated as "domain code" if its path contains any
 * of:
 *   - `/domain/`
 *   - `/aggregates/`
 *   - `/value-objects/`
 *   - `/specifications/`
 *   - `/policies/`
 * AND it is not under `/tests/` or `/__tests__/`.
 *
 * What's flagged:
 *   - `throw new SomeError(...)` at any depth inside the file
 *   - Re-throws (`throw error`) — same anti-pattern, just hidden
 *
 * What's NOT flagged:
 *   - `throws` JSDoc tags (we ignore comments entirely)
 *   - Test files (these often need to construct error values directly)
 *
 * **Recommended fix**: return `Result.fail(new DomainError(...))` instead of
 * throwing. Errors travel as values; control flow stays explicit.
 */
export const noThrowInDomain: LintRule = {
  id: RULE_ID,
  description: 'Domain layer must use Result<T> for failure paths instead of throwing exceptions.',
  run({ sourceFile, filePath }) {
    if (!isDomainFile(filePath)) return [];
    if (hasFileLevelSuppress(sourceFile, RULE_SLUG)) return [];

    const issues: LintIssue[] = [];

    const visit = (node: ts.Node): void => {
      if (ts.isThrowStatement(node)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile)
        );
        issues.push({
          ruleId: RULE_ID,
          severity: 'error',
          message:
            'Throwing in domain code breaks the Result<T> contract. Errors should travel as ' +
            'values, not exceptions.',
          file: filePath,
          line: line + 1,
          column: character + 1,
          fix: 'Replace `throw X` with `return Result.fail(X)`. Promote callers to handle the failure case.',
        });
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return issues;
  },
};

function isDomainFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');

  // Exclude test files regardless of folder. Vitest convention in this repo
  // is `*.test.ts` / `*.spec.ts` colocated next to source — checking
  // `/tests/` alone misses inline-colocated tests.
  if (normalized.includes('/tests/') || normalized.includes('/__tests__/')) return false;
  if (normalized.endsWith('.test.ts') || normalized.endsWith('.spec.ts')) return false;
  if (normalized.endsWith('.test.tsx') || normalized.endsWith('.spec.tsx')) return false;

  return (
    normalized.includes('/domain/') ||
    normalized.includes('/aggregates/') ||
    normalized.includes('/value-objects/') ||
    normalized.includes('/specifications/') ||
    normalized.includes('/policies/')
  );
}
