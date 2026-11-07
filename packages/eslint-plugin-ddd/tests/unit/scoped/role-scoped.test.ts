import { Linter, type Rule } from 'eslint';
import * as tsParser from '@typescript-eslint/parser';
import { describe, expect, it } from 'vitest';
import { createRoleResolver } from '../../../src/resolver';
import { roleScoped } from '../../../src/scoped/role-scoped';

const AGGREGATE_IMPORT = `import { AggregateRoot } from '@vytches/ddd-aggregates';`;
const VALUE_OBJECT_IMPORT = `import { BaseValueObject } from '@vytches/ddd-value-objects';`;
const FILENAME = '/virtual/src/file.ts';

/** Reports every `throw` and every import of 'forbidden-lib'. */
const probeRule: Rule.RuleModule = {
  meta: { type: 'problem', messages: { hit: 'hit {{what}}' }, schema: [] },
  create(context) {
    return {
      ThrowStatement: node => context.report({ node, messageId: 'hit', data: { what: 'throw' } }),
      ImportDeclaration: node => {
        if (node.source.value === 'forbidden-lib') {
          context.report({ node, messageId: 'hit', data: { what: 'import' } });
        }
      },
    };
  },
};

function lint(code: string, rule: Rule.RuleModule): readonly string[] {
  const linter = new Linter({ configType: 'flat', cwd: '/virtual' });
  const messages = linter.verify(
    code,
    [
      {
        files: ['**/*.ts'],
        languageOptions: { parser: tsParser },
        plugins: { t: { rules: { probe: rule } } },
        rules: { 't/probe': 'error' },
      },
    ],
    { filename: FILENAME }
  );
  return messages.map(m => (m.fatal ? `FATAL ${m.message}` : `${m.line}:${m.message}`));
}

const resolver = createRoleResolver({ cwd: '/virtual', tsconfig: false });

