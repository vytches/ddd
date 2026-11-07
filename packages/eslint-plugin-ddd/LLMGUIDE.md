# @vytches/eslint-plugin-ddd - LLM Guide

## Purpose

ESLint plugin (flat config only, ESLint `^9.39.0 || ^10.0.0`) for projects built
on `@vytches/ddd`. It reports incorrect use of the library API, resolves DDD
roles by import source, and offers an agent lane (`/agent`) so a project hook
can return findings to a coding agent. Beta: `@beta` symbols may change in a
minor release.

## Quick Start

```ts
import { configs } from '@vytches/eslint-plugin-ddd';
```

```js
// eslint.config.mjs
import tsParser from '@typescript-eslint/parser';
import { configs } from '@vytches/eslint-plugin-ddd';

export default [
  { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
  configs.recommended,
];
```

All exports are named; there is no default export. The plugin namespace is
`ddd`.

## Key API

| Export                                               | Stability | Purpose                                                                             |
| ---------------------------------------------------- | --------- | ----------------------------------------------------------------------------------- |
| `plugin`                                             | beta      | `{ meta, rules, configs }` object for flat config `plugins`                         |
| `configs.recommended`                                | beta      | Flat config object enabling the recommended rules (no parser, files)                |
| `rules`, `meta`                                      | beta      | Rule map and plugin metadata                                                        |
| `roleScoped(rule, role, opts)`                       | beta      | Aims any ESLint rule at classes of a role (`scope: 'class' \| 'file'`)              |
| `resolveRole({ resolver, program, filename, node })` | beta      | Roles of one class node                                                             |
| `createRoleResolver(opts)`                           | beta      | Builds a role resolver (bindings, tsconfig, depth)                                  |
| `resolverFromSettings`, `createSettingsResolver()`   | beta      | Resolver provider that reads `settings.ddd` of a rule context                       |
| `validateRoleConfig({ cwd, countRoles? })`           | beta      | Gate check: unresolved bindings, roles that match no class; `roleCounts` on request |
| `DddConfigError`, `parseSettings`, `SETTINGS_KEY`    | beta      | Configuration errors and shape validation of `settings.ddd`                         |
| `createAgentLinter(opts)` (`/agent`)                 | beta      | `lintText(text, filePath)` returning `ok \| skipped \| parse-error \| config-error` |
| `newFindings(before, after)` (`/agent`)              | beta      | Findings in `after` that `before` does not account for                              |

`settings.ddd` keys: `bindings`, `tsconfig`, `includeLibraryRoles`, `maxDepth`.
A binding is `{ role, extends?, implements?, decorator?, files?, implies? }`
where each target is `{ from, name }`: `from` is a package name or a project
file ending in `.ts`/`.tsx`/`.mts`/`.cts` (relative to the project root), `name`
is the exported name.

## Rules

| Rule                                    | Severity | `recommended` |
| --------------------------------------- | -------- | ------------- |
| `ddd/no-instanceof-result`              | error    | yes           |
| `ddd/no-deprecated-entity-id-factories` | warn     | yes           |
| `ddd/event-handler-requires-handle`     | error    | yes           |
| `ddd/no-internal-imports`               | error    | yes           |
| `ddd/no-new-entity-id`                  | error    | no (opt-in)   |
| `ddd/policy-builder-required-calls`     | error    | no (opt-in)   |

Every rule accepts `{ id, fix, see }`. Messages follow
`<what>. <why>. Fix: ... See: ...`.

## Role vocabulary

A role is decided by a binding (package + exported name), not by a class name.
`marker: library` means the library ships a detectable class-level marker;
`binding-required` roles exist only through a project binding (custom roles).
Every built-in role below is `library`.

