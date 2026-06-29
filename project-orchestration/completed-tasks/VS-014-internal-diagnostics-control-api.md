# Task: Internal diagnostics control API (configurable sink + level)

## Task Metadata

```yaml
task_id: VS-014
title:
  "diagnostics: configureDiagnostics({ sink, level }) — consumer control over
  library's own diagnostics"
type: feature
priority: medium
complexity: medium
estimated_time: 5h
created_by: agent
created_at: 2026-06-04
updated_at: 2026-06-29
status: done
depends_on: VS-013
adr_ref: docs/adr/0037-internal-diagnostics-control-sink-injection.md
memory_ref: feedback_logging_internal_only
target_version: 0.4.0
reverses:
  "feedback_logging_internal_only 'no public hook/setter' — conscious decision
  2026-06-04"
```

## Domain Context

```yaml
bounded_context: Library Infrastructure / Diagnostics
patterns:
  - Sink injection (strategy)
  - Public API design (additive, non-breaking)
```

## Business Context

### Why This Task Exists

VS-013 removed the application-logging layer and left a minimal `internalLogger`
(console shim, `@internal`, consolidated in `contracts`). An enterprise library
that writes to `console` with **no way for the consumer to silence or redirect**
that output is a DX anti-pattern. Consumers use their own logger (Pino) and must
be able to quiet or reroute the library's own diagnostics.

This consciously reverses the earlier "no public hook/setter" stance — see
ADR-0037 and `feedback_logging_internal_only` (which itself anticipated a "new
redesign task to follow").

### Expected Business Value

- [ ] Consumers can silence library diagnostics (production/tests) or route them
      to their own logger
- [ ] One consistent, controllable diagnostic channel across all packages
- [ ] Enterprise-grade DX (no uncontrollable dependency noise)

### Success Metrics

- Consumer can `configureDiagnostics({ level: 'silent' })` and see zero library
  console output
- Consumer can inject a Pino-backed sink and receive all library diagnostics
- Zero breaking changes (additive only)

## Technical Context

### Current State

`internalLogger` (in `packages/contracts/src/internal-logger.ts`) is a fixed
`console.warn`/`console.error` shim. No control surface. A consumer could only
monkeypatch the exported mutable object — an undocumented footgun.

### Desired State

Encapsulated control API (see ADR-0037):

```ts
export interface DiagnosticsSink {
  warn(message: string, context?: Record<string, unknown>): void;
  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void;
}
export type DiagnosticsLevel = 'silent' | 'error' | 'warn';
export interface DiagnosticsOptions {
  sink?: DiagnosticsSink;
  level?: DiagnosticsLevel;
}
export function configureDiagnostics(options: DiagnosticsOptions): void;
```

- Module-private `currentSink` (default console) + `currentLevel` (default
  `'warn'`); neither exported → no monkeypatch.
- `internalLogger` stays `@internal`, delegates to `currentSink` gated by
  `currentLevel`. ~25 existing call sites unchanged.
- `DiagnosticsSink` + `DiagnosticsLevel` + `configureDiagnostics` exported from
  contracts barrel AND re-exported by name from `@vytches/ddd` (enterprise).

### Technical Constraints

- Backward compatibility: purely additive (new exports), non-breaking → minor.
- Invariant preserved: `internalLogger` receives only metadata, never
  payloads/PII.
- Dependency-free.

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] `configureDiagnostics({ sink })` routes all library diagnostics to the
      sink
- [ ] `configureDiagnostics({ level: 'silent' })` suppresses all output
- [ ] `level: 'error'` passes only `error()`; `level: 'warn'` passes both
- [ ] Defaults (no call) = console sink, level `'warn'` (current behaviour)
- [ ] `internalLogger` no longer externally mutable (delegation, private state)
- [ ] Exports reachable from `@vytches/ddd` (not only `@vytches/ddd-contracts`)

### Non-Functional Requirements

- [x] Testing: unit tests for sink injection, each level, default, delegation
- [x] Documentation: ADR-0037 + README diagnostics section + consumer example
- [x] Security: invariant audit — sink never receives payloads/PII
- [x] API: library-api-guardian confirms additive/non-breaking

### Definition of Done

- [x] Implemented + reviewed (library-quality-verifier — GO)
- [x] Tests passing (>80% new code) — contracts 118/118, enterprise 1/1
- [x] api-surface snapshots updated (contracts + enterprise) intentionally
- [x] ADR-0037 accepted; changeset added
- [x] Backward-compat confirmed (library-api-guardian)

## Implementation Plan

> **Blocked until VS-013 base is green** (build/typecheck/snapshots). Do NOT
> build public API on an unverified refactor.

### Phase 1: Core control API (contracts)

- **Agent**: library-expert (impl) + backend-technology-expert (sink pattern)
- **Tasks**:
  - [ ] `DiagnosticsSink`, `DiagnosticsLevel`, `DiagnosticsOptions`,
        `configureDiagnostics` in contracts
  - [ ] `internalLogger` → delegating impl over private
        `currentSink`/`currentLevel`
  - [ ] Default console sink + noop; level gating
  - [ ] Export from contracts barrel (control API public; `internalLogger`
        `@internal`)
