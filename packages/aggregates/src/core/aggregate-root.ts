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
import { internalLogger } from '@vytches/ddd-contracts/internal';
import { LibUtils } from '@vytches/ddd-utils';

/**
 * VF-023 (D-2, AC5, BREAKING, CRITICAL F-H4): module-private gating token
 * for {@link AggregateRoot._internal_setState}. This is exported from this
 * module (`./core/aggregate-root`) — NOT from the package's public barrel
 * (`index.ts`) — so it is reachable only via a deep import within this
 * package's own source (e.g. `SnapshotCapability`), never via
 * `@vytches/ddd-aggregates`. Consumers cannot obtain this token, and
 * therefore cannot call `_internal_setState` at all: TypeScript rejects the
 * call without it, and even a `as any` cast would need the exact symbol
 * reference, which is not exported publicly.
 *
 * Previously `_internal_setState` was a plain public method reachable via
 * any `as any`/duck-typed cast — no compile-time or run-time barrier
 * prevented domain code from bypassing `apply()`/`loadFromHistory()` and
 * corrupting the version/event-log invariant directly.
 */
export const INTERNAL_STATE_TOKEN: unique symbol = Symbol('vytches-ddd-aggregate-internal-state');

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
 * - **Identity** via `EntityId<TId>` (`getId()`, `equals()`)
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
  /**
   * VF-023 (D-4, AC6, non-breaking addition): controls what happens when
   * `apply()` or `loadFromHistory()` processes an event for which no
   * handler was registered via `registerEventHandler()`. Defaults to
   * `"warn"` (preserves the previous silent-but-logged-nowhere behavior's
   * intent without a breaking default) — the event is still recorded /
   * replayed, but a warning is logged via the library's internal logger.
   * Set to `"throw"` to fail fast instead, useful in tests or strict
   * environments where a missing handler indicates a real bug.
   */
  private readonly _onMissingHandler: 'warn' | 'throw';

  constructor(params: IAggregateConstructorParams<TId>) {
    this._id = params.id;
    this._version = params.version || 0;
    this._initialVersion = params.version || 0;
    this._maxEvents = params.maxEvents;
    this._onMissingHandler = params.onMissingHandler ?? 'warn';
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
   * Identity-based equality, matching {@link Entity.equals}. Two aggregates
   * are equal iff they have the same id (compared via `EntityId.equals()`);
   * attribute/version differences are ignored.
   *
   * VF-023 (D-5, AC10, non-breaking addition): `AggregateRoot` does not
   * extend `Entity` (it implements `IAggregateRoot<TId>` directly), so this
   * mirrors `Entity.equals()` rather than inheriting it.
   *
   * @param other - Aggregate to compare against. May be `null` or `undefined`.
   * @returns `true` if both aggregates have the same id; `false` otherwise.
   */
  equals(other: AggregateRoot<TId> | null | undefined): boolean {
    if (other === null || other === undefined) return false;
    if (other === this) return true;
    if (!(other instanceof AggregateRoot)) return false;
    return this._id.equals(other._id);
  }

  /**
   * The version increments by one each time `apply()` successfully records a
   * domain event; compare it against the persisted version to detect
   * concurrent modification (optimistic locking).
   *
   * @returns {number} Current version number for optimistic locking
   */
  getVersion(): number {
    return this._version;
  }

  /**
   * The version this aggregate had when it was loaded (or as of the last
   * `commit()`), letting callers work out how many events have been applied
   * since without recomputing from the event log.
   *
   * @returns {number} Initial version when aggregate was loaded
   */
  getInitialVersion(): number {
    return this._initialVersion;
  }

  /**
   * Whether this aggregate has recorded domain events since its last
   * `commit()` — use it to decide whether persistence/dispatch work is
   * needed at all.
   *
   * @returns {boolean} True if aggregate has uncommitted domain events
   */
  hasChanges(): boolean {
    return this._domainEvents.length > 0;
  }

  /**
   * VF-023 (D-3, AC11, BREAKING): the returned array and every event object
   * it contains (including nested `payload`/`metadata`) are now deep-frozen
   * via `LibUtils.deepFreeze` — the same immutability guarantee applied to
   * `BaseValueObject` values (see `base-value-object.ts`). Previously this
   * returned only a shallow array copy: the array itself couldn't be
   * mutated by callers, but the event objects (and their nested payload
   * data) inside it could still be mutated in place, silently corrupting
   * state shared with `_domainEvents` (the same object references are
   * stored internally — events are never re-cloned after creation).
   * @returns {ReadonlyArray<IDomainEvent>} Array of uncommitted domain events
   */
  getDomainEvents(): ReadonlyArray<IDomainEvent> {
    const events = this._domainEvents.map(event => LibUtils.deepFreeze(event));
    return Object.freeze(events);
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
   * @throws {Error} when the aggregate's configured maxEvents limit would be exceeded
   * @example Hitting the maxEvents guard
   * ```typescript
   * class Order extends AggregateRoot<string> {
   *   record(customerId: string, amount: number): void {
   *     this.apply('OrderCreated', { customerId, amount });
   *   }
   * }
   *
   * const order = new Order({ id: EntityId.create(), version: 0, maxEvents: 1 });
   * order.record('c-1', 100); // ok, 1 event recorded
   * order.record('c-1', 100); // throws: maxEvents limit of 1 exceeded
   * ```
   */
  protected apply<P = unknown>(
    eventTypeOrEvent: string | IDomainEvent<P>,
    payload?: P,
    metadata?: Partial<IEventMetadata>
  ): void {
    // VP-NEW-002 (2026-05-09): unified one-pass enrichment.
    // Previous implementation did:
    //   (a) sanitizeMetadata of merged metadata + Object.create (object-event-with-metadata branch)
    //   (b) sanitizeMetadata of merged metadata + Object.create (always)
    // -> 2× allocations + 2× sanitization on object-event paths.
    // New flow: build the final merged metadata once, sanitize once, allocate once.

    // VF-023 (D-7, AC4, BREAKING fix for F-C6): REL-007's maxEvents guard
    // must run BEFORE any state mutation. The previous ordering incremented
    // `_version` first and only threw the maxEvents guard afterwards —
    // on throw, the aggregate was left with a bumped `_version` but no
    // corresponding event ever pushed to `_domainEvents`, a silent
    // version/event-log divergence. A subsequent valid `apply()` call would
    // then compound the bug (version+2 instead of version+1 relative to the
    // events actually recorded). All guards must pass before ANY mutation
    // of `_version` / `_domainEvents`.
    if (this._maxEvents !== undefined && this._domainEvents.length >= this._maxEvents) {
      throw new Error(
        `Aggregate ${this.constructor.name} (id=${this._id.toString()}) exceeded ` +
          `maxEvents limit of ${this._maxEvents}. This usually indicates a runaway ` +
          `loop or replay of a corrupted event stream. Increase maxEvents in the ` +
          `aggregate constructor params if the limit is too restrictive for your domain.`
      );
    }

    const nextVersion = this._version + 1;

    let event: IDomainEvent<P | undefined>;
    let baseMetadata: IEventMetadata | undefined;

    if (typeof eventTypeOrEvent === 'string') {
      // string path: createDomainEvent already builds a plain { eventName, payload, metadata }
      // and applies the user-supplied metadata; no class identity to preserve.
      event = createDomainEvent(eventTypeOrEvent, payload, metadata) as IDomainEvent<P>;
      baseMetadata = event.metadata;
    } else {
      // object path: preserve prototype chain for class-based events (instanceof).
      event = eventTypeOrEvent;
      baseMetadata = metadata
        ? ({ ...event.metadata, ...metadata } as IEventMetadata)
        : event.metadata;
    }

    // Enrich + sanitize in ONE pass. Uses `nextVersion` (not yet committed
    // to `this._version`) so metadata reflects the version this event WILL
    // have once all guards have passed.
    const enrichedMetadata = AggregateRoot.sanitizeMetadata({
      ...baseMetadata,
      aggregateId: this._id.toString(),
      aggregateType: this.constructor.name,
      aggregateVersion: nextVersion,
      timestamp: baseMetadata?.timestamp ?? new Date(),
    } as IEventMetadata);

    // Single Object.create — preserves prototype chain for class-based events.
    const enrichedEvent: IDomainEvent<P> = Object.assign(
      Object.create(Object.getPrototypeOf(event)),
      event,
      { metadata: enrichedMetadata }
    );

    // Commit: from here on nothing can fail before state is consistent —
    // version bump and event push happen together, immediately before the
    // (already-registered) handler runs.
    this._version = nextVersion;
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
      } else {
        this.reportMissingHandler(event.eventName);
      }
    }
  }

  /**
   * VF-023 (D-4, AC6): called from `handleEvent()`, which is shared by both
   * `apply()` (live) and `loadFromHistory()` (replay) — so the missing-
   * handler policy applies identically to both paths.
   */
  private reportMissingHandler(eventName: string): void {
    const message =
      `Aggregate ${this.constructor.name} (id=${this._id.toString()}) has no ` +
      `registered handler for event "${eventName}". State will not be updated ` +
      `for this event. Register a handler via registerEventHandler('${eventName}', ...) ` +
      `before applying/replaying this event, or pass onMissingHandler: "warn" ` +
      `explicitly to silence this in the constructor params.`;

    if (this._onMissingHandler === 'throw') {
      throw new Error(message);
    }

    internalLogger.warn(message, {
      aggregateType: this.constructor.name,
      aggregateId: this._id.toString(),
      eventName,
    });
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
    // VP-NEW-002: fast path — most metadata never contains prototype-pollution keys.
    // Use hasOwn directly to avoid building an array via Object.keys() when nothing
    // needs to be removed. Returns the input unchanged if clean.
    if (
      !Object.prototype.hasOwnProperty.call(metadata, '__proto__') &&
      !Object.prototype.hasOwnProperty.call(metadata, 'constructor') &&
      !Object.prototype.hasOwnProperty.call(metadata, 'prototype')
    ) {
      return metadata;
    }

    // Slow path — strip the dangerous keys.
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
   * Internal method for capabilities to access private state.
   *
   * VF-023 (D-2, AC5, BREAKING, CRITICAL F-H4): gated by
   * {@link INTERNAL_STATE_TOKEN}, a module-private `unique symbol` that is
   * exported only from this module (not from the package's public barrel).
   * Callers must supply the exact token reference to invoke this method —
   * consumers of `@vytches/ddd-aggregates` cannot obtain it, so this method
   * is unreachable from outside this package's own source, even via
   * `as unknown as {...}` casts (the token value itself, not just its type,
   * is required and cannot be forged).
   *
   * @throws {TypeError} if `token` does not match {@link INTERNAL_STATE_TOKEN}
   */
  _internal_setState(
    token: typeof INTERNAL_STATE_TOKEN,
    state: {
      version: number;
      initialVersion: number;
      domainEvents: IDomainEvent[];
    }
  ): void {
    if (token !== INTERNAL_STATE_TOKEN) {
      throw new TypeError(
        '_internal_setState: invalid or missing internal state token. ' +
          'This method is restricted to capabilities within @vytches/ddd-aggregates.'
      );
    }
    this._version = state.version;
    this._initialVersion = state.initialVersion;
    this._domainEvents = [...state.domainEvents];
  }
}

// Import capability classes for type checking
import { VersioningCapability } from '../capabilities/versioning-capability';
