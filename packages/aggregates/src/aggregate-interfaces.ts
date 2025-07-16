import type {
  IExtendedDomainEvent,
  IEventMetadata,
  IEventUpcaster,
  IAuditEvent,
  IEventStore,
  Capability,
  CapabilityConstructor,
  EntityId,
} from '@vytches-ddd/contracts';

// ==========================================
// CORE AGGREGATE INTERFACES
// ==========================================

/**
 * @llm-summary Contract for aggregate root functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * AggregateRoot interface implementing domain pattern implementation for aggregate root operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAggregateRoot implements IAggregateRoot {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IAggregateRoot<TId = string> {
  /**
   * Returns the aggregate identifier
   */
  getId(): EntityId<TId>;

  /**
   * Returns the current version of the aggregate
   */
  getVersion(): number;

  /**
   * Returns the initial version of the aggregate when it was loaded
   */
  getInitialVersion(): number;

  /**
   * Checks if the aggregate has uncommitted changes
   */
  hasChanges(): boolean;

  /**
   * Returns uncommitted domain events
   */
  getDomainEvents(): ReadonlyArray<IExtendedDomainEvent>;

  /**
   * Clears all uncommitted domain events and updates initial version
   */
  commit(): void;

  /**
   * Adds a capability to the aggregate
   */
  addCapability<T extends Capability & IAggregateCapability>(capability: T): this;

  /**
   * Gets a specific capability
   */
  getCapability<T extends Capability & IAggregateCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): T | undefined;

  /**
   * Checks if aggregate has a specific capability
   */
  hasCapability<T extends Capability & IAggregateCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): boolean;

  /**
   * Removes a capability from the aggregate
   */
  removeCapability<T extends Capability & IAggregateCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): this;
}

/**
 * @llm-summary Contract for aggregate constructor params functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * AggregateConstructorParams interface implementing domain pattern implementation for aggregate constructor params operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAggregateConstructorParams implements IAggregateConstructorParams {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IAggregateConstructorParams<TId> {
  id: EntityId<TId>;
  version?: number;
}

// ==========================================
// CAPABILITY SYSTEM
// ==========================================

/**
 * @llm-summary Contract for aggregate capability functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * AggregateCapability interface implementing domain pattern implementation for aggregate capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAggregateCapability implements IAggregateCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IAggregateCapability {
  /**
   * Called when capability is attached to an aggregate
   */
  attach(aggregate: IAggregateRoot<unknown>): void;

  /**
   * Called when capability is detached from an aggregate
   */
  detach?(): void;
}

/**
 * @llm-summary Contract for snapshot capability functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * SnapshotCapability interface implementing domain pattern implementation for snapshot capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSnapshotCapability implements ISnapshotCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ISnapshotCapability<TState = unknown, TMeta = unknown>
  extends IAggregateCapability {
  /**
   * Creates a snapshot of the current aggregate state
   */
  createSnapshot(
    serializer: () => TState,
    metadataCreator?: () => TMeta
  ): IAggregateSnapshot<TState, TMeta>;

  /**
   * Restores aggregate state from a snapshot
   */
  restoreFromSnapshot(
    snapshot: IAggregateSnapshot<TState, TMeta>,
    deserializer: (state: TState) => void,
    metadataRestorer?: (metadata: TMeta) => void
  ): void;

  /**
   * Saves current state temporarily (for audit purposes)
   */
  saveSnapshot(serializer: () => TState, metadataCreator?: () => TMeta): void;

  /**
   * Gets and clears the previous state
   */
  getPreviousState(): unknown | null;
}

/**
 * @llm-summary Contract for versioning capability functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * VersioningCapability interface implementing domain pattern implementation for versioning capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteVersioningCapability implements IVersioningCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IVersioningCapability extends IAggregateCapability {
  /**
   * Registers an upcaster for a specific event type and version
   */
  registerUpcaster<TFrom = unknown, TTo = unknown>(
    eventType: string,
    sourceVersion: number,
    upcaster: IEventUpcaster<TFrom, TTo>
  ): this;

  /**
   * Handles versioned event processing
   */
  handleVersionedEvent(
    event: IExtendedDomainEvent,
    handlers: Map<string, IAggregateEventHandler>
  ): void;
}

/**
 * @llm-summary Contract for event sourcing capability functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * EventSourcingCapability interface implementing domain pattern implementation for event sourcing capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEventSourcingCapability implements IEventSourcingCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IEventSourcingCapability extends IAggregateCapability {
  /**
   * Loads aggregate from event store
   */
  loadFromEventStore(aggregateId: unknown): Promise<void>;

  /**
   * Saves aggregate events to event store
   */
  saveToEventStore(): Promise<void>;

  /**
   * Replays events to rebuild aggregate state
   */
  replayEvents(events: IExtendedDomainEvent[]): void;
}

