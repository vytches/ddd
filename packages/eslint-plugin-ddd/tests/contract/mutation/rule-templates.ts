import type { RuleName } from '../../../src';

/**
 * How one symbol-based rule is exercised: the library symbol it tracks, a usage that must be
 * reported (`violations`) and usages of the same symbol that are fine (`valid`). Usages are
 * statements that refer to the symbol through `ref`; they must contain exactly one violation.
 */
export interface SymbolRuleTemplate {
  readonly rule: RuleName;
  readonly pkg: string;
  readonly symbol: string;
  readonly violations: readonly { readonly id: string; readonly usage: (ref: string) => string }[];
  readonly valid: readonly { readonly id: string; readonly usage: (ref: string) => string }[];
  /** Extra statements placed before the usage (a type or a class the usage needs). */
  readonly setup?: string;
}

export const SYMBOL_RULES: readonly SymbolRuleTemplate[] = [
  {
    rule: 'no-instanceof-result',
    pkg: '@vytches/ddd-contracts',
    symbol: 'Result',
    violations: [
      {
        id: 'instanceof',
        usage: ref => `const isResult = (value: unknown): boolean => value instanceof ${ref};`,
      },
      {
        id: 'instanceof-in-condition',
        usage: ref =>
          `function check(value: unknown): void {\n  if (value instanceof ${ref}) {\n    return;\n  }\n}`,
      },
    ],
    valid: [
      {
        id: 'instanceof-error',
        usage: () => `const isError = (value: unknown): boolean => value instanceof Error;`,
      },
      { id: 'static-use', usage: ref => `const ok = ${ref}.ok(1);` },
      { id: 'plain-reference', usage: ref => `const reference = ${ref};` },
    ],
  },
  {
    rule: 'no-new-entity-id',
    pkg: '@vytches/ddd-value-objects',
    symbol: 'EntityId',
    violations: [
      { id: 'new-two-args', usage: ref => `const id = new ${ref}('abc-123', 'text');` },
      { id: 'new-no-args', usage: ref => `const id = new ${ref}();` },
    ],
    valid: [
      { id: 'static-factory', usage: ref => `const id = ${ref}.fromText('abc-123');` },
      { id: 'new-other-class', usage: () => `const map = new Map<string, string>();` },
    ],
  },
  {
    rule: 'no-new-entity-id',
    pkg: '@vytches/ddd-contracts',
    symbol: 'EntityId',
    violations: [
      { id: 'new-contracts-entity-id', usage: ref => `const id = new ${ref}('abc-123', 'text');` },
    ],
    valid: [{ id: 'static-factory', usage: ref => `const id = ${ref}.fromText('abc-123');` }],
  },
  {
    rule: 'no-deprecated-entity-id-factories',
    pkg: '@vytches/ddd-value-objects',
    symbol: 'EntityId',
    violations: [
      { id: 'create-text', usage: ref => `const id = ${ref}.createText('abc-123');` },
      {
        id: 'create-uuid',
        usage: ref => `const id = ${ref}.createUuid('0b0e0a3e-6d57-4e6e-8d11-7a1b0b1f6a2c');`,
      },
      { id: 'create-integer', usage: ref => `const id = ${ref}.createInteger(7);` },
      { id: 'create-bigint', usage: ref => `const id = ${ref}.createBigInt(7n);` },
      { id: 'create-random-uuid', usage: ref => `const id = ${ref}.createWithRandomUUID();` },
      { id: 'reference-without-call', usage: ref => `const make = ${ref}.createText;` },
    ],
    valid: [
      { id: 'from-text', usage: ref => `const id = ${ref}.fromText('abc-123');` },
      {
        id: 'from-uuid',
        usage: ref => `const id = ${ref}.fromUUID('0b0e0a3e-6d57-4e6e-8d11-7a1b0b1f6a2c');`,
      },
      { id: 'create', usage: ref => `const id = ${ref}.create();` },
      {
        id: 'unrelated-create-text',
        usage: () => `const other: any = {};\nconst id = other.createText('x');`,
      },
    ],
  },
  {
    rule: 'no-deprecated-entity-id-factories',
    pkg: '@vytches/ddd-contracts',
    symbol: 'EntityId',
    violations: [
      { id: 'create-text-contracts', usage: ref => `const id = ${ref}.createText('abc-123');` },
    ],
    valid: [{ id: 'from-text-contracts', usage: ref => `const id = ${ref}.fromText('abc-123');` }],
  },
  {
    rule: 'event-handler-requires-handle',
    pkg: '@vytches/ddd-events',
    symbol: 'EventHandler',
    setup: `class SomeEvent {}`,
    violations: [
      {
        id: 'decorator-call',
        usage: ref => `@${ref}(SomeEvent)\nclass Handler {\n  other(): void {}\n}`,
      },
      { id: 'decorator-empty-class', usage: ref => `@${ref}(SomeEvent)\nclass Handler {}` },
      { id: 'decorator-bare', usage: ref => `@${ref}\nclass Handler {\n  other(): void {}\n}` },
      {
        id: 'decorator-with-options',
        usage: ref => `@${ref}(SomeEvent, { priority: 1 })\nclass Handler {\n  other(): void {}\n}`,
      },
    ],
    valid: [
      {
        id: 'has-handle',
        usage: ref => `@${ref}(SomeEvent)\nclass Handler {\n  handle(): void {}\n}`,
      },
      {
        id: 'has-async-handle',
        usage: ref => `@${ref}(SomeEvent)\nclass Handler {\n  async handle(): Promise<void> {}\n}`,
      },
      {
        id: 'handle-property',
        usage: ref => `@${ref}(SomeEvent)\nclass Handler {\n  handle = (): void => {};\n}`,
      },
      {
        id: 'handle-string-key',
        usage: ref => `@${ref}(SomeEvent)\nclass Handler {\n  'handle'(): void {}\n}`,
      },
      {
        id: 'extends-base',
        usage: ref => `class Base {}\n@${ref}(SomeEvent)\nclass Handler extends Base {}`,
      },
      { id: 'abstract-base', usage: ref => `@${ref}(SomeEvent)\nabstract class Handler {}` },
      { id: 'undecorated', usage: () => `class Handler {\n  other(): void {}\n}` },
    ],
  },
  {
    rule: 'policy-builder-required-calls',
    pkg: '@vytches/ddd-policies',
    symbol: 'PolicyBuilder',
    violations: [
      {
        id: 'create-only-id',
        usage: ref => `const built = ${ref}.create({}).withId('p').build();`,
      },
      { id: 'create-nothing', usage: ref => `const built = ${ref}.create({}).build();` },
      {
        id: 'create-no-config',
        usage: ref => `const built = ${ref}.create().withId('p').withName('n').build();`,
      },
      {
        id: 'create-with-condition',
        usage: ref =>
          `const built = ${ref}.create({}).withId('p').withName('n').withCondition(() => true).build();`,
      },
      {
        id: 'for-domain-missing-id',
        usage: ref => `const built = ${ref}.forDomain('d').withName('n').build();`,
      },
      {
        id: 'for-domain-missing-name',
        usage: ref => `const built = ${ref}.forDomain('d').withId('p').build();`,
      },
      {
        id: 'cast-inside-chain',
        usage: ref => `const built = (${ref}.create({}).withId('p') as any).build();`,
      },
    ],
    valid: [
      {
        id: 'create-complete-domain-call',
        usage: ref =>
          `const built = ${ref}.create({}).withId('p').withName('n').withDomain('d').build();`,
      },
      {
        id: 'create-default-domain',
        usage: ref =>
          `const built = ${ref}.create({ defaultDomain: 'd' }).withId('p').withName('n').build();`,
      },
      {
        id: 'create-config-from-variable',
        usage: ref =>
          `const config: any = {};\nconst built = ${ref}.create(config).withId('p').withName('n').build();`,
      },
      {
        id: 'for-domain-complete',
        usage: ref => `const built = ${ref}.forDomain('d').withId('p').withName('n').build();`,
      },
      {
        id: 'chain-split-across-variables',
        usage: ref => `const step = ${ref}.create({}).withId('p');\nconst built = step.build();`,
      },
      { id: 'no-build', usage: ref => `const builder = ${ref}.create({}).withId('p');` },
    ],
  },
];
