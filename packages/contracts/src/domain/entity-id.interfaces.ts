/**
 * Core Entity ID interfaces and types for DDD
 * These are fundamental contracts that other packages can depend on
 */

export type IdType = 'uuid' | 'integer' | 'text' | 'bigint';

/**
 * Core Entity ID interface - fundamental DDD building block
 * This interface represents the contract for all entity identifiers
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
 * Entity ID constructor parameters
 */
export interface IEntityIdConstructorParams<T = unknown> {
  value: T;
  type: IdType;
}

/**
 * Static factory methods for Entity IDs
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
 * Type alias for the most common Entity ID type
 */
export type EntityId<T = string> = IEntityId<T>;
