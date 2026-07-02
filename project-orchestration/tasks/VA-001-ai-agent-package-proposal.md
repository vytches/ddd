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
reviewed_at:
  2026-07-02 (round 3 — five-agent verification panel; file restructured)
status: backlog
release_target: post-v0.27 (after production validation in a consuming project)
priority_score: 40/100
demand_signal:
  'juz-ide-api scoping AI integration — expect attention ~2026-08/09'
analysis: project-orchestration/analysis/VA-001-ai-agent-package-proposal.analysis.md
threat_model: docs/security/threat-models/TM-VA-001.md
```

> **Status**: CONCEPT po trzech rundach recenzji (2026-06-12 pięciu agentów;
> 2026-06-30/07-01 panel analityczny D1–D13, status `approved`; 2026-07-02 panel
> weryfikacyjny pięciu agentów, D14–D19 + rewizje). **Decyzja**: implementacja
> NIE startuje przed spełnieniem Entry Conditions (walidacja produkcyjna w
> juz-ide-api, ~2026-08/09). **Dla implementera**: sekcja _§ v0.1 Target
> Specification_ poniżej jest jedynym źródłem prawdy. Historia i uzasadnienia —
> _§ Decision Log_ na dole oraz plik analizy (decyzje D1–D19). Poprzednie wersje
> tego pliku (oryginalny koncept + warstwy korekt) — w git history.

---

## Problem Statement

When an LLM (Claude, GPT, Gemini) needs to invoke a domain action in a DDD
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

None of these are acceptable. The solution is a dedicated boundary layer: **AI
as a third driving adapter** (alongside HTTP and CLI), fully aware of DDD
boundaries. No handler needs to know that AI exists. Authorization, audit trail,
and domain integrity are preserved.

---

## § v0.1 Target Specification (source of truth, 2026-07-02)

### Design principles

- **Interfaces and patterns only** — zero domain implementations, zero business
  logic.
- **Zero external dependencies** — no zod, no LLM-provider SDKs, no LangChain,
  no NestJS in core (enforced structurally, see Guardrails).
- **Fail-closed by default** — every security-relevant seam refuses when
  unconfigured.
- **Registry-first, manual registration** — auto-discovery is explicitly
  rejected (security regression: every new handler would become AI-accessible).
  This is a feature, not a DX gap — document it as such.

### Dependency graph (acyclic — verified)

```
@vytches/ddd-agent
  peerDependencies:
    @vytches/ddd-contracts          ← Result<T>, IValidator<T>
    @vytches/ddd-domain-primitives  ← IActor, DefaultActorType ('ai_agent'), IAIActor
    @vytches/ddd-cqrs               ← ICommandBus
    @vytches/ddd-events             ← IntegrationEvent<T> (dopiero v0.2+)
  devDependencies:
    @vytches/ddd-testing            ← test utilities
    @vytches/ddd-validation         ← WYŁĄCZNIE przykłady/testy referencyjne
```

> **Uwaga (korekta D1, 2026-07-02)**: `IValidator<T>` pochodzi z
> `@vytches/ddd-contracts`
> (`packages/contracts/src/validation/validator.interfaces.ts`) —
> `@vytches/ddd-validation` NIE jest peer dependency i nie może nią zostać.

### Core types — final shapes

**Write tiers + default limits** (as const, tree-shakeable):

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
  [AIWriteTier.READ]: 100, // per minute
  [AIWriteTier.WRITE_LOW]: 30, // per hour
  [AIWriteTier.WRITE_MEDIUM]: 10, // per hour
  [AIWriteTier.WRITE_HIGH]: 3, // per hour
  [AIWriteTier.WRITE_DESTRUCTIVE]: 0, // disabled by default
};
```

**Permission — dyskryminowany union pola (OQ2 rev., exhaustiveness-checking)**:

```typescript
export type AIToolPermission =
  | { readonly kind: 'PUBLIC_NO_AUTH' } // świadoma, recenzowalna decyzja — nigdy default
  | {
      readonly kind: 'REQUIRED';
      readonly action: string;
      readonly subject: string;
    };
// dispatcher: switch (permission.kind) { ... default: assertNever(permission) }
// → trzeci wariant w v0.2 (np. REQUIRES_MFA) = compile error, nie cichy fail-open
```

**Tool definition — readonly, deklaratywny, z `toCommand` (D15)**:

