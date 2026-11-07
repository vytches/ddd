import { guideUrl } from './docs-links';
import type { MessageSpec } from './format';

/**
 * Messages of the library-API rules, keyed by rule name and message id. Every message follows
 * the agent format of `format.ts`: what is wrong, why, `Fix:`, `See:`. Anchors point at
 * headings that exist in the package guides.
 */
export const RULE_MESSAGES = {
  'no-instanceof-result': {
    instanceofResult: {
      what: '`instanceof Result` is used to test a Result',
      why: 'Result class identity differs across bundles and duplicated package copies, so the check can be false for a genuine Result',
      fix: 'Use `result.isSuccess` / `result.isFailure`, or `Result.match()`',
      see: guideUrl('utils', 'anti-patterns'),
    },
  },
  'no-new-entity-id': {
    newEntityId: {
      what: '`new EntityId(...)` is called directly',
      why: 'the constructor does not validate the value or the id type, so an invalid identifier can enter the domain',
      fix: 'Use a static factory of `EntityId` from `@vytches/ddd-value-objects`: `EntityId.create()`, `EntityId.fromUUID(v)`, `EntityId.fromText(v)`, `EntityId.fromInteger(v)`, `EntityId.fromBigInt(v)`, or the Result-returning `EntityId.tryFromUUID(v)` and its siblings',
      see: guideUrl('value-objects', 'anti-patterns'),
    },
  },
  'no-deprecated-entity-id-factories': {
    deprecatedFactory: {
      what: '`EntityId.{{method}}()` is deprecated',
      why: 'it is kept only for backward compatibility and will be removed in the next major version',
      fix: 'Use `EntityId.{{replacement}}()` instead',
      see: guideUrl('value-objects', 'key-api'),
    },
  },
  'event-handler-requires-handle': {
    missingHandle: {
      what: 'Class `{{name}}` is decorated with `@EventHandler` but declares no `handle()` method',
      why: 'the event bus calls `handle(event)` on the registered instance, so dispatching the event fails at runtime',
      fix: 'Add `async handle(event): Promise<void>` to `{{name}}`, or put `@EventHandler(EventClass)` on a method instead of the class',
      see: guideUrl('events', 'quick-start'),
    },
  },
  'no-internal-imports': {
    internalSubpath: {
      what: '`{{source}}` is an internal entry point of `{{package}}`',
      why: 'internal subpaths exist only for sibling `@vytches/ddd-*` packages and can change or disappear without a semver bump',
      fix: 'Import from the public entry `{{package}}`; if the symbol is not exported there, it is not part of the consumer API and must not be depended on',
      see: guideUrl('contracts', 'anti-patterns'),
    },
    internalSymbol: {
      what: '`{{name}}` is an `@internal` symbol of `{{source}}`',
      why: 'it carries no semver guarantee and may be reshaped or removed without notice',
      fix: 'Remove the import; for library diagnostics use `configureDiagnostics()` instead of `internalLogger`',
      see: guideUrl('contracts', 'anti-patterns'),
    },
    deepSubpath: {
      what: '`{{source}}` reaches past the public entry of `{{package}}`',
      why: 'every symbol behind the package barrel is a private implementation detail with no compatibility promise',
      fix: 'Import from `{{package}}` instead; if the symbol is not exported there, do not depend on it',
      see: guideUrl('contracts', 'anti-patterns'),
    },
  },
  'policy-builder-required-calls': {
    missingCalls: {
      what: 'This `PolicyBuilder` chain calls `build()` without {{missing}}',
      why: '`build()` throws at runtime when the policy id, name or domain is missing',
      fix: 'Add {{calls}} before `build()`',
      see: guideUrl('policies', 'key-api'),
    },
  },
} as const satisfies Record<string, Record<string, MessageSpec>>;

/** Name of a rule that has messages. */
export type MessageRuleName = keyof typeof RULE_MESSAGES;
