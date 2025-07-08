/**
 * TestDataBuilder - Fluent builder for creating test data objects.
 * Provides type-safe, fluent API for constructing complex test data with sensible defaults.
 *
 * Supports both simple object construction and advanced patterns like sequences,
 * random generation, and factory methods for consistent test data creation.
 */

export interface TestDataBuilderOptions<T> {
  /**
   * Default values for the object being built
   */
  defaults?: Partial<T>;
  /**
   * Factory function for creating the final object
   */
  factory?: (data: Partial<T>) => T;
  /**
   * Validation function to ensure data consistency
   */
  validator?: (data: Partial<T>) => boolean | string;
  /**
   * Deep merge strategy for nested objects
   */
  deepMerge?: boolean;
}

export interface SequenceOptions {
  /**
   * Starting value for the sequence
   */
  start?: number;
  /**
   * Step size for each increment
   */
  step?: number;
  /**
   * Prefix for generated values
   */
  prefix?: string;
  /**
   * Suffix for generated values
   */
  suffix?: string;
}

export interface RandomOptions {
  /**
   * Minimum value for numbers
   */
  min?: number;
  /**
   * Maximum value for numbers
   */
  max?: number;
  /**
   * Length for strings
   */
  length?: number;
  /**
   * Character set for string generation
   */
  charset?: string;
  /**
   * Seed for reproducible randomness
   */
  seed?: string;
}

export class TestDataBuilder<T> {
  protected data: Partial<T> = {};
  protected options: Required<TestDataBuilderOptions<T>>;
  private static _sequences: Map<string, number> = new Map();
  private static _randomSeed: number = Date.now();

  constructor(options: TestDataBuilderOptions<T> = {}) {
    this.options = {
      defaults: options.defaults || {},
      factory: options.factory || ((data: Partial<T>) => data as T),
      validator: options.validator || (() => true),
      deepMerge: options.deepMerge ?? true
    };

    // Apply defaults
    if (this.options.defaults) {
      this.data = this.options.deepMerge
        ? this.deepMerge({}, this.options.defaults)
        : { ...this.options.defaults };
    }
  }

  /**
   * Set a property value
   */
  with<K extends keyof T>(property: K, value: T[K]): this {
    this.data[property] = value;
    return this;
  }

  /**
   * Set multiple properties at once
   */
  withProperties(properties: Partial<T>): this {
    if (this.options.deepMerge) {
      this.data = this.deepMerge(this.data, properties);
    } else {
      Object.assign(this.data, properties);
    }
    return this;
  }

  /**
   * Set a custom factory function for building the final object
   */
  withFactory(factory: (data: Partial<T>) => T): this {
    this.options.factory = factory;
    return this;
  }

  /**
   * Set a property to a sequenced value
   */
  withSequence<K extends keyof T>(
    property: K,
    options: SequenceOptions = {}
  ): this {
    const {
      start = 1,
      step = 1,
      prefix = '',
      suffix = ''
    } = options;

    // Create unique sequence key that includes prefix to avoid conflicts
    const sequenceKey = `${String(property)}_${prefix}_sequence`;
    const currentValue = TestDataBuilder._sequences.get(sequenceKey) || start;
    TestDataBuilder._sequences.set(sequenceKey, currentValue + step);

    const value = `${prefix}${currentValue}${suffix}` as T[K];
    this.data[property] = value;
    return this;
  }

  /**
   * Set a property to a random value
   */
  withRandom<K extends keyof T>(
    property: K,
    type: 'string' | 'number' | 'boolean',
    options: RandomOptions = {}
  ): this {
    let value: any;

    switch (type) {
      case 'string':
        value = this.generateRandomString(options);
        break;
      case 'number':
        value = this.generateRandomNumber(options);
        break;
      case 'boolean':
        value = this.generateRandomBoolean();
        break;
      default:
        throw new Error(`Unsupported random type: ${type}`);
    }

    this.data[property] = value as T[K];
    return this;
  }

  /**
   * Set a property based on a condition
   */
  withIf<K extends keyof T>(
    condition: boolean | (() => boolean),
    property: K,
    value: T[K]
  ): this {
    const shouldApply = typeof condition === 'function' ? condition() : condition;
    if (shouldApply) {
      this.data[property] = value;
    }
    return this;
  }

  /**
   * Apply a transformation function to the current data
   */
  transform(transformer: (data: Partial<T>) => Partial<T>): this {
    this.data = transformer(this.data);
    return this;
  }

  /**
   * Clone the current builder
   */
  clone(): this {
    const cloned = new (this.constructor as any)(this.options);
    cloned.data = this.options.deepMerge
      ? this.deepMerge({}, this.data)
      : { ...this.data };
    return cloned;
  }

  /**
   * Build the final object
   */
  build(): T {
    const validationResult = this.options.validator(this.data);
    if (validationResult !== true) {
      const errorMessage = typeof validationResult === 'string'
        ? validationResult
        : 'Data validation failed';
      throw new Error(`TestDataBuilder validation failed: ${errorMessage}`);
    }

    return this.options.factory(this.data);
  }

  /**
   * Build multiple objects with sequential variations
   */
  buildMany(count: number, sequenceProperty?: keyof T): T[] {
    const results: T[] = [];

    for (let i = 0; i < count; i++) {
      const builder = this.clone();

      if (sequenceProperty) {
        builder.withSequence(sequenceProperty as any);
      }

      results.push(builder.build());
    }

    return results;
  }