```typescript
export interface AIToolDefinition<
  TParams = unknown,
  TCommand extends object = object,
> {
  readonly name: string;
  readonly description: string;
  /** Walidacja SYNTAKTYCZNA nieufnego inputu LLM na granicy (DTO-parsing).
   *  NIE zastępuje walidacji domenowej — niezmienniki nadal egzekwują VO/agregaty. */
  readonly inputSchema: IValidator<TParams>; // type-only import z @vytches/ddd-contracts
  /** Mapowanie AI→Command jako zwykła funkcja — Command pozostaje czysty od
   *  słownictwa adaptera (zastępuje static fromAI() / AICallableClass, D15). */
  readonly toCommand: (params: TParams) => TCommand;
  readonly requiredPermission: AIToolPermission; // obowiązkowe (D3)
  readonly writeTier: AIWriteTier;
  readonly examples?: ReadonlyArray<{
    readonly input: TParams;
    readonly description: string;
  }>;
}
```

**Dispatcher — port + fabryka (D14 + OQ3 rev.)**:

```typescript
export interface AIDispatchContext {
  readonly userId: string;
  readonly sessionId: string;
  readonly workflowName?: string;
  readonly stepName?: string;
}

export interface IAICommandDispatcher {
  dispatch<T>(
    toolName: string,
    rawParams: unknown,
    context: AIDispatchContext
  ): Promise<Result<T, AIDispatchError>>;
}

/** Kolejność 5 kroków zaszyta WEWNĄTRZ — nienadpisywalna (TM-VA-001-D1).
 *  Rozszerzenia przez dekorację całego dispatchera, nie subclassing. */
export function createAICommandDispatcher(deps: {
  registry: IAIToolRegistry;
  rateLimiter: IAIRateLimiter;
  permissionChecker: IPermissionChecker;
  commandBus: ICommandBus;
  errorTranslator: AIErrorTranslator;
}): IAICommandDispatcher;
```

**Registry — constructed-immutable (OQ4 rev.)**:

```typescript
export interface IAIToolRegistry {
  get(name: string): AIToolDefinition | undefined; // O(1), hot path per dispatch
  list(): readonly AIToolDefinition[]; // zmemoizowana, zamrożona
}

/** Kolizja nazw = jawny błąd przy bootstrapie (nie cichy overwrite). */
export function createAIToolRegistry(
  tools: readonly AIToolDefinition[]
): Result<IAIToolRegistry, AIToolRegistrationError>;
```

> **Guardrail**: registry jest WYŁĄCZNIE źródłem metadanych (budowa
> `tools/list`, resolve nazwy→definicji). Nigdy mechanizmem resolvingu
> zależności/serwisów — to byłby dryf w service locator.

**Seams wstrzykiwane przez konsumenta**:

```typescript
export interface IPermissionChecker {
  can(
    actor: IActor,
    permission: { action: string; subject: string }
  ): Promise<boolean>;
}

export interface IAIRateLimiter {
  checkAndConsume(userId: string, tier: AIWriteTier): Promise<boolean>;
}
// Implementacje (Redis/Valkey, RBAC/ABAC engine) żyją u konsumenta.
// Dispatcher fail-closed: odmawia konstrukcji bez IPermissionChecker,
// jeśli jakikolwiek zarejestrowany tool ma permission.kind === 'REQUIRED' (D3).
```

**Error boundary (D4, D7, D18)**:

```typescript
export abstract class AIErrorTranslator<TError = Error> {
  abstract translate(error: TError): AIErrorResponse;
}

export interface AIErrorResponse {
  readonly userMessage: string;
  readonly category:
    | 'validation_error'
    | 'permission_denied'
    | 'rate_limited'
    | 'internal_error';
  readonly retryable: boolean;
  readonly leaked: false; // gwarancja typu; weryfikacja runtime: assertNoLeakage
}
// v0.1 dostarcza domyślną konserwatywną implementację (nigdy error.message,
// ale Z taksonomią kategorii — LLM musi wiedzieć czy retry ma sens, D18)
// + test helper assertNoLeakage(translator, sampleErrors) w /testing (D7).
```

