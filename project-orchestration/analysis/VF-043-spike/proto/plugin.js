'use strict';
// VF-043 AC-SPIKE (b) prototype: roleScoped adapter + one role-native rule, as a flat-config plugin.
const { builtinRules } = require('module').createRequire('/opt/projects/vytches-ddd/package.json')(
  'eslint/use-at-your-own-risk'
);

const classCache = new WeakMap();
function classesFor(context, resolver) {
  const ast = context.sourceCode.ast;
  if (!classCache.has(ast)) classCache.set(ast, resolver.classify(ast, context.filename));
  return classCache.get(ast);
}

// Wraps any rule so it only runs in files that contain a class of one of `roles`, and only keeps
// reports located inside such a class. Options after `roles` are passed to the wrapped rule.
function roleScoped(baseRule, { roles, resolver, docsUrl }) {
  return {
    meta: { ...baseRule.meta, docs: { ...(baseRule.meta && baseRule.meta.docs), url: docsUrl } },
    create(context) {
      const ranges = classesFor(context, resolver)
        .filter(c => roles.some(r => c.roles.has(r)))
        .map(c => c.node.range);
      if (!ranges.length) return {};
      const sc = context.sourceCode;
      const inside = idx => ranges.some(([a, b]) => idx >= a && idx < b);
      const proxy = Object.create(context, {
        report: {
          value(desc) {
            const idx = desc.node
              ? desc.node.range[0]
              : sc.getIndexFromLoc(desc.loc.start || desc.loc);
            if (inside(idx)) context.report(desc);
          },
        },
      });
      return baseRule.create(proxy);
    },
  };
}

// Role-native rule: classes of the given roles must not declare a public constructor.
function constructorNotPublic({ resolver, docsUrl }) {
  return {
    meta: {
      type: 'problem',
      docs: { url: docsUrl },
      schema: [{ type: 'object', properties: { roles: { type: 'array' } } }],
      messages: {
        publicCtor:
          '{{role}} "{{name}}" has a public constructor. Why: instances must be created through a factory that validates invariants. Fix: make the constructor private (or protected) and expose a static create(...) returning Result. See: {{url}}',
      },
    },
    create(context) {
      const roles = (context.options[0] && context.options[0].roles) || [];
      for (const c of classesFor(context, resolver)) {
        const role = roles.find(r => c.roles.has(r));
        if (!role || c.node.abstract) continue;
        const ctor = c.node.body.body.find(
          m => m.type === 'MethodDefinition' && m.kind === 'constructor'
        );
        if (ctor && ctor.accessibility !== 'private' && ctor.accessibility !== 'protected') {
          context.report({
            node: ctor,
            messageId: 'publicCtor',
            data: { role, name: c.name, url: docsUrl },
          });
        }
      }
      return {};
    },
  };
}

function createPlugin(resolver) {
  const docs = 'https://github.com/vytches/ddd/blob/main/packages/eslint-plugin-ddd/docs/rules';
  return {
    rules: {
      'no-throw-in-role': roleScoped(builtinRules.get('no-restricted-syntax'), {
        roles: ['Aggregate', 'ValueObject'],
        resolver,
        docsUrl: `${docs}/no-throw-in-role.md`,
      }),
      'command-handler-restricted': roleScoped(builtinRules.get('no-restricted-syntax'), {
        roles: ['CommandHandler'],
        resolver,
        docsUrl: `${docs}/command-handler-restricted.md`,
      }),
      'constructor-not-public': constructorNotPublic({
        resolver,
        docsUrl: `${docs}/constructor-not-public.md`,
      }),
    },
  };
}

module.exports = { roleScoped, constructorNotPublic, createPlugin, classesFor };
