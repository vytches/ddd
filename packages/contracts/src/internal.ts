/**
 * @vytches/ddd-contracts/internal
 *
 * Cross-package-only internal symbols. NOT part of the public consumer API —
 * these exist so sibling `@vytches/ddd-*` packages (which externalize
 * `@vytches/ddd-contracts` at build time and therefore can only reach it
 * through a declared `package.json#exports` entry) can share a single
 * implementation instead of duplicating it.
 *
 * VF-024 (AC4): moved out of the main `.` barrel (`src/index.ts`) — these
 * symbols used to be public API by accident. Consumers of `@vytches/ddd`
 * should never import from this subpath; it may change shape or be removed
 * without semver protection.
 */

// Internal library diagnostics shim (VS-010). Delegates to the configured
// DiagnosticsSink; not an application logging layer.
export { internalLogger } from './internal-logger';

// Framework-only event-handler metadata symbols (events decorator, nestjs
// explorer service).
export { EVENT_HANDLER_METADATA, EVENT_HANDLER_OPTIONS } from './events/event-handler-interface';