**Actor (D5 + D19)** — zmiany w `@vytches/ddd-domain-primitives`, nie w tym
pakiecie: `DefaultActorType` + `'ai_agent'` (additive) oraz typowany,
dyskryminowany
`IAIActor extends IActor { type: 'ai_agent'; aiSessionId: string; modelId?: string }`.
Dispatcher konstruuje `IAIActor` deterministycznie z `AIDispatchContext` — nigdy
nie przyjmuje actora od wywołującego (anti-spoofing, TM-VA-001-R1).

**Testing (`@vytches/ddd-agent/testing`)**: `MockAICommandDispatcher` (kontrakt
zgodny z D14: `assertDispatched(toolName)`), `assertNoLeakage`.

### Dispatcher pipeline (kolejność wymuszona przez fabrykę)

```
LLM → dispatch(toolName, rawParams, context)
       0. registry.get(toolName)                        ← unknown tool = jawny błąd
       1. rateLimiter.checkAndConsume(userId, tier)      ← rate limit
       2. permissionChecker.can(actor, permission)       ← type-level RBAC (fail-closed)
       3. inputSchema.validate(rawParams)                ← Result, nie throw (D4)
       4. tool.toCommand(validated)                      ← tylko czyste dane do Command
       5. commandBus.execute(command)                    ← handler nie wie o AI
   Wszystkie kroki objęte JEDNYM error boundary → AIErrorTranslator (D4).
   LLM nigdy nie widzi stack trace / internals (TM-VA-001-I1).
```

> **Rezydualna odpowiedzialność handlera (D17)**: krok 2 to RBAC na poziomie
> TYPU. Autoryzacja instance-level (ABAC — „czy TEN actor może edytować TĘ
> encję") strukturalnie nie może zajść w dispatcherze (brak sparsowanych danych
> przed krokiem 3). Handler MUSI ją nadal egzekwować (defense-in-depth).

### Deferred to v0.2+

- **`AIToolCallRecord`** (preferowana nazwa, OQ7 rev.; dawniej
  `AIWorkflowStepTracedPayload`) — kontrakt call-logu (kto/co/kiedy/wynik),
  provider-neutral z definicji (normalizacja formatu providera dzieje się PRZED
  dispatcherem), interfejs bez storage (D13). Highest churn risk — freeze last,
  po danych produkcyjnych z juz-ide-api. Notatki: `durationMs` z
  `performance.now()`; emisja tania przy braku subskrybenta; `costMicroUsd`
  (integer), nie float.
- Introspekcja schema / `toGenericToolSchema()` (D2) — wymaga wcześniej
  publicznego dostępu do `schema` w `ddd-validation` (dziś `protected`).
- `IAIWorkflow` (interface only, jeśli w ogóle) — orkiestracja jest
  out-of-scope.
- `@vytches/ddd-agent-nestjs` — osobny pakiet (nie subpath); dekorator `@AITool`
  tylko tam. Nigdy importowany zwrotnie przez `@vytches/ddd-nestjs` (cykl!).

### Zmiany zależne w innych pakietach (przed cięciem v0.1)

| Pakiet                  | Zmiana                                                                                           | Powód                    |
| ----------------------- | ------------------------------------------------------------------------------------------------ | ------------------------ |
| `ddd-domain-primitives` | `DefaultActorType` + `'ai_agent'`; `IAIActor`                                                    | D5                       |
| `ddd-domain-primitives` | Naprawa dryfu docs: kod ma 7 wartości, `LLMGUIDE.md` i `README.md` dokumentują sprzeczne zestawy | D19 — razem z D5, nie po |
| `ddd-validation`        | Publiczny dostęp do `schema` (`BaseValidationAdapter.schema` jest `protected`)                   | D2 (v0.2+)               |

### Structural guardrails (część definicji ukończenia, D16)

- `.eslintrc.json`: wpis `scope:agent` (tag `layer:integration`, wzorem `acl`) w
  `depConstraints` —
  `onlyDependOnLibsWithTags: [scope:contracts, scope:domain-primitives, scope:cqrs, scope:events, scope:testing]`.
- `no-restricted-imports` w `packages/agent`: `zod`, `langchain*`, `openai`,
  `@anthropic-ai/*` (dependency-creep pojawił się już 2×: zod 2026-06-12,
  LangChain 2026-07-01).
- Testy `expect-type`: exhaustiveness `AIToolPermission`, kształt `toCommand`,
  `readonly` pól `AIToolDefinition` — przed zamrożeniem v0.1.

