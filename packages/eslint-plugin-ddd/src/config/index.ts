// Internal barrel of the configuration layer (settings schema, binding validation). The package
// barrel re-exports the public symbols.
export { DddConfigError } from './errors';
export type { ConfigIssue } from './errors';
export { parseSettings, SETTINGS_KEY } from './settings';
export type { DddSettings } from './settings';
export {
  createSettingsResolver,
  resolverFromSettings,
  roleConfigFromSettings,
} from './settings-resolver';
export type {
  SettingsContext,
  SettingsResolver,
  SettingsResolverOptions,
} from './settings-resolver';
