import type ts from 'typescript';

/**
 * File-level suppression directive shared across all ddd-lint rules.
 *
 * Place a single-line comment near the top of the file (the first ~1 KB
 * is scanned) to disable a specific rule for the whole file:
 *
 *   // ddd-lint-disable factory-must-return-result
 *   // ddd-lint-disable no-throw-in-domain
 *   // ddd-lint-disable no-mutable-state-in-aggregate
 *
 * Multiple directives may coexist — one rule per directive line. The
 * directive name matches the rule's *kebab-case slug*, not its `ddd-NNN`
 * id, so it stays readable when grepping the codebase for known
 * suppressions.
 *
 * @example
 * ```typescript
 * // ddd-lint-disable no-throw-in-domain
 * // Reason: tryFromX variants in @vytches/ddd-value-objects expose the
 * // Result-based form; these throwing factories are intentionally kept
 * // for backward compatibility with 0.23.x consumers.
 * ```
 *
 * Always pair the directive with a comment explaining *why* the
 * suppression is intentional — silent suppressions rot.
 */
export function hasFileLevelSuppress(sourceFile: ts.SourceFile, ruleSlug: string): boolean {
  const head = sourceFile.text.slice(0, 1024);
  return head.includes(`ddd-lint-disable ${ruleSlug}`);
}
