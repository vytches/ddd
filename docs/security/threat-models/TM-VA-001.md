# Threat Model: TM-VA-001

**Feature:** `@vytches/ddd-agent` — AI↔DDD boundary package (concept) **Task:**
VA-001-ai-agent-package-proposal **Date:** 2026-06-30 **Method:** STRIDE +
DREAD + LINDDUN (lite — concept stage, no implementation exists yet) **Scope:**
Proposed v0.1 interfaces only: `IAICommandDispatcher`, `AIToolDefinition`,
`SchemaValidator<T>`/`IValidator<T>` (open decision, see analysis),
`IPermissionChecker`, `IAIRateLimiter`, `AIWriteTier`, `AIErrorTranslator`,
`IActor`/`DefaultActorType` extension. No concrete dispatcher implementation
exists in this repo — this TM gates the **spec**, not a deployment, and should
be re-run/extended against the concrete implementation when entry conditions are
met (~2026-08/09, see task file § Entry conditions).

---

## Context & Attack Surface

An LLM (untrusted relative to the domain — its output is attacker-influenceable
via prompt injection, hallucination, or a compromised upstream model) gains a
new path to invoke `CommandBus`/`QueryBus` through a dispatcher. The attack
surface is the **boundary layer itself**: whatever the dispatcher does not
enforce, the LLM-driven actor can bypass. Trust boundary: LLM output →
`IAICommandDispatcher.dispatch()` → CommandBus → domain. Everything left of
`CommandBus.execute()` is new surface introduced by this package.

---

## STRIDE Analysis

### E — Elevation of Privilege

#### TM-VA-001-E1: Optional `requiredPermission` enables silent fail-open authorization

**Description:** `AIToolDefinition.requiredPermission` is typed as optional
(`?`). Nothing in the spec defines dispatcher behavior when a consumer omits
`IPermissionChecker` entirely, or defines a tool without `requiredPermission`. A
tool author who forgets the field — or a dispatcher implementation that is wired
without a permission checker — silently grants unauthenticated AI access to a
domain command.

**Impact:** AI actor executes commands a human actor at the same session would
not be authorized for. Classic confused-deputy: the handler trusts the
dispatcher already checked authorization, but the dispatcher's check was
optional.

**DREAD:** D=8, R=7, E=6, A=8, Disc=6 → **35/50 (HIGH)**

**Mitigation:** Make `requiredPermission` mandatory on `AIToolDefinition` — use
an explicit sentinel (e.g.
`requiredPermission: {action,subject} | 'PUBLIC_NO_AUTH'`) so "no auth needed"
is a visible, reviewable decision in code, not an absence.
`IAICommandDispatcher` implementations must fail closed: refuse to dispatch
(ideally refuse to construct) if no `IPermissionChecker` is wired and any
registered tool requires permission.

---

### D — Denial of Service

#### TM-VA-001-D1: Rate-limit step is documentation-only, not type-enforced

**Description:** The 5-step pipeline (rate-limit → permission → parse →
construct → execute) exists only as prose in the task doc.
`IAICommandDispatcher.dispatch()` is a single abstract method — nothing prevents
a conforming implementation from skipping `IAIRateLimiter.checkAndConsume()` or
calling it after permission/execute.

**Impact:** `AIWriteTier.WRITE_DESTRUCTIVE` defaulting to 0/disabled is a good
secure default, but only if every implementation actually calls the limiter. DoS
/ cost-overrun risk (AI loops can call the same tool far more densely than a
human) if skipped.

**DREAD:** D=5, R=6, E=5, A=6, Disc=5 → **27/50 (MEDIUM)**

**Mitigation:** Ship an `abstract class` template-method base dispatcher with
the 5 steps hardcoded and only the injected interfaces (`IAIRateLimiter`,
`IPermissionChecker`, validator, `CommandClass.fromAI`) as extension points, so
skipping a step requires deliberately overriding the whole class rather than
misordering one call.

---

### I — Information Disclosure

#### TM-VA-001-I1: Throw-based `parse()` in the canonical pipeline risks leaking internals into the LLM context