- **Output**: control API + delegation

### Phase 2: Meta re-export + tests

- **Agent**: library-expert + library-api-guardian
- **Tasks**:
  - [ ] Re-export `DiagnosticsSink`/`DiagnosticsLevel`/`configureDiagnostics` by
        name from `@vytches/ddd` (enterprise)
  - [ ] Unit tests: sink injection, levels (silent/error/warn), default,
        delegation, non-mutability
  - [ ] Update api-surface snapshots (contracts + enterprise)
- **Output**: public reach + green tests

### Phase 3: Docs

- **Agent**: documentation-master
- **Tasks**:
  - [x] ADR-0037 → accepted
  - [x] README: "Controlling library diagnostics" + Pino example + silence
        example
  - [x] Changeset (minor)
- **Output**: docs + changeset

## Code References

### Files to Modify

```yaml
packages:
  - package: '@vytches/ddd-contracts'
    files:
      - src/diagnostics/diagnostics-sink.ts # new: interface + configureDiagnostics + state
      - src/internal-logger.ts # refactor → delegate to currentSink
      - src/index.ts # export control API
      - tests/diagnostics/*.test.ts # new
  - package: '@vytches/ddd-enterprise'
    files:
      - src/index.ts # re-export control API by name
      - tests/__snapshots__/api-surface.test.ts.snap # intentional snapshot update
```

## Risk Assessment

| Risk                                        | Probability | Impact | Mitigation                                                               |
| ------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------ |
| Reverses prior non-export stance            | —           | —      | Conscious decision, ADR-0037 + memory updated                            |
| Sink leaks PII (consumer logs context)      | Low         | Med    | Invariant: internalLogger emits metadata only; document in sink contract |
| Built on unverified VS-013 base             | Med         | High   | Hard dependency: VS-013 green first                                      |
| Global mutable state (configureDiagnostics) | Low         | Low    | Documented as process-global; acceptable for diagnostics                 |

## Security Considerations

> Threat model: [TM-VS-014](../../docs/security/threat-models/TM-VS-014.md)
> (STRIDE + DREAD + LINDDUN, 2026-06-18). **Verdict: PROCEED** — addytywne,
> non-breaking; dwa blokery przed merge.

**Top findings:**

| ID  | Zagrożenie                                                               | DREAD  | Priorytet | Mitygacja (blokująca?)                                     |
| --- | ------------------------------------------------------------------------ | ------ | --------- | ---------------------------------------------------------- |
| D1  | Wyjątek z konsumenckiego sinka propaguje w ścieżkę sterowania biblioteki | **11** | HIGH      | **R1** try/catch + fallback wokół `currentSink.*` (BLOKER) |
| I1  | Złamanie niezmiennika PII → payload do konsumenckiego sinka              | **10** | MEDIUM↑   | **R2/R4** audyt ~25 call-site'ów + spy-sink test (BLOKER)  |
| I2  | Wrażliwe dane osadzone w `Error` przekazanym do sinka                    | 9      | MEDIUM    | R3 kontrakt sinka „traktuj `Error` jako wrażliwy"          |
| T1  | Hijack kanału przez globalny stan (zależność tranzytywna)                | 7      | MEDIUM↓   | S3 dokument: process-global, last-write-wins (świadome)    |

**Blokery merge:** R1 (izolacja sinka) + R2/R4 (audyt + test niezmiennika
metadata-only). Niezmiennik „internalLogger niesie wyłącznie metadane, nigdy
payloadów/PII" jest **load-bearing** — sink to nowe konsumenckie ujście tych
danych. Default safety: `level: 'warn'`, console sink,
`currentSink`/`currentLevel` nieeksportowane (brak monkeypatch). Privacy
(LINDDUN): netto LOW-MEDIUM, warunkowane utrzymaniem niezmiennika; brak
maskowania w bibliotece (obowiązek sinka konsumenta —
[[feedback_logging_internal_only]]).

## Testing Strategy

### Unit Tests

- [ ] Default (no configure) → console, both warn+error
- [ ] `{ level: 'silent' }` → nothing emitted
- [ ] `{ level: 'error' }` → only error passes
- [ ] `{ sink }` → custom sink receives calls with metadata
- [ ] `internalLogger` delegates to currently-configured sink
- [ ] `internalLogger` not externally reassignable (encapsulation)

## Links & References

### Related Tasks

- VS-013: remove application-logging layer (dependency; introduces
  internalLogger)
- VS-009/010(datamasker)/011/012: cancelled (obsolete logging-hardening series)

### External Resources

- ADR-0037: internal diagnostics control via sink injection
- Memory: `feedback_logging_internal_only` (reversed re: hook)

## Final Notes

Decyzja właściciela 2026-06-04: budujemy bibliotekę enterprise — diagnostyka ma
być kontrolowalna przez konsumenta (cisza/przekierowanie), intencjonalnym API, a
nie przypadkowo-mutowalnym `const`. Wybrano bogatsze API (`configureDiagnostics`
z `level`) zamiast minimalnego sink-settera. Implementacja czeka na zielony
build VS-013.

---

_Task managed by Project Orchestrator | Last AI Review: 2026-06-04_
