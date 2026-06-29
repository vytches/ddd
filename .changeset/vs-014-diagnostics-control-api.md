---
'@vytches/ddd': minor
'@vytches/ddd-contracts': minor
---

feat(diagnostics): add `configureDiagnostics` public control API (VS-014)

Adds a consumer-facing `configureDiagnostics(options)` function that lets
library users silence or redirect the library's own internal diagnostic output
without monkey-patching `console`.

**New exports from `@vytches/ddd-contracts` and `@vytches/ddd`:**

- `configureDiagnostics(options: DiagnosticsOptions): void` — configure the
  active sink and level
- `DiagnosticsSink` — interface for custom sink implementations
- `DiagnosticsLevel` — `'silent' | 'error' | 'warn'`
- `DiagnosticsOptions` — options bag for `configureDiagnostics`

**`internalLogger` now delegates** to the configured `DiagnosticsSink` instead
of writing directly to `console`. This is a non-breaking change — the default
behaviour (console output at `warn` level) is preserved.

**Usage:**

```ts
import { configureDiagnostics } from '@vytches/ddd';

// Silence all library output (e.g. in tests):
configureDiagnostics({ level: 'silent' });

// Route to Pino:
configureDiagnostics({
  sink: {
    warn: (m, c) => pino.warn(c, m),
    error: (m, e, c) => pino.error({ ...c, err: e }, m),
  },
});
```
