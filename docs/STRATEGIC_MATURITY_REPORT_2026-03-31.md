# @vytches/ddd - Strategic Maturity & Competitive Analysis Report

> **Date**: 2026-03-31 **Scope**: Full ecosystem audit - maturity, DX,
> performance, usability, competitive positioning **Consumer project analyzed**:
> juz-ide-api (237+ aggregates, 10+ bounded contexts, 16,305 tests)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Competitive Landscape](#2-competitive-landscape)
3. [Feature Completeness Matrix](#3-feature-completeness-matrix)
4. [Maturity Assessment by Package](#4-maturity-assessment-by-package)
5. [Developer Experience (DX) Analysis](#5-developer-experience-dx-analysis)
6. [Pain Points from Real-World Usage](#6-pain-points-from-real-world-usage)
7. [Performance & Bundle Analysis](#7-performance--bundle-analysis)
8. [Type Safety & API Ergonomics](#8-type-safety--api-ergonomics)
9. [What's Missing vs World-Class](#9-whats-missing-vs-world-class)
10. [Strategic Recommendations](#10-strategic-recommendations)
11. [Roadmap Priority Matrix](#11-roadmap-priority-matrix)

---

## 1. Executive Summary

### Current State

@vytches/ddd is a **22-package monorepo** covering the broadest DDD surface area
of any TypeScript library in existence. With 28,761+ LOC across aggregates,
value objects, CQRS, events, ACL, policies, specifications, projections,
resilience, messaging (outbox), DI, logging, testing, CLI, and a NestJS adapter
-- no competitor comes close in breadth.

### Verdicts

| Dimension                | Score | Verdict                                                         |
| ------------------------ | ----- | --------------------------------------------------------------- |
| **Feature Completeness** | 9/10  | Most comprehensive DDD library in TypeScript ecosystem          |
| **Code Quality**         | 8/10  | Excellent type safety, Result monad, capability system          |
| **Developer Experience** | 5/10  | High boilerplate, steep learning curve, weak onboarding         |
| **Performance**          | 7/10  | Solid fundamentals, some unnecessary overhead in enhanced buses |
| **Documentation**        | 4/10  | JSDoc coverage improving, but no tutorials/guides for newcomers |
| **Ecosystem Readiness**  | 3/10  | GitHub Packages only, no npm, no community, no examples repo    |
| **Production Maturity**  | 7/10  | Battle-tested in juz-ide-api (16K+ tests), but pre-1.0 versions |

### The Gap to World-Class

The library has the **best foundation** in the TS DDD space. But "best library"
!= "best developer experience building apps." The gap to world-class is not in
features -- it's in **DX, onboarding, boilerplate reduction, and ecosystem
presence**.

---

## 2. Competitive Landscape

### Market Map (March 2026)

| Library          | Downloads/mo       | Focus              | vs @vytches/ddd                |
| ---------------- | ------------------ | ------------------ | ------------------------------ |
| **@nestjs/cqrs** | 1,294,202          | CQRS bus only      | We cover 10x more patterns     |
| **Emmett**       | 24,045 (+507% YoY) | Event Sourcing     | Rising threat, great DX        |
| **Castore**      | 12,673             | ES storage layer   | Narrow scope                   |
| **types-ddd**    | 2,735              | DDD primitives     | Closest competitor, but weaker |
| **fmodel-ts**    | 1,029              | Functional Decider | Niche, FP-only                 |
| **@noddde/core** | 748                | Full DDD/CQRS/ES   | NEW, similar ambition          |
| **@vytches/ddd** | N/A (private)      | Everything         | Not on npm yet                 |

### Key Competitive Insights

1. **No "Axon for TypeScript" exists** -- Java's Axon has 70M+ downloads. The TS
   market is wide open.
2. **@nestjs/cqrs dominates by default** -- not because it's good, but because
   NestJS is popular. It lacks aggregates, VOs, ACL, specs, policies,
   everything.
3. **Emmett is the rising star** -- 507% YoY growth, great branding (Oskar
   Dudycz), but ES-only.
4. **Nobody has ACL, Policies, Specifications, or Resilience** -- these are
   unique to @vytches/ddd.
5. **The community wants ONE comprehensive library** -- not 5 libraries glued
   together.

### What Competitors Do Better

| Area                     | Who               | What they do better                                  |
| ------------------------ | ----------------- | ---------------------------------------------------- |
| **Onboarding DX**        | Emmett            | 5-minute quickstart, BDD testing syntax, zero config |
| **Functional API**       | fmodel-ts, noDDDe | Decider pattern, composition over inheritance        |
| **Event Store backends** | Emmett, Castore   | PostgreSQL, EventStoreDB, MongoDB, SQLite, In-Memory |
| **Community/brand**      | @nestjs/cqrs      | NestJS ecosystem, massive community                  |
| **npm presence**         | All competitors   | They're on npm; we're not                            |

---

## 3. Feature Completeness Matrix

| Feature                   | @vytches               | @nestjs/cqrs | Emmett | types-ddd | noDDDe  | fmodel-ts |
| ------------------------- | ---------------------- | ------------ | ------ | --------- | ------- | --------- |
| AggregateRoot             | YES                    | -            | -      | YES       | Decider | Decider   |
| Value Objects             | YES                    | -            | -      | YES       | -       | -         |
| Entity                    | YES                    | -            | -      | YES       | -       | -         |
| EntityId (multi-format)   | YES                    | -            | -      | Partial   | -       | -         |
| Domain Events             | YES                    | YES          | YES    | YES       | YES     | YES       |
| Integration Events        | YES                    | -            | -      | -         | -       | -         |
| CQRS Command Bus          | YES                    | YES          | YES    | -         | YES     | -         |
| CQRS Query Bus            | YES                    | YES          | -      | -         | YES     | -         |
| Enhanced Bus (resilience) | YES                    | -            | -      | -         | -       | -         |
| Event Sourcing            | Partial                | -            | YES    | -         | YES     | YES       |
| Projections               | YES                    | -            | YES    | -         | YES     | YES       |
| Sagas                     | -                      | Partial      | -      | -         | YES     | YES       |
| ACL (Anti-Corruption)     | YES                    | -            | -      | -         | -       | -         |
| Specifications            | YES (237 in consumer!) | -            | -      | -         | -       | -         |
| Policies                  | YES                    | -            | -      | -         | -       | -         |
| Domain Services           | YES                    | -            | -      | YES       | -       | -         |
| Repository abstraction    | YES                    | -            | -      | YES       | YES     | -         |
| Unit of Work              | YES                    | -            | -      | -         | YES     | -         |
| Result<T,E> monad         | YES                    | -            | -      | YES       | -       | -         |
| Validation framework      | YES                    | -            | -      | YES       | -       | -         |
| DI Container              | YES                    | NestJS       | -      | -         | -       | -         |
| Resilience (CB, retry)    | YES                    | -            | -      | -         | -       | -         |
| Outbox pattern            | YES                    | -            | -      | -         | -       | -         |
| Logging                   | YES                    | -            | -      | -         | -       | -         |
| Testing toolkit           | YES                    | -            | YES    | -         | YES     | -         |
| CLI / Scaffolding         | YES                    | NestJS CLI   | -      | -         | -       | -         |
| NestJS adapter            | YES                    | Native       | -      | -         | -       | -         |
| Framework-agnostic core   | YES                    | NO           | YES    | YES       | YES     | YES       |
| Capability system         | YES                    | -            | -      | -         | -       | -         |
| Middleware pipeline       | YES                    | -            | -      | -         | -       | -         |

**Verdict: @vytches/ddd has the widest feature set. No competitor covers even
50% of what we offer.**

---

## 4. Maturity Assessment by Package

### Tier 1: Production-Ready (8-9/10)

| Package               | Lines | Tests | Assessment                                                |
| --------------------- | ----- | ----- | --------------------------------------------------------- |
| **ddd-contracts**     | ~800  | YES   | Solid interfaces, clean separation                        |
| **ddd-utils**         | ~600  | YES   | Result monad is excellent, LibUtils comprehensive         |
| **ddd-value-objects** | ~400  | YES   | Good primitives, multi-format EntityId                    |
| **ddd-aggregates**    | ~900  | YES   | Capability system is innovative, prototype handling solid |
| **ddd-cqrs**          | ~1500 | YES   | Both basic and enhanced buses, middleware pipeline        |
| **ddd-events**        | ~800  | YES   | Unified bus, discovery plugin, metadata enrichment        |
| **ddd-validation**    | ~600  | YES   | Fluent API, specification integration, conditional rules  |

### Tier 2: Functional but Needs Polish (6-7/10)

| Package              | Lines | Assessment                                                        |
| -------------------- | ----- | ----------------------------------------------------------------- |
| **ddd-di**           | ~600  | SimpleContainer works but can't compete with Inversify/tsyringe   |
| **ddd-acl**          | ~500  | Unique in ecosystem, but registry needs auto-discovery            |
| **ddd-repositories** | ~400  | Good abstraction, version conflict detection, needs more adapters |
| **ddd-policies**     | ~400  | Temporal support interesting, but underused in consumer           |
| **ddd-nestjs**       | ~800  | Works but initialization is brittle (lifecycle timing issues)     |
| **ddd-testing**      | ~500  | Has builders/fixtures, but no Given-When-Then aggregate testing   |
| **ddd-resilience**   | ~600  | CB, retry, timeout, bulkhead -- comprehensive                     |

### Tier 3: Needs Significant Work (4-5/10)

| Package                   | Lines | Assessment                                         |
| ------------------------- | ----- | -------------------------------------------------- |
| **ddd-domain-primitives** | ~300  | Mostly error classes, thin                         |
| **ddd-domain-services**   | ~300  | Thin abstraction, unclear value over plain classes |
| **ddd-projections**       | ~400  | Basic, no real projection engine                   |
| **ddd-messaging**         | ~400  | Outbox pattern exists but no inbox/idempotency     |
| **ddd-logging**           | ~300  | Structured logger wrapper, not differentiated      |
| **ddd-cli**               | ~1000 | Examples engine only, no real scaffolding yet      |

---

## 5. Developer Experience (DX) Analysis

### 5.1 Onboarding Experience: POOR

**Problem**: A new developer picking up @vytches/ddd faces:

- 22 packages to understand
- No "quickstart" tutorial
- No runnable example project
- No interactive playground
- No migration guide from @nestjs/cqrs or plain NestJS
- No stackblitz/codesandbox template

**Comparison**: Emmett has a 5-minute getting-started that runs immediately.

### 5.2 Boilerplate per Feature: HIGH

**Real-world measurement from juz-ide-api:**

To add a single new command (e.g., "Change User Email"):

```
Files to create/modify:
1. command.ts              (~20 LOC)   - Command class
2. handler.ts              (~80 LOC)   - Handler with Result wrapping
3. domain event class      (~40 LOC)   - Event with GDPR segregation
4. event handler           (~30 LOC)   - Side effect handler
5. specification(s)        (~25 LOC each) - Business rule(s)
6. aggregate method        (~20 LOC)   - Domain logic
7. value object (if new)   (~30 LOC)   - Validated type
8. module registration     (~5 LOC)    - Provider array
9. unit test              (~50 LOC)   - Handler test
10. aggregate test         (~30 LOC)   - Domain test
─────────────────────────────────────────
TOTAL:                     ~330+ LOC for ONE command
```

**Comparison**: In Emmett, the same feature is ~60 LOC (command handler +
event + test).

### 5.3 API Ergonomics: MIXED

**Good patterns:**

```typescript
// Result monad -- excellent
const result = aggregate.changeEmail(newEmail);
if (result.isFailure) return Result.fail(result.error);

// Specifications -- clean composition
const canChange = new EmailNotTakenSpec(repo).and(new UserIsVerifiedSpec());
```

**Painful patterns:**

```typescript
// Handler base class boilerplate
@Injectable()
@CommandHandler(ChangeEmailCommand, { context: 'auth', timeout: 30000 })
export class ChangeEmailHandler extends BaseCommandHandler<
  ChangeEmailCommand,
  Result<void, AuthDomainError>
> {
  // 5 constructor dependencies injected
  // executeBusinessLogic() wraps everything in try/catch
  // Must manually convert between Result and Exception at boundaries
}

// Event creation is verbose (GDPR segregation)
const event = new EmailChangedEvent({
  piiData: { oldEmail, newEmail },
  anonymizedData: { userId: this.id },
  businessData: { changedAt: new Date(), requiresReverification: true },
});
```

### 5.4 Error Messages: ADEQUATE

- HandlerNotFoundError provides handler name
- VersionError shows expected vs actual versions
- Circular dependency detection shows the chain
- ACLError includes correlation IDs

**Missing**: No error recovery suggestions, no links to docs.

### 5.5 IDE Experience: GOOD

- TypeScript generics provide strong autocomplete
- Decorator metadata enables handler discovery
- Package-level type exports work well
- Path aliases (@vytches/ddd-\*) resolve correctly

---

## 6. Pain Points from Real-World Usage (juz-ide-api)

### Critical Pain Points

#### P1: Aggregate Bloat (severity: HIGH)

- OrganizationAggregate: **1,608 lines**
- EventAggregate: **1,376 lines**
- UserIdentityAggregate: **616 lines**
- **Root cause**: No built-in aggregate decomposition pattern (no
  policies-as-first-class, no decision tables)
- **Impact**: Files become hard to navigate, test, and review

#### P2: Specification Explosion (severity: HIGH)

- **237 specification files** in juz-ide-api
- Many are 20-30 LOC one-use specs
- `/src/contexts/organization/domain/specifications/member/` has 20+ specs just
  for member management
- **Root cause**: No inline specification support, every rule needs its own
  class
- **Impact**: File sprawl, navigation difficulty, refactoring friction

#### P3: Handler Discovery Brittleness (severity: HIGH)

- DDDModule.onApplicationBootstrap() has **100+ lines** of initialization
- Comments in code reference past issues with discovery timing
- VytchesExplorerService has `initialized` flag to prevent re-execution
- Workaround: manual `discoverHandlers()` and `registerHandler()` calls
- **Root cause**: NestJS lifecycle coupling, no graceful fallback
- **Impact**: New developers hit mysterious "handler not found" errors

#### P4: Event Payload API Instability (severity: MEDIUM)

- Recent migration from `event.getBusinessData()` to
  `event.payload?.businessData`
- Required updates in **168+ files**
- Test mocks broke across the board
- **Root cause**: Breaking API change in minor version
- **Impact**: Trust erosion, migration fatigue

### Significant Pain Points

#### P5: Repository Boilerplate (severity: MEDIUM)

- Before BaseKyselyRepository: **290+ LOC per repository**
- After: ~50 LOC, but mapper still repetitive (PII encryption/decryption)
- **Missing**: No ORM adapter packages (Prisma, Drizzle, TypeORM, Kysely)

#### P6: Cross-Context Communication Friction (severity: MEDIUM)

- ACL adapters must be manually registered in modules
- No auto-discovery for ACL (unlike command/query handlers)
- Plumbing required in each context module's `onModuleInit()`

#### P7: No Saga/Process Manager Support (severity: MEDIUM)

- juz-ide-api uses BullMQ queues for all async flows
- No saga orchestration, no compensation, no timeout handling
- Common DDD pattern completely absent

#### P8: Testing Toolkit Gap (severity: MEDIUM)

- No Given-When-Then syntax for aggregate testing
- No BDD-style domain behavior testing
- No snapshot testing for aggregates
- Consumer project hand-rolls all test patterns

---

## 7. Performance & Bundle Analysis

### Build System: EXCELLENT

- Vite 7.0.8 + NX 21.2.3 with caching
- Dual output: ESM + CJS
- Tree-shakeable exports
- Type bundling via rollup-plugin-dts

### Bundle Considerations

| Concern               | Status  | Notes                                      |
| --------------------- | ------- | ------------------------------------------ |
| Tree-shaking          | YES     | Per-package exports, explicit barrel files |
| Dead code elimination | YES     | Vite handles this                          |
| Peer dependencies     | Minimal | Only NestJS adapter has peers              |
| Meta-package size     | CONCERN | `@vytches/ddd` re-exports everything       |
| Runtime overhead      | LOW     | Most code is type-level, thin runtime      |

### Runtime Performance Observations

**EnhancedCommandBus overhead:**

- 60s TTL handler cache with LRU eviction (500 entries)
- Metrics collection enabled by default
- Middleware pipeline per command execution
- Resilience features (CB, retry, timeout) configurable but add overhead even
  when disabled
- **Recommendation**: Default to BasicCommandBus, opt-in to Enhanced

**AggregateRoot event enrichment:**

- `Object.create(Object.getPrototypeOf(event))` on every event apply
- Metadata sanitization loop on every event
- **Recommendation**: Cache prototype references, skip sanitization for trusted
  internal events

**Specification evaluation:**

- CompositeSpecification creates new spec objects on `.and()` / `.or()`
- With 237 specs, composition chains can be deep
- **Recommendation**: Evaluate lazy evaluation / short-circuit optimization

---

## 8. Type Safety & API Ergonomics

### Strengths

1. **Result<TValue, TError>** -- Excellent railway-oriented programming

   - `map()`, `flatMap()`, `match()`, `tap()`, `tapError()`
   - Async variants: `mapAsync()`, `flatMapAsync()`
   - `try()` / `tryAsync()` wrappers
   - Full type inference throughout chain

2. **Generic Aggregate/Entity system** -- `AggregateRoot<TId>` with flexible ID
   types

3. **Type-safe decorators** -- `@CommandHandler(CommandType)` preserves type
   info

4. **Capability type narrowing** -- `capability.isType<T>(type)` with type guard

### Weaknesses

1. **ValueObject equality** -- Uses `===` (works for primitives, breaks for
   complex types). Missing `hashCode()` for Set/Map usage.

2. **EntityId validation** -- No `isValid()` pre-check method. Must try/catch
   factory methods.

3. **ACL generics** -- `TResult = any` is too permissive. Should be `unknown`.

4. **Handler return types** -- Some handlers use `Promise<TResult>`, others
   `Promise<Result<T,E>>`. No enforced consistency.

5. **Event payload typing** -- `T = unknown` default means consumers must cast.
   Typed event factories would be better.

---

## 9. What's Missing vs World-Class

### Must-Have for "Best in World" Status

| #   | Gap                                            | Why It Matters                                             | Effort |
| --- | ---------------------------------------------- | ---------------------------------------------------------- | ------ |
| 1   | **npm public release**                         | Nobody can use a private GitHub Packages library           | S      |
| 2   | **Quickstart tutorial** (5 min to working app) | First impression determines adoption                       | M      |
| 3   | **Code generators / scaffolding**              | CLI should generate bounded contexts, aggregates, handlers | L      |
| 4   | **Saga / Process Manager**                     | Core DDD pattern, all competitors have it or plan it       | L      |
| 5   | **Given-When-Then aggregate testing**          | Emmett has it, it's expected                               | M      |
| 6   | **Inline specifications**                      | Kill the 237-file explosion problem                        | M      |
| 7   | **ORM adapter packages**                       | Prisma, Drizzle, Kysely, TypeORM adapters                  | L      |
| 8   | **Example repository**                         | Real-world reference app (like juz-ide-api but public)     | L      |
| 9   | **Event Store backends**                       | PostgreSQL, EventStoreDB, in-memory (like Emmett)          | L      |
| 10  | **v1.0 release**                               | Signals production readiness, SemVer stability promise     | M      |

### Should-Have for Competitive Edge

| #   | Gap                                       | Why It Matters                                         | Effort |
| --- | ----------------------------------------- | ------------------------------------------------------ | ------ |
| 11  | **Functional API alternative**            | Decider pattern alongside class-based for FP teams     | L      |
| 12  | **Aggregate decomposition helpers**       | Break 1600-line aggregates into capabilities/policies  | M      |
| 13  | **Auto-discovery for ACL adapters**       | Eliminate manual registration boilerplate              | M      |
| 14  | **Express/Fastify/Hono adapters**         | Not everyone uses NestJS                               | M      |
| 15  | **Inbox pattern + idempotency**           | Complete the messaging story (outbox exists)           | M      |
| 16  | **Event versioning with migration tools** | Upcaster exists, but no migration CLI                  | M      |
| 17  | **Branded types for IDs**                 | TypeScript-native pattern, prevents ID mixups          | S      |
| 18  | **Decision tables**                       | Reduce specification sprawl for complex rules          | M      |
| 19  | **Read model projections engine**         | Current projections package is thin                    | L      |
| 20  | **AI-assisted scaffolding**               | CLI + LLM generates bounded contexts from requirements | L      |

### Nice-to-Have for Delight

| #   | Gap                                 | Why                                                   |
| --- | ----------------------------------- | ----------------------------------------------------- |
| 21  | **Stackblitz/CodeSandbox template** | Try before install                                    |
| 22  | **VS Code extension**               | Aggregate visualization, handler navigation           |
| 23  | **Architecture visualization**      | Bounded context map from code                         |
| 24  | **Dual persistence**                | Swap ES <-> CRUD without domain changes (like noDDDe) |
| 25  | **Effect-ts integration**           | Growing community wants DDD + Effect                  |

---

## 10. Strategic Recommendations

### Phase 1: "Make It Accessible" (Weeks 1-4)

**Goal**: Anyone can find, install, and use the library in 5 minutes.

1. **Publish to npm** (public registry, not just GitHub Packages)
2. **Create quickstart guide**: "Build a Todo app with DDD in 5 minutes"
3. **Create example repository**: Clean, minimal bounded context showing all
   patterns
4. **Write migration guide**: "From @nestjs/cqrs to @vytches/ddd"
5. **Landing page / docs site**: Docusaurus or Starlight

### Phase 2: "Kill the Boilerplate" (Weeks 5-12)

**Goal**: 50% less code to implement a feature.

6. **CLI scaffolding**: `vytches-ddd generate context`, `generate aggregate`,
   `generate command`
7. **Inline specifications**: Allow lambda-style specs without separate classes
   ```typescript
   // Instead of: new MinimumAgeSpec().isSatisfiedBy(user)
   aggregate.validate(
     user,
     spec(u => u.age >= 18, 'Must be 18+')
   );
   ```
8. **Handler base class simplification**: Remove try/catch boilerplate,
   auto-Result wrapping
9. **Auto-discovery for ACL**: Same pattern as command/query handlers
10. **Repository generator**: CLI creates typed repo + mapper from aggregate

### Phase 3: "Complete the Patterns" (Weeks 13-24)

**Goal**: Cover every DDD pattern a team needs.

11. **Saga / Process Manager**: Orchestration-based, with compensation and
    timeout
12. **Event Store adapters**: PostgreSQL, EventStoreDB, In-Memory
13. **ORM adapters**: Prisma, Drizzle, Kysely
14. **Given-When-Then testing**:
    `AggregateTest.given(events).when(command).then(expectedEvents)`
15. **Inbox pattern + idempotency**: Complete reliable messaging story

### Phase 4: "Win the Market" (Weeks 25-36)

**Goal**: Become the default choice for TypeScript DDD.

16. **v1.0 release**: Stability promise, SemVer commitment
17. **Functional API**: Decider pattern as alternative to class-based aggregates
18. **Express/Fastify adapters**: Break NestJS exclusivity
19. **VS Code extension**: Aggregate visualization, context map
20. **Conference talks / blog posts**: Brand building

---

## 11. Roadmap Priority Matrix

```
                    HIGH IMPACT
                        |
    [npm publish]       |    [Saga/Process Manager]
    [Quickstart]        |    [Event Store adapters]
    [CLI scaffolding]   |    [ORM adapters]
    [Inline specs]      |    [Functional API]
    [GWT testing]       |
                        |
  LOW EFFORT -----------+----------- HIGH EFFORT
                        |
    [Branded types]     |    [VS Code extension]
    [ACL auto-discovery]|    [Dual persistence]
    [Migration guide]   |    [Effect integration]
    [Handler simplify]  |    [Architecture viz]
                        |
                    LOW IMPACT
```

### Immediate Wins (This Sprint)

1. `npm publish` -- literally just change registry config
2. Inline specification support -- ~200 LOC library change
3. Branded types for EntityId -- ~100 LOC
4. Auto-discovery for ACL adapters -- extend existing discovery plugin

### Quick Wins (Next 2 Sprints)

5. Given-When-Then aggregate testing API
6. CLI `generate aggregate` command
7. Handler base class simplification (remove try/catch ceremony)
8. Quickstart tutorial + example repo

---

## Appendix A: Library Stats

| Metric             | Value                                         |
| ------------------ | --------------------------------------------- |
| Total packages     | 22 (21 lib + 1 meta)                          |
| Total source LOC   | 28,761+                                       |
| TypeScript version | 5.8.2 (strict)                                |
| Build system       | NX 21.2.3 + Vite 7.0.8                        |
| Test framework     | Vitest 4.0.18                                 |
| Coverage target    | 80% (branches, functions, lines, statements)  |
| Module formats     | ESM + CJS                                     |
| CI/CD              | GitHub Actions (6 workflows)                  |
| Release strategy   | Independent versioning + conventional commits |
| Node requirement   | >=22.19.0                                     |

## Appendix B: Consumer Project Stats (juz-ide-api)

| Metric                  | Value                    |
| ----------------------- | ------------------------ |
| Bounded contexts        | 10+                      |
| Aggregates              | 237+ files               |
| Specifications          | 237 files                |
| Commands                | 200+                     |
| Queries                 | 100+                     |
| Event handlers          | 40+                      |
| Domain events           | 100+                     |
| Value objects           | 100+                     |
| Tests passing           | 16,305 (99.3%)           |
| Largest aggregate       | 1,608 LOC (Organization) |
| Boilerplate per command | ~330 LOC                 |

## Appendix C: Competitor Downloads (March 2026)

| Library      | Monthly Downloads | YoY Growth |
| ------------ | ----------------- | ---------- |
| @nestjs/cqrs | 1,294,202         | +61%       |
| Emmett       | 24,045            | +507%      |
| Castore      | 12,673            | +75%       |
| types-ddd    | 2,735             | +51%       |
| fmodel-ts    | 1,029             | stable     |
| @noddde/core | 748               | NEW        |
| @vytches/ddd | N/A               | private    |

---

_Report generated from analysis of full codebase, real-world consumer project
(juz-ide-api), and competitive market research._
