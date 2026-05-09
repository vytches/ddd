import ts from 'typescript';

import type { LintIssue, LintRule } from '../types.js';

const RULE_ID = 'ddd-001';

/**
 * Flags **public mutable property declarations** inside classes that extend
 * `AggregateRoot` or `Entity`. Per Evans, all state changes must go through
 * `apply(eventName, payload)` — direct field mutation by external code
 * bypasses event recording and version tracking.
 *
 * Heuristic: a class that has `extends AggregateRoot` (with any generic
 * argument) or `extends Entity` in its heritage clauses is treated as a
 * domain aggregate. Property declarations on such classes:
 *
 * - `private readonly` → OK (immutable internal field)
 * - `private` (no `readonly`) → **flagged**: should be `private readonly` and
 *   updated only via event handler, never reassigned outside the handler
 * - `public` / `protected` (no `readonly`) → **flagged**: external code can
 *   reach in and mutate; aggregate boundary is broken
 * - `public readonly` → OK (read-only externally; safe to expose)
 *
 * False-positive avoidance: we only check property declarations with an
 * accessibility modifier — fields without `private`/`public`/`protected`
 * keywords (just `name = ''`) are conservatively flagged because TypeScript
 * defaults bare class fields to `public`, which is the most dangerous case.
 *
 * False-negative limits: this rule does NOT detect:
 * - Setters that reassign internal fields
 * - Methods named `setX` that mutate state
 * - Mutation through array/object methods on readonly fields
 *
 * Those are stretch goals; this rule catches the cheap, common mistake.
 */
export const noMutableStateInAggregate: LintRule = {
  id: RULE_ID,
  description:
    'Aggregate roots and entities must not expose mutable state. Use `private readonly` and ' +
    'mutate only inside event handlers via `apply()`.',
  run({ sourceFile, filePath }) {
    const issues: LintIssue[] = [];

    const visit = (node: ts.Node): void => {
      if (ts.isClassDeclaration(node) && isAggregateOrEntity(node)) {
        for (const member of node.members) {
          if (!ts.isPropertyDeclaration(member)) continue;
          const violation = inspectProperty(member);
          if (violation) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(
              member.getStart(sourceFile)
            );
            issues.push({
              ruleId: RULE_ID,
              severity: violation.severity,
              message: violation.message,
              file: filePath,
              line: line + 1,
              column: character + 1,
              fix: violation.fix,
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return issues;
  },
};

function isAggregateOrEntity(node: ts.ClassDeclaration): boolean {
  if (!node.heritageClauses) return false;
  for (const clause of node.heritageClauses) {
    if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
    for (const type of clause.types) {
      const expr = type.expression;
      // Match "extends AggregateRoot" or "extends Entity" — generic arguments
      // (`<TId>`) live on the type reference, not the expression, so this
      // covers both `extends AggregateRoot` and `extends AggregateRoot<string>`.
      if (ts.isIdentifier(expr) && (expr.text === 'AggregateRoot' || expr.text === 'Entity')) {
        return true;
      }
    }
  }
  return false;
}

interface PropertyViolation {
  severity: 'error' | 'warning';
  message: string;
  fix: string;
}

function inspectProperty(prop: ts.PropertyDeclaration): PropertyViolation | null {
  const modifiers = ts.canHaveModifiers(prop) ? (ts.getModifiers(prop) ?? []) : [];

  const hasReadonly = modifiers.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword);
  if (hasReadonly) return null;

  const accessibility = modifiers.find(
    m =>
      m.kind === ts.SyntaxKind.PrivateKeyword ||
      m.kind === ts.SyntaxKind.ProtectedKeyword ||
      m.kind === ts.SyntaxKind.PublicKeyword
  );

  const propName = ts.isIdentifier(prop.name) ? prop.name.text : '<computed>';

  if (!accessibility) {
    // Bare field — TypeScript defaults to public, which is the worst case
    // for an aggregate.
    return {
      severity: 'error',
      message:
        `Property "${propName}" has no accessibility modifier and defaults to public-mutable. ` +
        `Aggregate fields must be \`private readonly\` and mutated only inside event handlers.`,
      fix: `Change to \`private readonly ${propName} = ...\` and update via apply().`,
    };
  }

  const kind = accessibility.kind;
  if (kind === ts.SyntaxKind.PublicKeyword || kind === ts.SyntaxKind.ProtectedKeyword) {
    return {
      severity: 'error',
      message:
        `Property "${propName}" is mutable and externally reachable. Aggregate boundary requires ` +
        `\`private readonly\` for internal state.`,
      fix: `Change to \`private readonly ${propName} = ...\`. Expose via getter if needed.`,
    };
  }

  // private without readonly — emit as WARNING, not error. Event-sourced
  // aggregates legitimately reassign private fields inside event handlers
  // (`this.status = payload.status` in `apply('OrderShipped', ...)`), so this
  // pattern is not a hard violation. We still surface it because forgetting
  // `readonly` makes the "no external mutation" guarantee easier to break
  // accidentally elsewhere in the class.
  return {
    severity: 'warning',
    message:
      `Property "${propName}" is private but not readonly. Adding \`readonly\` documents that ` +
      `mutation only happens inside event handlers (assignments still work in handlers via type assertion).`,
    fix: `Prefer \`private readonly ${propName} = ...\` if mutation isn't needed; otherwise keep as-is and ignore this warning.`,
  };
}
