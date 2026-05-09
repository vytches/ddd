/**
 * Base class for **capabilities** — composable, opt-in features attached
 * to aggregates or projections at construction time. Lets domain types
 * gain orthogonal behaviors (audit, snapshots, versioning, replay) without
 * inheritance chains.
 *
 * The pattern: each subclass declares a unique `type` discriminant
 * (`'snapshot'`, `'audit'`, `'eventSourcing'`, `'versioning'`, etc.) and
 * a corresponding `static capabilityType` getter for runtime registry
 * lookup. Two parallel sub-interfaces — `IAggregateCapability` and
 * `IProjectionCapability` — extend this base with attach/detach
 * lifecycle hooks specific to their host type.
 *
 * Implementations live in feature packages:
 * - `@vytches/ddd-aggregates`: `AuditCapability`, `SnapshotCapability`,
 *   `VersioningCapability`, `EventSourcingCapability`.
 * - `@vytches/ddd-projections`: `CheckpointCapability`,
 *   `CircuitBreakerCapability`, `DeadLetterCapability`, etc.
 *
 * @example Defining a custom capability
 * ```typescript
 * import { Capability, IAggregateCapability } from '@vytches/ddd-contracts';
 *
 * class MetricsCapability
 *   extends Capability<'metrics'>
 *   implements IAggregateCapability<'metrics'>
 * {
 *   readonly type = 'metrics' as const;
 *   static override get capabilityType(): string { return 'metrics'; }
 *
 *   private events = 0;
 *   attach(_agg: unknown): void { this.events = 0; }
 *   recordEvent(): void { this.events += 1; }
 *   getCount(): number { return this.events; }
 * }
 * ```
 *
 * @example Type-narrowing via `isType`
 * ```typescript
 * const cap: Capability = aggregate.getCapability(SnapshotCapability);
 * if (cap.isType('snapshot')) {
 *   // cap is narrowed to Capability<'snapshot'> here
 * }
 * ```
 *
 * @public
 * @stable
 * @since 0.1.0
 */
export abstract class Capability<T extends string = string> {
  /**
   * Unique type identifier for the capability
   */
  abstract readonly type: T;

  /**
   * Optional capability metadata
   */
  metadata?: Record<string, unknown>;

  /**
   * Checks if this capability is of a specific type
   */
  isType<U extends string>(type: U): this is Capability<U> {
    return (this.type as string) === (type as string);
  }

  /**
   * Static type getter for compile-time type extraction
   * Each capability must override this
   */
  static get capabilityType(): string {
    throw new Error('Capability subclass must override static capabilityType getter');
  }
}

export interface IAggregateCapability<T extends string = string> extends Capability<T> {
  /**
   * Called when capability is attached to an aggregate
   */
  attach(aggregate: unknown): void;

  /**
   * Called when capability is detached from an aggregate
   */
  detach?(): void;
}

export interface IProjectionCapability<T extends string = string, TReadModel = unknown>
  extends Capability<T> {
  /**
   * Called when capability is attached to a projection engine
   */
  attach(context: unknown): void;

  /**
   * Called when capability is detached from a projection engine
   */
  detach?(): void;

  /**
   * Initialize the capability
   */
  initialize?(): Promise<void>;

  /**
   * Cleanup resources
   */
  cleanup?(): Promise<void>;
}

export type CapabilityType<T extends Capability> = T extends Capability<infer U> ? U : never;

export type CapabilityConstructor<T extends Capability = Capability> = (new (
  ...args: unknown[]
) => T) & {
  capabilityType: string;
};

export type CapabilityMap = Map<string, Capability>;
