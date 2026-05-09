import type {
  IAggregateCapability,
  IAggregateConstructorParams,
  IAggregateEventHandler,
  IAggregateRoot,
} from '../aggregate-interfaces';

import type {
  Capability,
  CapabilityConstructor,
  EntityId,
  IDomainEvent,
  IEventMetadata,
} from '@vytches/ddd-contracts';
import { CapabilityRegistry, createDomainEvent } from '@vytches/ddd-contracts';

/**
 * Base class for aggregate roots — the *transactional consistency boundary*
 * of a Domain-Driven Design model. Per Eric Evans (Blue Book, ch. 6):
 *
 * > An AGGREGATE is a cluster of associated objects that we treat as a unit
 * > for the purpose of data changes. Each AGGREGATE has a root and a
 * > boundary. The root is a single, specific ENTITY contained in the
 * > AGGREGATE. The root is the only member of the AGGREGATE that outside
 * > objects are allowed to hold references to.
 *
 * `AggregateRoot<TId>` provides:
 *
 * - **Identity** via `EntityId<TId>` (`getId()`)
 * - **Versioning** for optimistic locking (`getVersion()`,
 *   `getInitialVersion()`)
 * - **Event emission** via `apply()` — append a `DomainEvent`, increment
 *   version, run the registered handler to mutate state
 * - **Event sourcing reconstitution** via `loadFromHistory()` — replay
 *   events without accumulating new ones
 * - **Capabilities** — composable, opt-in features (snapshots, audit,
 *   versioning, event-sourcing) attached without inheritance chains
 *   (see {@link AggregateBuilder})
 *
 * Two state-mutation rules:
 *
 * 1. **Never assign fields directly.** All state changes flow through
 *    `apply(eventType, payload)` so they are recorded as events. Direct
 *    assignment bypasses event recording and version tracking — the
 *    aggregate becomes inconsistent with its event stream.
 * 2. **Register handlers BEFORE applying events.** Wire every event name
 *    in the constructor via `registerEventHandler('EventName', payload =>
 *    {...})` before any `apply()` call. Missing handlers do not throw —
 *    the event is recorded but state remains stale.
 *
 * For non-root domain entities (`OrderLine` inside `Order`), use
 * {@link Entity} — it has identity but no version/event machinery.
 *
 * @example Minimal event-sourced aggregate
 * ```typescript
 * import { AggregateRoot } from '@vytches/ddd-aggregates';
 * import { EntityId } from '@vytches/ddd-contracts';
 *
 * interface OrderCreatedPayload {
 *   customerId: string;
 *   amount: number;
 * }
 *
 * class Order extends AggregateRoot<string> {
 *   private customerId = '';
 *   private amount = 0;
 *
 *   constructor(params: IAggregateConstructorParams<string>) {
 *     super(params);
 *     this.registerEventHandler<OrderCreatedPayload>('OrderCreated', payload => {
 *       this.customerId = payload!.customerId;
 *       this.amount = payload!.amount;
 *     });
 *   }
 *
 *   static create(customerId: string, amount: number): Order {
 *     const order = new Order({ id: EntityId.create(), version: 0 });
 *     order.apply('OrderCreated', { customerId, amount });
 *     return order;
 *   }
 * }
 *
 * const order = Order.create('c-1', 500);
 * order.getVersion();         // 1
 * order.getDomainEvents();    // [{ eventName: 'OrderCreated', ... }]
 * order.commit();             // clear after persisting
 * order.hasChanges();         // false
 * ```
 *
 * @example Reconstituting from event history
 * ```typescript
 * class Order extends AggregateRoot<string> {
 *   static fromEvents(id: EntityId<string>, events: IDomainEvent[]): Order {
 *     const order = new Order({ id, version: 0 });
 *     order.loadFromHistory(events);  // replays events, no new ones recorded
 *     return order;
 *   }
 * }
 * ```
 *
 * @example Bounded uncommitted-event count (REL-007 guard)
 * ```typescript
 * const order = new Order({
 *   id: EntityId.create(),
 *   version: 0,
 *   maxEvents: 1000,  // throw if uncommitted events exceed 1000
 * });
 * ```
 *
 * @public
 * @stable
 * @since 0.1.0
 */
