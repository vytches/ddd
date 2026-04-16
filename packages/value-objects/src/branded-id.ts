/**
 * Branded ID types for compile-time safety.
 *
 * Prevents accidentally passing an OrderId where a CustomerId is expected.
 * Zero runtime overhead — branding exists only in the type system.
 *
 * @public
 * @stable
 * @since 0.24.0
 *
 * @example
 * ```typescript
 * type OrderId = BrandedId<'Order'>;
 * type CustomerId = BrandedId<'Customer'>;
 *
 * const orderId = createBrandedId<'Order'>(EntityId.create());
 * const customerId = createBrandedId<'Customer'>(EntityId.create());
 *
 * function processOrder(id: OrderId): void { ... }
 * processOrder(orderId);      // OK
 * processOrder(customerId);   // Compile error!
 * ```
 */

import { EntityId } from './id.value-object';

declare const __brand: unique symbol;

/**
 * A branded EntityId that carries a compile-time tag.
 * Prevents mixing IDs from different aggregate types.
 *
 * @public
 * @stable
 * @since 0.24.0
 */
export type BrandedId<Tag extends string> = EntityId<string> & {
  readonly [__brand]: Tag;
};

/**
 * Create a branded ID from an existing EntityId.
 *
 * @public
 * @stable
 * @since 0.24.0
 *
 * @example
 * ```typescript
 * type OrderId = BrandedId<'Order'>;
 * const orderId = createBrandedId<'Order'>(EntityId.create());
 * ```
 */
export function createBrandedId<Tag extends string>(id: EntityId<string>): BrandedId<Tag> {
  return id as BrandedId<Tag>;
}

/**
 * Create a new branded ID with a random UUID.
 *
 * @public
 * @stable
 * @since 0.24.0
 *
 * @example
 * ```typescript
 * type OrderId = BrandedId<'Order'>;
 * const orderId = newBrandedId<'Order'>();
 * ```
 */
export function newBrandedId<Tag extends string>(): BrandedId<Tag> {
  return EntityId.create() as BrandedId<Tag>;
}

/**
 * Create a branded ID from a UUID string.
 *
 * @public
 * @stable
 * @since 0.24.0
 */
export function brandedIdFromUUID<Tag extends string>(uuid: string): BrandedId<Tag> {
  return EntityId.fromUUID(uuid) as BrandedId<Tag>;
}

/**
 * Create a branded ID from a text value.
 *
 * @public
 * @stable
 * @since 0.24.0
 */
export function brandedIdFromText<Tag extends string>(text: string): BrandedId<Tag> {
  return EntityId.fromText(text) as BrandedId<Tag>;
}
