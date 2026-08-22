---
task: VF-030
task_file: project-orchestration/tasks/VF-030-di-token-identity.md
status: approved
created: 2026-07-11
approved_at: 2026-07-11
approved_by: human (accepted all panel recommendations verbatim)
panel:
  threat-model (ecc:security-reviewer) → architect (ecc:architect) ∥ TM →
  library-api-guardian → tech-lead (synthesis)
threat_model: docs/security/threat-models/TM-VF-030.md
rag:
  - ? skipped (no .claude/config/knowledge.json in project; knowledge-retriever
      MCP not connected this session — fallback
    : targeted Explore agents over code + claude-patterns source repo)
patterns:
  - typescript-library/backward-compatibility-pattern.md
  - typescript-library/public-api-pattern.md
  - typescript-library/package-boundary-pattern.md
  - typescript-library/library-testing-pattern.md
  # NOTE: .claude/knowledge/patterns/ symlink is BROKEN in this checkout; Rule Cards
  # were loaded from /opt/projects/claude-patterns/patterns/typescript-library/.
  # _stack-defaults always_include also lists cross-layer/conventions-pattern.md —
  # not loaded (broken symlink), low relevance to this internal-keying bugfix.
open_questions:
  - id: Q1
    question: >-
      Token identity model: pure reference identity (Map keyed by
      constructor/symbol reference, string tokens by value) with documented
      Symbol.for() guidance for dual-ESM/CJS and cross-context tokens — or
      ADR-0034-style secondary `.name` string fallback on reference miss? Threat
      model M1 suggested the fallback; architect AND api-guardian both reject it
      (a name fallback reintroduces exactly the UX-C4 collision on the fallback
      path). Panel verdict: pure reference identity. Confirming this also flips
      TM-VF-030 DRAFT → ACCEPTED.
    recommendation:
      Pure reference identity + Symbol.for guidance (no name fallback).
    answer: >-
      Pure reference identity + Symbol.for() guidance; no `.name` fallback. TM
      M1 rejected per panel verdict; TM-VF-030 moves DRAFT → ACCEPTED.
  - id: Q2
    question: >-
      Fate of `BaseContainerAdapter.protected getTokenKey` — it is a DOCUMENTED
      public extension point (packages/di/FRAMEWORK-ADAPTERS.md, 8 occurrences,
      teaches Inversify/TSyringe/Awilix integrators to subclass and call it;
      exercised by packages/di/tests/adapters/base-adapter.test.ts). Silent
      deletion breaks the documented contract. Keep as thin
      describeToken()-backed deprecated wrapper, or remove outright
      (pre-first-publish, saves deprecation-docs work)?
    recommendation: >-
      Deprecate + keep thin wrapper backed by describeToken(); update
      FRAMEWORK-ADAPTERS.md in the same PR.
    answer: >-
      Deprecate + keep thin describeToken()-backed wrapper; update
      FRAMEWORK-ADAPTERS.md in the same PR.
  - id: Q3
    question: >-
      Scoped lifetime in NestJSContainerAdapter: real scoped-instance cache
      (parity with SimpleContainer; createScope() is the scope boundary) or
      throw InvalidRegistrationError on Scoped registrations? AC3 allows either;
      panel prefers parity cache (low cost, honest semantics; NestJS REQUEST
      scope still governs moduleRef-resolved services). Note this IS a behavior
      change vs today's silent-Transient — must be called out in CHANGELOG, not
      shipped as a silent bugfix.
    recommendation: Real scoped cache (parity), explicit CHANGELOG entry.
    answer: >-
      Real scoped-instance cache (parity with SimpleContainer); explicit
      CHANGELOG entry for the behavior change.
  - id: Q4
    question: >-
      Unify `descriptor.token` shape now? Pre-existing divergence:
      SimpleContainer stores the real token in descriptors
      (simple-container.ts:112) while NestJSContainerAdapter stores the derived
      string key (nestjs-container.adapter.ts:111,137,157).
      ServiceDescriptor.token is already typed ServiceToken<T> (types.ts:26), so
      unifying to the real token is type-compatible. Do consumers iterate
      getServices() relying on `.token` being a string?
    recommendation: >-
      Unify to real token now (last free window pre-publish); if a string
      representation is needed, expose it via error messages/describeToken, not
      via descriptor shape.
    answer: >-
      Unify descriptor.token to the real token in all containers now; string
      representation only via describeToken()/error messages.
  - id: Q5
    question: >-
      VP-006b coordination (AC5): implement the throwing resolveDependency
      helper now with createInstance() signature untouched, so VP-006b's
      registration-time factory-caching rewrite reuses the same helper — no hard
      block between tasks, convergence handled in PR review. Acceptable?
    recommendation:
      Yes — no hard block; VP-006b lands later and reuses the helper.
    answer: >-
      Accepted — no hard block on VP-006b; createInstance() signature stays
      frozen and VP-006b reuses the throwing resolveDependency helper.
