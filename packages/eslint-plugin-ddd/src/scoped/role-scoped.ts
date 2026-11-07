import type { Rule } from 'eslint';
import type { RoleName } from '../roles';
import type { RoleResolver } from '../resolver';
import { reportStartIndex } from './report-position';
import type { ResolverSource, RoleScopedOptions } from './types';

type Range = readonly [number, number];

/**
 * Scopes any existing ESLint rule to classes of a DDD role.
 *
 * The wrapped rule is supplied by the caller (this module never imports ESLint at runtime, nor
 * its unexported built-in rules). A file without a class of `role` skips the rule entirely.
 * Otherwise:
 * - `scope: 'class'` (default): the rule runs, and only reports located inside a class of the
 *   role are kept;
 * - `scope: 'file'`: the rule runs unfiltered on the whole file.
 *
 * Library import rules must not be wrapped: an import can sit in a file with no role class.
 *
 * @example
 * ```ts
 * const noThrowInRole = roleScoped(noRestrictedSyntax, ['Aggregate', 'ValueObject'], { resolver });
 * ```
 *
 * @beta
 * @since 0.32.0
 */
export function roleScoped(
  rule: Rule.RuleModule,
  role: RoleName | readonly RoleName[],
  options: RoleScopedOptions
): Rule.RuleModule {
  const roles: readonly RoleName[] = typeof role === 'string' ? [role] : [...role];
  assertValid(rule, roles, options);
  const scope = options.scope ?? 'class';

  return {
    meta: {
      ...rule.meta,
      docs: {
        ...rule.meta?.docs,
        ...(options.docsUrl ? { url: options.docsUrl } : {}),
      },
    },
    create(context) {
      const ranges = roleClassRanges(context, resolverFor(options.resolver, context), roles);
      if (ranges.length === 0) return {};
      if (scope === 'file') return rule.create(context);
      return rule.create(filterReports(context, ranges));
    },
  };
}

function assertValid(
  rule: Rule.RuleModule,
  roles: readonly RoleName[],
  options: RoleScopedOptions
): void {
  if (typeof rule?.create !== 'function') {
    throw new TypeError('roleScoped: the wrapped rule must be an object with a create() function.');
  }
  if (roles.length === 0) {
    throw new TypeError('roleScoped: at least one role is required.');
  }
  if (options.scope !== undefined && options.scope !== 'class' && options.scope !== 'file') {
    throw new TypeError(
      `roleScoped: scope must be 'class' or 'file', got '${String(options.scope)}'.`
    );
  }
}

function resolverFor(source: ResolverSource, context: Rule.RuleContext): RoleResolver {
  return typeof source === 'function' ? source(context) : source;
}

function roleClassRanges(
  context: Rule.RuleContext,
  resolver: RoleResolver,
  roles: readonly RoleName[]
): readonly Range[] {
  const sourceCode = context.sourceCode;
  return resolver
    .classify(sourceCode.ast as never, context.filename, sourceCode.text)
    .filter(c => roles.some(r => c.roles.has(r)))
    .flatMap(c => (c.node.range ? [c.node.range] : []));
}

function filterReports(context: Rule.RuleContext, ranges: readonly Range[]): Rule.RuleContext {
  const sourceCode = context.sourceCode;
  const inside = (index: number) => ranges.some(([start, end]) => index >= start && index < end);
  return Object.create(context, {
    report: {
      value(descriptor: Rule.ReportDescriptor): void {
        const index = reportStartIndex(sourceCode, descriptor);
        // No usable position: let ESLint decide (it rejects descriptors without one).
        if (index === undefined || inside(index)) context.report(descriptor);
      },
    },
  }) as Rule.RuleContext;
}
