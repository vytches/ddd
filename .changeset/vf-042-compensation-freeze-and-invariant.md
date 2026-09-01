---
'@vytches/ddd-resilience': patch
---

fix(resilience): freeze the compensation-failure list returned by
`CompensationStack.unwind()` (VF-042)

- `CompensationStack.unwind()` (and `runCompensated()`'s failure path) now
  return a genuinely frozen `CompensationFailure[]` at runtime, matching the
  `readonly` type that was already declared. Previously the array was a shared,
  mutable object handed out to every caller — a consumer that cast the
  `readonly` away could silently corrupt what every other caller of the same
  `unwind()` sees. Reference identity is unchanged (repeated `unwind()` calls
  still return the same array instance).
- Documents the invariant that confirmation must be the last operation in a
  compensated flow — see `LLMGUIDE.md`'s "Compensating for side effects outside
  the transaction" section for the full rule and a worked example. No new public
  API: the previously-requested invalidation method was deliberately not added
  (see
  `project-orchestration/completed-tasks/VF-042-stale-compensation-invalidation.md`).

**Behavioral BC checklist** (`docs/process/behavioral-bc-checklist.md`): not a
behavioral break. Any caller that only reads the returned array (the documented,
type-checked usage) observes no change. The only observable difference is for
code that already violated the declared `readonly` type by casting it away and
mutating — that code now gets a `TypeError` instead of silently corrupting
shared state. Pinned by a new regression test asserting `Object.isFrozen(...)`
on the result.
