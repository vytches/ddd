---
task: VF-036-value-object-equality-components
status: approved
threat_model: docs/security/threat-models/TM-VF-036.md
rag:
  skipped (no .claude/config/knowledge.json and no knowledge-retriever MCP in
  this project; additionally no .claude/knowledge/patterns/, no
  _stack-defaults/ and no .claude/knowledge/decisions/ exist here — steps
  0.5/0.6/0.7 ran in graceful-fallback mode. Substitute grounding used:
  6 narrow Explore agents (source, config, tests/docs, ADRs, internal call
  sites, process artifacts) + targeted Reads of base-value-object.ts,
  lib-utils.ts, TM-VF-023.md, root package.json.)
patterns:
  fallback — no canonical pattern cards exist in this repo. Grounding taken
  from .claude/rules/{common,typescript}/, the `ts-library-patterns` skill and
  CLAUDE.md's library rules (explicit-barrel exports, absolute backward
  compatibility, every exported symbol under test).
open_questions:
  - id: Q1
    blocking: true
    question: >-
      ROLLOUT SHAPE — the single decision everything else hangs on. (A) reuse
      the name `getEqualityComponents()` and honor it by default, as the task
      spec currently states: activates ~170 dormant consumer overrides on
      upgrade, silently unless the consumer compiles with noImplicitOverride.
      (C) ship the identical capability under a NEW name (e.g.
      `getIdentityComponents()`): purely additive, dormant overrides stay
      dormant, consumers migrate class-by-class with a greppable rename.
      (D) reuse the name but defer to the next major (1.0) — same blast radius,
      just later, and blocks the consumer indefinitely. Both the architect
      stage and the library-api-guardian stage independently recommend (C),
      each citing CLAUDE.md's absolute rule "All public API changes must
      maintain backward compatibility". The strongest counter to (C): the
      consumer wrote those overrides AS their intended equality semantics, so
      (A) plausibly fixes latent bugs rather than causing them, and the task
      already gates the npm tag on their full suite (AC-SIGNOFF).
      UPDATED after Q2 was measured — the balance is now a dominance argument,
      not a preference. For the known consumer BOTH options cost exactly one
      mechanical codemod over the same 171 sites (add `override` under A;
      rename under C) plus the same correctness audit of those overrides. The
      options therefore differ only in risk to consumers we cannot see: the
      phantom sat in our published READMEs from 2025-07-16 to 2026-05-23, so
      any other consumer who built on it and does NOT enable
      `noImplicitOverride` (off by default in TypeScript) gets silent
      activation under (A) and nothing at all under (C). Equal cost, strictly
      lower risk ⇒ (C) dominates. One new caveat introduced by (C): the rename
      CAN be staged, and a partially-renamed hierarchy is exactly the mixed
      population that triggers the Q9 non-transitivity. Ship the rename as a
      single atomic codemod, not class-by-class.
    answer: >-
      OPTION C (decided 2026-08-09). Ship the capability under a NEW name,
      `getIdentityComponents()`; `getEqualityComponents` is never implemented.
      D1 is accepted as written, including its three conditions: no
      compatibility shim delegating from the old name (that would be option A
      in disguise), and a permanent note in README/LLMGUIDE stating that
      `getEqualityComponents` was a 2025 documentation error and will not be
      implemented, so the phantom cannot regenerate. Q2(c) confirmed the name
      is collision-free downstream.
      CONSEQUENCE FOR THE RELEASE CLASSIFICATION — VF-036 ships as an ADDITIVE
      MINOR with NO `BREAKING CHANGE:` entry at all. The task spec's
      "⚠️ Behavioral-BC classification (mandatory)" section no longer applies
      and has been removed in the 2026-08-09 rewrite of the task file. Reason:
      under option C no existing code declares the new hook name, so it returns
      `undefined`, the components branch is skipped, and every consumer's
      behavior on upgrade is unchanged. The one candidate behavior change — the
      reflexivity guard fixing `NaN` self-inequality — was split out per the
      revised Q7 answer precisely to keep this true; any reflexivity shortcut
      that IS implemented must live inside the components branch only, so the
      raw path stays bit-for-bit identical. AC-MIGRATION therefore becomes a
      `feat(core):` CHANGELOG entry plus a MIGRATION.md section for
      consumers holding dead `getEqualityComponents` overrides, carrying the
      grep hint and the instruction to rename in ONE atomic codemod (per Q9).
      Versioning stays with Lerna — no hand-edited version fields.
      One residual, unavoidable for any new name: a consumer who already
      declares a member called `getIdentityComponents` and compiles with
      `noImplicitOverride` gets TS4114 at those sites. Zero occurrences in the
      known consumer (Q2c); worth one line in the release notes. It is a
      compile-time signal, not a runtime change, so it does not alter the
      classification.
      CONSEQUENCE FOR AC-SIGNOFF — the downstream full-suite sign-off stays, but its
      role changes: it is no longer the load-bearing safety gate for mass
      activation (option C removes that failure mode by construction, per the
      2026-08-09 correction in the threat model). It becomes validation that
      the new hook behaves correctly against a real corpus of migrated call
      sites. Still required before any npm tag.
      Q8(b) is unaffected — the behavioral-BC checklist still gets created,
      since the reflexivity change and the general defect class both warrant
      it.
  - id: Q2
    blocking: true
    question: >-
      DIAGNOSTIC FACTS about the downstream consumer's existing override sites,
      needed to size the blast radius of Q1. NOTE — none of these is a
      requirement we place on consumers: a library cannot influence a
      consumer's compiler flags (tsconfig is not inherited from a dependency),
      and we neither ship nor should ship a base config for them to extend.
      These are purely observations. (a) Is `noImplicitOverride` enabled? If
      yes, option (A) is not silent FOR THEM — a concrete base member makes
      every override site lacking the `override` keyword fail with TS4114.
      (b) Do any override sites use the arrow-property form (TS2425), declare
      it `private` (TS2415), or return a non-array (TS2416)? Those are hard
      compile breaks under option (A). (c) If (C) is chosen — does the proposed
      new name already occur in their codebase? A collision voids the option.
    answer: >-
      ANSWERED 2026-08-09 by direct inspection of the consumer repository.
      (a) `noImplicitOverride: true` and `strict: true` are set at the root
      tsconfig and not overridden by any of the three extending configs — the
      flag is ON everywhere. Under option (A) the hook is a CONCRETE base
      member, so every override site without the `override` keyword fails with
      TS4114.
      (b) Shape is uniformly clean — 179 declarations across 175 `.ts` files
      (plus ~40 non-declaration mentions: test titles, comments and explicit
      `this.getEqualityComponents()` calls). 171 are plain `protected` methods
      without `override`; 8 carry `override`. ZERO arrow-property, ZERO
      `private`, ZERO `public`/no-modifier, ZERO `abstract`, ZERO non-array
      returns. All 179 are explicitly annotated; return types are 120×
      `unknown[]`, 26× `string[]`, 15× `(string|number)[]`, 2× `any[]` and a
      tail of concrete unions — every one of them assignable to
      `readonly unknown[] | undefined`, so no covariance problem in either
      option. Therefore option (A) yields exactly 171 mechanical TS4114 errors
      and no pathological compile breaks.
      (c) The candidate name `getIdentityComponents` has ZERO occurrences
      anywhere in the consumer repository — option (C)'s precondition is met.
      Additional finding: there is a real consumer-side intermediate chain —
      BaseValueObject → a locale-specific identifier base (declares a CONCRETE
      `getEqualityComponents`, without `override`) → an abstract national
      identifier base (does not redeclare) → three concrete identifier VOs,
      which carry `override` because they override the consumer's own concrete
      member, not ours. Under (A) the intermediate base is one of the 171
      TS4114 sites; under (C) the whole chain is renamed together.
  - id: Q3
    blocking: true
    question: >-
      NESTED VALUE OBJECTS INSIDE COMPONENTS — scope call. The most common
      override shape is `return [this.street, this.city]` where those elements
      are themselves BaseValueObject instances. The task spec says "LibUtils.
      deepEqual per element", but deepEqual walks a nested VO's own properties
      and completely ignores its `equals()` — so a nested VO's own component
      logic is discarded and any subclass memo/cache field yields a false
      inequality. Fix requires a `componentEquals` helper (MUST BE CREATED)
      that dispatches to `.equals()` when both elements are value objects,
      detected via a `Symbol.for('@vytches/ddd.valueObject')` brand rather than
      `instanceof` (duplicate package copies break instanceof). Is this in
      scope for VF-036, or a follow-up? The panel's position: without it the
      feature is wrong for its most common use, so it belongs in VF-036.
    answer: >-
      IN SCOPE for VF-036 (accepted 2026-08-09, panel recommendation). Element
      comparison goes through a new `componentEquals` helper: if both elements
      carry the value-object brand, dispatch to their own `.equals()`;
      otherwise fall through to `LibUtils.deepEqual`. Detection uses a
      `Symbol.for('@vytches/ddd.valueObject')` marker on the base, NOT
      `instanceof` — duplicate package copies from a failed dedupe would break
      instanceof silently. Each element gets a fresh `visitedPairs` WeakMap.
      Rationale for keeping it in scope rather than deferring: `[this.street,
      this.city]` is the single most common override shape, and without this
      the feature returns wrong answers for it on day one.
  - id: Q4
    blocking: true
    question: >-
      THROW CONTRACT. `getEqualityComponents()` is consumer code now invoked
      from inside `equals()`, so a previously total predicate can throw —
      inside `list.some(x => x.equals(y))` in domain code, which the project's
      own rules say must not throw. Options: propagate (architect's
      recommendation — catching would hide real consumer bugs and costs a
      try/catch on a hot path) or catch-and-treat-as-unequal. Whichever is
      chosen must be documented and pinned by a test; the spec is currently
      silent, and the quality verifier will BLOCK on it being left implicit.
    answer: >-
      PROPAGATE (accepted 2026-08-09, panel recommendation). A throwing
      override is a genuine consumer bug; catching it would convert a loud
      failure into a wrong-but-silent equality result, which is the exact class
      of defect this whole task exists to clean up. It also avoids a try/catch
      on a hot path. Consequence to document explicitly in JSDoc, README and
      LLMGUIDE: `equals()` is no longer a total function — a component
      projection that throws propagates out of `equals()`, including out of
      `list.some(x => x.equals(y))`. Pin with a test asserting the throw
      propagates rather than being swallowed.
  - id: Q5
    blocking: true
    question: >-
      EMPTY-ARRAY SEMANTICS. An override returning `[]` means "defined, zero
      components", which under the same-length + element-wise rule makes every
      such instance equal to every other — including across unrelated types.
      It is also the natural output of a buggy override (`return this.parts ??
      []`, conditional pushes). Accept `[]` ⇒ equal (consistent reading, valid
      for unit/singleton VOs) with a documented warning and a pinning test, or
      treat `[]` as opt-out/error? Note: a runtime warning is rejected — equals
      is a hot path and the library logger is diagnostics-only. Related trap to
      document: an override returning `undefined` because a field is not yet
      initialised silently DOWNGRADES to raw comparison instead of failing.
    answer: >-
      `[]` ⇒ EQUAL, documented and pinned (accepted 2026-08-09, panel
      recommendation). It is the consistent reading of the same-length rule and
      legitimate for unit/singleton value objects. `undefined` remains the base
      default and the only opt-out, which is what keeps every non-overriding
      subclass bit-identical. No runtime warning on `[]` — `equals()` is a hot
      path and the library logger is diagnostics-only. Docs must call out two
      traps by name: (1) `[]` is the natural output of a buggy override
      (`return this.parts ?? []`, conditional pushes) and makes all instances
      of that class equal; (2) an override returning `undefined` because a
      field is not yet initialised silently DOWNGRADES to raw comparison
      instead of failing. Both get a pinning test. Also document the fixed-arity
      rule: a given class must always return the same number of components.
  - id: Q6
    blocking: true
    question: >-
      CROSS-SUBCLASS TYPE CHECK. `equals()` has no instanceof/constructor check
      today, and the existing test at
      `packages/value-objects/tests/base-value-object.test.ts:355-373`
      explicitly pins `baseVO.equals(extendedVO) === true` for the same raw
      value. The components path makes this worse in kind: `Temperature{celsius:
      20}` and `Distance{meters:20}` both project to `[20]` and become equal,
      where the raw path correctly returned false. Add a type check on the
      components path only (bifurcated semantics, fragile under duplicate
      package copies / minification), on both paths (a SECOND behavioral BC),
      or neither? Panel recommends NEITHER now: pin current behavior with a
      test, document the sanctioned discriminator idiom (a string literal such
      as `return ['Temperature', this.celsius]`, explicitly not
      `this.constructor.name` and not the class object), and open a follow-up
      to apply a type check uniformly at the next major.
    answer: >-
      NEITHER in VF-036 (accepted 2026-08-09, panel recommendation). Pin the
      current cross-subclass behavior with a test so it cannot drift silently —
      the existing assertion at
      `packages/value-objects/tests/base-value-object.test.ts:355-373` already
      fixes the raw-path case and must keep passing. Document the sanctioned
      discriminator idiom for consumers who DO want type-scoped equality: a
      string literal as the first component (`return ['Temperature',
      this.celsius]`), explicitly not `this.constructor.name` (minification
      unsafe) and not the class object (reference unsafe across duplicate
      package copies). Record "type-scoped equality" as an explicit non-goal in
      the task and open a follow-up to consider applying a type check to BOTH
      paths uniformly at the next major — half-applying it now buys
      inconsistency without buying safety.
  - id: Q7
    blocking: true
    question: >-
      REFLEXIVITY GUARD — bundle or split? Moving the hook in front of the
      `this.value === valueObject.value` fast path (which the architect argues
      is mandatory, otherwise the hook can never return false where it matters)
      removes the accidental reflexivity that fast path provided. A new `if
      (this === valueObject) return true;` guard is therefore required. It
      incidentally FIXES a pre-existing bug — a VO wrapping `NaN` is currently
      not equal to itself. Ship that fix inside VF-036 as an explicitly
      announced micro-behavior-change, or split it into its own task so the
      VF-036 diff stays single-purpose?
    answer: >-
      SPLIT OUT (decided 2026-08-09). This REVERSES an earlier answer in this
      same artifact, which said "bundle, because D2's reordering makes the
      guard mandatory". That reasoning was derived under option A and does not
      survive the Q1 decision. Under option C the hook carries a NEW name, so
      at ship time NO class overrides it: both sides return `undefined`, the
      components branch is skipped, and the raw path executes unchanged. An
      unconditional `this === valueObject` guard is therefore not required by
      anything — it is only a safety net against a non-deterministic override,
      and it can be scoped INSIDE the components branch, leaving the raw path
      bit-for-bit identical. (Even there it is optional: a deterministic
      override compares equal to itself anyway, and `NaN` components already
      work because `LibUtils.deepEqual` opens with `Object.is`.)
      Consequence: the `NaN`-self-inequality bug on the raw path is NOT fixed
      by VF-036 and becomes its own follow-up task, where it can be scheduled
      as the breaking change it genuinely is. This is what makes the whole of
      VF-036 non-breaking — see the release classification under Q1.
  - id: Q8
    blocking: true
    question: >-
      SCOPE BOUNDARY for three process/tooling artifacts that DO NOT EXIST
      today and that AC-DOCS/AC-MIGRATION implicitly assume. (a) `packages/value-objects/
      api-extractor.json` and `packages/value-objects/**/api-surface.test.ts`
      are both confirmed ABSENT, and root `validate:api` covers only
      events/contracts/enterprise — so AC-GATE's "api-surface snapshot updated" has
      no snapshot to update, and `test:contracts` runs with `--passWithNoTests`
      (silent green). Wire them up inside VF-036, or a separate task? (b) The
      behavioral-BC checklist from LIB-MATURITY-AUDIT item 12 is PROPOSED ONLY
      — no artifact anywhere in the repo — yet VF-036 was written as "the first
      consumer of it". Create it here, or carry an inline checklist and defer?
      (c) A `ddd-lint` rule flagging classes that extend BaseValueObject and
      declare a dead `getEqualityComponents` method (relevant only under option
      C) — the tool exists (`ddd:lint` → `tools/ddd-lint/src/cli.ts`), but
      whether VF-026 already scopes this pattern is UNVERIFIED.
    answer: >-
      (accepted 2026-08-09, panel recommendation — note this grows VF-036's
      scope beyond the original spec, deliberately.)
      (a) IN SCOPE, but NARROWED by a 2026-08-09 fact correction. Create
      `packages/value-objects/api-extractor.json` (genuinely absent — only
      events, contracts and enterprise have one) and append it to root
      `package.json`'s `validate:api` chain. Do NOT create an api-surface test:
      `packages/value-objects/tests/api-surface.test.ts` already exists, and the
      claim that `test:contracts` was green for this package only via
      `--passWithNoTests` was WRONG. The gate gap is real but different in
      shape: the existing test snapshots the named-export list, so a new
      `protected` member on `BaseValueObject` is invisible to it by design, and
      api-extractor does not run for this package at all. Caveat to state in the
      verification report: a clean api-surface diff is NOT evidence of safety
      for a behavioral break — api-extractor is a shape-diff tool.
      (b) IN SCOPE. Create the behavioral-BC checklist (LIB-MATURITY-AUDIT
      item 12) as a real artifact and apply it to VF-036 as its first consumer.
      It is a markdown document, not engineering work, and VF-036 is the third
      instance of this defect class after VB-003/F-C4 and VP-009 Bug #3 — a
      checklist that stays "proposed" through its third occurrence will not
      exist for the fourth.
      (c) FOLLOW-UP, not VF-036. A `ddd-lint` rule flagging classes that extend
      BaseValueObject and declare a dead `getEqualityComponents` method is only
      meaningful under option C, and `tools/ddd-lint/src/cli.ts` already exists
      as its home. Before opening it, verify whether VF-026 already scopes this
      pattern (still UNVERIFIED).
  - id: Q9
    blocking: true
    question: >-
      NON-TRANSITIVITY — accept as a documented limitation, or redesign? The
      asymmetric-fallback rule is provably SYMMETRIC (the both-defined
      predicate is a conjunction over an unordered pair) but provably NOT
      TRANSITIVE. Counterexample: Email('A@b.com') ~ Email('a@b.com') via
      case-insensitive components; Email('a@b.com') ~ LegacyEmail('a@b.com')
      via raw fallback; Email('A@b.com') !~ LegacyEmail('a@b.com'). Equality no
      longer partitions into classes, so `list.some(x => x.equals(y))` becomes
      dependent on which representative happens to be in the list. This fires
      whenever SOME but not all members of an equality domain override the hook
      — which is the normal state during a staged migration, and is imposed
      wholesale on the consumer under option (A). Accept + document + pin with
      a test (panel's position), or does this change the Q1 answer?
    answer: >-
      ACCEPT as a documented, tested limitation (accepted 2026-08-09, panel
      recommendation). It does not change the Q1 answer — it reinforces the
      migration shape chosen there. Non-transitivity is inherent to ANY
      opt-in-per-class equality hook with a fallback; the only alternatives are
      to remove the fallback (which would break every non-overriding subclass)
      or to refuse the feature. Required outputs: (1) the Email/LegacyEmail
      triangle as an explicit test, commented as a KNOWN ACCEPTED LIMITATION so
      a future contributor does not "fix" it; (2) a documented invariant — if
      any class in an equality domain provides components, all classes ever
      compared against it must too, which TypeScript cannot enforce; (3) the
      migration guidance from D1 — perform the rename as one atomic codemod,
      because a partially-migrated hierarchy IS the mixed population that
      triggers this.
  - id: Q10
    blocking: true
    question: >-
      TM-VF-036 sign-off. `docs/security/threat-models/TM-VF-036.md` was
      produced this run and is Status DRAFT with one Critical finding
      (TM-VF-036-002, DREAD 13, "dormant ~170-site mass activation on upgrade
      with no compiler signal"). Per the same rule TM-VF-023 followed, a
      Critical finding needs an assigned mitigation before DRAFT → APPROVED.
      The TM proposes treating existing AC-SIGNOFF (consumer full-suite sign-off
      before any npm tag) as load-bearing and non-skippable rather than adding
      a new control. Confirm that, and flip the TM to APPROVED.
    answer: >-
      CONFIRMED (accepted 2026-08-09), with one required correction to the TM
      before it flips. AC-SIGNOFF (downstream full-suite sign-off on a patched
      pre-release build, before any npm tag) is the assigned mitigation for
      TM-VF-036-002 and is non-skippable — no new control is invented.
      Correction: TM-VF-036-002 was written as "mass activation with NO
      compiler signal", which the Q2 measurement disproves for the known
      consumer — they compile with `noImplicitOverride: true`, so option (A)
      produces 171 TS4114 errors and option (C) produces none-and-no-activation.
      The finding survives but narrows to consumers who built on the phantom
      README and do NOT enable that flag (off by default in TypeScript), whose
      existence is plausible but unquantified. Discoverability is therefore
      partial rather than absent, and Reproducibility drops accordingly
      (DREAD 13 → 11, Critical → High). Under option (C) the finding is
      mitigated by construction rather than by process. Apply the correction,
      then flip DRAFT → APPROVED.
decisions:
  - id: D1
    decision: >-
      Ship under a NEW name (`getIdentityComponents()`) rather than reusing
      `getEqualityComponents` — rollout option C.
    rationale: >-
      CLAUDE.md states backward compatibility as an absolute project rule, not
      one gated by major-version-zero. Option A knowingly violates it by
      changing runtime semantics at ~170 consumer sites with no signature
      change and no repo gate able to detect it (confirmed: api-extractor does
      not cover value-objects; api-surface tests for the package do not exist;
      a shape-diff tool cannot see a semantics change anyway). Option C
      delivers the identical capability additively. Conditions: verify the new
      name has zero downstream occurrences (Q2c); do NOT ship a shim
      delegating to the old name (that is option A wearing a hat); document
      permanently that `getEqualityComponents` was a 2025 documentation error
      and will never be implemented, or the phantom regenerates.
    propose_adr: true
    adr_note: >-
      No ADR decides value-object equality semantics (39 numbered ADR files scanned).
      ADR-0030 (stability levels @stable/@experimental/@internal +
      api-extractor CI) is PROPOSED, not accepted, so an @experimental tag
      carries no force today and cannot be used to lower the BC bar here.
      ADR-0002 (Accepted) governs meta-package/semver plumbing and grants no
      0.x exception. Propose a new ADR covering (i) the VO equality extension
      point and (ii) the behavioral-BC-without-signature-change policy.
    supersedes_task_spec: true
  - id: D2
    decision: >-
      The hook is consulted BEFORE the `this.value === valueObject.value` fast
      path, and it is honored for primitive `T` as well as object `T`.
      NO unconditional `this === valueObject` reflexivity guard is added.
      CORRECTED 2026-08-09: the original wording of this decision required that
      guard, and was superseded by the revised Q7 answer. Any reflexivity
      shortcut must live INSIDE the components branch only, so the raw path
      stays bit-for-bit identical and the release stays non-breaking. An
      implementer receiving this decision must NOT add a guard at the top of
      `equals()`.
    rationale: >-
      The existing fast path is a VALUE-identity test, not an object-identity
      test: two distinct instances sharing a primitive or a frozen object
      reference can legitimately project to different components (type
      discriminator, subclass fields beyond `value`). If it ran first it would
      return true before the hook could return false — making the hook
      non-authoritative exactly where it matters. Restricting the hook to
      object `T` would create a rule invisible in the type system, and the most
      valuable overrides are on primitive-backed VOs (case-insensitive email,
      scaled money, normalized identifiers).
  - id: D3
    decision: >-
      Element comparison uses a new `componentEquals` helper (MUST BE CREATED),
      not bare `LibUtils.deepEqual`: value-object elements dispatch to their own
      `.equals()`, everything else falls through to deepEqual. Each element gets
      a FRESH `visitedPairs` WeakMap — never share it across elements.
    rationale: >-
      See Q3. Sharing the WeakMap across elements produces cross-element false
      negatives, because `LibUtils.deepEqual` uses `visitedPairs` as an
      unremoved memo, not only as a cycle guard.
  - id: D4
    decision: >-
      `undefined` = opt out (base default, keeps every non-overriding subclass
      bit-identical). `[]` = defined-and-empty ⇒ equal to any other
      `[]`-returning VO. Both pinned by tests; `[]` documented as a loaded gun.
    rationale: >-
      Consistent reading of the same-length rule and legitimate for
      unit/singleton VOs. No runtime warning: equals is a hot path and the
      library logger is diagnostics-only. Offer discovery as an opt-in
      test-time assertion helper instead (MUST BE CREATED).
  - id: D5
    decision: A throwing override propagates; `equals()` is no longer total.
    rationale: >-
      Catching would hide genuine consumer bugs and add try/catch cost to a hot
      path. Must be an explicit documented decision with a test, not an
      accident. Subject to Q4.
  - id: D6
    decision: >-
      No type check on the components path in VF-036. Pin the current
      cross-subclass behavior with a test, document the string-literal
      discriminator idiom, open a follow-up to consider a uniform type check at
      the next major.
    rationale: >-
      Half-applying a type check to one of two paths buys inconsistency without
      buying safety, and `this.constructor` comparison is fragile in a library
      (duplicate package copies, HMR, cross-realm, minification). Subject to Q6.
  - id: D7
    decision: >-
      The pre-existing `LibUtils.deepEqual` shared-reference false negative is
      a SEPARATE task, but VF-036 adds a pinning regression test for it and
      VF-036's own tests must avoid depending on shared references.
    rationale: >-
      `deepEqual({a: s, b: s}, {a: {x:1}, b: {x:1}})` returns false today
      because `visitedPairs` is never popped. It reproduces on the current
      `equals()` path already, so VF-036 neither introduces nor worsens it —
      but component arrays make it far more likely to be hit
      (`[this.range, this.range.start]`), so it must not be conflated with new
      hook logic at review time.
  - id: D8
    decision: >-
      Documentation work is larger than the task spec implies:
      `packages/value-objects/LLMGUIDE.md:61` is ALREADY WRONG today (claims
      "Structural equality by raw value (`===`)" — it has been
      `LibUtils.deepEqual` since VF-023) and must be corrected as part of this
      task.
    rationale: >-
      The docs-compile CI gate (`.github/workflows/ci.yml:239-243`,
      `pnpm docs-compile-gate:check`) only type-checks fences marked
      `compile-check`. It cannot catch a wrong prose claim and would NOT have
      caught the original `getEqualityComponents` phantom. New usage fences must
      be marked `compile-check`; prose accuracy still needs manual review, so
      the gate is necessary-but-not-sufficient here.
---

# VF-036 — Analysis (STOP1)

Panel run 2026-08-09, stack profile `typescript-library`: threat-model →
architect → library-api-guardian + library-quality-verifier → synthesis.

**Procedural notes.** (1) Steps 0.5/0.6/0.7 of `/analyze-ddd` assume
`.claude/knowledge/patterns/`, `_stack-defaults/`, `decisions/`, `preset.yml`
and `knowledge.json` — **none of these exist in this repo**, so pattern-card
injection, RAG retrieval and decision cards all ran in fallback mode (see
frontmatter `rag:`). (2) `Bash`, `Grep` and `Glob` were denied at the permission
layer for the whole session; every panel agent worked from targeted `Read`
calls, and several of them flagged reduced confidence as a result — the
UNVERIFIED list at the end of this document is longer than it would otherwise
be. (3) Synthesis was done by the main command rather than a separate
`@tech-lead` leaf, per the documented fallback: the main command already holds
every stage's full output, and an extra leaf adds interruption risk without new
information.

## What was verified in the source (trust these)

| Fact                                                                                                                                                                                                                                                                                                                                                                                                                                        | Location                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `abstract class BaseValueObject<T> implements ValueObjectValidator<T>`, `protected readonly value: T`                                                                                                                                                                                                                                                                                                                                       | `packages/value-objects/src/base-value-object.ts:7-124`                                                                                              |
| Constructor deep-freezes object values via `LibUtils.deepFreeze`, then throws if `validate()` fails                                                                                                                                                                                                                                                                                                                                         | same, `:30-39`                                                                                                                                       |
| `equals()` — null guard → `this.value === valueObject.value` → `LibUtils.deepEqual` for objects → `false`                                                                                                                                                                                                                                                                                                                                   | same, `:58-73`                                                                                                                                       |
| Only abstract member is `validate(value: unknown): boolean`; `getInvalidValueMessage` is the only other protected hook                                                                                                                                                                                                                                                                                                                      | same, `:104`, `:120-123`                                                                                                                             |
| `LibUtils.deepEqual` — `Object.is` fast path (so `NaN` components compare equal), cycle/memo `WeakMap`, `Date` by time, `RegExp` by string, `Map` recursive, **`Set` by `has()` ⇒ reference equality for object members**                                                                                                                                                                                                                   | `packages/utils/src/lib-utils.ts:259-332`                                                                                                            |
| `getEqualityComponents` — **ZERO occurrences anywhere in the repo**                                                                                                                                                                                                                                                                                                                                                                         | whole-repo search                                                                                                                                    |
| Entity/aggregate identity is NOT affected: `Entity.equals` and `AggregateRoot.equals` delegate to `this._id.equals()` → `EntityId`, which does **not** extend `BaseValueObject`                                                                                                                                                                                                                                                             | `packages/aggregates/src/core/entity.ts:83-88`, `.../aggregate-root.ts:191-196`, `packages/contracts/src/domain/entity-id.implementation.ts:117-119` |
| Existing equality corpus: ~6 equality tests, incl. one pinning cross-subclass same-value equality as `true`                                                                                                                                                                                                                                                                                                                                 | `packages/value-objects/tests/base-value-object.test.ts` (418 lines), `:108-117`, `:143-150`, `:176-185`, `:246-259`, `:355-373`                     |
| `validate:api` runs api-extractor for **events, contracts, enterprise only** — value-objects is not covered                                                                                                                                                                                                                                                                                                                                 | root `package.json:73`                                                                                                                               |
| `test:contracts` = `vitest packages/**/api-surface.test.ts --passWithNoTests` — **CORRECTED 2026-08-09**: `packages/value-objects/tests/api-surface.test.ts` DOES exist (19 such tests repo-wide), so this package is NOT green-by-`--passWithNoTests`. It snapshots `Object.keys(api).sort()` — the named-export list only — so it still cannot see a new `protected` member on `BaseValueObject`. Conclusion unchanged, reason different. | root `package.json:50`, `packages/value-objects/tests/api-surface.test.ts` (20 lines)                                                                |
| `ddd:lint` → `tools/ddd-lint/src/cli.ts packages` exists                                                                                                                                                                                                                                                                                                                                                                                    | root `package.json:85`                                                                                                                               |
| Docs-compile CI gate exists (`pnpm docs-compile-gate:check`, VD-005 AC11)                                                                                                                                                                                                                                                                                                                                                                   | `.github/workflows/ci.yml:239-243`                                                                                                                   |
| `LLMGUIDE.md:61` claims raw-`===` equality — already wrong since VF-023                                                                                                                                                                                                                                                                                                                                                                     | `packages/value-objects/LLMGUIDE.md`                                                                                                                 |
| No ADR decides VO equality (39 numbered ADR files); ADR-0030 and ADR-0029 are **Proposed**, ADR-0002 Accepted                                                                                                                                                                                                                                                                                                                               | `docs/adr/`                                                                                                                                          |

## Named symbols that DO NOT EXIST YET

Every one of these reads like an existing thing in the task spec or in panel
prose. None of them is in the repo — an implementer must **create** them. **All
of these were shipped in `c88e728e` except where noted**; the list is kept for
the record of what the state was before the task.

- `getIdentityComponents()` — **MUST BE CREATED** (zero occurrences).
  **CORRECTED 2026-08-09:** this bullet originally read
  "`getEqualityComponents()` / `getIdentityComponents()`", written before Q1
  picked a name. Read literally it instructs creating BOTH, which is option A
  wearing a hat. Only `getIdentityComponents` is ever implemented;
  `getEqualityComponents` is never created, aliased, shimmed or runtime-detected
  (D1, and a task non-goal).
- `componentEquals` element-comparison helper — **MUST BE CREATED** (D3).
- Value-object brand symbol (`Symbol.for('@vytches/ddd.valueObject')`) — **MUST
  BE CREATED**.
- ~~Test-time assertion helper for detecting dead/mixed overrides~~ — **NOT
  ADOPTED, do not build.** It was floated in D4's rationale as an alternative to
  a runtime warning, but no answer adopted it and the task lists "no
  auto-warning for override-exists-but-was-dead-code" as an explicit non-goal.
  Building it would add an unrequested export to the public surface of a release
  whose whole classification rests on being additive-only. _(Struck 2026-08-09;
  the bullet previously said MUST BE CREATED and "proposal only" in the same
  breath.)_
- `packages/value-objects/api-extractor.json` — **MUST BE CREATED** (confirmed
  absent).
- ~~`packages/value-objects/**/api-surface.test.ts`~~ — **ALREADY EXISTS**, at
  `packages/value-objects/tests/api-surface.test.ts`. **CORRECTED 2026-08-09**:
  the "absent" claim was made while Glob/Bash were denied and only the package
  root and `src/` were checked. Do NOT create it — extend it if needed. It is an
  export-name snapshot, so it is blind to protected members by design.
- Behavioral-BC checklist (LIB-MATURITY-AUDIT item 12) — **MUST BE CREATED**
  (proposed only, no artifact anywhere in `.github/`, `.claude/`, `docs/`,
  `scripts/`).
- expect-type / compile fixtures for value-objects — location **UNVERIFIED**,
  most likely **MUST BE CREATED**.

## Synthesis — what actually matters

**1. The task spec's core premise is contested by two independent stages.** The
spec chose to reuse the phantom name because "the hook name is already reserved
by our own historical docs" and it "matches what consumers already wrote". The
architect and the API guardian, reasoning separately, both reached option C (new
name) — not on aesthetics, but because CLAUDE.md states backward compatibility
as an absolute rule and no repo gate can detect this class of break. That is D1,
and it **supersedes the task spec**, so it needs an explicit human decision (Q1)
rather than quiet adoption. The counter-argument is real and rests on one
external fact (Q2): if the consumer compiles with `noImplicitOverride`, option A
stops being silent and becomes a ~170-error migration checklist — i.e. most of
C's benefit without asking anyone to rename anything.

**2. No gate in this repo would have caught this, and none would catch it now.**
`validate:api` does not cover `packages/value-objects` at all; `test:contracts`
DOES match a real file there (`tests/api-surface.test.ts` — corrected
2026-08-09, the earlier `--passWithNoTests` claim was wrong), but that test
snapshots the named-export list and is structurally blind to a new `protected`
member; api-extractor is a shape-diff tool and cannot see a semantics change
even where it does run; the docs-compile gate only type-checks marked fences and
is blind to prose. That is the structural finding behind the whole incident —
the phantom survived seven months precisely because nothing compared docs to
surface. Fixing it (Q8a) is arguably worth more than the feature.

**3. Two design defects the spec missed outright.** Nested value objects inside
component arrays are compared structurally, discarding their own `equals()` (Q3)
— this breaks the single most common override shape,
`return [this.street, this.city]`. And the asymmetric-fallback rule, while
symmetric, is **not transitive** (Q9), which makes `list.some(x => x.equals(y))`
order-dependent in exactly the mixed-population state that a staged migration
creates. Neither is a nit: the first makes the feature wrong for its main use,
the second breaks the equivalence-relation contract that consumer collection
code assumes.

**4. AC-CORE is weaker evidence than it sounds.** "Run the existing equality
test corpus unmodified" covers ~6 tests over primitives, flat objects and the
null guard. There is zero existing coverage of nested `Date`/`Map`/`Set`/`NaN`
inside a VO value. So an unmodified-corpus pass proves the primitive/flat slice
only; the deep slice has to be added net-new before it proves anything.

**5. Security.** `docs/security/threat-models/TM-VF-036.md` (DRAFT, written this
run) carries six findings, one Critical: mass activation of ~170 dormant
overrides with no compiler signal (DREAD 13). Notably, Denial-of-Service stops
being N/A here — unlike TM-VF-023, `equals()` now calls consumer code that can
throw or allocate on a hot path. The TM's position is that existing AC-SIGNOFF
(consumer full-suite sign-off before any npm tag) is the mitigation and must be
treated as non-skippable rather than inventing a new control (Q10).

## Risks (detail in the threat model — do not duplicate it here)

- **High** — dormant-override mass activation. **Removed by construction** once
  option C was chosen (Q1): the hook carries a new name, so nothing activates on
  upgrade for anyone. Rated 13/Critical in the TM's first draft, corrected to
  11/High per Q10 once the compiler-signal measurement landed. `AC-SIGNOFF`
  remains the assigned mitigation for the residual, and still blocks the npm
  tag. _(This bullet said "Critical … or removed entirely by choosing option C"
  until 2026-08-09; option C IS chosen, so the conditional was stale.)_
- **High** — identity narrowing: a consumer override that omits a discriminating
  field (tenant, scope, resource key) silently widens equality, and the library
  can neither see nor constrain what goes into components.
- **Medium** — mixed-population non-transitivity; `[]`-override universal
  equality; previously-total `equals()` can now throw or amplify CPU in
  `.some()` loops over large lists.
- **Low** — inherited `Set`-member reference-equality limitation from
  `LibUtils.deepEqual`, now also applying to component arrays.

## Verification gates the quality verifier will enforce (preview)

Both `nx run @vytches/ddd-value-objects:test` **and** `:type-check` (tsc —
Vitest/esbuild has previously missed signature regressions in this repo);
coverage ≥80% on touched files; ESM+CJS build with clean `.d.ts`;
`test:contracts`; corrected `LLMGUIDE.md` equality claim confirmed by eye, not
by the gate; `AC-SIGNOFF` recorded. Leaving the throw contract (Q4) or the
asymmetric-presence behavior untested is itself a block.

**Do NOT gate on `pnpm validate:api` (added 2026-08-09, learned the hard way).**
Two reasons. First, that chain is **already red before this task starts** — it
aborts inside the `enterprise` config on an api-extractor internal error in
`packages/aggregates`, so value-objects is never reached and a verifier reading
the failure will misattribute it. Run the single config instead:
`npx api-extractor run --local --config packages/value-objects/api-extractor.json`.
Second, every config uses `--local`, which **overwrites** committed `api-report`
baselines rather than diffing against them, so merely running the gate dirties
two unrelated packages and looks like scope contamination at review time. Both
are recorded as follow-ups in the task file. And whichever way it is run: a
clean api-surface diff is **not** evidence of safety for a behavioral break, and
must be reported as such rather than as a pass.

## Test matrix an implementer must add

Default path: both sides `undefined` → byte-identical to current behavior, plus
the existing six tests still green. Core: both defined and equal; one element
differs; length mismatch both directions; `[]` vs `[]`; asymmetric override
tested in **both** call directions. Nested semantics: `Date`, `Map`, `Set`,
`NaN` inside components; a component that is itself a value object (D3).
Robustness: throwing override (per Q4); the non-transitivity triangle pinned as
a known limitation with a comment so nobody "fixes" it later; cross-subclass
same components (Q6); `0`/`-0`.

**Removed 2026-08-09: `NaN` self-equality (Q7).** This line asked for a test
that CANNOT pass under the shipped design, and it cited Q7 as its authority
while Q7 says the opposite. A VO wrapping `NaN` is not equal to itself on the
raw path, and the only way to make such an assertion green is the unconditional
`this === valueObject` guard that Q7 explicitly split out and that D2 forbids —
reintroducing it would make the release breaking and invalidate Q1's whole
classification. The `NaN` coverage that DOES belong here is `NaN` **inside
components**, listed under Nested semantics above. Left in place, this line was
a live instruction to undo the task's central constraint.

Type fixtures: negative fixtures for the arrow-property form (TS2425), `private`
narrowing (TS2415) and non-array returns (TS2416). In `packages/utils/tests/`: a
pinning repro for the shared-reference false negative (D7).

## Open questions — ALL ANSWERED (2026-08-09)

Ten blocking questions were recorded in the frontmatter; every one now carries
an `answer`, and `status` is `approved`. Q1 (rollout shape) and Q2 (the
downstream `noImplicitOverride` / override-shape facts) gated all the others —
choosing option C changed the framing of Q8c and softened Q9. Nothing here is
still open. _(answers live in the frontmatter only)_

## Decisions — ACCEPTED (2026-08-09)

D1–D8 in the frontmatter, all **accepted**. D1 superseded the task spec's stated
design; the task file was rewritten to match on 2026-08-09, so
`D1.supersedes_task_spec` is now history rather than a pending action. D2–D6 are
refinements the spec left under-specified — note D2 carries a
`CORRECTED 2026-08-09` clause where its original wording was superseded by the
revised Q7. D7 and D8 expand what "done" means for testing and docs. D4's
floated test-time assertion helper was NOT adopted (see the struck bullet
above).

## Verification status of the "UNVERIFIED" list

The list below was written while `Bash`, `Grep` and `Glob` were denied. Each
item was resolved on 2026-08-09 once tools were available:

- `packages/utils/tests/lib-utils.test.ts` — **RESOLVED.** It exists; VF-036
  adds a pinning test for the `deepEqual` shared-reference false negative to it.
- expect-type fixtures under `packages/value-objects` — **RESOLVED: none
  existed.** `expectTypeOf` appeared nowhere under `packages/`. VF-036 created
  `tests/base-value-object.identity-components.type-fixtures.test.ts`.
- Other internal `BaseValueObject` subclasses / `.equals()` call sites — **STILL
  NOT EXHAUSTIVELY ESTABLISHED.** The Entity/AggregateRoot/EntityId path is
  confirmed unaffected, and the full suite across all 26 projects is green,
  which is strong evidence but not a proof of absence. Treat "no other internal
  callers" as unproven.
- VF-026 scoping a dead-override lint rule — **RESOLVED as locatable:** VF-026
  is completed and lives in
  `project-orchestration/completed-tasks/VF-026-ddd-lint-anti-pattern-rules.md`.
  Whether it already covers this pattern still needs a read before the follow-up
  is opened.
- Everything in Q2 — **RESOLVED** by direct inspection of the consumer
  repository; see the Q2 answer.

## Known accuracy defects in this artifact (audited 2026-08-09)

Recorded rather than silently patched, because the pattern matters more than the
individual slips. Three audits were run against the real repo after
implementation. The **fact table above held up** — every line anchor and every
root `package.json` script claim was exact. What failed was the **joins between
documents**: claims restated in the frontmatter, the body, the task file and the
threat model, where updating one left the other three stale.

Corrected in place: the `api-surface.test.ts` absence claim and the
`--passWithNoTests` claim (both wrong); D2 contradicting the revised Q7; the
`NaN` self-equality line in the test matrix; the `getEqualityComponents()` /
`getIdentityComponents()` slash in the MUST-BE-CREATED list; D4's unadopted
helper; every ordinal `ACn` reference, now pointing at stable IDs; the stale
Critical rating in Risks; the test file's line count (418, not 419) and the ADR
count (39 numbered files, not 38).

One that cannot be fixed by editing, only by not repeating: the row asserting
"`getEqualityComponents` — ZERO occurrences anywhere in the repo | whole-repo
search" sat inside the block headed **"trust these"**, while the procedural note
two sections down states that `Grep` was denied for the entire session. The
engineering conclusion survives — there are zero occurrences in `packages/`,
`docs/`, `.github/`, `scripts/` and `tools/`; the 12 real hits are all in
`project-orchestration/` prose — but the claim describes a search that could not
have been performed. **The failure was confidence labelling, not fact-finding**,
and that is the worse of the two, because it removes the reader's ability to
know which parts to trust.
