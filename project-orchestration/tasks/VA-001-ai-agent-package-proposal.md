# Task: `@vytches/ddd-agent` — AI Agent DDD Boundary Package

## Task Metadata

```yaml
task_id: VA-001
title: '@vytches/ddd-agent — AI agent DDD boundary package (concept)'
type: concept
priority: low
complexity: expert
estimated_time: unknown (requires real-world validation first)
created_at: 2026-05-20
migrated_at: 2026-05-22
reviewed_at: 2026-06-12 (multi-agent review — spec corrected, see below)
status: backlog
release_target: post-v0.27 (after production validation in a consuming project)
priority_score: 40/100
demand_signal: 'juz-ide-api scoping AI integration — expect attention ~2026-08/09'
```

> **Status**: CONCEPT — interfaces and patterns designed, not yet validated in
> production. **Decision**: Do NOT implement until patterns are proven stable in
> at least one production DDD project. **Category**: New Package (optional
> ecosystem extension) **Priority**: Future (not blocking any current work)
>
> **Update 2026-06-12**: juz-ide-api is actively scoping an AI integration. This
> package is the natural home for that boundary layer and will likely need
> attention in ~2-3 months once those patterns run in production. The spec below
> was reviewed by 5 agents (api-guardian, library-expert, developer-experience,
> performance-optimizer, product-owner) and **corrected** — the original concept
> referenced 3 symbols that do not exist in the codebase and a `zod` dependency
> that violates the library's dependency-free rule. See
> **§ Multi-Agent Review & Corrections** before any implementation.

---

## Multi-Agent Review & Corrections (2026-06-12)

> Reviewed by: `library-api-guardian`, `library-expert`, `developer-experience`,
> `performance-optimizer`, `product-owner`. Verdict: **direction is sound, spec
> needs the corrections below before implementation.** Implementation stays
> deferred (see revised entry conditions at the end of this section).

### Verified errors in the original concept

The concept was written against an assumed API. Three symbols below **do not
exist** in the current codebase (verified 2026-06-12) and the proposed `zod`
dependency breaks a core library rule. These are corrected inline in the
relevant sections and consolidated here:

