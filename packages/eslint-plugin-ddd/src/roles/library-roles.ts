import type { BindingTarget, LibraryRoleName, RoleDefinition } from './types';

/**
 * Meta-package that re-exports every library package. A symbol imported from here is the
 * same symbol as the one in its home package.
 */
export const ENTERPRISE_PACKAGE = '@vytches/ddd';

const t = (from: string, name: string): BindingTarget => ({ from, name });

const CONTRACTS = '@vytches/ddd-contracts';
const AGGREGATES = '@vytches/ddd-aggregates';
const EVENTS = '@vytches/ddd-events';
const CQRS = '@vytches/ddd-cqrs';
const SERVICES = '@vytches/ddd-domain-services';
const REPOSITORIES = '@vytches/ddd-repositories';
const VALIDATION = '@vytches/ddd-validation';
const POLICIES = '@vytches/ddd-policies';
const ACL = '@vytches/ddd-acl';
const VALUE_OBJECTS = '@vytches/ddd-value-objects';

/**
 * Built-in vocabulary. Internal: the only public view of it is `resolveRole`.
 * A test imports the real packages (devDependencies) and asserts every name below exists in
 * their exports.
 */
export const LIBRARY_ROLES: readonly RoleDefinition[] = Object.freeze([
  {
    role: 'Aggregate',
    kind: 'tactical',
    marker: 'library',
    bases: [t(AGGREGATES, 'AggregateRoot')],
    decorators: [],
  },
  {
    role: 'Entity',
    kind: 'tactical',
    marker: 'library',
    bases: [t(AGGREGATES, 'Entity')],
    decorators: [],
  },
  {
    role: 'ValueObject',
    kind: 'tactical',
    marker: 'library',
    bases: [t(VALUE_OBJECTS, 'BaseValueObject')],
    decorators: [],
  },
  {
    role: 'DomainEvent',
    kind: 'tactical',
    marker: 'library',
    bases: [t(EVENTS, 'DomainEvent')],
    decorators: [],
  },
  {
    role: 'IntegrationEvent',
    kind: 'integration',
    marker: 'library',
    bases: [t(EVENTS, 'IntegrationEvent')],
    decorators: [],
  },
  {
    role: 'Command',
    kind: 'cqrs',
    marker: 'library',
    bases: [t(CQRS, 'ICommand')],
    decorators: [],
  },
  {
    role: 'Query',
    kind: 'cqrs',
    marker: 'library',
    bases: [t(CQRS, 'IQuery')],
    decorators: [],
  },
  {
    role: 'CommandHandler',
    kind: 'cqrs',
    marker: 'library',
    bases: [t(CQRS, 'ICommandHandler')],
    decorators: [t(CQRS, 'CommandHandler')],
  },
  {
    role: 'QueryHandler',
    kind: 'cqrs',
    marker: 'library',
    bases: [t(CQRS, 'IQueryHandler')],
    decorators: [t(CQRS, 'QueryHandler')],
  },
  {
    role: 'EventHandler',
    kind: 'cqrs',
    marker: 'library',
    bases: [t(CONTRACTS, 'IEventHandler')],
    decorators: [t(EVENTS, 'EventHandler')],
  },
  {
    role: 'DomainService',
    kind: 'tactical',
    marker: 'library',
    bases: [
      t(SERVICES, 'PlainDomainService'),
      t(SERVICES, 'IBaseDomainService'),
      t(SERVICES, 'EventAwareDomainService'),
      t(SERVICES, 'UnitOfWorkAwareDomainService'),
      t(SERVICES, 'AsyncDomainService'),
      t(SERVICES, 'IDomainService'),
    ],
    decorators: [t(SERVICES, 'DomainService')],
  },
  {
    role: 'Repository',
    kind: 'tactical',
    marker: 'library',
    bases: [
      t(REPOSITORIES, 'IBaseRepository'),
      t(REPOSITORIES, 'IRepository'),
      t(CONTRACTS, 'IRepository'),
      t(CONTRACTS, 'ICQRSRepository'),
    ],
    decorators: [],
  },
  {
    role: 'Specification',
    kind: 'tactical',
    marker: 'library',
    bases: [
      t(VALIDATION, 'CompositeSpecification'),
      t(VALIDATION, 'AsyncCompositeSpecification'),
      t(CONTRACTS, 'ISpecification'),
    ],
    decorators: [],
  },
  {
    role: 'Policy',
    kind: 'tactical',
    marker: 'library',
    bases: [
      t(POLICIES, 'BaseBusinessPolicy'),
      t(POLICIES, 'BaseCompositePolicy'),
      t(POLICIES, 'IBusinessPolicy'),
    ],
    decorators: [],
  },
  {
    role: 'ACLAdapter',
    kind: 'integration',
    marker: 'library',
    bases: [t(ACL, 'BaseACLAdapter'), t(ACL, 'SimpleACLAdapter')],
    decorators: [],
  },
]);

/** Names of the built-in roles, in vocabulary order. */
export const LIBRARY_ROLE_NAMES: readonly LibraryRoleName[] = Object.freeze(
  LIBRARY_ROLES.map(def => def.role)
);
