/**
 * Result<T, E> — moved to @vytches/ddd-contracts in REL-008 (2026-05-08).
 *
 * This file is now a re-export shim preserving backwards compatibility for
 * consumers importing `Result` from `@vytches/ddd-utils`. New code should
 * import directly from `@vytches/ddd-contracts`:
 *
 *   import { Result } from '@vytches/ddd-contracts';
 *
 * The shim has zero runtime cost — it is a compile-time re-export only.
 *
 * The eslint-disable below silences a false positive from
 * `@nx/enforce-module-boundaries`: `packages/contracts/vite.config.mts`
 * imports build helpers from this package, creating a *build-time* cycle
 * detection. Runtime dependency is one-way (utils → contracts), correct
 * per package.json — see contracts/vite.config.mts for the matching note.
 */
// eslint-disable-next-line @nx/enforce-module-boundaries
export { Result } from '@vytches/ddd-contracts';
