/**
 * Global Vitest setup for the monorepo.
 *
 * F-C3 (VB-002): `cqrs`, `di`, `events`, and `domain-services` used to carry
 * an unconditional `import 'reflect-metadata'` side-effect at the top of
 * several source files, which silently polyfilled decorator metadata for
 * every consumer (including internal tests) even though the packages declare
 * `sideEffects: false` — a bundler is free to strip a side-effecting import
 * from a `sideEffects: false` package, so relying on it was already unsound.
 *
 * `reflect-metadata` is now a `peerDependency` of those 4 packages (real
 * consumers must import it once at application bootstrap — see each
 * package's README). Internal tests across the workspace (most visibly the
 * `nestjs` package's test suite, which exercises decorator-heavy NestJS DI)
 * still need the polyfill loaded before any decorator runs. Rather than
 * scattering `import 'reflect-metadata'` across dozens of test files, it is
 * loaded once here via Vitest's `setupFiles`.
 */
import 'reflect-metadata';
