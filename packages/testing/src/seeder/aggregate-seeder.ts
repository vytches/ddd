/**
 * Type-safe aggregate seeder that works with AggregateFactory to provide
 * a fluent API for aggregate generation. Handles business rule compliance,
 * capability-aware seeding, and cross-aggregate relationships.
 */

import { Result } from '@vytches/ddd-utils';
import {
  AggregateFactory,
  type AggregateTemplate,
  type SequenceGenerator,
  type ValueObjectGenerator,
} from './aggregate-factory.js';
import type {
  DomainSeederConfig,
  ISeeder,
  IStreamingSeeder,
  SeederResult,
  SeedableAggregate,
} from './domain-seeder.js';

/**
 * Configuration for aggregate-specific seeding behavior
 */
export interface AggregateSeederConfig {
  /** Enable automatic domain event generation */
  generateDomainEvents?: boolean;

  /** Enable capability-based seeding (audit trails, versioning, etc.) */
  enableCapabilities?: boolean;

  /** List of specific capabilities to enable */
  capabilities?: string[];

  /** Enable cross-aggregate relationship seeding */
  enableRelationships?: boolean;

  /** Batch size for streaming operations */
  streamingBatchSize?: number;
}

/**
 * Relationship configuration between aggregates
 */
export interface AggregateRelationship {
  /** Target aggregate type name */
  targetAggregate: string;

  /** Relationship type (one-to-one, one-to-many, many-to-many) */
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';

  /** Minimum number of related entities */
  min?: number;

  /** Maximum number of related entities */
  max?: number;

  /** Average number of related entities for realistic distribution */
  average?: number;

  /** Probability that this relationship exists (0-1) */
  probability?: number;
}

/**
 * Event generation pattern for aggregate events
 */
export interface EventPattern {
  /** Event type name */
  eventType: string;

  /** Probability this event is generated (0-1) */
  probability?: number;

  /** Data generator for event payload */
  dataGenerator?: () => any | Promise<any>;

  /** Delay after aggregate creation (in ms) */
  delay?: number;
}

/**
 * Aggregate seeder implementation that provides a fluent API for type-safe
 * aggregate generation with deep DDD pattern integration.
 *
 * This seeder works closely with AggregateFactory to provide:
 * - Type-safe aggregate creation with business rule validation
 * - Capability-aware seeding for audit, versioning, and other patterns
 * - Domain event generation with realistic timelines
 * - Cross-aggregate relationship management
 * - Streaming support for large-scale data generation
 */
