/**
 * Factory pattern implementation for DDD-aware aggregate generation.
 *
 * Implements Factory pattern for type-safe aggregate creation with business
 * rule compliance. Provides composable, reusable aggregate generation logic
 * that respects DDD patterns and aggregate boundaries.
 */

import type { EntityId } from '@vytches/ddd-contracts';
import { Result } from '@vytches/ddd-utils';
import type { DomainSeederConfig, SeedableAggregate } from './shared-seeder-types.js';

/**
 * Sequence generator function type
 */
export type SequenceGenerator<T> = (index: number, previous?: T) => T;

/**
 * Value object generator function type
 */
export type ValueObjectGenerator<T> = (index?: number) => T | Promise<T>;

/**
 * Aggregate factory configuration options
 */
export interface AggregateFactoryConfig {
  /** Enable automatic event generation during aggregate creation */
  generateEvents?: boolean;

  /** Validate business rules after aggregate creation */
  validateBusinessRules?: boolean;

  /** Maximum number of retry attempts for constraint violations */
  maxRetryAttempts?: number;

  /** Custom constraint validation function */
  constraintValidator?: (aggregate: any) => Promise<boolean>;
}

/**
 * Template for aggregate creation with predefined patterns
 */
export interface AggregateTemplate<T> {
  name: string;
  description?: string;
  defaults: Partial<T>;
  sequences?: { [K in keyof T]?: SequenceGenerator<T[K]> };
  valueObjects?: { [K in keyof T]?: ValueObjectGenerator<T[K]> };
  postProcessors?: Array<(aggregate: T) => Promise<T>>;
}

/**
 * Factory implementation for creating DDD aggregates with business rule compliance.
 *
 * This factory provides a composable way to create aggregates with:
 * - Default values for common scenarios
 * - Sequence generation for unique fields
 * - Value object generation with proper validation
 * - Template-based creation for reusable patterns
 * - Batch generation with performance optimizations
 */
export class AggregateFactory<T extends SeedableAggregate> {
  private readonly AggregateClass: new (...args: any[]) => T;
  private readonly config: AggregateFactoryConfig;
  private readonly defaults: Partial<any> = {};
  private readonly sequences: Map<string, SequenceGenerator<any>> = new Map();
  private readonly valueObjects: Map<string, ValueObjectGenerator<any>> = new Map();
  private readonly templates: Map<string, AggregateTemplate<any>> = new Map();
  private readonly postProcessors: Array<(aggregate: T) => Promise<T>> = [];
  private sequenceCounters: Map<string, number> = new Map();

  /**
   * Creates a new AggregateFactory for the specified aggregate type.
   *
   * @param AggregateClass Constructor function for the aggregate
   * @param seederConfig Optional seeder configuration
   * @param factoryConfig Optional factory-specific configuration
   */
  constructor(
    AggregateClass: new (...args: any[]) => T,
    seederConfig: DomainSeederConfig = {},
    factoryConfig: AggregateFactoryConfig = {}
  ) {
    this.AggregateClass = AggregateClass;
    this.config = {
      generateEvents: seederConfig.enableEvents ?? true,
      validateBusinessRules: true,
      maxRetryAttempts: 3,
      ...factoryConfig,
    };
  }

  /**
   * Sets default values for aggregate properties.
   *
   * @param defaults Object containing default property values
   * @returns Factory instance for method chaining
   *
   * @example
   * ```typescript
   * const factory = new AggregateFactory(UserAggregate)
   *   .withDefaults({
   *     status: 'active',
   *     role: 'user',
   *     emailVerified: false
   *   });
   * ```
   */
  withDefaults(defaults: Partial<any>): this {
    Object.assign(this.defaults, defaults);
    return this;
  }

  /**
   * Adds a sequence generator for a specific property.
   *
   * @param property Property name to generate sequence values for
   * @param generator Function that generates sequential values
   * @returns Factory instance for method chaining
   *
   * @example
   * ```typescript
   * const factory = new AggregateFactory(UserAggregate)
   *   .withSequence('email', n => `user${n}@example.com`)
   *   .withSequence('username', n => `user_${String(n).padStart(4, '0')}`);
   * ```
   */
  withSequence<K extends keyof any>(property: K, generator: SequenceGenerator<any[K]>): this {
    this.sequences.set(String(property), generator);
    this.sequenceCounters.set(String(property), 0);
    return this;
  }

