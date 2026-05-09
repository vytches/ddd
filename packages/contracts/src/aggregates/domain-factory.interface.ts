import type { Result } from '../shared/result';

/**
 * Contract for a domain factory — a first-class tactical pattern in DDD
 * that encapsulates the creation logic of complex aggregates or value
 * objects.
 *
 * Per Eric Evans (Blue Book, ch. 6):
 * > Shift the responsibility for creating instances of complex objects and
 * > AGGREGATES to a separate object, which may itself have no responsibility
 * > in the domain model but is still part of the domain design.
 *
 * Use a domain factory when:
 *   - construction logic is too complex for an aggregate constructor
 *     (e.g. invariant checks across multiple value objects, or seeding
 *     initial domain events on creation),
 *   - creation needs orchestration across several pieces (e.g. assemble
 *     an `Order` from `Customer`, `Cart`, and `PricingPolicy` inputs),
 *   - you want a single, testable seam for "how is this aggregate born?".
 *
 * Returning `Result<TAggregate, Error>` is conventional in this library —
 * factories are a natural place to validate inputs and reject invalid
 * states without throwing.
 *
 * VF-CANON-001 (2026-05-09): added to give consumers a canonical interface
 * for the Factory pattern, sitting alongside `IRepository` in the
 * foundation contracts. Previously the library only had factory-method
 * support inside aggregates (`AggregateRoot.create()` static methods);
 * this interface formalizes the standalone Factory tactical pattern.
 *
 * @example
 * ```typescript
 * import type { IDomainFactory } from '@vytches/ddd-contracts';
 * import { Result } from '@vytches/ddd-contracts';
 *
 * interface OrderProps {
 *   customerId: string;
 *   items: ReadonlyArray<{ sku: string; qty: number; price: number }>;
 *   currency: string;
 * }
 *
 * class OrderFactory implements IDomainFactory<Order, OrderProps> {
 *   create(props: OrderProps): Result<Order, Error> {
 *     if (props.items.length === 0) {
 *       return Result.fail(new Error('Cannot create empty order'));
 *     }
 *     // ... validate, assemble value objects, seed events, etc.
 *     return Result.ok(new Order(props));
 *   }
 * }
 * ```
 *
 * @template TAggregate - The aggregate (or entity / value object) type produced.
 * @template TProps - Shape of the input data the factory consumes.
 *
 * @public
 * @stable
 * @since 0.25.0
 */
export interface IDomainFactory<TAggregate, TProps> {
  /**
   * Construct a new instance of the aggregate from the given props.
   *
   * Implementations should validate inputs and return `Result.fail(...)`
   * for invariant violations rather than throwing — keeping construction
   * a pure error-as-value operation.
   *
   * @param props - Input data for the new aggregate.
   * @returns `Result.ok(aggregate)` on success, `Result.fail(error)` on
   *   invariant violation or invalid input.
   */
  create(props: TProps): Result<TAggregate, Error>;
}

/**
 * Async variant of `IDomainFactory` for factories that must perform
 * asynchronous validation or coordination during creation (e.g. checking
 * for duplicate aggregates against a repository, or pulling reference
 * data from a domain service).
 *
 * @template TAggregate - The aggregate (or entity / value object) type produced.
 * @template TProps - Shape of the input data the factory consumes.
 *
 * @public
 * @stable
 * @since 0.25.0
 */
export interface IAsyncDomainFactory<TAggregate, TProps> {
  /**
   * Asynchronously construct a new instance of the aggregate from the
   * given props.
   *
   * @param props - Input data for the new aggregate.
   * @returns Promise resolving to `Result.ok(aggregate)` on success, or
   *   `Result.fail(error)` on invariant violation or async lookup failure.
   */
  create(props: TProps): Promise<Result<TAggregate, Error>>;
}
