import type { EntityId } from '@vytches/ddd-contracts';

/**
 * Base class for domain entities — objects with identity that may be
 * referenced from other aggregates but are NOT themselves aggregate roots.
 *
 * Per Eric Evans (Blue Book, ch. 5):
 * > Some objects are not defined primarily by their attributes. They
 * > represent a thread of identity that runs through time and often across
 * > distinct representations. Sometimes such an object must be matched with
 * > another object even though attributes differ.
 *
 * Use `Entity<TId>` for inner objects of an aggregate that have their own
 * identity (e.g. `OrderLine` inside `Order`, `Address` inside `Customer`
 * if addresses are independently identifiable). Use `AggregateRoot<TId>`
 * for the *root* entity of an aggregate — the transactional boundary.
 *
 * Two entities are equal iff they have the same `EntityId<TId>`. Attribute
 * equality is irrelevant; even if all fields match, two entities with
 * different ids are different things. Conversely, the same entity at two
 * points in time may have different attribute values but is still the
 * same entity.
 *
 * VF-CANON-001 (2026-05-09): added to close the canonical Evans/Vernon
 * gap — competing libraries (NestJS DDD plugins, dddsample-java) ship
 * a separate Entity base; this library previously only had AggregateRoot.
 *
 * **Relationship to `AggregateRoot`:** Conceptually, every aggregate root
 * is a special kind of entity (per Evans: "the only member of its AGGREGATE
 * that outside objects are allowed to hold references to"). For backward
 * compatibility, `AggregateRoot` does NOT extend this `Entity` class — both
 * carry their own `_id: EntityId<TId>` and `equals()` logic. Treat them as
 * conceptual siblings: identity-based equality is the same contract, but
 * the inheritance graph is intentionally flat to avoid breaking existing
 * `AggregateRoot` consumers. A future major version may unify them.
 *
 * @example
 * ```typescript
 * import { Entity } from '@vytches/ddd-aggregates';
 * import { EntityId } from '@vytches/ddd-value-objects';
 *
 * class OrderLine extends Entity<string> {
 *   constructor(
 *     id: EntityId<string>,
 *     public readonly sku: string,
 *     public quantity: number,
 *   ) {
 *     super(id);
 *   }
 * }
 *
 * const a = new OrderLine(EntityId.fromUUID('...'), 'SKU-1', 1);
 * const b = new OrderLine(EntityId.fromUUID('...'), 'SKU-1', 99);
 * a.equals(b); // true if ids match — quantity doesn't matter
 * ```
 *
 * @public
 * @stable
 * @since 0.25.0
 */
export abstract class Entity<TId = string> {
  protected readonly _id: EntityId<TId>;

  constructor(id: EntityId<TId>) {
    this._id = id;
  }

  /**
   * Return this entity's unique identifier.
   */
  getId(): EntityId<TId> {
    return this._id;
  }

  /**
   * Identity-based equality. Two entities are equal iff they have the same
   * id (compared via the EntityId's own equality). Attribute differences
   * are ignored.
   *
   * @param other - Entity to compare against. May be `null` or `undefined`.
   * @returns `true` if both entities have the same id; `false` otherwise.
   */
  equals(other: Entity<TId> | null | undefined): boolean {
    if (other === null || other === undefined) return false;
    if (other === this) return true;
    if (!(other instanceof Entity)) return false;
    return this._id.equals(other._id);
  }
}
