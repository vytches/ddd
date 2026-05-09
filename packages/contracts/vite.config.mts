// Contracts package - foundation layer with new optimized config.
//
// REL-008 (2026-05-08) moved Result<T,E> from `@vytches/ddd-utils` to
// `@vytches/ddd-contracts`. The utils package now re-exports Result from
// contracts as a backward-compat shim — that creates a *runtime* edge
// `utils → contracts`. The build-config import below is a *build-time*
// edge `contracts(vite.config) → utils(build-configs)` and is not part
// of the runtime dependency graph, but `@nx/enforce-module-boundaries`
// flags it as a cycle anyway. Suppressed locally with rationale.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { createFoundationConfig } from '../utils/build-configs';
export default createFoundationConfig(__dirname);