  /**
   * Build with specific overrides
   */
  buildWith(overrides: Partial<T>): T {
    return this.clone().withProperties(overrides).build();
  }

  /**
   * Get the current data without building
   */
  peek(): Readonly<Partial<T>> {
    return { ...this.data };
  }

  /**
   * Reset the builder to defaults
   */
  reset(): this {
    this.data = this.options.deepMerge
      ? this.deepMerge({}, this.options.defaults)
      : { ...this.options.defaults };
    return this;
  }

  // Static utility methods

  /**
   * Create a new builder instance
   */
  static create<T>(options?: TestDataBuilderOptions<T>): TestDataBuilder<T> {
    return new TestDataBuilder<T>(options);
  }

  /**
   * Reset all sequences
   */
  static resetSequences(): void {
    TestDataBuilder._sequences.clear();
  }

  /**
   * Reset a specific sequence
   */
  static resetSequence(sequenceKey: string): void {
    TestDataBuilder._sequences.delete(sequenceKey);
  }

  /**
   * Set random seed for reproducible testing
   */
  static setRandomSeed(seed: number): void {
    TestDataBuilder._randomSeed = seed;
  }

  // Private utility methods

  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      // eslint-disable-next-line no-prototype-builtins
      if (source.hasOwnProperty(key)) {
        if (this.isObject(source[key]) && this.isObject(result[key])) {
          result[key] = this.deepMerge(result[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  private generateRandomString(options: RandomOptions): string {
    const {
      length = 10,
      charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    } = options;

    let result = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(this.seededRandom() * charset.length);
      result += charset[randomIndex];
    }
    return result;
  }

  private generateRandomNumber(options: RandomOptions): number {
    const { min = 0, max = 100 } = options;
    return Math.floor(this.seededRandom() * (max - min + 1)) + min;
  }

  private generateRandomBoolean(): boolean {
    return this.seededRandom() > 0.5;
  }

  private seededRandom(): number {
    // Simple seeded random using the global seed
    TestDataBuilder._randomSeed = (TestDataBuilder._randomSeed * 9301 + 49297) % 233280;
    return TestDataBuilder._randomSeed / 233280;
  }
}

/**
 * Specialized builders for common DDD patterns
 */

// Entity ID builder
export class EntityIdBuilder extends TestDataBuilder<{ id: string }> {
  constructor(options?: TestDataBuilderOptions<{ id: string }>) {
    super({
      defaults: { id: 'entity-id' },
      factory: (data) => ({ id: data.id! }),
      ...options
    });
  }

  withUuid(): this {
    const uuid = this.generateUuid();
    return this.with('id', uuid);
  }

  withPrefix(prefix: string): this {
    return this.withSequence('id' as any, { prefix: `${prefix}-` });
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// User data builder
export interface TestUser {
  id: string;
  name: string;
  email: string;
  age: number;
  isActive: boolean;
  createdAt: Date;
  roles: string[];
}

export class UserBuilder extends TestDataBuilder<TestUser> {
  constructor(options?: TestDataBuilderOptions<TestUser>) {
    super({
      defaults: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        age: 25,
        isActive: true,
        createdAt: new Date(),
        roles: ['user']
      },
      validator: (data) => {
        if (data.age && data.age < 0) return 'Age cannot be negative';
        if (data.email && !data.email.includes('@')) return 'Invalid email format';
        return true;
      },
      ...options
    });
  }

  withUniqueEmail(): this {
    return this.withSequence('email', {
      prefix: 'user',
      suffix: '@example.com'
    });
  }

  withRandomAge(min = 18, max = 80): this {
    return this.withRandom('age', 'number', { min, max });
  }

  asAdmin(): this {
    return this.with('roles', ['admin', 'user']);
  }

  asInactive(): this {
    return this.with('isActive', false);
  }
}

// Domain event builder
export interface TestDomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  version: number;
  timestamp: Date;
  data: Record<string, any>;
  correlationId?: string;
  causationId?: string;
}

export class DomainEventBuilder extends TestDataBuilder<TestDomainEvent> {
  constructor(options?: TestDataBuilderOptions<TestDomainEvent>) {
    super({
      defaults: {
        id: 'event-1',
        type: 'TestEvent',
        aggregateId: 'aggregate-1',
        version: 1,
        timestamp: new Date(),
        data: {}
      },
      ...options
    });
  }

  withEventType(type: string): this {
    return this.with('type', type);
  }

  withAggregateInfo(aggregateId: string, version: number): this {
    return this
      .with('aggregateId', aggregateId)
      .with('version', version);
  }

  withCorrelation(correlationId: string, causationId?: string): this {
    return this
      .with('correlationId', correlationId)
      .with('causationId', causationId || correlationId);
  }

  withData(data: Record<string, any>): this {
    return this.with('data', data);
  }

  withSequentialVersion(): this {
    // Create a custom sequence for version numbers
    const sequenceKey = 'version_sequence';
    const currentValue = TestDataBuilder['_sequences'].get(sequenceKey) || 1;
    TestDataBuilder['_sequences'].set(sequenceKey, currentValue + 1);

    return this.with('version', currentValue);
  }
}
