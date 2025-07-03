import type {
  IAggregateRoot,
  IAggregateCapability,
  IAggregateConstructorParams,
  IAggregateEventHandler,
} from './aggregate-interfaces';

import type { IExtendedDomainEvent, IEventMetadata } from '@vytches-ddd/contracts';
import { createDomainEvent } from '@vytches-ddd/contracts';

import type { EntityId } from '../value-objects';

/**
 * Core AggregateRoot implementation with capability management
 * Provides basic aggregate functionality with composition-based extensions
 */
export class AggregateRoot<TId = string> implements IAggregateRoot<TId> {
  private readonly _id: EntityId<TId>;
  private _version = 0;
  private _initialVersion = 0;
  private _domainEvents: IExtendedDomainEvent[] = [];
  private _eventHandlers = new Map<string, IAggregateEventHandler>();
  private _capabilities = new Map<string, IAggregateCapability>();

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
    this._eventHandlers.set(eventType, handler);
    return this;
  }

  protected apply<P = any>(
    eventTypeOrEvent: string | IExtendedDomainEvent<P>,
    payload?: P,
    metadata?: Partial<IEventMetadata>
  ): void {
    let event: IExtendedDomainEvent<P | undefined>;

    if (typeof eventTypeOrEvent === 'string') {
      event = createDomainEvent(eventTypeOrEvent, payload, metadata);
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
    // Check if versioning capability is attached
    const versioningCapability = this._capabilities.get('versioning');

    if (versioningCapability && 'handleVersionedEvent' in versioningCapability) {
      (versioningCapability as { handleVersionedEvent: (event: IExtendedDomainEvent, handlers: Map<string, IAggregateEventHandler>) => void }).handleVersionedEvent(event, this._eventHandlers);
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
  // CAPABILITY MANAGEMENT
  // ==========================================

  addCapability<T extends IAggregateCapability>(name: string, capability: T): this {
    capability.attach(this);
    this._capabilities.set(name, capability);
    return this;
  }

  getCapability<T extends IAggregateCapability>(name: string): T | undefined {
    return this._capabilities.get(name) as T;
  }

  hasCapability(name: string): boolean {
    return this._capabilities.has(name);
  }

  removeCapability(name: string): this {
    const capability = this._capabilities.get(name);
    if (capability?.detach) {
      capability.detach();
    }
    this._capabilities.delete(name);
    return this;
  }

  // ==========================================
  // INTERNAL ACCESS FOR CAPABILITIES
  // ==========================================

  /**
   * Internal method for capabilities to access private state
   * Should only be used by capabilities, not directly by domain code
   */
  private _internal_setState(
    updates: Partial<{
      version: number;
      initialVersion: number;
      domainEvents: IExtendedDomainEvent[];
    }>
  ): void {
    if (updates.version !== undefined) {
      this._version = updates.version;
    }
    if (updates.initialVersion !== undefined) {
      this._initialVersion = updates.initialVersion;
    }
    if (updates.domainEvents !== undefined) {
      this._domainEvents = updates.domainEvents;
    }
  }

  /**
   * Internal method for capabilities to get event handlers
   */
  private _internal_getEventHandlers(): Map<string, IAggregateEventHandler> {
    return this._eventHandlers;
  }
}