export class AggregateRoot<TId = string> implements IAggregateRoot<TId> {
  private readonly _id: EntityId<TId>;
  private _version = 0;
  private _initialVersion = 0;
  private _domainEvents: IDomainEvent[] = [];
  private _eventHandlers = new Map<string, IAggregateEventHandler>();
  private _capabilities = new CapabilityRegistry();
  /**
   * REL-007 (2026-05-08): optional advisory limit on uncommitted events.
   * Undefined = no limit (default, backward-compat). When set, `apply()`
   * throws if pushing would exceed the limit — guards against runaway
   * loops or malicious replay payloads.
   */
  private readonly _maxEvents: number | undefined;

  constructor(params: IAggregateConstructorParams<TId>) {
    this._id = params.id;
    this._version = params.version || 0;
    this._initialVersion = params.version || 0;
    this._maxEvents = params.maxEvents;
  }

  // ==========================================
  // CORE AGGREGATE FUNCTIONALITY
  // ==========================================

  /**
   * Get the unique identifier of this aggregate
   */
  getId(): EntityId<TId> {
    return this._id;
  }

  /**
   *
   * @returns {number} Current version number for optimistic locking
   */
  getVersion(): number {
    return this._version;
  }

  /**
   *
   * @returns {number} Initial version when aggregate was loaded
   */
  getInitialVersion(): number {
    return this._initialVersion;
  }

  /**
   *
   * @returns {boolean} True if aggregate has uncommitted domain events
   */
  hasChanges(): boolean {
    return this._domainEvents.length > 0;
  }

  /**
   *
   * @returns {ReadonlyArray<IDomainEvent>} Array of uncommitted domain events
   */
  getDomainEvents(): ReadonlyArray<IDomainEvent> {
    return [...this._domainEvents];
  }

  /**
   * Clear all uncommitted domain events and update initial version
   */
  commit(): void {
    this._domainEvents = [];
    this._initialVersion = this._version;
  }

  // ==========================================
  // EVENT HANDLING - Type-safe approach
  // ==========================================

  /**
   * @param {string} eventType - Event type to register handler for
   * @param {IAggregateEventHandler<T>} handler - Event handler function
   * @returns {this} The aggregate instance for method chaining
   */
  protected registerEventHandler<T>(eventType: string, handler: IAggregateEventHandler<T>): this {
    this._eventHandlers.set(eventType, handler as IAggregateEventHandler);
    return this;
  }

  /**
   * Apply domain event to aggregate and add to pending events
   * @param {string | IDomainEvent<P>} eventTypeOrEvent - Event type string or complete event object
   * @param {P} payload - Event payload data
   * @param {Partial<IEventMetadata>} metadata - Optional event metadata
   */
  protected apply<P = unknown>(
    eventTypeOrEvent: string | IDomainEvent<P>,
    payload?: P,
    metadata?: Partial<IEventMetadata>
  ): void {
    let event: IDomainEvent<P | undefined>;

    if (typeof eventTypeOrEvent === 'string') {
      event = createDomainEvent(eventTypeOrEvent, payload, metadata) as IDomainEvent<P>;
    } else {
      event = eventTypeOrEvent;
      if (metadata) {
        const sanitizedMetadata = AggregateRoot.sanitizeMetadata({
          ...event.metadata,
          ...metadata,
        });
        // Preserve prototype chain when merging additional metadata
        event = Object.assign(Object.create(Object.getPrototypeOf(event)), event, {
          metadata: sanitizedMetadata,
        });
      }
    }

    this._version++;

    // Enrich with aggregate metadata
    // CRITICAL: Use Object.assign + Object.create to PRESERVE prototype chain
    // This allows event classes (e.g., OrderCreatedEvent) to retain their methods
    // and instanceof checks to work correctly after enrichment
    const enrichedMetadata: IEventMetadata = AggregateRoot.sanitizeMetadata({
      ...event.metadata,
      aggregateId: this._id.toString(),
      aggregateType: this.constructor.name,
      aggregateVersion: this._version,
      timestamp: event.metadata?.timestamp ?? new Date(),
    });

    // Preserve prototype chain - essential for class-based events
    const enrichedEvent: IDomainEvent<P> = Object.assign(
      Object.create(Object.getPrototypeOf(event)),
      event,
      { metadata: enrichedMetadata }
    );

    // REL-007 (2026-05-08): enforce optional maxEvents advisory limit
    // BEFORE push, so the aggregate's invariants are preserved on failure.
    if (this._maxEvents !== undefined && this._domainEvents.length >= this._maxEvents) {
      throw new Error(
        `Aggregate ${this.constructor.name} (id=${this._id.toString()}) exceeded ` +
          `maxEvents limit of ${this._maxEvents}. This usually indicates a runaway ` +
          `loop or replay of a corrupted event stream. Increase maxEvents in the ` +
          `aggregate constructor params if the limit is too restrictive for your domain.`
      );
    }

    this._domainEvents.push(enrichedEvent);
    this.handleEvent(enrichedEvent);
  }

