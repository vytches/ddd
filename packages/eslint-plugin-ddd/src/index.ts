// Public barrel of @vytches/eslint-plugin-ddd (VF-043 D4): named exports only, no default export
// (flat config reads `plugin` / `configs.recommended`). The agent lane lives in the separate
// `@vytches/eslint-plugin-ddd/agent` entry and is not re-exported here.

export { configs, meta, plugin } from './configs';
export type { DddConfigs, DddPlugin, DddPluginMeta } from './configs';

export { rules } from './rules';
export type { RuleName } from './rules';

export { createRoleResolver, resolveRole, validateRoleConfig } from './resolver';
export type {
  ConfigProblem,
  ResolveRoleInput,
  ValidateRoleConfigOptions,
  ValidateRoleConfigResult,
} from './resolver';
export type {
  BindingProblem,
  BindingProblemCode,
  ResolverFs,
  ResolverWarning,
  RoleBinding,
  RoleResolver,
  RoleResolverOptions,
} from './resolver';
export type { BindingTarget, LibraryRoleName, RoleName } from './roles';

export { roleScoped } from './scoped';
export type { ResolverSource, RoleScope, RoleScopedOptions } from './scoped';

export {
  createSettingsResolver,
  DddConfigError,
  parseSettings,
  resolverFromSettings,
  roleConfigFromSettings,
  SETTINGS_KEY,
} from './config';
export type {
  ConfigIssue,
  DddSettings,
  SettingsContext,
  SettingsResolver,
  SettingsResolverOptions,
} from './config';