---

# VF-030 — DI Token Identity: Analysis (STOP1)

## Synthesis (tech-lead, merged with architect + api-guardian corrections)

**Plan of record.** Migrate token identity in `@vytches/ddd-di` and
`@vytches/ddd-nestjs` from derived string keys to **reference identity**,
mirroring the ADR-0034 CommandBus fix one layer down:

1. **Key mechanism (Option A).** `services` / `singletonInstances` /
   `scopedInstances` in `SimpleContainer` and the nestjs adapter's internal maps
   change from `Map<string, …>` to `Map<ServiceToken, …>`
   (`Function | string | symbol`): strings key by value, functions and symbols
   by reference. This fixes UX-C4 (same-named classes from two bounded contexts
   never collide), fixes the latent `Symbol('X')` toString-collision **for
   free** (TM-002), and deletes the entire WeakMap/counter/`__anon_N__`/
   `tokenKeyCache` machinery whose only purpose was synthesizing unique strings.
2. **One canonical utility (AC2).** New internal module
   `packages/di/src/internal/token-key.ts` exporting
   `describeToken(token): string` — the only remaining string-producing logic,
   used for error messages and display. **Not barrel-exported** (public-api
   rule: internal is sacred). `NestJSContainerAdapter` switches from
   `implements IDependencyContainer` to **`extends BaseContainerAdapter`**
   (verified: no new dependency edge — nestjs already depends on ddd-di; all
   abstract members present), inheriting the canonical logic. Both unfixed
   `getTokenKey` copies disappear as _implementations_; the documented protected
   extension point itself is Q2.
3. **Scoped lifetime (AC3).** Real scoped-instance cache in the nestjs adapter,
   parity with SimpleContainer; `createScope()` is the scope boundary and stops
   copying scoped-as-singleton. Never silent Transient. (Q3 confirms; explicit
   CHANGELOG entry required — this is a behavior change.)
4. **Error hierarchy (AC4).** Raw `new Error()` at
   `nestjs-container.adapter.ts:72,89` → `ContainerServiceNotFoundError` /
   `InvalidRegistrationError` (VF-024 rename already landed 2026-07-11 — the
   final class name is settled; the task's "coordinate the name" caveat is
   resolved). Provided as protected helpers on `BaseContainerAdapter`.
5. **Silent zero-arg fallback (AC5).** `createInstance()`'s
   `catch { return new paramType() }` (`:246-249`) is replaced by a throwing
   `resolveDependency(param, owner)` helper on the base adapter
   (`ContainerServiceNotFoundError`, or `CircularDependencyError` when
   detected). `createInstance()` signature stays untouched so VP-006b's future
   factory-caching rewrite swaps internals and reuses the same helper (implement
   once). Verified: SimpleContainer has no reflection path — AC5 is nestjs-only.
   This is the **highest-risk behavioral change** of the task (api-guardian):
   anything relying on silent zero-arg construction starts throwing. Correct,
   but gets its own CHANGELOG line.
6. **descriptor.token unification** (Q4) and **FRAMEWORK-ADAPTERS.md update**
   land in the same PR.

