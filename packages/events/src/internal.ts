/**
 * @vytches/ddd-events/internal
 *
 * Cross-package-only internal symbols. NOT part of the public consumer API.
 *
 * VF-024 (AC4): moved out of the main `.` barrel (`src/index.ts`). Consumers
 * of `@vytches/ddd` should never import from this subpath; it may change
 * shape or be removed without semver protection.
 */

/**
 * Framework-only middleware marker symbol.
 *
 * Used by custom bus implementations to detect middleware applied via
 * `Object.defineProperty(middleware, CUSTOM_MIDDLEWARE_SYMBOL, ...)`.
 */
export { CUSTOM_MIDDLEWARE_SYMBOL } from './base-event-bus';