| Role               | Kind        | Marker  | Bases (`extends` / `implements`)                                                                                                                                               | Decorators                                       |
| ------------------ | ----------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `Aggregate`        | tactical    | library | `AggregateRoot` (`@vytches/ddd-aggregates`)                                                                                                                                    | -                                                |
| `Entity`           | tactical    | library | `Entity` (`@vytches/ddd-aggregates`)                                                                                                                                           | -                                                |
| `ValueObject`      | tactical    | library | `BaseValueObject` (`@vytches/ddd-value-objects`)                                                                                                                               | -                                                |
| `DomainEvent`      | tactical    | library | `DomainEvent` (`@vytches/ddd-events`)                                                                                                                                          | -                                                |
| `IntegrationEvent` | integration | library | `IntegrationEvent` (`@vytches/ddd-events`)                                                                                                                                     | -                                                |
| `Command`          | cqrs        | library | `ICommand` (`@vytches/ddd-cqrs`)                                                                                                                                               | -                                                |
| `Query`            | cqrs        | library | `IQuery` (`@vytches/ddd-cqrs`)                                                                                                                                                 | -                                                |
| `CommandHandler`   | cqrs        | library | `ICommandHandler` (`@vytches/ddd-cqrs`)                                                                                                                                        | `CommandHandler` (`@vytches/ddd-cqrs`)           |
| `QueryHandler`     | cqrs        | library | `IQueryHandler` (`@vytches/ddd-cqrs`)                                                                                                                                          | `QueryHandler` (`@vytches/ddd-cqrs`)             |
| `EventHandler`     | cqrs        | library | `IEventHandler` (`@vytches/ddd-contracts`)                                                                                                                                     | `EventHandler` (`@vytches/ddd-events`)           |
| `DomainService`    | tactical    | library | `PlainDomainService`, `IBaseDomainService`, `EventAwareDomainService`, `UnitOfWorkAwareDomainService`, `AsyncDomainService`, `IDomainService` (`@vytches/ddd-domain-services`) | `DomainService` (`@vytches/ddd-domain-services`) |
| `Repository`       | tactical    | library | `IBaseRepository`, `IRepository` (`@vytches/ddd-repositories`); `IRepository`, `ICQRSRepository` (`@vytches/ddd-contracts`)                                                    | -                                                |
| `Specification`    | tactical    | library | `CompositeSpecification`, `AsyncCompositeSpecification` (`@vytches/ddd-validation`); `ISpecification` (`@vytches/ddd-contracts`)                                               | -                                                |
| `Policy`           | tactical    | library | `BaseBusinessPolicy`, `BaseCompositePolicy`, `IBusinessPolicy` (`@vytches/ddd-policies`)                                                                                       | -                                                |
| `ACLAdapter`       | integration | library | `BaseACLAdapter`, `SimpleACLAdapter` (`@vytches/ddd-acl`)                                                                                                                      | -                                                |

The meta-package `@vytches/ddd` re-exports every library package; a symbol
imported from it is the same symbol as in its home package. A project role can
`implies` library roles (a custom `AuditedAggregate` that implies `Aggregate`).

## Common Patterns

Bind a project base class:

```js
settings: {
  ddd: {
    bindings: [{ role: 'Aggregate', extends: { from: 'src/shared/base.aggregate.ts', name: 'BaseAggregate' } }],
  },
}
```

Project rule on a role (the rule is yours; the plugin only scopes it):

```js
roleScoped(noRestrictedSyntaxRule, 'Aggregate', {
  resolver: resolverFromSettings,
  scope: 'class',
});
```

Agent hook (project policy decides deny / block / inform):

```js
import { createAgentLinter } from '@vytches/eslint-plugin-ddd/agent';

const result = await createAgentLinter({ config }).lintText(
  proposedText,
  filePath
);
if (result.status === 'ok' && result.findings.length > 0) {
  /* report result.findings */
}
```

## Anti-Patterns

- Wrapping the library import rules (`no-internal-imports`) in `roleScoped`: an
  import can sit in a file with no role class, so the rule would miss most
  violations.
- Binding a role to a class name or a file path convention instead of the base
  class or decorator.
- Pointing a binding at a file or export that does not exist: the run fails with
  `DddConfigError`.
- Expecting the agent lane to see warnings: it reports errors only unless
  `minSeverity: 'warn'`.
- Using ESLint `--cache` with the agent lane: resolver state would be stale.
- Relying on `eslint-disable` to silence the agent lane: inline config is
  ignored by default (`noInlineConfig: true`); a blocked agent has no way out
  unless the project sets it to `false`.
- Using the preset on destructured statics (`const { createText } = EntityId`),
  dynamic aliases or a `PolicyBuilder` chain split across variables: the rules
  stay silent there.

## Related

- [`README.md`](./README.md)
- [`docs/rules/`](./docs/rules)
- `@vytches/ddd-contracts`, `@vytches/ddd-events`, `@vytches/ddd-cqrs` (the
  symbols the roles bind to)
