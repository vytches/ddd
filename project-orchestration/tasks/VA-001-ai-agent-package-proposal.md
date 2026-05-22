# Task: `@vytches/ddd-agent` — AI Agent DDD Boundary Package

## Task Metadata

```yaml
task_id: VA-001
title: "@vytches/ddd-agent — AI agent DDD boundary package (concept)"
type: concept
priority: low
complexity: expert
estimated_time: unknown (requires real-world validation first)
created_at: 2026-05-20
migrated_at: 2026-05-22
status: backlog
release_target: post-v0.27 (after production validation in a consuming project)
priority_score: 40/100
```

> **Status**: CONCEPT — interfaces and patterns designed, not yet validated in production.
> **Decision**: Do NOT implement until patterns are proven stable in at least one production DDD project.
> **Category**: New Package (optional ecosystem extension)
> **Priority**: Future (not blocking any current work)

---

## Summary

This is a concept proposal for `@vytches/ddd-agent` — a library package that provides
interfaces and patterns for integrating AI agents into DDD-based systems **without
violating DDD boundaries**.

The core idea: AI becomes a **third driving adapter** (alongside HTTP and CLI), fully
aware of DDD boundaries. No handler needs to know that AI exists. Authorization,
audit trail, and domain integrity are preserved.

This document captures the design rationale and proposed API surface for future
consideration. It is **not a committed roadmap item**.

---

## Problem Statement

When an LLM (Claude, GPT-4, Gemini) needs to invoke a domain action in a DDD system:

```
LLM: "Create a job for the user"
```

Common approaches all have issues:

| Approach | Problem |
|----------|---------|
| LLM calls HTTP endpoints | Double latency, hard correlation, double rate limits |
| LLM calls CommandBus directly | Authorization bypassed, audit trail missing |
| LLM has its own auth logic copy | Desynchronization with real auth rules |
| Auto-discovery of all handlers | Every new handler = automatically AI-accessible = security regression |

None of these are acceptable. The solution is a dedicated boundary layer.

---

## Proposed Package: `@vytches/ddd-agent`

### Design principle

The package provides **interfaces and patterns only**, not domain implementations.
Zero dependencies on specific LLM providers (OpenAI, Anthropic). Zero business logic.
Only "how AI should communicate with a DDD system."

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

In a monolith: `InProcessAICommandDispatcher` calls CommandBus locally.
The interface design is transport-agnostic — consuming projects provide their own
implementations for different transport mechanisms.
**The interface stays the same** — swap implementations without changing the AI layer.

#### 2. `AIRequestContextExtension` — extension for RequestContext

Two new fields for the existing `RequestContext` from `@vytches/ddd-nestjs`:

```typescript
export interface AIRequestContextExtension {
  actorType: 'user' | 'ai_agent' | 'system';
  aiSessionId?: string;  // only when actorType='ai_agent'
}
```

Every integration event automatically carries "was this done by a human or an agent"
without modifying handlers or aggregates.

#### 3. `AIToolDefinition` — contract for what an agent can invoke

```typescript
export interface AIToolDefinition<TParams = unknown> {
  name: string;
  description: string;
  inputSchema: ZodSchema<TParams>;
  commandClass: new (params: TParams) => object;
  requiredPermission?: { action: string; subject: string };
  writeTier: AIWriteTier;
}
```

`writeTier` drives rate limiting. `requiredPermission` is checked before dispatch.
`commandClass` is the bridge to existing CQRS.

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
  userMessage: string;   // human-readable, for the end user
  retryable: boolean;    // should the LLM retry?
  leaked: false;         // always false — guarantees no PII leakage
}
```

Each consuming project implements its own `ProjectAIErrorTranslator extends AIErrorTranslator`
mapping its own error codes to human-readable messages.

#### 5. `AIWorkflowStepTraced` — base integration event

```typescript
export interface AIWorkflowStepTracedPayload {
  traceId: string;        // = workflowId, links all steps
  sessionId: string;
  userId: string;
  workflowName: string;
  stepName: string;
  stepIndex: number;
  durationMs: number;
  status: 'ok' | 'domain_error' | 'system_error';
  errorCode?: string;     // never message — GDPR
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  inputShape: string;     // "CommandName{field1,field2}" — no values
  actorType: 'user' | 'ai_agent' | 'system';
  aiSessionId?: string;
  timestamp: string;
}
```

Consuming projects emit `class MyWorkflowStepTraced extends BaseIntegrationEvent<AIWorkflowStepTracedPayload>`.
Self-hosted LLM tracing — full observability without external tooling.

#### 6. `AIWriteTier` — enum + default rate limits

```typescript
export enum AIWriteTier {
  READ = 'READ',
  WRITE_LOW = 'WRITE_LOW',
  WRITE_MEDIUM = 'WRITE_MEDIUM',
  WRITE_HIGH = 'WRITE_HIGH',
  WRITE_DESTRUCTIVE = 'WRITE_DESTRUCTIVE',
}