**Description:** `SchemaValidator.parse()` is documented as "throws on invalid
data," and the canonical pipeline (task doc, step 3) shows
`schema.parse(rawParams)` — the throwing variant, despite `safeParse()` existing
on the same interface. If `dispatch()` wraps only `commandBus.execute()` in
error handling (as a literal reading of the 5-step list suggests) rather than
the whole pipeline, an uncaught exception's `message`/`stack` can reach the
dispatcher's caller — which, for an AI tool-calling pipeline, is the LLM's
context window. Stack traces or internal field names fed back to a model are
worse than a normal user-facing leak: a model may surface them to the end user
verbatim or be steered by them.

**Impact:** Internal type/field names, library internals, or partial domain
logic exposed to the model and potentially propagated to the end user or used to
refine further malicious calls.

**DREAD:** D=7, R=8, E=7, A=6, Disc=7 → **35/50 (HIGH)**

**Mitigation:** Canonical pipeline documentation/reference implementation must
use the non-throwing path (`safeParse()`, or — per analysis decision — a
`Result`-returning `IValidator.validate()`) and wrap the **entire** dispatch
pipeline (not just `execute`) in one error boundary that always routes through
`AIErrorTranslator` before any value reaches the caller.

#### TM-VA-001-I2: `AIErrorResponse.leaked: false` is a compile-time label, not a runtime guarantee (LINDDUN: Disclosure)

**Description:** The type system guarantees the field exists and is the literal
`false` — it does not guarantee `userMessage` is actually free of PII or
internal error detail. Any `AIErrorTranslator` subclass can echo `error.message`
verbatim and still satisfy the type.

**Impact:** False sense of security for implementers; GDPR/PII exposure to LLM
context if a consumer's translator is naive (most will be, absent guidance).

**DREAD:** D=5, R=6, E=4, A=5, Disc=6 → **26/50 (MEDIUM)**

**Mitigation:** Ship a default, conservative `AIErrorTranslator` (maps known
domain error codes → canonical messages, never echoes `.message`) plus a public
test helper (`assertNoLeakage(translator, sampleErrors)`) so the guarantee is
verifiable, not just typed.

---

### R — Repudiation

#### TM-VA-001-R1: `actor.metadata.aiSessionId` is an untyped, caller-supplied convention

**Description:** `IActor.metadata` is `Record<string, unknown>`; `aiSessionId`
is a documented convention, not enforced by any type. A caller building the
`IActor` passed into the dispatch context can omit it, typo the key, or — more
importantly — construct an actor with `type: 'user'` instead of `'ai_agent'`,
erasing the human/AI distinction the whole package exists to preserve for audit
purposes.

**Impact:** Audit trails and integration events lose the ability to reliably
answer "was this done by a human or an agent?" — undermining a stated core value
proposition of VA-001 (every integration event "carries human vs agent for
free").

**DREAD:** D=6, R=5, E=5, A=7, Disc=5 → **28/50 (MEDIUM)**

**Mitigation:** `IAICommandDispatcher` should construct the `IActor` internally
from `AIDispatchContext` (deterministically: `type: 'ai_agent'`,
`metadata.aiSessionId = context.sessionId`) rather than accepting a
caller-supplied actor. Pair with a typed, discriminated
`IAIActor extends IActor { type: 'ai_agent'; aiSessionId: string }` in
`@vytches/ddd-domain-primitives` instead of an untyped metadata convention.

---

## Overall Verdict

Two **HIGH** findings (E1, I1) should be treated as blocking for the _spec_, not
just nice-to-haves — they affect the type signatures (`requiredPermission`,
canonical pipeline error handling) that v0.1 would freeze for backward
compatibility. Both are cheap to fix at concept stage and expensive to fix after
a published v0.1 (breaking change). Three **MEDIUM** findings (D1, I2, R1) are
strongly recommended before cutting v0.1 but do not block continued design work.
None of the findings require schema/architecture rework beyond what is already
proposed in
`project-orchestration/analysis/VA-001-ai-agent-package-proposal.analysis.md`.

Re-run this threat model (full STRIDE/DREAD against the concrete
`InProcessAICommandDispatcher` implementation, not just interfaces) when entry
conditions are met and real code exists.