### Documentation commitments (v0.1)

1. Quickstart z **wklejalnym inline** `ZodAdapter` (kopia recepty z
   `HOW-TO-validation.md` §10) — nie sam odnośnik.
2. Minimalny „first successful `dispatch()`" ze stubami rate-limitera i
   permission-checkera (cel: 15 minut do produktywności).
3. Jawna nota: manualna rejestracja to **cecha bezpieczeństwa**, nie brak DX.
4. Nota ABAC (D17) przy dokumentacji pipeline'u.
5. Strona „Writing Good AI Tool Descriptions" (`description`/`examples` trafiają
   do kontekstu LLM i decydują o trafności wyboru narzędzia).
6. Sekcja Provider & Framework Recipes (niżej) jako wersja robocza strony docs.

---

## Provider & Framework Recipes (docs-only — draft przyszłej strony)

Zasada: biblioteka NIGDY nie zależy od providera/frameworka. Każda integracja to
przepis w dokumentacji z wklejalnym snippetem (OQ6):

- **Walidacja (zod / valibot / arktype)** — adapter do `IValidator<T>`;
  rekomendowany wzorzec: `BaseValidationAdapter` z `ddd-validation` (istniejący
  `ZodAdapter` z `HOW-TO-validation.md`).
- **Tool schema (MCP `tools/list` / Anthropic `input_schema` / OpenAI
  `parameters`)** — przez hook introspekcji schema (D2, v0.2+) +
  `zod.toJSONSchema()` po stronie konsumenta.
- **LangChain** — konsument buduje własny `StructuredTool` z
  `AIToolDefinition.{name, description, examples}` + JSON Schema (D10).
- **LangSmith** — tracing jednokierunkowy (consumer → LangSmith, nigdy
  odwrotnie): widok „co LLM robił" za darmo przez `LANGCHAIN_TRACING_V2`; widok
  domenowy przez subskrypcję na `IntegrationEvent<AIToolCallRecord>` (v0.2+) i
  własny eksporter (D12).
- **Topologia** — domyślnie in-process: pętla orkiestracji w TYM SAMYM procesie
  co `CommandBus`, `InProcessAICommandDispatcher` woła `commandBus.execute()`
  jako zwykłą funkcję, zero HTTP. `RemoteAICommandDispatcher` (HTTP/gRPC)
  dopiero przy świadomym wydzieleniu AI-gateway — decyzja topologii konsumenta
  (D11).

---

## What the Package Does NOT Contain

| Component                                  | Why it stays out                            |
| ------------------------------------------ | ------------------------------------------- |
| Concrete AI workflows / `AIWorkflowEngine` | Orkiestracja jest project-specific          |
| AISession aggregate                        | A product concern, not a library            |
| OpenAI/Anthropic/LangChain clients         | LLM provider is not a DDD concern           |
| BudgetTracker                              | Infrastructure concern                      |
| Rate-limiter / permission-checker impls    | Infrastructure — library ships seams only   |
| Call-log storage / query API               | Konsument buduje read-model z eventów (D13) |
| Intent identification logic                | LLM call — outside DDD boundary             |

---

## Entry Conditions before implementation (consensus — unchanged)

Implementation stays **deferred**; the trigger is concrete:

1. **Production validation** — juz-ide-api runs the AI boundary in production
   for 2-3 months and the core interfaces (`IAICommandDispatcher`,
   `AIToolDefinition`, `actorType`) prove stable. _(Primary trigger — likely
   ~2026-08/09.)_
2. **Core quality green first** — current project priority (JSDoc, ts-paths,
   flaky test) must not be displaced. VA-001 does not jump the queue.
3. **Pre-implementation step** — extract the patterns from juz-ide-api's real
   usage and diff against _§ v0.1 Target Specification_ before cutting v0.1.
   Build one end-to-end recipe (1 command + AIToolDefinition + InProcess
   dispatcher + L1 mock test + L2 actorType assertion) **in juz-ide-api** first.
   Include a fresh look at the then-current MCP spec (does `AIToolDefinition`
   still map 1:1 to `tools/list`).
4. **Guardrails in place** — ESLint `scope:agent` + `no-restricted-imports`
   (D16) land with the package skeleton, not after.

---

## § Decision Log / Design History

