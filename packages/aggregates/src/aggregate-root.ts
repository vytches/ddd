import type {
  IAggregateRoot,
  IAggregateCapability,
  IAggregateConstructorParams,
  IAggregateEventHandler,
} from './aggregate-interfaces';

import type { IExtendedDomainEvent, IEventMetadata, Capability, CapabilityConstructor, EntityId } from '@vytches-ddd/contracts';
import { createDomainEvent, CapabilityRegistry } from '@vytches-ddd/contracts';

/**
 * Type-safe AggregateRoot implementation with capability management
 * Provides basic aggregate functionality with composition-based extensions
 */
export class AggregateRoot<TId = string> implements IAggregateRoot<TId> {
  private readonly _id: EntityId<TId>;
  private _version = 0;
  private _initialVersion = 0;
  private _domainEvents: IExtendedDomainEvent[] = [];
  private _eventHandlers = new Map<string, IAggregateEventHandler>();
  private _capabilities = new CapabilityRegistry();

  constructor(params: IAggregateConstructorParams<TId>) {
    this._id = params.id;
    this._version = params.version || 0;
    this._initialVersion = params.version || 0;
  }

  // ==========================================
  // CORE AGGREGATE FUNCTIONALITY
  // ==========================================

  getId(): EntityId<TId> {
    return this._id;
  }

  getVersion(): number {
    return this._version;
  }

  getInitialVersion(): number {
    return this._initialVersion;
  }

  hasChanges(): boolean {
    return this._domainEvents.length > 0;
  }

  getDomainEvents(): ReadonlyArray<IExtendedDomainEvent> {
    return [...this._domainEvents];
  }

  commit(): void {
    this._domainEvents = [];
    this._initialVersion = this._version;
  }

  // ==========================================
  // EVENT HANDLING - Type-safe approach
  // ==========================================

  protected registerEventHandler<T>(eventType: string, handler: IAggregateEventHandler<T>): this {
    this._eventHandlers.set(eventType, handler as IAggregateEventHandler);
    return this;
  }

  protected apply<P = unknown>(
    eventTypeOrEvent: string | IExtendedDomainEvent<P>,
    payload?: P,
    metadata?: Partial<IEventMetadata>
  ): void {
    let event: IExtendedDomainEvent<P | undefined>;

    if (typeof eventTypeOrEvent === 'string') {
      event = createDomainEvent(eventTypeOrEvent, payload, metadata) as IExtendedDomainEvent<P>;
    } else {
      event = eventTypeOrEvent;
      if (metadata) {
        event = { ...event, metadata: { ...event.metadata, ...metadata } };
      }
    }

    this._version++;

    // Enrich with aggregate metadata
    const enrichedEvent: IExtendedDomainEvent<P> = {
      ...event,
      metadata: {
        ...event.metadata,
        aggregateId: this._id.getValue(),
        aggregateType: this.constructor.name,
        aggregateVersion: this._version,
      },
    };

    this._domainEvents.push(enrichedEvent);
    this.handleEvent(enrichedEvent);
  }

  private handleEvent(event: IExtendedDomainEvent): void {
    // Check if we have versioning capability for upcasting
    const versioningCapability = this.getCapability(VersioningCapability);
    if (versioningCapability) {
      versioningCapability.handleVersionedEvent(event, this._eventHandlers);
    } else {
      // Standard event handling
      const handler = this._eventHandlers.get(event.eventType);
      if (handler) {
        handler(event.payload, event.metadata);
      }
    }
  }

  protected loadFromHistory(events: IExtendedDomainEvent[]): void {
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
   * Add a capability using its instance
   */
  addCapability<T extends Capability & IAggregateCapability>(capability: T): this {
    if ('attach' in capability && typeof capability.attach === 'function') {
      capability.attach(this);
    }
    this._capabilities.register(capability);
    return this;
  }

  /**
   * Get a capability by its constructor
   */
  getCapability<T extends Capability & IAggregateCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): T | undefined {
    return this._capabilities.get(CapabilityClass) as T | undefined;
  }

  /**
   * Check if aggregate has a capability by its constructor
   */
  hasCapability<T extends Capability & IAggregateCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): boolean {
    return this._capabilities.has(CapabilityClass);
  }

  /**
   * Remove a capability by its constructor
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
   * Get all capabilities
   */
  getAllCapabilities(): Capability[] {
    return this._capabilities.getAll();
  }

  /**
   * Get capability types
   */
  getCapabilityTypes(): string[] {
    return this._capabilities.getTypes();
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
    domainEvents: IExtendedDomainEvent[];
  }): void {
    this._version = state.version;
    this._initialVersion = state.initialVersion;
    this._domainEvents = state.domainEvents;
  }
}

// Import capability classes for type checking
import { VersioningCapability } from './capabilities/versioning-capability';