  private handleEvent(event: IDomainEvent): void {
    // Check if we have versioning capability for upcasting
    const versioningCapability = this.getCapability(VersioningCapability);
    if (versioningCapability) {
      versioningCapability.handleVersionedEvent(event, this._eventHandlers);
    } else {
      // Standard event handling
      const handler = this._eventHandlers.get(event.eventName);
      if (handler) {
        handler(event.payload, event.metadata);
      }
    }
  }

  /**
   * Reconstruct aggregate state from historical domain events
   * @param {IDomainEvent[]} events - Array of events to replay for state reconstruction
   */
  protected loadFromHistory(events: IDomainEvent[]): void {
    this._version = this._initialVersion;
    this._domainEvents = [];

    for (const event of events) {
      this.handleEvent(event);
      this._version++;
    }

    this._initialVersion = this._version;
  }

  // ==========================================
  // TYPE-SAFE CAPABILITY MANAGEMENT
  // ==========================================

  /**
   * Add capability to enhance aggregate functionality
   * @param {T} capability - Capability instance to add to the aggregate
   * @returns {this} The aggregate instance for method chaining
   */
  addCapability<T extends Capability & IAggregateCapability>(capability: T): this {
    if ('attach' in capability && typeof capability.attach === 'function') {
      capability.attach(this as unknown as IAggregateRoot<unknown>);
    }
    this._capabilities.register(capability);
    return this;
  }

  /**
   * @param {CapabilityConstructor<T>} CapabilityClass - Constructor of the capability to retrieve
   * @returns {T | undefined} The capability instance or undefined if not found
   */
  getCapability<T extends Capability & IAggregateCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): T | undefined {
    return this._capabilities.get(CapabilityClass) as T | undefined;
  }

  /**
   * @param {CapabilityConstructor<T>} CapabilityClass - Constructor of the capability to check
   * @returns {boolean} True if the capability is present
   */
  hasCapability<T extends Capability & IAggregateCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): boolean {
    return this._capabilities.has(CapabilityClass);
  }

  /**
   * @param {CapabilityConstructor<T>} CapabilityClass - Constructor of the capability to remove
   * @returns {this} The aggregate instance for method chaining
   */
  removeCapability<T extends Capability & IAggregateCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): this {
    const capability = this._capabilities.get(CapabilityClass);
    if (capability && 'detach' in capability && typeof capability.detach === 'function') {
      capability.detach();
    }
    this._capabilities.remove(CapabilityClass);
    return this;
  }

  /**
   * @returns {Capability[]} Array of all registered capabilities
   */
  getAllCapabilities(): Capability[] {
    return this._capabilities.getAll();
  }

  /**
   * @returns {string[]} Array of capability type names
   */
  getCapabilityTypes(): string[] {
    return this._capabilities.getTypes();
  }

  // ==========================================
  // SECURITY UTILITIES
  // ==========================================

  private static sanitizeMetadata<T extends Record<string, unknown>>(metadata: T): T {
    const clean = {} as Record<string, unknown>;
    for (const key of Object.keys(metadata)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      clean[key] = metadata[key];
    }
    return clean as T;
  }

  // ==========================================
  // INTERNAL ACCESS FOR CAPABILITIES
  // ==========================================

  /**
   * Internal method for capabilities to access private state
   * Should only be used by capabilities, not directly by domain code
   */
  _internal_setState(state: {
    version: number;
    initialVersion: number;
    domainEvents: IDomainEvent[];
  }): void {
    this._version = state.version;
    this._initialVersion = state.initialVersion;
    this._domainEvents = [...state.domainEvents];
  }
}

// Import capability classes for type checking
import { VersioningCapability } from '../capabilities/versioning-capability';