Pełne wersje historyczne — git history tego pliku. Pełne uzasadnienia decyzji —
`project-orchestration/analysis/VA-001-ai-agent-package-proposal.analysis.md`.

**2026-05-20 — oryginalny koncept.** AI jako trzeci driving adapter; szkice API
pisane „z głowy" — odwoływały się do 3 nieistniejących symboli
(`@vytches/ddd-core`, `BaseIntegrationEvent`, `RequestContext`) i zakładały peer
dep na `zod`.

**2026-06-12 — recenzja #1 (5 agentów: api-guardian, library-expert,
developer-experience, performance-optimizer, product-owner).** Werdykt: kierunek
słuszny, spec skorygowana. Kluczowe korekty: (1) `ddd-core`→`ddd-contracts`+
`ddd-domain-primitives`; (2) `BaseIntegrationEvent`→`IntegrationEvent<T>`; (3)
`RequestContext` nie istnieje → rozszerzenie `DefaultActorType`; (4) zod OUT →
własna abstrakcja walidacji; (5) rate-limiting jako interfejs + stałe, nie
implementacja in-memory; (6) `as const` zamiast `enum`; (7) provider tool-schema
converters → docs-only; (8) registry-first, dekorator tylko w przyszłym
subpakiecie nestjs; (9) `fromAI` przez constraint typu. Ustalono zakres v0.1 i
entry conditions.

**2026-06-30/07-01 — analiza #2 (panel: security-audit/threat-model,
backend-technology-expert/external research, ddd-patterns-expert,
performance-optimizer, architecture-guardian).** Decyzje D1–D13, status
`approved`. Najważniejsze: D1 reuse `IValidator<T>` zamiast bespoke
`SchemaValidator<T>` (type-erasure blokował budowę `tools/list`); D3
`requiredPermission` obowiązkowe, fail-closed (TM-VA-001-E1, HIGH); D4 cały
pipeline za `AIErrorTranslator` (TM-VA-001-I1, HIGH — wyciek internals do
kontekstu promptu); D5 typowany `IAIActor`; D9 nazwa `@vytches/ddd-agent`
potwierdzona; D10-D12 LangChain/LangSmith docs-only, topologia in-process; D13
call-log jako kontrakt bez storage. Rozstrzygnięto OQ1-OQ7.

**2026-07-02 — weryfikacja #3 (panel: library-api-guardian,
architecture-guardian, performance-optimizer, developer-experience,
ddd-compliance-guardian).** Kierunek i 10/13 decyzji potwierdzone; korekty i
rewizje:

- **Korekta faktu w D1**: `IValidator<T>` żyje w `@vytches/ddd-contracts`, nie w
  `ddd-validation` — nowy peerDependency zbędny.
- **OQ2 → `AIToolPermission` kind-union** zamiast sentinel-stringa
  (exhaustiveness; trzeci wariant = compile error, nie cichy fail-open).
- **OQ3 → fabryka `createAICommandDispatcher`** zamiast abstract class (subclass
  mógłby nadpisać krok pipeline'u; protected sygnatury = najdroższa ewolucja
  API).
- **OQ4 → registry constructed-immutable** z `get(name)` O(1) i kolizją nazw
  jako błędem konstrukcji; `readonly` na polach `AIToolDefinition`.
- **OQ5 → restrukturyzacja tego pliku** (wykonana) zamiast czwartej warstwy
  korekt — pole `inputSchema` przeszło już 3 typy w jednym dokumencie.
- **OQ7 → nazwa `AIToolCallRecord`** zapisana jako preferowana już teraz;
  kształt pól nadal v0.2+.
- **D14**: rozstrzygnięta niespójność sygnatury —
  `dispatch(toolName, rawParams, context)` (spójne z D13; dispatcher wykonuje
  kroki 3-4, nie może dostawać gotowej komendy).
- **D15**: `AIToolDefinition.toCommand` zamiast
  `static fromAI()`/`AICallableClass` — Command czysty od słownictwa adaptera
  (propose_adr).
- **D16–D19**: guardraile ESLint; luka ABAC udokumentowana; taksonomia kategorii
  w domyślnym `AIErrorTranslator`; naprawa dryfu docs `DefaultActorType` razem z
  D5.

---

_Concept created: 2026-05-20 · Migrated: 2026-05-22 · Restructured per OQ5:
2026-07-02_