export class AggregateSeeder<T extends SeedableAggregate>
  implements ISeeder<T>, IStreamingSeeder<T>
{
  private readonly factory: AggregateFactory<T>;
  private readonly config: AggregateSeederConfig;
  private readonly relationships: Map<string, AggregateRelationship> = new Map();
  private readonly eventPatterns: EventPattern[] = [];

  /**
   * Creates a new AggregateSeeder instance.
   *
   * @param AggregateClass Constructor for the aggregate type
   * @param globalConfig Global seeder configuration
   */
  constructor(AggregateClass: new (...args: any[]) => T, globalConfig: DomainSeederConfig = {}) {
    this.config = {
      generateDomainEvents: globalConfig.enableEvents ?? true,
      enableCapabilities: true,
      streamingBatchSize: globalConfig.defaultBatchSize ?? 1000,
    };

    this.factory = new AggregateFactory(AggregateClass, globalConfig, {
      generateEvents: this.config.generateDomainEvents ?? true,
      validateBusinessRules: true,
    });
  }

  /**
   * Sets default values for aggregate properties.
   *
   * @param defaults Object containing default property values
   * @returns Seeder instance for method chaining
   */
  withDefaults(defaults: Partial<any>): this {
    this.factory.withDefaults(defaults);
    return this;
  }

  /**
   * Adds a sequence generator for a specific property.
   *
   * @param property Property name to generate sequence values for
   * @param generator Function that generates sequential values
   * @returns Seeder instance for method chaining
   */
  withSequence<K extends keyof any>(property: K, generator: SequenceGenerator<any[K]>): this {
    this.factory.withSequence(property, generator);
    return this;
  }

  /**
   * Adds a value object generator for a specific property.
   *
   * @param property Property name to generate value objects for
   * @param generator Function that creates value objects
   * @returns Seeder instance for method chaining
   */
  withValueObject<K extends keyof any>(property: K, generator: ValueObjectGenerator<any[K]>): this {
    this.factory.withValueObject(property, generator);
    return this;
  }

  /**
   * Configures aggregate capabilities for seeding.
   *
   * @param capabilities Array of capability names to enable
   * @returns Seeder instance for method chaining
   *
   * @example
   * ```typescript
   * const seeder = DomainSeeder.forAggregate(OrderAggregate)
   *   .withCapabilities(['audit', 'versioning', 'events'])
   *   .withDefaults({ status: 'draft' });
   * ```
   */
  withCapabilities(capabilities: string[]): this {
    this.config.capabilities = capabilities;
    this.config.enableCapabilities = true;
    return this;
  }

  /**
   * Configures domain event generation patterns.
   *
   * @param enable Whether to enable event generation
   * @param patterns Optional specific event patterns to generate
   * @returns Seeder instance for method chaining
   *
   * @example
   * ```typescript
   * const seeder = DomainSeeder.forAggregate(UserAggregate)
   *   .withEvents(true, [
   *     { eventType: 'UserRegistered', probability: 1.0 },
   *     { eventType: 'EmailVerified', probability: 0.8, delay: 1000 },
   *     { eventType: 'ProfileCompleted', probability: 0.6, delay: 5000 }
   *   ]);
   * ```
   */
  withEvents(enable: boolean, patterns?: EventPattern[]): this {
    this.config.generateDomainEvents = enable;
    if (patterns) {
      this.eventPatterns.push(...patterns);
    }
    return this;
  }

  /**
   * Configures relationships with other aggregates.
   *
   * @param relationshipName Name of the relationship
   * @param relationship Relationship configuration
   * @returns Seeder instance for method chaining
   *
   * @example
   * ```typescript
   * const orderSeeder = DomainSeeder.forAggregate(OrderAggregate)
   *   .withRelationship('orderItems', {
   *     targetAggregate: 'OrderItem',
   *     type: 'one-to-many',
   *     min: 1,
   *     max: 10,
   *     average: 3,
   *     probability: 1.0
   *   })
   *   .withRelationship('customer', {
   *     targetAggregate: 'Customer',
   *     type: 'one-to-one',
   *     probability: 1.0
   *   });
   * ```
   */
  withRelationship(relationshipName: string, relationship: AggregateRelationship): this {
    this.relationships.set(relationshipName, relationship);
    this.config.enableRelationships = true;
    return this;
  }

  /**
   * Registers a reusable template for aggregate creation.
   *
   * @param template Template configuration
   * @returns Seeder instance for method chaining
   */
  withTemplate(template: AggregateTemplate<any>): this {
    this.factory.withTemplate(template);
    return this;
  }

  /**
   * Adds a post-processor for aggregate modification after creation.
   *
   * @param processor Async function to process the aggregate
   * @returns Seeder instance for method chaining
   */
  withPostProcessor(processor: (aggregate: T) => Promise<T>): this {
    this.factory.withPostProcessor(async (aggregate: T) => {
      // Apply capability-specific processing
      if (this.config.enableCapabilities && this.config.capabilities) {
        aggregate = await this.applyCapabilities(aggregate);
      }

      // Generate domain events if configured
      if (this.config.generateDomainEvents && this.eventPatterns.length > 0) {
        await this.generateDomainEvents(aggregate);
      }

      // Apply custom processor
      return await processor(aggregate);
    });
    return this;
  }

  /**
   * Builds a single aggregate instance.
   *
   * @param overrides Optional property overrides
   * @param templateName Optional template to use
   * @returns Promise resolving to created aggregate
   */
  async build(overrides: Partial<any> = {}, templateName?: string): Promise<SeederResult<T>> {
    const result = await this.factory.create(overrides, templateName);

    if (!result.isSuccess) {
      return result;
    }

    // Apply additional seeder-specific processing
    try {
      const aggregate = await this.postProcessAggregate(result.value);
      return Result.ok(aggregate);
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Builds multiple aggregate instances.
   *
   * @param count Number of aggregates to create
   * @param overrideGenerator Optional per-instance override generator
   * @param templateName Optional template to use
   * @returns Promise resolving to array of aggregates
   */
  async buildMany(
    count: number,
    overrideGenerator?: (index: number) => Partial<any>,
    templateName?: string
  ): Promise<SeederResult<T[]>> {
    const result = await this.factory.createMany(count, overrideGenerator, templateName);

    if (!result.isSuccess) {
      return result;
    }

    // Apply post-processing to all aggregates
    try {
      const processedAggregates = await Promise.all(
        result.value.map((aggregate: T) => this.postProcessAggregate(aggregate))
      );

      return Result.ok(processedAggregates);
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Creates a streaming iterator for large-scale aggregate generation.
   *
   * @param count Total number of aggregates to generate
   * @param batchSize Optional batch size (defaults to config value)
   * @returns Async iterable of aggregate batches
   *
   * @example
   * ```typescript
   * const seeder = DomainSeeder.forAggregate(UserAggregate);
   *
   * // Stream 1 million users in batches of 1000
   * for await (const batch of seeder.stream(1_000_000, 1000)) {
   *   if (batch.success) {
   *     await saveToDatabase(batch.data);
   *   } else {
   *     console.error('Batch failed:', batch.error);
   *   }
   * }
   * ```
   */
  async *stream(
    count: number,
    batchSize: number = this.config.streamingBatchSize!
  ): AsyncIterable<SeederResult<T>> {
    let generated = 0;

    while (generated < count) {
      const currentBatchSize = Math.min(batchSize, count - generated);

      const result = await this.buildMany(currentBatchSize, index => ({
        // Add sequential identifier for streaming batches
        _streamIndex: generated + index,
      }));

      if (result.isSuccess) {
        // Yield individual aggregates from the batch
        for (const aggregate of result.value) {
          yield Result.ok(aggregate);
          generated++;
        }
      } else {
        yield Result.fail(result.error);
        break; // Stop streaming on batch failure
      }
    }
  }

  /**
   * Gets current configuration.
   */
  getConfig(): Readonly<AggregateSeederConfig> {
    return { ...this.config };
  }

  /**
   * Gets registered relationships.
   */
  getRelationships(): Map<string, AggregateRelationship> {
    return new Map(this.relationships);
  }

  /**
   * Gets configured event patterns.
   */
  getEventPatterns(): EventPattern[] {
    return [...this.eventPatterns];
  }

  /**
   * Applies capability-specific processing to an aggregate.
   */
  private async applyCapabilities(aggregate: T): Promise<T> {
    if (!this.config.capabilities) return aggregate;

    for (const capability of this.config.capabilities) {
      switch (capability) {
        case 'audit':
          // Apply audit capability if available
          if ('enableAudit' in aggregate && typeof aggregate.enableAudit === 'function') {
            (aggregate as any).enableAudit();
          }
          break;

        case 'versioning':
          // Apply versioning capability if available
          if ('enableVersioning' in aggregate && typeof aggregate.enableVersioning === 'function') {
            (aggregate as any).enableVersioning();
          }
          break;

        case 'events':
          // Ensure event capability is enabled
          if ('enableEvents' in aggregate && typeof aggregate.enableEvents === 'function') {
            (aggregate as any).enableEvents();
          }
          break;

        case 'snapshots':
          // Apply snapshot capability if available
          if ('enableSnapshots' in aggregate && typeof aggregate.enableSnapshots === 'function') {
            (aggregate as any).enableSnapshots();
          }
          break;
      }
    }

    return aggregate;
  }

  /**
   * Generates domain events based on configured patterns.
   */
  private async generateDomainEvents(aggregate: T): Promise<void> {
    if (!('addDomainEvent' in aggregate) || typeof aggregate.addDomainEvent !== 'function') {
      return; // Aggregate doesn't support domain events
    }

    for (const pattern of this.eventPatterns) {
      // Check probability
      if (pattern.probability && Math.random() > pattern.probability) {
        continue;
      }

      // Generate event data
      const eventData = pattern.dataGenerator ? await pattern.dataGenerator() : {};

      // Create domain event (simplified - in real implementation would use proper event classes)
      const domainEvent = {
        eventType: pattern.eventType,
        aggregateId: (aggregate as any).id,
        eventData,
        occurredOn: new Date(),
        eventVersion: 1,
      };

      // Add event to aggregate
      if (pattern.delay) {
        setTimeout(() => {
          (aggregate as any).addDomainEvent(domainEvent);
        }, pattern.delay);
      } else {
        (aggregate as any).addDomainEvent(domainEvent);
      }
    }
  }

  /**
   * Applies post-processing to a created aggregate.
   */
  private async postProcessAggregate(aggregate: T): Promise<T> {
    // Apply capabilities if enabled
    if (this.config.enableCapabilities && this.config.capabilities) {
      aggregate = await this.applyCapabilities(aggregate);
    }

    // Generate domain events if configured
    if (this.config.generateDomainEvents && this.eventPatterns.length > 0) {
      await this.generateDomainEvents(aggregate);
    }

    return aggregate;
  }
}
