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
 */
export { Result } from '@vytches/ddd-contracts';
