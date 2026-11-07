import type { Rule } from 'eslint';
import {
  createRoleResolver,
  type ResolverFs,
  type ResolverWarning,
  type RoleResolver,
  type RoleResolverOptions,
} from '../resolver';
import { DddConfigError } from './errors';
import { parseSettings, SETTINGS_KEY } from './settings';

/**
 * The slice of an ESLint rule context the plugin configuration is read from.
 *
 * @beta
 * @since 0.32.0
 */
export type SettingsContext = Pick<Rule.RuleContext, 'settings'> & { readonly cwd?: string };

/**
 * Resolver options for a project: `settings.ddd` (validated by shape) plus its root. Use it to
 * feed `validateRoleConfig` in a gate, so CI and the lint run read one configuration.
 *
 * @beta
 * @since 0.32.0
 */
export function roleConfigFromSettings(cwd: string, rawSettings: unknown): RoleResolverOptions {
  const settings = parseSettings(rawSettings);
  return {
    cwd,
    ...(settings.bindings === undefined ? {} : { bindings: settings.bindings }),
    ...(settings.tsconfig === undefined ? {} : { tsconfig: settings.tsconfig }),
    ...(settings.includeLibraryRoles === undefined
      ? {}
      : { includeLibraryRoles: settings.includeLibraryRoles }),
    ...(settings.maxDepth === undefined ? {} : { maxDepth: settings.maxDepth }),
  };
}

/** @beta @since 0.32.0 */
export interface SettingsResolverOptions {
  readonly fs?: ResolverFs;
  readonly onWarning?: (warning: ResolverWarning) => void;
}

/**
 * Callable that builds (and caches) the role resolver for a rule context. It satisfies the
 * `resolver` option of `roleScoped`.
 *
 * @beta
 * @since 0.32.0
 */
export interface SettingsResolver {
  (context: SettingsContext): RoleResolver;
  /** Drops every cached resolver (and so its validation result). Call between independent runs. */
  reset(): void;
}

/** Cache key part for `settings.ddd`; a non-serializable value (e.g. circular) is a config error. */
function serializeSettings(raw: unknown): string {
  try {
    return JSON.stringify(raw ?? null);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new DddConfigError([
      {
        code: 'invalid-settings',
        path: SETTINGS_KEY,
        message: `settings.${SETTINGS_KEY} is not serializable (${detail}); use plain JSON-compatible values.`,
      },
    ]);
  }
}

/**
 * Creates a settings-driven resolver provider with its own cache. For one `cwd` + `settings.ddd`
 * pair the resolver is built once; its bindings are checked (validation level i, D11) on the
 * first use and a {@link DddConfigError} is thrown while they are unresolvable. Failures are
 * not cached, so a fixed binding is picked up on the next file.
 *
 * @beta
 * @since 0.32.0
 */
export function createSettingsResolver(options: SettingsResolverOptions = {}): SettingsResolver {
  const cache = new Map<string, RoleResolver>();

  const provider = (context: SettingsContext): RoleResolver => {
    const cwd = context.cwd ?? process.cwd();
    const raw: unknown = context.settings?.[SETTINGS_KEY];
    const key = `${cwd}\0${serializeSettings(raw)}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const resolver = createRoleResolver({
      ...roleConfigFromSettings(cwd, raw),
      ...(options.fs === undefined ? {} : { fs: options.fs }),
      ...(options.onWarning === undefined ? {} : { onWarning: options.onWarning }),
    });
    const problems = resolver.checkBindings();
    if (problems.length > 0) {
      throw new DddConfigError(
        problems.map(p => ({ code: p.code, role: p.role, message: p.message }))
      );
    }
    cache.set(key, resolver);
    return resolver;
  };

  return Object.assign(provider, { reset: () => cache.clear() });
}

/**
 * Default provider shared by the plugin's rules: `roleScoped(rule, 'Aggregate', { resolver:
 * resolverFromSettings })`.
 *
 * @beta
 * @since 0.32.0
 */
export const resolverFromSettings: SettingsResolver = createSettingsResolver();
