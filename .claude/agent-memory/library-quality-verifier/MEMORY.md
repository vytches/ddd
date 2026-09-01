# Memory Index

- [VB-003 F-C4 unit verdict](project_vb003_fc4_verdict.md) — multi-pass history,
  F-C4 and forRootAsync/D-5/D-7 sub-units now GO; type-check target caught
  dead-field usages Vitest missed
- [VB-003 F-M5/D-3 unit verdict](project_vb003_fm5_verdict.md) — pass 1 GO:
  BusRegistrationLedger + real configureContext() implemented correctly, real
  behavioral tests, 215/215 green
- [VP-006b adapter-core verdict](project_vp006b_adaptercore_verdict.md) — GO:
  registry-first resolve, lazy paramtypes cache, resolveDependency override all
  match approved decisions, no packages/di edits, 232/232 green
- [VF-040 final gate verdict](project_vf040_verdict.md) — NO-GO pass 1, GO pass
  2: combine's TError never inferred (falls back to `= Error`); expectTypeOf is
  a runtime no-op so only type-check catches it
- [config/packages.json core/cli](project_vf040_config_packages_json.md) —
  validate:exports was red on develop pre-VF-040 (stale core/cli entries);
  deletion is correct but leaves dangling deps refs
