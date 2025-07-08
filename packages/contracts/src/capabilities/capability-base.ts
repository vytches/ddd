/**
 * Base abstract class for all capabilities
 * Provides type-safe capability identification
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

/**
 * Base interface for aggregate capabilities
 */
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

/**
 * Base interface for projection capabilities
 */
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

/**
 * Type helper to extract capability type
 */
export type CapabilityType<T extends Capability> = T extends Capability<infer U> ? U : never;

/**
 * Type helper to create a capability constructor with static capabilityType getter
 */
export type CapabilityConstructor<T extends Capability = Capability> = (new (
  ...args: any[]
) => T) & {
  capabilityType: string;
};

/**
 * Type helper for capability registry
 */
export type CapabilityMap = Map<string, Capability>;