// Role vocabulary types (VF-043 D6). Pure data module: no eslint import.

/**
 * Roles the library itself knows about, in terms of its own building blocks.
 *
 * @beta
 * @since 0.32.0
 */
export type LibraryRoleName =
  | 'Aggregate'
  | 'Entity'
  | 'ValueObject'
  | 'DomainEvent'
  | 'IntegrationEvent'
  | 'Command'
  | 'Query'
  | 'CommandHandler'
  | 'QueryHandler'
  | 'EventHandler'
  | 'DomainService'
  | 'Repository'
  | 'Specification'
  | 'Policy'
  | 'ACLAdapter';

/**
 * A library role, or a custom role declared by a project binding.
 *
 * @beta
 * @since 0.32.0
 */
export type RoleName = LibraryRoleName | (string & {});

/** Broad family of a role. */
export type RoleKind = 'tactical' | 'cqrs' | 'integration';

/**
 * `library`: the library ships at least one detectable class-level marker for the role.
 * `binding-required`: the role exists only through a project binding (custom roles).
 */
export type RoleMarker = 'library' | 'binding-required';

/**
 * Pointer to an exported symbol. `from` is a package name (e.g. `@vytches/ddd-events`)
 * or, when it ends in `.ts` / `.tsx` / `.mts` / `.cts`, a project file relative to `cwd`.
 * `name` is the exported name (`default` for a default export).
 *
 * @beta
 * @since 0.32.0
 */
export interface BindingTarget {
  readonly from: string;
  readonly name: string;
}

/** Library role definition: which exported symbols make a class carry the role. */
export interface RoleDefinition {
  readonly role: LibraryRoleName;
  readonly kind: RoleKind;
  readonly marker: RoleMarker;
  /** Base classes / interfaces: matched against `extends` and `implements` alike. */
  readonly bases: readonly BindingTarget[];
  /** Class decorators. */
  readonly decorators: readonly BindingTarget[];
}