**Panel conflict resolved.** TM mitigation M1 proposed a `.name` BC-fallback on
reference miss; architect and api-guardian independently rejected it — a name
fallback reintroduces the exact collision this task exists to fix, and DI tokens
are consumer-chosen so `Symbol.for()` guidance is the clean answer for
dual-ESM/CJS double-load (ADR-0034 Bug #3). Tech-lead verdict: **reject M1**
(human confirms via Q1).

**Sequencing (api-guardian).** Package `@vytches/ddd-di` is v0.30.0 and
unpublished — batch _everything_ (key shape, symbol fix, scoped behavior, error
types, fallback removal, descriptor.token unification) in this one task. This is
the last window in which none of it is a breaking change. Do not split into a
second breaking round.

## Decisions (proposed)

| #   | Decision                                                                                                                                                | Rationale                                                                                        | ADR                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Reference-keyed maps `Map<ServiceToken, …>` (Option A), mirroring ADR-0034                                                                              | Same bug class, same fix shape; deletes key-synthesis machinery; symbol fix for free             | cite ADR-0034                                                                                                                                 |
| D2  | No `.name` fallback; document `Symbol.for()` for cross-context / dual-format tokens                                                                     | Fallback reintroduces UX-C4 on the fallback path; unanimous architect+guardian                   | **propose_adr: true** (short ADR extending ADR-0034 with honest caveat: reference identity does not survive process/realm boundaries — TM M7) |
| D3  | Canonical util = internal `packages/di/src/internal/token-key.ts` (`describeToken`), not barrel-exported; nestjs adapter `extends BaseContainerAdapter` | Package-boundary + public-api rules; zero new dependency edges; deletes both unfixed copies      | no                                                                                                                                            |
| D4  | Deprecate protected `getTokenKey` extension point, keep thin describeToken-backed wrapper; update FRAMEWORK-ADAPTERS.md same PR                         | Documented third-party integrator contract (8 occurrences); silent deletion = undocumented break | no (pending Q2)                                                                                                                               |
| D5  | Scoped = real parity cache in nestjs adapter                                                                                                            | AC3 preference; low cost; honest lifetime semantics                                              | no (pending Q3)                                                                                                                               |
| D6  | Adapter errors via DIError hierarchy using `ContainerServiceNotFoundError` (VF-024 final name)                                                          | AC4; VF-024 done — name settled                                                                  | no                                                                                                                                            |
| D7  | AC5 via throwing `resolveDependency` helper; `createInstance` signature frozen for VP-006b                                                              | Implement once; TM-001 mitigation; explicit CHANGELOG line for behavior change                   | no                                                                                                                                            |
| D8  | Unify `descriptor.token` to hold the real token in all containers                                                                                       | Type-compatible today (`ServiceToken<T>`); removes pre-existing cross-adapter divergence         | no (pending Q4)                                                                                                                               |

## Top risks

1. **Dual ESM/CJS double-load reference split (HIGH).** Same class loaded under
   both formats = two references = reference-key miss. Mitigation: D2
   `Symbol.for()` guidance in FRAMEWORK-ADAPTERS.md + CHANGELOG + new ADR;
   library-internal well-known tokens already use `Symbol.for` (ADR-0034 Bug #3)
   — must not regress.
2. **AC5 fallback removal breaks silent-zero-arg reliance (MEDIUM).**
   Pre-first-publish makes this acceptable; explicit CHANGELOG line, own
   decision (D7), lifetime-parity and error-type tests.
3. **`extends BaseContainerAdapter` method-resolution change (LOW-MED).**
   Contract tests; keep overrides whose semantics genuinely differ; run
   `nx run @vytches/ddd-nestjs:type-check` in addition to Vitest (esbuild masks
   excess-property regressions).

## Implementation units (for /orchestrate-ddd)

1. **packages/di — `internal/token-key.ts`**: `describeToken()`. Tests: unit
   (string/symbol/named/anonymous render uniquely and never throw).
2. **packages/di — SimpleContainer**: reference-keyed maps; delete
   WeakMap/counter/tokenKeyCache; symbol-by-reference. Tests: contract — two
   same-`name` classes register & resolve independently (the UX-C4 test);
   `Symbol('X') !== Symbol('X')` isolation; existing suite green.
3. **packages/di — BaseContainerAdapter**: canonical logic + protected
   error/`resolveDependency` helpers; `getTokenKey` per Q2 (deprecated thin
   wrapper). Tests: error-type (`instanceof DIError` family); subclass
   compile-compat (TestAdapter fixture).
4. **packages/nestjs — NestJSContainerAdapter**: `extends BaseContainerAdapter`;
   reference-keyed maps; scoped parity cache (same instance within scope,
   distinct across `createScope()`); DIError swaps; throwing `resolveDependency`
   replacing `new paramType()`; descriptor.token unification (Q4). Tests:
   lifetime-parity matrix between both containers; error-type asserts;
   **`nx run @vytches/ddd-nestjs:type-check`** mandatory.
5. **Docs**: new ADR (D2), FRAMEWORK-ADAPTERS.md update, CHANGELOG BC notes (key
   shape internal; Scoped behavior change; AC5 throw; getTokenKey deprecation;
   Symbol.for recipe), TM-VF-030 DRAFT → ACCEPTED after Q1.

## Security

Full STRIDE/DREAD/LINDDUN lives in `docs/security/threat-models/TM-VF-030.md` (7
threats; top: TM-001 silent wrong-instance resolution, DREAD 13/Critical; TM-002
symbol collision 11; TM-004 false-positive ServiceAlreadyRegisteredError 11;
TM-005 cross-context privilege leak 10). Mitigations M1–M7 map onto D1–D8 above,
except M1 (name fallback) — rejected by panel verdict, pending Q1. TM status:
DRAFT until Q1 answered.

## Procedural notes

- `.claude/knowledge/patterns/` symlink is broken in this checkout — Rule Cards
  were loaded from the claude-patterns source repo directly. Worth re-running
  `setup-project.sh` (repo maintenance, independent of VF-030).
- Panel ran as background leaf agents (no Task tool); no stage was interrupted;
  synthesis by tech-lead stage, assembled/corrected here (the raw synthesis
  conflated AC3/AC5 in one bullet — this artifact restores the
  architect/guardian version: AC3 = scoped parity cache, AC5 = throwing
  dependency resolution).
- Out of scope confirmed: ServiceLocator overwrite/reconfigure policy
  (SA-H4/SA-M10/SA-L4) — separate design decision per SEC-AUDIT-2026-07-09.

_Open-question answers live ONLY in the frontmatter (`answer:` fields)._
