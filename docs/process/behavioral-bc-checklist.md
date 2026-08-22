# Behavioral Breaking-Change Checklist

> Source: `LIB-MATURITY-AUDIT-2026-08-08.analysis.md`, ranked action plan item
> 12 — "Behavioral-BC-without-signature-change checklist entry in review/CI
> process (both recent silent breaks were this class)." Proposed three times
> before this file existed; VF-036 is its first real consumer (see
> [Applied to VF-036](#applied-to-vf-036-2026-08-09) below).

## What this catches

A **behavioral breaking change with no signature difference**: a public method's
TypeScript type — parameters, return type, overload set — is identical before
and after, so type-checking, an API-surface snapshot test, and `tsc --noEmit` on
consumer code all stay green, yet an existing call site now produces a different
runtime result than it did before the change.

This class of defect is dangerous specifically _because_ every mechanical gate
this repo already runs (type-check, API-extractor `.api.md` diff,
`api-surface.test.ts`) is blind to it by construction — they compare shapes, not
behavior. The only way to catch it is a reviewer (human or agent) deliberately
asking the questions below, and a regression test that pins the _old_ behavior
for the no-opt-in path, not just a happy-path test of the _new_ behavior.

## Prior occurrences (why this list exists)

| #   | Defect                                                                                                              | What made it "no signature difference"                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | VB-003 / F-C4 — `forFeature()` DI wiring change that stopped a cross-context event leak                             | Same public `forFeature()` signature; the change was in _which handlers received which events_ at runtime, invisible to any type check.                                                                                                                                        |
| 2   | VP-009 Bug #3 — CQRS DI token bridge only wired inside `forRoot()`, not the other registration path                 | Same exported `COMMAND_BUS_TOKEN`/`QUERY_BUS_TOKEN` symbols and types; the break was in DI resolution behavior depending on _which_ setup path a consumer used.                                                                                                                |
| 3   | VF-036 (this task) — candidate: reusing the `getEqualityComponents()` name from 2025 docs for the new identity hook | Would have had an unchanged `equals()` signature; the risk was that ~179 already-declared, previously-dead consumer overrides would have started running simultaneously on upgrade. **Avoided** — see below.                                                                   |
| 4   | VF-023 — `BaseValueObject`'s constructor started calling `validate()`, which no released version had ever executed  | Same constructor signature, and consumers' `validate()` overrides were already declared — they had simply never run. A value object that used to construct successfully with invalid input now throws at construction. Announced as a `BREAKING CHANGE:` with migration notes. |

**Four cases, three different endings.** This table is calibration, not a
verdict — reaching it does not mean the change is breaking, it means the
classification has to be made explicitly:

- **#1 (VB-003 / F-C4)** and **#4 (VF-023)** — behavioral breaks, correctly
  classified and announced as `BREAKING CHANGE:` with migration notes.
- **#2 (VP-009 Bug #3)** — a behavioral break that shipped **silently**. The one
  to study: nothing in the type system, the CI gates, or the review flow said a
  word.
- **#3 (VF-036)** — the **counter-example**. Same shape as the others, but the
  design was deliberately reshaped during analysis so that the no-override path
  stays bit-for-bit identical, which made it a genuine additive minor with
  **no** `BREAKING CHANGE:` entry. Answering this checklist honestly is what
  produced that outcome; assuming a hit must mean "breaking" would have produced
  the wrong release classification.

#1, #2 and #4 all shipped before this checklist existed. #3 is the first case
run through it _before_ shipping.

## The checklist

Run this against any change to an existing public class/function where the
exported TypeScript signature is unchanged (or only additively widened — new
optional parameter, new optional interface field, new opt-in method with a
default that mirrors old behavior).

1. **Does any existing call site's return value or observable side effect change
   without that call site opting in via a new parameter, config flag, or
   override?** If yes, this is a behavioral break regardless of the type
   signature — it needs the same review weight as a signature-level breaking
   change (major bump, `BREAKING CHANGE:` entry, migration notes), not a quiet
   `feat`/`fix`.

2. **Is a new default value, or a newly-consulted hook, reachable without
   explicit consumer action?** A default flag flip (e.g. `enableCache: true` →
   `false`) or a hook that starts being _read_ where it was previously _ignored_
   both count, even if nothing was renamed.

3. **If this introduces or re-activates a hook/override point, has any released
   version of the library ever executed it?** Prove this from the actual shipped
   `dist/` output or compiled test history across released versions — not from
   current source, and not from "the docs don't mention it anymore." A name that
   only ever existed in documentation (never in source) is not automatically
   safe to reuse for something new: if consumers wrote code against the
   documented name, treat it as if it had been live, and pick a **different**
   name for the new, real behavior instead of reusing the phantom one.

4. **Does the change alter identity/equality/hashing/serialization semantics**
   for instances that may already be in the wild — cached, compared,
   deduplicated, persisted, or transmitted?

5. **Does the change alter iteration order, the type of error thrown, or
   sync-vs-async timing** (a previously-synchronous method becoming effectively
   asynchronous, or vice versa) for an existing public method?

6. **Is the pre-change ("no opt-in") code path preserved bit-for-bit, and is
   that pinned by an automated regression test** — not just re-reviewed by eye —
   asserting the _old_ behavior is unchanged when the new opt-in is absent?

7. **Does activating the new behavior require a symbol name that has never
   carried the old meaning for any known consumer?** If reusing a name that
   appeared in old docs/examples (even if never implemented in source), answer
   "no" and pick a new name — see item 3.

8. **Has this exact defect class occurred before in this repo?** Check the
   [Prior occurrences](#prior-occurrences-why-this-list-exists) table above and
   link the relevant entry/entries in the PR description.

9. **Is the release classification (additive `feat`/`fix` vs. `BREAKING CHANGE`)
   explicit in the PR description and CHANGELOG, and does it match what this
   checklist concluded** — not just what the TypeScript diff suggests?

10. **Is there a documented, permanent note preventing the same phantom name (if
    any) from being reintroduced later** by a future contributor who finds it in
    old docs, git history, or an external reference and assumes it should exist?

A change that answers "no" (or "additive, opted-in, proven by regression test")
to items 1–7 and satisfies items 8–10 can ship as an additive `feat`/`fix`. Any
"yes" on items 1, 2, 4, or 5 without an explicit consumer opt-in means this is a
behavioral breaking change and must be classified, versioned, and documented as
one, even though no TypeScript signature changed.

## Applied to VF-036 (2026-08-09)

| #   | Question                                                    | Answer for VF-036                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Existing call site behavior changes without opt-in?         | **No.** `getIdentityComponents()` defaults to `undefined`; `equals()`'s raw-comparison branch is reached for every class that does not override the hook and executes the exact pre-VF-036 code path.                                                                                                                                                                                                                              |
| 2   | New default/hook reachable without consumer action?         | **No.** The hook is only ever consulted via a call the base class already made to itself; it returns `undefined` unless a subclass overrides it, and no released subclass does (see item 3).                                                                                                                                                                                                                                       |
| 3   | Has any released version ever executed the reused name?     | **N/A — name was deliberately NOT reused.** The design considered reusing `getEqualityComponents()` (documented 2025, never implemented) and rejected it specifically because ~179 already-declared, previously-dead consumer overrides would have started executing simultaneously on upgrade. The new hook ships under the new name `getIdentityComponents()`, which no consumer has ever declared with equality-hook semantics. |
| 4   | Identity/equality semantics changed for existing instances? | **No** for any class not overriding the new hook — raw comparison is untouched. Classes that _do_ opt in get new, but explicitly requested, semantics.                                                                                                                                                                                                                                                                             |
| 5   | Iteration order / error type / sync-async timing changed?   | **No.** `equals()` remains synchronous and non-throwing on the raw-comparison path; a throwing `getIdentityComponents()` override only affects classes that added one.                                                                                                                                                                                                                                                             |
| 6   | No-opt-in path pinned by regression test?                   | **Yes.** The existing equality test corpus passes unmodified, plus new tests explicitly assert bit-for-bit raw-comparison behavior when the hook is absent.                                                                                                                                                                                                                                                                        |
| 7   | New behavior requires a name with no prior "old meaning"?   | **Yes** — see item 3.                                                                                                                                                                                                                                                                                                                                                                                                              |
| 8   | Prior occurrence of this defect class checked?              | **Yes** — VB-003/F-C4 and VP-009 Bug #3, both listed above; this task file itself was reframed mid-flight specifically to avoid becoming the third live instance.                                                                                                                                                                                                                                                                  |
| 9   | Release classification explicit and consistent?             | **Yes** — `feat(core)`, additive minor, no `BREAKING CHANGE:` entry, recorded consistently in the package CHANGELOG, root MIGRATION.md, README, and LLMGUIDE.                                                                                                                                                                                                                                                                      |
| 10  | Permanent anti-regeneration note present?                   | **Yes** — recorded in the value-objects README, LLMGUIDE, and package CHANGELOG: `getEqualityComponents` was a 2025 documentation error, was never implemented, and will not be added as an alias/shim/fallback.                                                                                                                                                                                                                   |

**Outcome: VF-036 passes this checklist as additive.** The no-override path is
unchanged, bit-for-bit, and the one path that could have made this a silent
behavioral break — reusing the phantom `getEqualityComponents` name — was
identified and deliberately avoided during design, before implementation began.