/**
 * @llm-summary Contract for audit capability functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * AuditCapability interface implementing domain pattern implementation for audit capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAuditCapability implements IAuditCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IAuditCapability extends IAggregateCapability {
  /**
   * Gets the audit log for this aggregate
   */
  getAuditLog(): ReadonlyArray<IAuditEvent>;

  /**
   * Clears the audit log
   */
  clearAuditLog(): void;
}

/**
 * @llm-summary Contract for middleware capability functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * MiddlewareCapability interface implementing domain pattern implementation for middleware capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteMiddlewareCapability implements IMiddlewareCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IMiddlewareCapability extends IAggregateCapability {
  /**
   * Adds middleware to the event processing pipeline
   */
  use(middleware: EventAggregateMiddleware): this;
}

// ==========================================
// BUILDER INTERFACE
// ==========================================

/**
 * @llm-summary Contract for aggregate builder functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * AggregateBuilder interface implementing domain pattern implementation for aggregate builder operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAggregateBuilder implements IAggregateBuilder {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IAggregateBuilder<TId> {
  /**
   * Adds snapshot capability
   */
  withSnapshots<TState = unknown, TMeta = unknown>(): this;

  /**
   * Adds versioning capability
   */
  withVersioning(): this;

  /**
   * Adds event sourcing capability
   */
  withEventSourcing(eventStore?: IEventStore): this;

  /**
   * Adds audit capability
   */
  withAudit(): this;

  /**
   * Adds custom capability
   */
  withCustomCapability<T extends IAggregateCapability>(name: string, capability: T): this;

  /**
   * Builds the aggregate with all configured capabilities
   */
  build(): IAggregateRoot<TId>;
}

// ==========================================
// SUPPORTING TYPES AND INTERFACES
// ==========================================

/**
 * @llm-summary Contract for aggregate event handler functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * AggregateEventHandler interface implementing domain pattern implementation for aggregate event handler operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAggregateEventHandler implements IAggregateEventHandler {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IAggregateEventHandler<T = unknown> {
  (payload: T, metadata?: IEventMetadata): void;
}

/**
 * @llm-summary Type definition for event aggregate middleware
 * @llm-domain Pattern
 * @llm-usage Frequent
 *
 * @description
 * EventAggregateMiddleware type implementing domain pattern implementation for event aggregate middleware operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: EventAggregateMiddleware = {} as EventAggregateMiddleware;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type EventAggregateMiddleware<T = unknown> = (
  event: IExtendedDomainEvent<T>,
  next: (event: IExtendedDomainEvent<T>) => void
) => void;

/**
 * @llm-summary Contract for aggregate snapshot functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * AggregateSnapshot interface implementing domain pattern implementation for aggregate snapshot operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAggregateSnapshot implements IAggregateSnapshot {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IAggregateSnapshot<TState = unknown, TMeta = unknown> {
  /** Aggregate identifier */
  id: unknown;

  /** Aggregate version */
  version: number;

  /** Aggregate type */
  aggregateType: string;

  /** Aggregate state */
  state: TState;

  /** When the snapshot was created */
  timestamp: Date;

  /** Snapshot metadata (optional) */
  metadata?: TMeta | undefined;

  /** ID of the last event included in the snapshot (optional) */
  lastEventId?: string | undefined;
}

// ==========================================
// TYPE GUARDS
// ==========================================

// Note: Type guards are now implemented in aggregate-utilities.ts with type-safe capability constructors

// ==========================================
// CAPABILITY CONSTANTS (DEPRECATED)
// ==========================================

/**
 * @llm-summary CAPABILITY_NAMES constant
 * @llm-domain Pattern
 *
 * @description
 * CAPABILITY_NAMES constant implementing domain pattern implementation for c a p a b i l i t y_ n a m e s operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(CAPABILITY_NAMES);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const CAPABILITY_NAMES = {
  SNAPSHOT: 'snapshot',
  VERSIONING: 'versioning',
  EVENT_SOURCING: 'eventSourcing',
  AUDIT: 'audit',
  MIDDLEWARE: 'middleware',
} as const;

/**
 * @llm-summary Type definition for capability name
 * @llm-domain Pattern
 * @llm-usage Frequent
 *
 * @description
 * CapabilityName type implementing domain pattern implementation for capability name operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: CapabilityName = {} as CapabilityName;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type CapabilityName = (typeof CAPABILITY_NAMES)[keyof typeof CAPABILITY_NAMES];

// ==========================================
// UTILITY TYPES
// ==========================================

/**
 * @llm-summary Type definition for aggregate id type
 * @llm-domain Pattern
 * @llm-usage Frequent
 *
 * @description
 * AggregateIdType type implementing domain pattern implementation for aggregate id type operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: AggregateIdType = {} as AggregateIdType;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type AggregateIdType<T> = T extends IAggregateRoot<infer TId> ? TId : never;

/**
 * @llm-summary Type definition for aggregate with capabilities
 * @llm-domain Pattern
 * @llm-usage Frequent
 *
 * @description
 * AggregateWithCapabilities type implementing domain pattern implementation for aggregate with capabilities operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: AggregateWithCapabilities = {} as AggregateWithCapabilities;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type AggregateWithCapabilities<
  TId,
  TCapabilities extends CapabilityName[],
> = IAggregateRoot<TId> & {
  [K in TCapabilities[number] as `getCapability`]: (
    name: K
  ) => K extends 'snapshot'
    ? ISnapshotCapability
    : K extends 'versioning'
      ? IVersioningCapability
      : K extends 'eventSourcing'
        ? IEventSourcingCapability
        : K extends 'audit'
          ? IAuditCapability
          : K extends 'middleware'
            ? IMiddlewareCapability
            : IAggregateCapability;
};

// ==========================================
// AGGREGATE FACTORY INTERFACE
// ==========================================

/**
 * @llm-summary Contract for aggregate factory functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * AggregateFactory interface implementing domain pattern implementation for aggregate factory operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAggregateFactory implements IAggregateFactory {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IAggregateFactory<TId, TAggregate extends IAggregateRoot<TId>> {
  /**
   * Creates a new aggregate instance
   */
  create(id: EntityId<TId>, ...args: unknown[]): TAggregate;

  /**
   * Rebuilds aggregate from events
   */
  fromEvents(id: EntityId<TId>, events: IExtendedDomainEvent[]): TAggregate;

  /**
   * Rebuilds aggregate from snapshot and subsequent events
   */
  fromSnapshot<TState, TMeta>(
    snapshot: IAggregateSnapshot<TState, TMeta>,
    events: IExtendedDomainEvent[]
  ): TAggregate;
}

