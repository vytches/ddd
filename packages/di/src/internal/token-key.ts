import type { ServiceToken } from '../types';

/**
 * Produces a human-readable description of a service token for use in
 * error messages, logging, and diagnostics.
 *
 * This is a DISPLAY helper only — it is intentionally lossy and MUST NOT
 * be used as an identity key. Token identity lives in the container maps
 * themselves (`Map<ServiceToken, ...>`), where functions and symbols are
 * keyed by reference and strings by value (see ADR-0034).
 *
 * Guarantees:
 * - Never throws, for any input (including degenerate non-token values).
 * - String tokens are rendered as-is.
 * - Symbol tokens render via their description (e.g. `Symbol(UserRepo)`).
 * - Named classes/functions render via their `name`.
 * - Anonymous functions render as a stable readable placeholder.
 *
 * @internal Not exported from the package barrel.
 */
export function describeToken(token: ServiceToken): string {
  try {
    if (typeof token === 'string') {
      return token;
    }

    if (typeof token === 'symbol') {
      return token.toString();
    }

    if (typeof token === 'function') {
      return token.name || '[anonymous function]';
    }

    return String(token);
  } catch {
    return '[unknown token]';
  }
}
