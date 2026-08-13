## Summary

<!-- What does this PR change, and why? -->

## Checklist

- [ ] Tests added/updated for the change
- [ ] `pnpm format:check` / `pnpm lint:affected` / `pnpm type-check` pass
      locally
- [ ] If this PR adds or changes an `examples/*/` file,
      [`tools/example-matrix/expected-combinations.yaml`](../tools/example-matrix/expected-combinations.yaml)
      is updated to match (run `pnpm example-matrix:generate` and commit the
      regenerated `docs/coverage-matrix.json` / `docs/COVERAGE-MATRIX.md`)
- [ ] Breaking changes are documented and justified — including **behavioral**
      ones. Ask it directly: **does this change runtime behavior under an
      unchanged type signature?** If the exported signature is identical (or
      only additively widened), a green type-check and a clean api-surface diff
      prove nothing here — they compare shapes. Walk
      [`docs/process/behavioral-bc-checklist.md`](../docs/process/behavioral-bc-checklist.md)
      and state the conclusion in the Summary above. A "yes" does not
      automatically mean `BREAKING CHANGE:` — it means the classification must
      be explicit either way

## Test plan

<!-- How did you verify this change? -->
