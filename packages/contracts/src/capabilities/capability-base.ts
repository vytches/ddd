/**
 * @llm-summary Capability class for capability operations
 * @llm-domain Core
 * @llm-complexity Medium
 *
 * @description
 * Capability class implementing core domain functionality for capability operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new Capability();
 * ```
 * *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for aggregate capability functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * AggregateCapability interface implementing core domain functionality for aggregate capability operations.
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
 * @llm-summary Contract for projection capability functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ProjectionCapability interface implementing core domain functionality for projection capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteProjectionCapability implements IProjectionCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Type definition for capability type
 * @llm-domain Core
 * @llm-usage Frequent
 *
 * @description
 * CapabilityType type implementing core domain functionality for capability type operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: CapabilityType = {} as CapabilityType;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type CapabilityType<T extends Capability> = T extends Capability<infer U> ? U : never;

/**
 * @llm-summary Type definition for capability constructor
 * @llm-domain Core
 * @llm-usage Frequent
 *
 * @description
 * CapabilityConstructor type implementing core domain functionality for capability constructor operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: CapabilityConstructor = {} as CapabilityConstructor;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type CapabilityConstructor<T extends Capability = Capability> = (new (
  ...args: any[]
) => T) & {
  capabilityType: string;
};

/**
 * @llm-summary Type definition for capability map
 * @llm-domain Core
 * @llm-usage Frequent
 *
 * @description
 * CapabilityMap type implementing core domain functionality for capability map operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: CapabilityMap = {} as CapabilityMap;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type CapabilityMap = Map<string, Capability>;