| # | Issue (original) | Reality / Correction | Severity |
| - | ---------------- | -------------------- | -------- |
| 1 | peerDep `@vytches/ddd-core` | Does not exist. `Result<T>` → `@vytches/ddd-contracts`; `IActor` → `@vytches/ddd-domain-primitives` | blocker |
| 2 | base event `BaseIntegrationEvent` | Does not exist. Real class is `IntegrationEvent<T>` in `@vytches/ddd-events` | blocker |
| 3 | extend `RequestContext` from `@vytches/ddd-nestjs` (component #2) | No such symbol in nestjs (`RequestContext` only appears as an example string in a `ddd-utils` JSDoc). Re-frame — see correction #4 | blocker |
| 4 | `zod` as peerDependency; `inputSchema: ZodSchema<TParams>` | Violates dependency-free rule (zod is in **zero** packages). Forces every consumer to install zod even with another validator. Replace with own `SchemaValidator<T>` interface — zod satisfies it structurally, zero breaking | blocker |
| 5 | in-library rate-limiting via `AIWriteTier` | In-memory counter does not scale horizontally (N pods = N× limit). Ship enum + default constants + `IAIRateLimiter` **interface** only; implementation (Redis/Valkey) stays in consumer | high |
| 6 | `enum AIWriteTier` | TS `enum` emits a runtime IIFE. Use `as const` object literal (consistent with rest of monorepo) | medium |
| 7 | `toAnthropicTools()` / `toOpenAITools()` in library (Open Q #7) | **No** — provider formats track their APIs. Expose neutral `toGenericToolSchema()`; provider adapters are docs-only recipes | medium |
| 8 | offer both decorator + registry discovery (Open Q #4) | Pick one in core: **registry-first**. Decorator binds a pure domain command to the framework — keep it (if at all) in a `/nestjs` subpackage only | medium |
| 9 | `static fromAI()` as loose convention (Open Q #6) | Runtime-only error if misnamed. Cannot be enforced via instance interface (it's static). Use a factory-type constraint on `commandClass` instead (see correction #3 below). DX still wants this enforced from v0.1 | medium |

Minor: `costUsd: number` (float) risks accumulation error → prefer
`costMicroUsd: number` (integer); add `examples?: Array<{ input; description }>`
to `AIToolDefinition` for LLM tool-disambiguation.

### Corrected API sketches

**Correction #1 — schema abstraction (kills the zod dependency):**

```typescript
// Own minimal interface — zod's ZodSchema satisfies this structurally.
// Consumers may plug zod, valibot, arktype, or a hand-rolled parser.
export interface SchemaValidator<T> {
  parse(input: unknown): T; // throws on invalid
  safeParse(
    input: unknown
  ): { success: true; data: T } | { success: false; error: unknown };
}

export interface AIToolDefinition<TParams = unknown> {
  name: string;
  description: string;
  inputSchema: SchemaValidator<TParams>; // was: ZodSchema<TParams>
  commandClass: AICallableClass<object, TParams>; // see correction #3
  requiredPermission?: { action: string; subject: string };
  writeTier: AIWriteTier;
  examples?: Array<{ input: TParams; description: string }>;
}
```

**Correction #2 — actorType without a phantom RequestContext:**

`AIRequestContextExtension` as a standalone interface is unnecessary. The actor
already carries identity. Extend `DefaultActorType` in
`@vytches/ddd-domain-primitives` with `AI_AGENT = 'ai_agent'` and use the
existing `IActor.metadata` for `aiSessionId` (convention). This is a
non-breaking enum extension and means every audit/integration event already
carries "human vs agent" for free — no handler or aggregate changes.

```typescript
// in @vytches/ddd-domain-primitives (additive)
// DefaultActorType: ... | 'ai_agent'
// convention: actor.metadata.aiSessionId?: string
```

**Correction #3 — enforce `fromAI()` shape via a type, not a convention:**

```typescript
// Static methods can't live on an instance interface — use a constructor type.
export type AICallableClass<TInstance, TParams> = {
  new (...args: never[]): TInstance;
  fromAI(params: TParams): TInstance;
};
// AIToolDefinition.commandClass: AICallableClass<object, TParams>
// → a command missing static fromAI() is now a COMPILE error.
```

**Correction #4 — rate limiting as interface + constants only:**

```typescript
export const AIWriteTier = {
  READ: 'READ',
  WRITE_LOW: 'WRITE_LOW',
  WRITE_MEDIUM: 'WRITE_MEDIUM',
  WRITE_HIGH: 'WRITE_HIGH',
  WRITE_DESTRUCTIVE: 'WRITE_DESTRUCTIVE',
} as const;
export type AIWriteTier = (typeof AIWriteTier)[keyof typeof AIWriteTier];

export const AI_DEFAULT_RATE_LIMITS: Record<AIWriteTier, number> = {
  /* unchanged conservative defaults */
};

// Implementation lives in the consumer (Redis/Valkey). Library ships interface:
export interface IAIRateLimiter {
  checkAndConsume(userId: string, tier: AIWriteTier): Promise<boolean>;
}
```

**Correction #5 — permission check is injected, not built-in:**

The dispatcher pipeline's `checkPermission` step is project-specific RBAC/ABAC.
The library provides the seam, the consumer provides the policy:

```typescript
export interface IPermissionChecker {
  can(
    actor: IActor,
    permission: { action: string; subject: string }
  ): Promise<boolean>;
}
// InProcess dispatcher receives IPermissionChecker + IAIRateLimiter + IAICommandDispatcher target.
```

### Corrected dependency graph (acyclic — verified)

```
@vytches/ddd-agent
  peerDependencies:
    @vytches/ddd-contracts          ← Result<T>  (was: ddd-core)
    @vytches/ddd-domain-primitives  ← IActor / DefaultActorType
    @vytches/ddd-cqrs               ← CommandBus / QueryBus interfaces
    @vytches/ddd-events             ← IntegrationEvent<T> (was: BaseIntegrationEvent)
  # NO zod. NO LLM-provider SDKs. NO NestJS in core.
  devDependencies:
    @vytches/ddd-testing            ← MockAICommandDispatcher
```

No package depends on `ddd-agent`, so the graph stays acyclic. Risk to watch:
a future `@vytches/ddd-agent-nestjs` must not be imported back by
`@vytches/ddd-nestjs` (would create a cycle).

### Scope decisions (resolved open questions)

- **OQ #2** — NestJS utilities: separate package `@vytches/ddd-agent-nestjs`
  later (not a subpath export — complicates dual ESM/CJS). Decorator `@AITool`
  lives here, never in core.
- **OQ #3** — `AIWorkflowEngine`: **out of scope**. Orchestration is
  project-specific; library ships at most an `IAIWorkflow` interface.
- **OQ #4** — registry-first; decorator only in the nestjs subpackage.
- **OQ #5** — `AIWriteTier` + `AI_DEFAULT_RATE_LIMITS` as constants: **yes**
  (pure data, tree-shakeable). Limiter implementation: **no**.
- **OQ #6** — enforce `fromAI()` via `AICallableClass` type (correction #3).
- **OQ #7** — provider tool-schema converters: **out** (docs-only recipes).

### Revised v0.1 scope (after validation)

Type-only + minimal-runtime surface, zero external deps:

1. `IAICommandDispatcher`, `AIDispatchContext`, `AIDispatchError` (interfaces)
2. `SchemaValidator<T>`, `AIToolDefinition<T>`, `AICallableClass<T,P>` (types)
3. `IPermissionChecker`, `IAIRateLimiter` (interfaces)
4. `AIWriteTier` + `AI_DEFAULT_RATE_LIMITS` (`as const`)
5. `AIErrorTranslator` (abstract class) + `AIErrorResponse`
6. `@vytches/ddd-agent/testing`: `MockAICommandDispatcher`

Defer to v0.2+: `AIWorkflowStepTracedPayload` (15-field event schema — highest
churn risk, freeze last), provider-neutral `AIToolRegistry.toGenericToolSchema()`.

### Entry conditions before implementation (consensus)

Implementation stays **deferred**, but the trigger is now concrete:

1. **Production validation** — juz-ide-api runs the AI boundary in production for
   2-3 months and the core interfaces (`IAICommandDispatcher`,
   `AIToolDefinition`, `actorType`) prove stable. _(Primary trigger — likely
   ~2026-08/09 given juz-ide-api is already scoping this.)_
2. **Core quality green first** — current project priority (JSDoc, ts-paths,
   flaky test) must not be displaced by this. VA-001 does not jump the queue.
3. **Pre-implementation step** — extract the patterns from juz-ide-api's real
   usage and diff against the corrected spec above before cutting v0.1. Build one
   end-to-end recipe (1 command + AIToolDefinition + InProcess dispatcher + L1
   mock test + L2 actorType assertion) **in juz-ide-api** before extraction.

---

## Summary

This is a concept proposal for `@vytches/ddd-agent` — a library package that
provides interfaces and patterns for integrating AI agents into DDD-based
systems **without violating DDD boundaries**.

The core idea: AI becomes a **third driving adapter** (alongside HTTP and CLI),
fully aware of DDD boundaries. No handler needs to know that AI exists.
Authorization, audit trail, and domain integrity are preserved.

This document captures the design rationale and proposed API surface for future
consideration. It is **not a committed roadmap item**.

---

## Problem Statement

When an LLM (Claude, GPT-4, Gemini) needs to invoke a domain action in a DDD
system:

```
LLM: "Create a job for the user"
```

Common approaches all have issues:

| Approach                        | Problem                                                               |
| ------------------------------- | --------------------------------------------------------------------- |
| LLM calls HTTP endpoints        | Double latency, hard correlation, double rate limits                  |
| LLM calls CommandBus directly   | Authorization bypassed, audit trail missing                           |
| LLM has its own auth logic copy | Desynchronization with real auth rules                                |
| Auto-discovery of all handlers  | Every new handler = automatically AI-accessible = security regression |

None of these are acceptable. The solution is a dedicated boundary layer.

---

## Proposed Package: `@vytches/ddd-agent`

### Design principle

The package provides **interfaces and patterns only**, not domain
implementations. Zero dependencies on specific LLM providers (OpenAI,
Anthropic). Zero business logic. Only "how AI should communicate with a DDD
system."

> **Note on naming**: `@vytches/ddd-agent` is preferred over `@vytches/ddd-ai`
> because "agent" more precisely describes the DDD↔AI boundary role.

---

### Proposed Components

#### 1. `IAICommandDispatcher` — transport abstraction

```typescript
export interface IAICommandDispatcher {
  dispatch<T>(
    command: object,
    context: AIDispatchContext
  ): Promise<Result<T, AIDispatchError>>;
}

export interface AIDispatchContext {
  userId: string;
  sessionId: string;
  workflowName?: string;
  stepName?: string;
}
```

In a monolith: `InProcessAICommandDispatcher` calls CommandBus locally. The
interface design is transport-agnostic — consuming projects provide their own
implementations for different transport mechanisms. **The interface stays the
same** — swap implementations without changing the AI layer.

#### 2. `AIRequestContextExtension` — extension for RequestContext

> ⚠️ **Corrected** — there is no `RequestContext` in `@vytches/ddd-nestjs`. Drop
> this standalone interface; extend `DefaultActorType` with `'ai_agent'` and use
> `IActor.metadata.aiSessionId` instead. See § Multi-Agent Review correction #2.

Two new fields for the existing `RequestContext` from `@vytches/ddd-nestjs`:

```typescript
export interface AIRequestContextExtension {
  actorType: 'user' | 'ai_agent' | 'system';
  aiSessionId?: string; // only when actorType='ai_agent'
}
```

Every integration event automatically carries "was this done by a human or an
agent" without modifying handlers or aggregates.

#### 3. `AIToolDefinition` — contract for what an agent can invoke

```typescript
export interface AIToolDefinition<TParams = unknown> {
  name: string;
  description: string;
  inputSchema: ZodSchema<TParams>; // ⚠️ corrected → SchemaValidator<TParams> (no zod dep)
  commandClass: new (params: TParams) => object; // ⚠️ → AICallableClass<object, TParams>
  requiredPermission?: { action: string; subject: string };
  writeTier: AIWriteTier;
}
```

> ⚠️ **Corrected** — `ZodSchema` is replaced by an own `SchemaValidator<T>`
> interface to keep the library dependency-free. See § Multi-Agent Review
> corrections #1 and #3.

`writeTier` drives rate limiting. `requiredPermission` is checked before
dispatch. `commandClass` is the bridge to existing CQRS.

#### 4. `AIErrorTranslator` — abstract base class

```typescript
export abstract class AIErrorTranslator<TError = Error> {
  abstract translate(error: TError): AIErrorResponse;

  protected categoryFallback(error: TError): AIErrorResponse {
    return {
      userMessage: 'Unable to complete the action. Please try again.',
      retryable: false,
      leaked: false,
    };
  }
}

export interface AIErrorResponse {
  userMessage: string; // human-readable, for the end user
  retryable: boolean; // should the LLM retry?
  leaked: false; // always false — guarantees no PII leakage
}
```

Each consuming project implements its own
`ProjectAIErrorTranslator extends AIErrorTranslator` mapping its own error codes
to human-readable messages.

#### 5. `AIWorkflowStepTraced` — base integration event

```typescript
export interface AIWorkflowStepTracedPayload {
  traceId: string; // = workflowId, links all steps
  sessionId: string;
  userId: string;
  workflowName: string;
  stepName: string;
  stepIndex: number;
  durationMs: number;
  status: 'ok' | 'domain_error' | 'system_error';
  errorCode?: string; // never message — GDPR
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  inputShape: string; // "CommandName{field1,field2}" — no values
  actorType: 'user' | 'ai_agent' | 'system';
  aiSessionId?: string;
  timestamp: string;
}
```

Consuming projects emit
`class MyWorkflowStepTraced extends BaseIntegrationEvent<AIWorkflowStepTracedPayload>`.
Self-hosted LLM tracing — full observability without external tooling.

> ⚠️ **Corrected** — base class is `IntegrationEvent<T>` (from
> `@vytches/ddd-events`), not `BaseIntegrationEvent`. Also prefer
> `costMicroUsd: number` over float `costUsd`. This 15-field payload is the
> highest churn risk — defer to v0.2+, freeze last. See § Multi-Agent Review.

#### 6. `AIWriteTier` — enum + default rate limits

> ⚠️ **Corrected** — use an `as const` object literal, not `enum` (avoids the
> runtime IIFE). Rate-limit **enforcement** is an injected `IAIRateLimiter`, not
> in-library (in-memory does not scale across pods). See § Multi-Agent Review
> corrections #4 and #5.

```typescript
export enum AIWriteTier {
  READ = 'READ',
  WRITE_LOW = 'WRITE_LOW',
  WRITE_MEDIUM = 'WRITE_MEDIUM',
  WRITE_HIGH = 'WRITE_HIGH',
  WRITE_DESTRUCTIVE = 'WRITE_DESTRUCTIVE',
}

export const AI_DEFAULT_RATE_LIMITS: Record<AIWriteTier, number> = {
  [AIWriteTier.READ]: 100, // per minute
  [AIWriteTier.WRITE_LOW]: 30, // per hour
  [AIWriteTier.WRITE_MEDIUM]: 10, // per hour
  [AIWriteTier.WRITE_HIGH]: 3, // per hour
  [AIWriteTier.WRITE_DESTRUCTIVE]: 0, // disabled by default
};
```

Projects may override limits via configuration. Defaults are conservative.

#### 7. Test utilities (`@vytches/ddd-agent/testing`)

```typescript
export class MockAICommandDispatcher implements IAICommandDispatcher {
  private calls: { command: object; context: AIDispatchContext }[] = [];

  async dispatch<T>(
    command: object,
    context: AIDispatchContext
  ): Promise<Result<T>> {
    this.calls.push({ command, context });
    return Result.ok(undefined as T);
  }

  assertDispatched(commandClass: new (...args: any[]) => object): void {
    /* ... */
  }
  assertNotDispatched(): void {
    /* ... */
  }
  getCallCount(): number {
    /* ... */
  }
}
```

---

### Dispatcher Pipeline

```
LLM → dispatch('create_job', rawParams)
       1. checkWriteTier(tier, userId)       ← rate limit
       2. checkPermission(permission, actor)  ← authorization check
       3. schema.parse(rawParams)             ← Zod, throws on invalid data
       4. CommandClass.fromAI(parsedParams)   ← only clean data reaches Command
       5. commandBus.execute(command)         ← handler has no knowledge of AI
```

The LLM has no access to CommandBus — the only path is through the dispatcher.
Steps 1-3 cannot be bypassed.

---

### Decorator Style (alternative to registry)

For projects that prefer decorator-based discovery:

```typescript
@AITool({
  description: 'Creates a new job request',
  tier: AIWriteTier.WRITE_MEDIUM,
  permission: { action: 'create', subject: 'Job' },
  schema: z.object({
    title: z.string().min(2).max(100).describe('Job title'),
    budget: z.number().int().min(10).describe('Budget in base currency'),
  }),
})
export class CreateJobCommand {
  static fromAI(params: z.infer<typeof schema>): CreateJobCommand {
    return new CreateJobCommand(params.title, params.budget);
  }
}
```

The library could offer both decorator-based and registry-based discovery, with
documentation on trade-offs.

---

## What the Package Does NOT Contain

| Component                                   | Why it stays out                              |
| ------------------------------------------- | --------------------------------------------- |
| Concrete AI workflows                       | Domain-specific — each project builds its own |
| AISession aggregate                         | A product concern, not a library              |
| OpenAI/Anthropic clients                    | LLM provider is not a DDD concern             |
| BudgetTracker                               | Infrastructure concern                        |
| Workflow registries with concrete workflows | Domain-specific whitelists                    |
| Intent identification logic                 | LLM call — outside DDD boundary               |

---

## Proposed Package Dependencies

```
@vytches/ddd-agent
  peerDependencies:
    @vytches/ddd-core        ← Result<T>, base classes
    @vytches/ddd-cqrs        ← CommandBus, QueryBus interfaces
    @vytches/ddd-events      ← BaseIntegrationEvent
    zod                      ← AIToolDefinition schema validation
  devDependencies:
    @vytches/ddd-testing     ← for MockAICommandDispatcher
```

> ⚠️ **Corrected** — `@vytches/ddd-core` does not exist (use
> `@vytches/ddd-contracts` + `@vytches/ddd-domain-primitives`),
> `BaseIntegrationEvent` → `IntegrationEvent`, and **`zod` is removed entirely**.
> See the corrected graph in § Multi-Agent Review & Corrections.

Zero dependency on NestJS — core package is framework-agnostic. Optional
subpackage `@vytches/ddd-agent/nestjs` for NestJS-specific utilities.

---

## Arguments For Extraction

**1. The problem is fundamental and repeatable** Every project using
@vytches/ddd that wants AI faces the same question: "how should the LLM invoke
handlers without breaking authorization and audit trail?" Without
`@vytches/ddd-agent`, each project solves this independently, often incorrectly.

**2. The interfaces are genuinely generic** `IAICommandDispatcher`,
`AIToolDefinition`, `AIErrorTranslator` — none of them contain anything
project-specific. These are pure DDD-AI boundary abstractions.

**3. Transport abstraction is a key microservices enabler** The
`IAICommandDispatcher` interface is the single change that makes an AI layer in
a monolith not require a rewrite when migrating to microservices.

**4. `actorType` / `aiSessionId` in RequestContext is a cross-cutting concern**
Every audit log, every tracing system, every security monitor wants to know "was
this a human or a bot?" Without standardization in @vytches, each project does
this differently, making shared tooling impossible.

---

## Arguments Against / Risks

**1. Too early — patterns not production-validated** All patterns described here
are designed, not battle-tested. Extraction before validation risks breaking
changes in v0.1, v0.2, v0.3 that affect all consuming projects.

**Mitigation**: Wait until patterns are proven stable in at least one production
DDD project for 2-3 months. Only then extract.

**2. Maintenance overhead of a new package** Every new package = changelog,
semver, backward compatibility, documentation, tests.

**Mitigation**: Start small — v0.1 with 3-4 interfaces and 1 abstract class. Do
not attempt a full package immediately.

**3. Risk of "God Package" — AI is a broad domain** If `@vytches/ddd-agent`
contains too much, it becomes a monolith inside the monorepo.

**Mitigation**: Hard rule — only interfaces and patterns, zero domain
implementations and zero LLM provider code. If something requires importing
OpenAI/Anthropic, it does not belong in the package.

---

## Open Questions

1. **Naming**: `@vytches/ddd-agent` vs `@vytches/ddd-ai` vs
   `@vytches/ddd-ai-boundary`?
2. **Framework agnostic?**: Does `@vytches/ddd-agent/nestjs` subpackage make
   sense, or should NestJS integration stay in consumer projects?
3. **Workflow engine**: Should `AIWorkflowEngine` be a separate concept in this
   package, or left entirely to consuming projects?
4. **Decorator vs registry**: Offer both discovery styles, or pick one?
5. **Rate limiting in library**: Does `AIWriteTier` with default limits make
   sense in the library, or is it always project-specific?
6. Should `static fromAI()` be enforced by an interface (`IAICallable`) or
   remain a convention?
7. Should `AIToolRegistry.toAnthropicTools()` / `toOpenAITools()` live in the
   library, or be left to consuming projects?

---

## Implementation Timeline (hypothetical)

```
When patterns are validated in production (~2-3 months of real usage):
  → Verify IAICommandDispatcher, AIToolDefinition, actorType are stable
  → If stable: extract as @vytches/ddd-agent v0.1
  → v0.1 scope: interfaces only + AIErrorTranslator base + MockAICommandDispatcher

After further validation (~5-6 months total):
  → If AIWorkflowStepTraced shape is stable: add to v0.2
  → If AIWriteTier enum is validated: add rate limit defaults
  → v0.2 scope: + tracing event + rate limit tiers

Later (optional):
  → @vytches/ddd-agent/nestjs subpackage with NestJS utilities
  → @vytches/ddd-agent/testing with full mock utilities
```

---

_Concept created: 2026-05-20_ _Migrated to project-orchestration: 2026-05-22_
