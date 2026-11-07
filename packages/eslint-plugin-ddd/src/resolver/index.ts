// Internal barrel of the role resolver. The package barrel re-exports only the @beta symbols.
export { createRoleResolver } from './role-resolver';
export { resolveRole } from './resolve-role';
export type { ResolveRoleInput } from './resolve-role';
export { validateRoleConfig } from './validate-config';
export type {
  ConfigProblem,
  ValidateRoleConfigOptions,
  ValidateRoleConfigResult,
} from './validate-config';
export { parseJsonc } from './jsonc';
export { globToRegExp } from './glob';
export type {
  AstNode,
  BindingProblem,
  BindingProblemCode,
  ClassRoles,
  ResolverFs,
  ResolverWarning,
  RoleBinding,
  RoleResolver,
  RoleResolverOptions,
} from './types';
