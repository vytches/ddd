import ts from 'typescript';

import type { LintIssue, LintRule } from '../types.js';

const RULE_ID = 'ddd-003';

/**
 * Flags **static `create(...)` methods** on aggregate or factory classes
 * whose return type annotation is NOT `Result<...>`.
 *
 * Rationale: `IDomainFactory` (VF-CANON-001) standardizes factory methods
 * to `create(props): Result<T, Error>`. Direct construction that throws
 * (or returns the aggregate without explicit error reporting) breaks the
 * Result contract and forces callers to use try/catch instead of the
 * idiomatic `r.isSuccess` / `r.isFailure` flow.
 *
 * Heuristic: we flag any static method **named exactly `create`** whose
 * declared return type does NOT start with `Result<` or `Promise<Result<`.
 * The class doesn't need to implement `IDomainFactory` explicitly — the
 * convention is strong enough to warrant the check on naming alone. If a
 * project has a legitimate `create()` that returns a non-Result type
 * (e.g., a value object's `create` that throws on validation), suppress
 * with a `// ddd-lint-disable factory-must-return-result` comment.
 *
 * What's NOT flagged:
 *   - Non-static `create()` methods (those are typically internal helpers,
 *     not factories)
 *   - Factories named differently (`from`, `make`, `of`) — they often have
 *     specialized semantics; only `create` is the canonical convention
 *   - Files containing `// ddd-lint-disable factory-must-return-result`
 */
export const factoryMustReturnResult: LintRule = {
  id: RULE_ID,
  description:
    'Static `create(...)` methods are domain factories — they must return `Result<T, E>` to ' +
    'preserve the explicit-failure contract.',
  run({ sourceFile, filePath }) {
    if (hasFileLevelSuppress(sourceFile)) return [];
    const issues: LintIssue[] = [];

    const visit = (node: ts.Node): void => {
      if (ts.isClassDeclaration(node)) {
        for (const member of node.members) {
          if (!ts.isMethodDeclaration(member)) continue;
          if (!isStaticCreateMethod(member)) continue;
          if (returnsResult(member)) continue;

          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            member.getStart(sourceFile)
          );
          const className = node.name?.text ?? '<anonymous>';
          issues.push({
            ruleId: RULE_ID,
            severity: 'warning',
            message:
              `${className}.create() does not return Result<T, E>. Domain factories should make ` +
              `failure explicit instead of throwing.`,
            file: filePath,
            line: line + 1,
            column: character + 1,
            fix:
              'Change return type to `Result<T, Error>` and replace internal `throw` paths with ' +
              '`Result.fail(...)`.',
          });
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return issues;
  },
};

function hasFileLevelSuppress(sourceFile: ts.SourceFile): boolean {
  // Cheap check: scan the leading 1024 chars of the source for the directive.
  // We don't walk JSDoc — single-line comments are the recommended form.
  const head = sourceFile.text.slice(0, 1024);
  return head.includes('ddd-lint-disable factory-must-return-result');
}

function isStaticCreateMethod(method: ts.MethodDeclaration): boolean {
  if (!ts.isIdentifier(method.name) || method.name.text !== 'create') return false;
  const modifiers = ts.canHaveModifiers(method) ? (ts.getModifiers(method) ?? []) : [];
  return modifiers.some(m => m.kind === ts.SyntaxKind.StaticKeyword);
}

function returnsResult(method: ts.MethodDeclaration): boolean {
  const ret = method.type;
  if (!ret) return false; // unannotated returns are conservatively flagged

  // Walk the type reference looking for `Result<...>` or `Promise<Result<...>>`.
  return typeMentionsResult(ret);
}

function typeMentionsResult(type: ts.TypeNode): boolean {
  if (ts.isTypeReferenceNode(type)) {
    const name = ts.isIdentifier(type.typeName) ? type.typeName.text : null;
    if (name === 'Result') return true;
    if (name === 'Promise' && type.typeArguments && type.typeArguments.length > 0) {
      return typeMentionsResult(type.typeArguments[0]!);
    }
  }
  return false;
}