// ==========================================
// VALIDATION INTERFACES
// ==========================================

/**
 * @llm-summary Contract for aggregate validator functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * AggregateValidator interface implementing domain pattern implementation for aggregate validator operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAggregateValidator implements IAggregateValidator {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IAggregateValidator<TAggregate extends IAggregateRoot<unknown>> {
  /**
   * Validates aggregate state
   */
  validate(aggregate: TAggregate): ValidationResult;

  /**
   * Validates aggregate before applying event
   */
  validateBeforeEvent(aggregate: TAggregate, event: IExtendedDomainEvent): ValidationResult;
}

/**
 * @llm-summary Contract for validation result functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * ValidationResult interface implementing domain pattern implementation for validation result operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteValidationResult implements ValidationResult {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ValidationResult {
  isValid: boolean;
  errors: IValidationError[];
}

/**
 * @llm-summary Contract for validation error functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * ValidationError interface implementing domain pattern implementation for validation error operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteValidationError implements IValidationError {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IValidationError {
  field: string;
  message: string;
  code?: string;
}

// ==========================================
// ADVANCED CAPABILITY INTERFACES
// ==========================================

/**
 * @llm-summary Contract for caching capability functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * CachingCapability interface implementing domain pattern implementation for caching capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCachingCapability implements ICachingCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ICachingCapability extends IAggregateCapability {
  /**
   * Gets cached value
   */
  get<T>(key: string): T | undefined;

  /**
   * Sets cached value
   */
  set<T>(key: string, value: T, ttl?: number): void;

  /**
   * Clears all cached values
   */
  clear(): void;

  /**
   * Invalidates specific cached value
   */
  invalidate(key: string): void;
}

/**
 * @llm-summary Contract for metrics capability functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * MetricsCapability interface implementing domain pattern implementation for metrics capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteMetricsCapability implements IMetricsCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IMetricsCapability extends IAggregateCapability {
  /**
   * Records a metric
   */
  record(name: string, value: number, tags?: Record<string, string>): void;

  /**
   * Increments a counter
   */
  increment(name: string, tags?: Record<string, string>): void;

  /**
   * Records timing information
   */
  timing(name: string, duration: number, tags?: Record<string, string>): void;

  /**
   * Gets recorded metrics
   */
  getMetrics(): MetricData[];
}

/**
 * @llm-summary Contract for metric data functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * MetricData interface implementing domain pattern implementation for metric data operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteMetricData implements MetricData {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface MetricData {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'timing';
  tags?: Record<string, string>;
  timestamp: Date;
}

/**
 * @llm-summary Contract for security capability functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * SecurityCapability interface implementing domain pattern implementation for security capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSecurityCapability implements ISecurityCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ISecurityCapability extends IAggregateCapability {
  /**
   * Encrypts sensitive data
   */
  encrypt(data: unknown): string;

  /**
   * Decrypts sensitive data
   */
  decrypt(encryptedData: string): unknown;

  /**
   * Checks if user has permission to perform action
   */
  hasPermission(action: string, user?: unknown): boolean;

  /**
   * Logs security events
   */
  logSecurityEvent(event: SecurityEvent): void;
}

/**
 * @llm-summary Contract for security event functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * SecurityEvent interface implementing domain pattern implementation for security event operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSecurityEvent implements SecurityEvent {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface SecurityEvent {
  type: 'access' | 'modification' | 'failure';
  action: string;
  user?: unknown;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