describe('roleScoped', () => {
  const aggregateFile = [
    `import 'forbidden-lib';`,
    AGGREGATE_IMPORT,
    `export class Order extends AggregateRoot<string> {`,
    `  pay() { throw new Error('x'); }`,
    `}`,
    `export function helper() { throw new Error('y'); }`,
  ].join('\n');

  const valueObjectFile = [
    VALUE_OBJECT_IMPORT,
    `export class Money extends BaseValueObject<string> { f() { throw new Error('v'); } }`,
  ].join('\n');

  it('scope "class" keeps only reports inside a class of the role', () => {
    const rule = roleScoped(probeRule, 'Aggregate', { resolver });
    expect(lint(aggregateFile, rule)).toEqual(['4:hit throw']);
  });

  describe('scope "class" report positions', () => {
    interface Position {
      line: number;
      column: number;
    }
    const at = (line: number): Position => ({ line, column: 0 });

    /** Reports once per `Program`, building the descriptor from the visited ThrowStatement nodes. */
    function reportingRule(
      build: (throwNodes: readonly Rule.Node[]) => Rule.ReportDescriptor
    ): Rule.RuleModule {
      return {
        meta: { type: 'problem', messages: { hit: 'hit' }, schema: [] },
        create(context) {
          const throwNodes: Rule.Node[] = [];
          return {
            ThrowStatement: node => void throwNodes.push(node),
            'Program:exit': () => context.report(build(throwNodes)),
          };
        },
      };
    }

    /** Returns the visited throw node at `index`, failing loudly when the fixture changed. */
    function nodeAt(nodes: readonly Rule.Node[], index: number): Rule.Node {
      const node = nodes[index];
      if (!node) throw new Error(`fixture has no ThrowStatement at index ${index}`);
      return node;
    }

    const scoped = (base: Rule.RuleModule) => roleScoped(base, 'Aggregate', { resolver });

    it('keeps a loc-only report inside a class of the role', () => {
      const base = reportingRule(() => ({ messageId: 'hit', loc: at(4) }));
      expect(lint(aggregateFile, scoped(base))).toEqual(['4:hit']);
    });

    it('drops a loc-only report outside any class of the role', () => {
      const base = reportingRule(() => ({ messageId: 'hit', loc: at(6) }));
      expect(lint(aggregateFile, scoped(base))).toEqual([]);
    });

    it('accepts a loc given as a start/end range', () => {
      const inside = reportingRule(() => ({
        messageId: 'hit',
        loc: { start: at(4), end: { line: 4, column: 5 } },
      }));
      const outside = reportingRule(() => ({
        messageId: 'hit',
        loc: { start: at(6), end: { line: 6, column: 5 } },
      }));
      expect(lint(aggregateFile, scoped(inside))).toEqual(['4:hit']);
      expect(lint(aggregateFile, scoped(outside))).toEqual([]);
    });

    it('lets loc win over node: node outside the class, loc inside, report is kept', () => {
      // throwNodes[1] is the throw in `helper()` (line 6), outside the class.
      const base = reportingRule(nodes => ({
        messageId: 'hit',
        node: nodeAt(nodes, 1),
        loc: at(4),
      }));
      expect(lint(aggregateFile, scoped(base))).toEqual(['4:hit']);
    });

    it('lets loc win over node: node inside the class, loc outside, report is dropped', () => {
      // throwNodes[0] is the throw in `Order.pay()` (line 4), inside the class.
      const base = reportingRule(nodes => ({
        messageId: 'hit',
        node: nodeAt(nodes, 0),
        loc: at(6),
      }));
      expect(lint(aggregateFile, scoped(base))).toEqual([]);
    });

    it('uses the node position when no loc is given', () => {
      const inside = reportingRule(nodes => ({ messageId: 'hit', node: nodeAt(nodes, 0) }));
      const outside = reportingRule(nodes => ({ messageId: 'hit', node: nodeAt(nodes, 1) }));
      expect(lint(aggregateFile, scoped(inside))).toEqual(['4:hit']);
      expect(lint(aggregateFile, scoped(outside))).toEqual([]);
    });

    it('passes a report without any usable position to ESLint, which rejects it', () => {
      const base = reportingRule(() => ({ messageId: 'hit' }) as unknown as Rule.ReportDescriptor);
      expect(() => lint(aggregateFile, scoped(base))).toThrow(/Node must be provided/);
    });
  });

  it('defaults to scope "class"', () => {
    const explicit = roleScoped(probeRule, ['Aggregate'], { resolver, scope: 'class' });
    const implicit = roleScoped(probeRule, ['Aggregate'], { resolver });
    expect(lint(aggregateFile, implicit)).toEqual(lint(aggregateFile, explicit));
  });

  it('scope "file" runs the rule on the whole file when it has a class of the role', () => {
    const rule = roleScoped(probeRule, 'Aggregate', { resolver, scope: 'file' });
    expect(lint(aggregateFile, rule)).toEqual(['1:hit import', '4:hit throw', '6:hit throw']);
  });

  it.each(['class', 'file'] as const)('skips files without a class of the role (%s)', scope => {
    const code = `import 'forbidden-lib';\nexport class Plain { run() { throw new Error('z'); } }`;
    const rule = roleScoped(probeRule, 'Aggregate', { resolver, scope });
    expect(lint(code, rule)).toEqual([]);
  });

  it('skips a file whose class has a different role', () => {
    expect(lint(valueObjectFile, roleScoped(probeRule, 'Aggregate', { resolver }))).toEqual([]);
    expect(lint(valueObjectFile, roleScoped(probeRule, 'ValueObject', { resolver }))).toHaveLength(
      1
    );
  });

  it('accepts several roles', () => {
    const rule = roleScoped(probeRule, ['Aggregate', 'ValueObject'], { resolver });
    expect(lint(valueObjectFile, rule)).toHaveLength(1);
  });

  it('keeps a report inside a decorated class', () => {
    const code = [
      AGGREGATE_IMPORT,
      `function Deco(): ClassDecorator { return () => undefined; }`,
      `@Deco()`,
      `export class Order extends AggregateRoot<string> { f() { throw new Error('d'); } }`,
    ].join('\n');
    expect(lint(code, roleScoped(probeRule, 'Aggregate', { resolver }))).toEqual(['4:hit throw']);
  });

  it('accepts a resolver factory called with the rule context', () => {
    const seen: string[] = [];
    const rule = roleScoped(probeRule, 'Aggregate', {
      resolver: context => {
        seen.push(context.filename);
        return resolver;
      },
    });
    expect(lint(aggregateFile, rule)).toEqual(['4:hit throw']);
    expect(seen).toEqual([FILENAME]);
  });

  it('keeps the wrapped rule meta, overriding only the docs url, without mutating it', () => {
    const base: Rule.RuleModule = {
      meta: { type: 'problem', docs: { description: 'd', url: 'old' }, schema: [] },
      create: () => ({}),
    };
    const rule = roleScoped(base, 'Aggregate', { resolver, docsUrl: 'https://docs/x' });
    expect(rule.meta?.type).toBe('problem');
    expect(rule.meta?.docs).toEqual({ description: 'd', url: 'https://docs/x' });
    expect(base.meta?.docs?.url).toBe('old');
  });

  it('passes the rule options through to the wrapped rule', () => {
    let received: unknown;
    const base: Rule.RuleModule = {
      meta: { schema: [{ type: 'object' }] },
      create(context) {
        received = context.options;
        return {};
      },
    };
    const rule = roleScoped(base, 'Aggregate', { resolver });
    new Linter({ configType: 'flat', cwd: '/virtual' }).verify(
      `${AGGREGATE_IMPORT}\nexport class A extends AggregateRoot<string> {}`,
      [
        {
          files: ['**/*.ts'],
          languageOptions: { parser: tsParser },
          plugins: { t: { rules: { base: rule } } },
          rules: { 't/base': ['error', { a: 1 }] },
        },
      ],
      { filename: FILENAME }
    );
    expect(received).toEqual([{ a: 1 }]);
  });

  describe('construction errors', () => {
    it('rejects an empty role list', () => {
      expect(() => roleScoped(probeRule, [], { resolver })).toThrow(/at least one role/);
    });
    it('rejects a rule without create()', () => {
      expect(() => roleScoped({} as Rule.RuleModule, 'Aggregate', { resolver })).toThrow(/create/);
    });
    it('rejects an unknown scope', () => {
      expect(() =>
        roleScoped(probeRule, 'Aggregate', { resolver, scope: 'module' as never })
      ).toThrow(/scope/);
    });
  });
});