  /**
   * Adds a value object generator for a specific property.
   *
   * @param property Property name to generate value objects for
   * @param generator Function that creates value objects
   * @returns Factory instance for method chaining
   *
   * @example
   * ```typescript
   * const factory = new AggregateFactory(UserAggregate)
   *   .withValueObject('age', () => AgeVO.create(faker.number.int({ min: 18, max: 80 })))
   *   .withValueObject('email', () => EmailVO.create(faker.internet.email()))
   *   .withValueObject('address', () => AddressVO.create({
   *     street: faker.location.streetAddress(),
   *     city: faker.location.city(),
   *     zipCode: faker.location.zipCode()
   *   }));
   * ```
   */
  withValueObject<K extends keyof any>(property: K, generator: ValueObjectGenerator<any[K]>): this {
    this.valueObjects.set(String(property), generator);
    return this;
  }

  /**
   * Adds a post-processor function that modifies aggregates after creation.
   *
   * @param processor Async function that processes the aggregate
   * @returns Factory instance for method chaining
   *
   * @example
   * ```typescript
   * const factory = new AggregateFactory(UserAggregate)
   *   .withPostProcessor(async (user) => {
   *     // Add realistic interaction history
   *     user.recordActivity('account_created');
   *     return user;
   *   })
   *   .withPostProcessor(async (user) => {
   *     // Set up initial preferences
   *     user.updatePreferences({ notifications: true });
   *     return user;
   *   });
   * ```
   */
  withPostProcessor(processor: (aggregate: T) => Promise<T>): this {
    this.postProcessors.push(processor);
    return this;
  }

  /**
   * Registers a reusable template for aggregate creation.
   *
   * @param template Template configuration with predefined patterns
   * @returns Factory instance for method chaining
   *
   * @example
   * ```typescript
   * const adminTemplate: AggregateTemplate<UserData> = {
   *   name: 'admin-user',
   *   description: 'Administrative user with full permissions',
   *   defaults: { role: 'admin', status: 'active', emailVerified: true },
   *   sequences: {
   *     email: n => `admin${n}@company.com`
   *   },
   *   valueObjects: {
   *     permissions: () => PermissionsVO.create(['read', 'write', 'admin'])
   *   }
   * };
   *
   * const factory = new AggregateFactory(UserAggregate)
   *   .withTemplate(adminTemplate);
   * ```
   */
  withTemplate(template: AggregateTemplate<any>): this {
    this.templates.set(template.name, template);
    return this;
  }

