import { RULE_MESSAGES } from '../messages';
import { unwrapExpression, expressionPath } from '../resolver/ast-model';
import type { AstNode } from '../resolver/types';
import { defineRule } from './shared/define-rule';
import { isLibraryExport } from './shared/symbols';

interface Chain {
  /** The `PolicyBuilder.create(...)` / `PolicyBuilder.forDomain(...)` call. */
  readonly root: AstNode;
  /** Names of the methods called on the builder, outermost first. */
  readonly methods: readonly string[];
}

function methodName(callee: AstNode): string | undefined {
  const property = callee['property'] as AstNode;
  return !callee['computed'] && property.type === 'Identifier'
    ? (property['name'] as string)
    : undefined;
}

/** Walks `a.b().c().d()` down to its first call; `undefined` when the chain is not plain calls. */
function readChain(call: AstNode): Chain | undefined {
  const methods: string[] = [];
  let current = call;
  for (;;) {
    const callee = unwrapExpression(current['callee'] as AstNode);
    if (callee?.type !== 'MemberExpression') return undefined;
    const name = methodName(callee);
    if (name === undefined) return undefined;
    const target = unwrapExpression(callee['object'] as AstNode);
    if (target?.type !== 'CallExpression') return { root: current, methods };
    methods.push(name);
    current = target;
  }
}

/**
 * `false` only when the config argument of `PolicyBuilder.create(config)` certainly lacks
 * `defaultDomain`. Anything that cannot be read statically counts as "may have it".
 */
function mayHaveDefaultDomain(root: AstNode): boolean {
  const config = unwrapExpression((root['arguments'] as AstNode[])[0]);
  if (!config) return false;
  if (config.type !== 'ObjectExpression') return true;
  return (config['properties'] as AstNode[]).some(p => {
    if (p.type !== 'Property') return true;
    const key = p['key'] as AstNode;
    return key['name'] === 'defaultDomain' || key['value'] === 'defaultDomain';
  });
}

/**
 * Opt-in rule (not in `recommended`): `PolicyBuilder` chain that calls `build()` without the
 * calls `build()` requires. Chains split across variables are not followed (the rule stays
 * silent rather than raise a false alarm).
 */
export const policyBuilderRequiredCalls = defineRule({
  name: 'policy-builder-required-calls',
  description:
    'Require `withId`, `withName` and a domain on a `PolicyBuilder` chain before `build()`.',
  messages: RULE_MESSAGES['policy-builder-required-calls'],
  create({ symbols, report }) {
    return {
      CallExpression(node) {
        const build = node as unknown as AstNode;
        const callee = build['callee'] as AstNode;
        if (callee.type !== 'MemberExpression' || methodName(callee) !== 'build') return;
        const target = unwrapExpression(callee['object'] as AstNode);
        if (target?.type !== 'CallExpression') return;
        const chain = readChain(target);
        if (!chain) return;

        const factory = unwrapExpression(chain.root['callee'] as AstNode);
        if (!factory || !expressionPath(factory)) return;
        const refs = symbols.libraryRefs(factory);
        const isCreate = isLibraryExport(refs, 'PolicyBuilder', ['create']);
        const isForDomain = isLibraryExport(refs, 'PolicyBuilder', ['forDomain']);
        if (!isCreate && !isForDomain) return;

        const called = new Set(chain.methods);
        const missing: string[] = [];
        if (!called.has('withId')) missing.push('withId');
        if (!called.has('withName')) missing.push('withName');
        if (isCreate && !called.has('withDomain') && !mayHaveDefaultDomain(chain.root)) {
          missing.push('withDomain');
        }
        if (missing.length === 0) return;
        report(build, 'missingCalls', {
          missing: missing.map(m => `\`${m}\``).join(', '),
          calls: missing.map(m => `\`.${m}()\``).join(', '),
        });
      },
    };
  },
});
