/**
 * Local copy of `safeRun` for contracts tests.
 *
 * Why a local copy instead of `import { safeRun } from '@vytches/ddd-utils'`:
 * `@vytches/ddd-utils` re-exports `Result` from `@vytches/ddd-contracts`
 * (REL-008 backward-compat shim), which makes the dependency direction
 * `utils → contracts`. Importing from utils inside a contracts test file
 * would close a cycle (`contracts/tests → utils → contracts`) and trip the
 * Nx `enforce-module-boundaries` rule.
 *
 * The helper is intentionally minimal — only the synchronous variant is
 * needed by the current contracts test suite. If async is needed later,
 * either extend this file or wait until `safeRun` itself is moved to
 * contracts (out of scope for VT-001 / VP-NEW-002).
 */

export function safeRun<T>(fn: () => T): readonly [Error | undefined, T | undefined] {
  try {
    return [undefined, fn()] as const;
  } catch (error) {
    return [error instanceof Error ? error : new Error(String(error)), undefined] as const;
  }
}