  /**
   * Creates a single aggregate instance with applied rules and generators.
   *
   * @param overrides Optional property overrides for this instance
   * @param templateName Optional template to use for creation
   * @returns Promise resolving to created aggregate or error
   *
   * @example
   * ```typescript
   * // Basic creation with overrides
   * const user = await factory.create({ name: 'John Doe', age: 30 });
   *
   * // Template-based creation
   * const admin = await factory.create({}, 'admin-user');
   * ```
   */
  async create(overrides: Partial<any> = {}, templateName?: string): Promise<Result<T, Error>> {
    try {
      const template = templateName ? this.templates.get(templateName) : undefined;

      // Build aggregate data by merging sources in priority order
      const aggregateData = await this.buildAggregateData(overrides, template);

      // Create aggregate instance
      let aggregate: T;
      for (let attempt = 1; attempt <= this.config.maxRetryAttempts!; attempt++) {
        try {
          aggregate = new this.AggregateClass(aggregateData);

          // Validate business rules if enabled
          if (this.config.validateBusinessRules && this.config.constraintValidator) {
            const isValid = await this.config.constraintValidator(aggregate);
            if (!isValid) {
              throw new Error(`Business rule validation failed for ${this.AggregateClass.name}`);
            }
          }

          // Apply post-processors
          for (const processor of this.postProcessors) {
            aggregate = await processor(aggregate);
          }

          return Result.ok(aggregate);
        } catch (error) {
          if (attempt === this.config.maxRetryAttempts) {
            throw error;
          }
          // Retry with slightly modified data
          aggregateData.id = this.generateEntityId();
        }
      }

      throw new Error('Failed to create aggregate after maximum retry attempts');
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Creates multiple aggregate instances efficiently.
   *
   * @param count Number of aggregates to create
   * @param overrideGenerator Optional function to generate per-instance overrides
   * @param templateName Optional template to use for all instances
   * @returns Promise resolving to array of created aggregates or error
   *
   * @example
   * ```typescript
   * // Create 100 users with sequential emails
   * const users = await factory.createMany(100);
   *
   * // Create with per-instance overrides
   * const variedUsers = await factory.createMany(50, (index) => ({
   *   department: index < 25 ? 'Engineering' : 'Marketing',
   *   level: Math.floor(index / 10) + 1
   * }));
   * ```
   */
  async createMany(
    count: number,
    overrideGenerator?: (index: number) => Partial<any>,
    templateName?: string
  ): Promise<Result<T[], Error>> {
    try {
      const aggregates: T[] = [];
      const errors: Error[] = [];

      for (let i = 0; i < count; i++) {
        const overrides = overrideGenerator ? overrideGenerator(i) : {};
        const result = await this.create(overrides, templateName);

        if (result.isSuccess) {
          aggregates.push(result.value);
        } else {
          errors.push(result.error);
        }
      }

      if (errors.length > 0 && aggregates.length === 0) {
        return Result.fail(
          new Error(
            `Failed to create any aggregates. Errors: ${errors.map(e => e.message).join(', ')}`
          )
        );
      }

      if (errors.length > 0) {
        console.warn(
          `Created ${aggregates.length}/${count} aggregates. ${errors.length} failures.`
        );
      }

      return Result.ok(aggregates);
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Resets all sequence counters to their initial values.
   */
  resetSequences(): void {
    for (const [property] of this.sequences) {
      this.sequenceCounters.set(property, 0);
    }
  }

  /**
   * Gets the current value of a sequence counter.
   *
   * @param property Property name to get counter for
   * @returns Current counter value or 0 if not found
   */
  getSequenceCounter(property: string): number {
    return this.sequenceCounters.get(property) ?? 0;
  }

  /**
   * Lists all registered templates.
   *
   * @returns Array of template names and descriptions
   */
  getTemplates(): Array<{ name: string; description?: string }> {
    return Array.from(this.templates.values()).map(template => ({
      name: template.name,
      ...(template.description ? { description: template.description } : {}),
    }));
  }

  /**
   * Builds aggregate data by merging defaults, sequences, value objects, and overrides.
   */
  private async buildAggregateData(
    overrides: Partial<any>,
    template?: AggregateTemplate<any>
  ): Promise<any> {
    const data: any = {};

    // 1. Apply template defaults first
    if (template) {
      Object.assign(data, template.defaults);
    }

    // 2. Apply factory defaults
    Object.assign(data, this.defaults);

    // 3. Generate sequence values
    await this.applySequences(data, template);

    // 4. Generate value objects
    await this.applyValueObjects(data, template);

    // 5. Apply overrides last (highest priority)
    Object.assign(data, overrides);

    // 6. Ensure EntityId is present
    if (!data.id) {
      data.id = this.generateEntityId();
    }

    return data;
  }

  /**
   * Applies sequence generators to aggregate data.
   */
  private async applySequences(data: any, template?: AggregateTemplate<any>): Promise<void> {
    // Apply template sequences
    if (template?.sequences) {
      for (const [property, generator] of Object.entries(template.sequences)) {
        if (generator) {
          const counter = this.getAndIncrementCounter(property);
          data[property] = generator(counter, data[property]);
        }
      }
    }

    // Apply factory sequences
    for (const [property, generator] of this.sequences) {
      const counter = this.getAndIncrementCounter(property);
      data[property] = generator(counter, data[property]);
    }
  }

  /**
   * Applies value object generators to aggregate data.
   */
  private async applyValueObjects(data: any, template?: AggregateTemplate<any>): Promise<void> {
    // Apply template value objects
    if (template?.valueObjects) {
      for (const [property, generator] of Object.entries(template.valueObjects)) {
        if (generator && !Object.prototype.hasOwnProperty.call(data, property)) {
          data[property] = await generator();
        }
      }
    }

    // Apply factory value objects
    for (const [property, generator] of this.valueObjects) {
      if (!Object.prototype.hasOwnProperty.call(data, property)) {
        data[property] = await generator();
      }
    }
  }

  /**
   * Gets and increments a sequence counter.
   */
  private getAndIncrementCounter(property: string): number {
    const current = this.sequenceCounters.get(property) ?? 0;
    this.sequenceCounters.set(property, current + 1);
    return current;
  }

  /**
   * Generates a new EntityId using appropriate factory method.
   */
  private generateEntityId(): EntityId {
    // Import EntityId dynamically to avoid circular dependencies
    const { EntityId } = require('@vytches/ddd-value-objects');
    return EntityId.createWithRandomUUID();
  }
}
