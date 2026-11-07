// Data behind `no-internal-imports`: what a consumer must not import from the library.

/** Subpaths that exist for sibling library packages only. */
export const INTERNAL_SUBPATHS: readonly string[] = Object.freeze(['/internal']);

/**
 * Subpaths of library packages that are part of the public contract, so a deep-subpath import
 * of them is fine. Everything else behind a package entry is private.
 */
export const PUBLIC_SUBPATHS: readonly string[] = Object.freeze([
  '/llm-context',
  '/llm-context.md',
  '/package.json',
]);

/** Symbols marked `@internal` in the library guides; they live behind `/internal` subpaths. */
export const INTERNAL_SYMBOLS: ReadonlySet<string> = new Set([
  'internalLogger',
  'EVENT_HANDLER_METADATA',
  'EVENT_HANDLER_OPTIONS',
  'CUSTOM_MIDDLEWARE_SYMBOL',
]);

/** True when `subpath` (leading slash) is an internal entry or sits below one. */
export function isInternalSubpath(subpath: string): boolean {
  return INTERNAL_SUBPATHS.some(base => subpath === base || subpath.startsWith(`${base}/`));
}

/** True when `subpath` is a documented public subpath. */
export function isPublicSubpath(subpath: string): boolean {
  return PUBLIC_SUBPATHS.includes(subpath);
}
