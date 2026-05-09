# Quickstart Validation — Friction Log

A running record of paper cuts found by `scripts/validate-quickstart.sh` runs.
Each entry: 1-line cause + 1-line fix + ticket reference.

The goal is **≤5 minutes** from a fresh environment to "16 passing tests" in
`examples/quickstart`. New friction must either be fixed or filed as an issue.

## Run history

### 2026-05-09 — initial validation (host mode)

- **Mode**: host (no Docker — workspace deps pre-installed)
- **Elapsed**: 1 second
- **Tests**: 16/16 passed
- **Status**: PASS (host mode is upper bound, not realistic)

**Friction**: none observed in host mode (everything cached).

---

### 2026-05-09 — Docker validation (PENDING)

- **Mode**: `node:22-alpine` Docker, fresh container
- **Status**: PENDING — to be run on the publish-ready branch by maintainer
- **Expected**: ~30s pnpm install + ~2s test execution = under 1 minute even on
  a cold machine

Friction items will be appended below as they're discovered.

## Known friction sources (pre-empted)

The following were checked + fixed during pre-release work:

| Source                                                                                  | Status | Ticket  |
| --------------------------------------------------------------------------------------- | ------ | ------- |
| `npx @vytches/ddd init-context` reference (broken binary)                               | Fixed  | REL-006 |
| `@vytches/ddd-testing` AI SDK peerDeps causing npm warnings                             | Fixed  | REL-007 |
| 3 fictional package references in README                                                | Fixed  | REL-006 |
| Saga section conflicting with "no sagas" decision                                       | Fixed  | REL-006 |
| Required tsconfig flags undocumented                                                    | Fixed  | REL-006 |
| `BaseValueObject.validate()` example showing broken pattern                             | Fixed  | REL-006 |
| `Specification.create` (made-up API) replaced with real `CompositeSpecification.create` | Fixed  | REL-006 |

## How to add an entry

After a `validate-quickstart.sh` run that surfaces an issue:

```markdown
### YYYY-MM-DD — {brief description}

- **Mode**: docker / host
- **Elapsed**: {seconds}
- **Tests**: {N/M} passed
- **Status**: PASS / FAIL / OVER_BUDGET
- **Friction observed**:
  - **{paper cut}**: {1-line cause}. **Fix**: {1-line fix}. Ticket: REL-XXX or
    [issue #N](https://github.com/vytches/ddd/issues/N).
```

## CI integration

Once published, run via `pnpm validate:quickstart` (root script — see
`package.json`) on every release PR. Failures block release. Currently a manual
script — automating in CI is a v0.26 task.
