import type { RoleName } from '../roles';
import type { AstNode, RoleResolver } from './types';

/** @beta @since 0.32.0 */
export interface ResolveRoleInput {
  readonly resolver: RoleResolver;
  /** Parsed `Program` node of the file that contains `node`. */
  readonly program: AstNode;
  readonly filename: string;
  /** A `ClassDeclaration` or `ClassExpression` node of `program`. */
  readonly node: AstNode;
}

/**
 * Roles of one class, resolved by import source (never by class name): library roles plus the
 * project's bindings. Returns an empty array for a non-class node or a class without a role.
 *
 * @beta
 * @since 0.32.0
 */
export function resolveRole(input: ResolveRoleInput): readonly RoleName[] {
  const hit = input.resolver
    .classify(input.program, input.filename)
    .find(c => c.node === input.node);
  return hit ? [...hit.roles] : [];
}
