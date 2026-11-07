import type { ESLint, Linter, Rule } from 'eslint';
import pkg from '../../package.json';
import { RECOMMENDED_RULES, rules, type RuleName } from '../rules';

/** Namespace consumers register the plugin under: rules are `ddd/<rule>`. */
export const PLUGIN_NAMESPACE = 'ddd';

/**
 * Plugin metadata read by ESLint (cache invalidation, error messages). `version` comes from
 * `package.json`, so it cannot drift from the released version.
 *
 * @beta
 * @since 0.32.0
 */
export interface DddPluginMeta {
  readonly name: string;
  readonly version: string;
  readonly namespace: string;
}

/**
 * Presets offered by the plugin, keyed by name.
 *
 * @beta
 * @since 0.32.0
 */
export interface DddConfigs {
  /**
   * Strictly incorrect use of the library API: error-severity rules plus the deprecation `warn`.
   * It sets no parser, no `files` and no `settings.ddd`, so it composes with the project's own
   * TypeScript setup.
   */
  readonly recommended: Linter.Config;
}

/**
 * The plugin object: `{ meta, rules, configs }`, in the shape ESLint flat config expects.
 *
 * @beta
 * @since 0.32.0
 */
export interface DddPlugin {
  readonly meta: DddPluginMeta;
  readonly rules: Readonly<Record<RuleName, Rule.RuleModule>>;
  readonly configs: DddConfigs;
}

/**
 * Plugin metadata (also `plugin.meta`).
 *
 * @beta
 * @since 0.32.0
 */
export const meta: DddPluginMeta = Object.freeze({
  name: pkg.name,
  version: pkg.version,
  namespace: PLUGIN_NAMESPACE,
});

const prefixed = (
  names: Readonly<Record<string, Linter.RuleEntry>>
): Record<string, Linter.RuleEntry> =>
  Object.fromEntries(
    Object.entries(names).map(([name, entry]) => [`${PLUGIN_NAMESPACE}/${name}`, entry])
  );

// The preset refers to the plugin object and the plugin object lists the preset: build the
// container first, fill it once the plugin exists, then freeze both.
const mutableConfigs = {} as { recommended: Linter.Config };

/**
 * The plugin object (also available as `configs.recommended.plugins.ddd`).
 *
 * @beta
 * @since 0.32.0
 */
export const plugin: DddPlugin = {
  meta,
  rules,
  configs: mutableConfigs,
};

mutableConfigs.recommended = Object.freeze({
  name: `${PLUGIN_NAMESPACE}/recommended`,
  plugins: { [PLUGIN_NAMESPACE]: plugin as unknown as ESLint.Plugin },
  rules: Object.freeze(prefixed(RECOMMENDED_RULES)),
}) as Linter.Config;

Object.freeze(mutableConfigs);
Object.freeze(plugin);

/**
 * Presets of the plugin (also `plugin.configs`).
 *
 * @beta
 * @since 0.32.0
 */
export const configs: DddConfigs = plugin.configs;
