/**
 * @llm-summary Type definition for id type
 * @llm-domain Core
 * @llm-usage Frequent
 *
 * @description
 * IdType type implementing core domain functionality for id type operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: IdType = {} as IdType;
 * ```
 *
 * @since 1.0.0
 * @public
 */

export type IdType = 'uuid' | 'integer' | 'text' | 'bigint';

/**
 * @llm-summary Contract for entity id functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * EntityId interface implementing core domain functionality for entity id operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEntityId implements IEntityId {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IEntityId<T = unknown> {
  /**
   * Get the raw value of the entity ID
   */
  getValue(): T;

  /**
   * Get the type of the entity ID
   */
  getType(): IdType;

  /**
   * Validate the entity ID value
   */
  validate(value: T): boolean;

  /**
   * Compare two entity IDs for equality
   */
  equals(other: IEntityId<T>): boolean;

  /**
   * Check if the entity ID is of a specific type
   */
  isType(type: IdType): boolean;

  /**
   * Get string representation of the entity ID
   */
  toString(): string;

  /**
   * Get JSON representation of the entity ID
   */
  toJSON(): string;

  /**
   * The actual value (readonly)
   */
  readonly value: T;
}

/**
 * @llm-summary Contract for entity id constructor params functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * EntityIdConstructorParams interface implementing core domain functionality for entity id constructor params operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEntityIdConstructorParams implements IEntityIdConstructorParams {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IEntityIdConstructorParams<T = unknown> {
  value: T;
  type: IdType;
}

/**
 * @llm-summary Contract for entity id factory functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * EntityIdFactory interface implementing core domain functionality for entity id factory operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEntityIdFactory implements IEntityIdFactory {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IEntityIdFactory {
  /**
   * Create Entity ID with random UUID
   */
  createWithRandomUUID(): IEntityId<string>;

  /**
   * Create Entity ID from UUID string
   */
  fromUUID(value: string): IEntityId<string>;

  /**
   * Create Entity ID from integer
   */
  fromInteger(value: number): IEntityId<string>;

  /**
   * Create Entity ID from bigint
   */
  fromBigInt(value: string | bigint): IEntityId<string>;

  /**
   * Create Entity ID from text
   */
  fromText(value: string): IEntityId<string>;
}

/**
 * @llm-summary Type definition for entity id
 * @llm-domain Core
 * @llm-usage Frequent
 *
 * @description
 * EntityId type implementing core domain functionality for entity id operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: EntityId = {} as EntityId;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type EntityId<T = string> = IEntityId<T>;