export const AI_DEFAULT_RATE_LIMITS: Record<AIWriteTier, number> = {
  [AIWriteTier.READ]: 100,            // per minute
  [AIWriteTier.WRITE_LOW]: 30,        // per hour
  [AIWriteTier.WRITE_MEDIUM]: 10,     // per hour
  [AIWriteTier.WRITE_HIGH]: 3,        // per hour
  [AIWriteTier.WRITE_DESTRUCTIVE]: 0, // disabled by default
};
```

Projects may override limits via configuration. Defaults are conservative.

#### 7. Test utilities (`@vytches/ddd-agent/testing`)

```typescript
export class MockAICommandDispatcher implements IAICommandDispatcher {
  private calls: { command: object; context: AIDispatchContext }[] = [];

  async dispatch<T>(command: object, context: AIDispatchContext): Promise<Result<T>> {
    this.calls.push({ command, context });
    return Result.ok(undefined as T);
  }

  assertDispatched(commandClass: new (...args: any[]) => object): void { /* ... */ }
  assertNotDispatched(): void { /* ... */ }
  getCallCount(): number { /* ... */ }
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

The library could offer both decorator-based and registry-based discovery,
with documentation on trade-offs.

---

## What the Package Does NOT Contain

| Component | Why it stays out |
|-----------|-----------------|
| Concrete AI workflows | Domain-specific — each project builds its own |
| AISession aggregate | A product concern, not a library |
| OpenAI/Anthropic clients | LLM provider is not a DDD concern |
| BudgetTracker | Infrastructure concern |
| Workflow registries with concrete workflows | Domain-specific whitelists |
| Intent identification logic | LLM call — outside DDD boundary |

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

Zero dependency on NestJS — core package is framework-agnostic.
Optional subpackage `@vytches/ddd-agent/nestjs` for NestJS-specific utilities.

---

## Arguments For Extraction

**1. The problem is fundamental and repeatable**
Every project using @vytches/ddd that wants AI faces the same question:
"how should the LLM invoke handlers without breaking authorization and audit trail?"
Without `@vytches/ddd-agent`, each project solves this independently, often incorrectly.

**2. The interfaces are genuinely generic**
`IAICommandDispatcher`, `AIToolDefinition`, `AIErrorTranslator` — none of them
contain anything project-specific. These are pure DDD-AI boundary abstractions.

**3. Transport abstraction is a key microservices enabler**
The `IAICommandDispatcher` interface is the single change that makes an AI layer
in a monolith not require a rewrite when migrating to microservices.

**4. `actorType` / `aiSessionId` in RequestContext is a cross-cutting concern**
Every audit log, every tracing system, every security monitor wants to know
"was this a human or a bot?" Without standardization in @vytches, each project
does this differently, making shared tooling impossible.

---

## Arguments Against / Risks

**1. Too early — patterns not production-validated**
All patterns described here are designed, not battle-tested.
Extraction before validation risks breaking changes in v0.1, v0.2, v0.3
that affect all consuming projects.

**Mitigation**: Wait until patterns are proven stable in at least one production
DDD project for 2-3 months. Only then extract.

**2. Maintenance overhead of a new package**
Every new package = changelog, semver, backward compatibility, documentation, tests.

**Mitigation**: Start small — v0.1 with 3-4 interfaces and 1 abstract class.
Do not attempt a full package immediately.

**3. Risk of "God Package" — AI is a broad domain**
If `@vytches/ddd-agent` contains too much, it becomes a monolith inside the monorepo.

**Mitigation**: Hard rule — only interfaces and patterns, zero domain implementations
and zero LLM provider code. If something requires importing OpenAI/Anthropic, it
does not belong in the package.

---

## Open Questions

1. **Naming**: `@vytches/ddd-agent` vs `@vytches/ddd-ai` vs `@vytches/ddd-ai-boundary`?
2. **Framework agnostic?**: Does `@vytches/ddd-agent/nestjs` subpackage make sense,
   or should NestJS integration stay in consumer projects?
3. **Workflow engine**: Should `AIWorkflowEngine` be a separate concept in this package,
   or left entirely to consuming projects?
4. **Decorator vs registry**: Offer both discovery styles, or pick one?
5. **Rate limiting in library**: Does `AIWriteTier` with default limits make sense
   in the library, or is it always project-specific?
6. Should `static fromAI()` be enforced by an interface (`IAICallable`) or remain a convention?
7. Should `AIToolRegistry.toAnthropicTools()` / `toOpenAITools()` live in the library,
   or be left to consuming projects?

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

*Concept created: 2026-05-20*
*Migrated to project-orchestration: 2026-05-22*
