---
'@vytches/ddd': minor
'@vytches/ddd-acl': minor
'@vytches/ddd-aggregates': minor
'@vytches/ddd-contracts': minor
'@vytches/ddd-cqrs': minor
'@vytches/ddd-di': minor
'@vytches/ddd-domain-primitives': minor
'@vytches/ddd-domain-services': minor
'@vytches/ddd-events': minor
'@vytches/ddd-logging': minor
'@vytches/ddd-messaging': minor
'@vytches/ddd-nestjs': minor
'@vytches/ddd-policies': minor
'@vytches/ddd-projections': minor
'@vytches/ddd-repositories': minor
'@vytches/ddd-resilience': minor
'@vytches/ddd-testing': minor
'@vytches/ddd-utils': minor
'@vytches/ddd-validation': minor
'@vytches/ddd-value-objects': minor
---

REL-004: Unified all packages to `0.25.0-beta.1` for first public release on
npmjs.org. Previous independent versioning (0.22.x – 0.24.5, plus a
`@vytches/ddd-nestjs@12.1.2` lapsus from copying NestJS peer-dep version) caused
confusion about API stability across the suite.

Going forward, the `fixed: [["@vytches/ddd", "@vytches/ddd-*"]]` group in
`.changeset/config.json` keeps every published package on the same version,
preventing drift. Examples and benchmarks are excluded via `ignore` since they
ship as workspace projects, not npm packages.
