/**
 * Core seeding orchestrator that provides a fluent API for generating
 * domain-aware test data, respecting aggregate boundaries and business rules.
 *
 * Follows Factory pattern over Builder pattern for better composability
 * and aligns with DDD architectural principles.
 */

import type { Result } from '@vytches/ddd-utils';
import { AggregateSeeder } from './aggregate-seeder.js';
import { AIEnhancedSeeder } from './ai-enhanced-seeder.js';
import { EventSourcedSeeder } from './event-sourced-seeder.js';
import { GeographicSeeder } from './geographic-seeder.js';
import { ScenarioSeeder } from './scenario-seeder.js';
import type {
  AIProviderConfig,
  CrisisConfig,
  DomainSeederConfig,
  GeographicContext,
  GeographicCoordinate,
  ISeeder,
  IStreamingSeeder,
  SeedableAggregate,
  SeederResult,
  TimelineSpec,
} from './shared-seeder-types.js';

/**
 * Main orchestrator class for DDD-native test data seeding.
 *
 * This class serves as the central entry point for all seeding operations,
 * providing factory methods for different types of seeders and scenarios.
 * It follows the Factory pattern to ensure proper composability and
 * maintainability of complex seeding logic.
 *
 * Key architectural decisions:
 * - Factory pattern over Builder pattern for better DDD alignment
 * - Streaming-first architecture for performance with large datasets
 * - Type-safe aggregate generation with business rule compliance
 * - Deep integration with all VytchesDDD packages
 */
export class DomainSeeder {
  private readonly config: DomainSeederConfig;
  private static globalConfig: DomainSeederConfig = {};

  /**
   * Creates a new DomainSeeder instance with optional configuration.
   *
   * @param config Optional configuration for this seeder instance
   */
  constructor(config: DomainSeederConfig = {}) {
    this.config = { ...DomainSeeder.globalConfig, ...config };
  }

  /**
   * Sets global configuration for all DomainSeeder instances.
   *
   * @param config Global configuration to apply
   */
  static configure(config: DomainSeederConfig): void {
    DomainSeeder.globalConfig = { ...DomainSeeder.globalConfig, ...config };
  }

  /**
   * Creates an aggregate-specific seeder for type-safe aggregate generation.
   *
   * @param AggregateClass Constructor function for the aggregate type
   * @returns AggregateSeeder instance configured for the specific aggregate
   *
   * @example
   * ```typescript
   * const userSeeder = DomainSeeder.forAggregate(UserAggregate)
   *   .withDefaults({ status: 'active' })
   *   .withSequence('email', n => `user${n}@example.com`);
   *
   * const user = await userSeeder.build();
   * const users = await userSeeder.buildMany(10);
   * ```
   */
  static forAggregate<T extends SeedableAggregate>(
    AggregateClass: new (...args: any[]) => T
  ): AggregateSeeder<T> {
    return new AggregateSeeder(AggregateClass, DomainSeeder.globalConfig);
  }

  /**
   * Creates an event sourcing seeder for generating event streams and histories.
   *
   * @param scenarioName Descriptive name for the event sourcing scenario
   * @returns EventSourcedSeeder instance for building event streams
   *
   * @example
   * ```typescript
   * const orderHistory = await DomainSeeder.eventSourcedScenario('order-lifecycle')
   *   .withEventStream(stream =>
   *     stream
   *       .start('OrderCreated', { orderId: 'order-123', amount: 1000 })
   *       .after('2h', 'PaymentProcessed', { paymentId: 'pay-456' })
   *       .after('1h', 'OrderShipped', { trackingNumber: 'TRK789' })
   *   )
   *   .withSnapshots({ every: 5 })
   *   .generateWithHistory();
   * ```
   */
  static eventSourcedScenario(scenarioName: string): EventSourcedSeeder {
    return new EventSourcedSeeder(scenarioName, DomainSeeder.globalConfig);
  }

  /**
   * Creates a complex scenario seeder for multi-aggregate coordinated scenarios.
   *
   * @param scenarioName Descriptive name for the complex scenario
   * @returns ScenarioSeeder instance for building complex domain scenarios
   *
   * @example
   * ```typescript
   * const marketplaceScenario = await DomainSeeder.scenario('active-marketplace')
   *   .withAggregates({
   *     users: 1000,
   *     products: 500,
   *     orders: 2000
   *   })
   *   .withRelationships({
   *     'users.orders': { min: 0, max: 10, avg: 3 },
   *     'products.orders': { min: 1, max: 100, avg: 20 }
   *   })
   *   .withTimeline('6months')
   *   .seed();
   * ```
   */
  static scenario(scenarioName: string): ScenarioSeeder {
    return new ScenarioSeeder(scenarioName, DomainSeeder.globalConfig);
  }

  /**
   * Creates a geographic seeder for location-aware scenarios.
   *
   * @param scenarioName Descriptive name for the geographic scenario
   * @returns GeographicSeeder instance for location-based seeding
   *
   * @example
   * ```typescript
   * const neighborhoodScenario = await DomainSeeder.geographicScenario('warsaw-mokotow')
   *   .withBoundaries({
   *     center: { lat: 52.1946, lng: 21.0147 },
   *     radius: 2000,
   *     density: 'urban'
   *   })
   *   .withUsers({ count: 500, verificationRate: 0.8 })
   *   .withBusinesses({ types: ['restaurant', 'pharmacy'], density: 'medium' })
   *   .seed();
   * ```
   */
  static geographicScenario(scenarioName: string): GeographicSeeder {
    return new GeographicSeeder(scenarioName, DomainSeeder.globalConfig);
  }

  /**
   * Creates an AI-enhanced seeder for intelligent, realistic data generation.
   *
   * @param scenarioName Descriptive name for the AI-enhanced scenario
   * @returns AIEnhancedSeeder instance for intelligent data generation
   *
   * @example
   * ```typescript
   * const intelligentScenario = await DomainSeeder.aiEnhancedScenario('realistic-community')
   *   .withAI({
   *     provider: 'openai',
   *     model: 'gpt-4',
   *     context: 'urban-polish-community'
   *   })
   *   .generateRealisticProfiles({
   *     count: 1000,
   *     diversity: 'high',
   *     behaviorPatterns: ['community-focused', 'tech-savvy']
   *   })
   *   .seed();
   * ```
   */
  static aiEnhancedScenario(scenarioName: string): AIEnhancedSeeder {
    return new AIEnhancedSeeder(scenarioName, DomainSeeder.globalConfig);
  }

  /**
   * Creates a crisis scenario seeder for emergency and edge-case simulation.
   *
   * @param scenarioName Descriptive name for the crisis scenario
   * @returns ScenarioSeeder instance configured for crisis simulation
   *
   * @example
   * ```typescript
   * const crisisTest = await DomainSeeder.crisisScenario('neighborhood-flooding')
   *   .withBaseline('active-community')
   *   .injectCrisis({
   *     type: 'natural-disaster',
   *     subtype: 'flooding',
   *     severity: 'high',
   *     triggerAt: 'day-30',
   *     duration: '6hours',
   *     affectedArea: 0.6
   *   })
   *   .withEmergencyResponse({ alertPropagation: 'exponential' })
   *   .seed();
   * ```
   */
  static crisisScenario(scenarioName: string): ScenarioSeeder {
    return new ScenarioSeeder(scenarioName, DomainSeeder.globalConfig).withCrisisMode(true);
  }

  /**
   * Creates a multi-tenant scenario seeder for tenant isolation testing.
   *
   * @param scenarioName Descriptive name for the multi-tenant scenario
   * @returns ScenarioSeeder instance configured for multi-tenancy
   *
   * @example
   * ```typescript
   * const multiTenantScenario = await DomainSeeder.multiTenantScenario('saas-platform')
   *   .withTenants([
   *     { id: 'tenant-1', plan: 'enterprise', users: 1000 },
   *     { id: 'tenant-2', plan: 'starter', users: 50 }
   *   ])
   *   .withIsolationValidation(true)
   *   .seed();
   * ```
   */
  static multiTenantScenario(scenarioName: string): ScenarioSeeder {
    return new ScenarioSeeder(scenarioName, DomainSeeder.globalConfig).withMultiTenancy(true);
  }

  /**
   * Creates a saga scenario seeder for workflow and compensation pattern testing.
   *
   * @param scenarioName Descriptive name for the saga scenario
   * @returns ScenarioSeeder instance configured for saga workflows
   *
   * @example
   * ```typescript
   * const sagaScenario = await DomainSeeder.sagaScenario('order-payment-workflow')
   *   .withWorkflowSteps([
   *     'CreateOrder',
   *     'ReserveInventory',
   *     'ProcessPayment',
   *     'ShipOrder'
   *   ])
   *   .withCompensationActions({
   *     'ProcessPayment': 'RefundPayment',
   *     'ReserveInventory': 'ReleaseInventory'
   *   })
   *   .withFailureScenarios(['payment-declined', 'inventory-unavailable'])
   *   .seed();
   * ```
   */
  static sagaScenario(scenarioName: string): ScenarioSeeder {
    return new ScenarioSeeder(scenarioName, DomainSeeder.globalConfig).withSagaWorkflow(true);
  }

  /**
   * Gets the current global configuration.
   *
   * @returns Current global configuration object
   */
  static getGlobalConfig(): Readonly<DomainSeederConfig> {
    return { ...DomainSeeder.globalConfig };
  }

  /**
   * Resets the global configuration to defaults.
   */
  static resetGlobalConfig(): void {
    DomainSeeder.globalConfig = {};
  }

  /**
   * Gets the instance configuration.
   *
   * @returns Current instance configuration object
   */
  getConfig(): Readonly<DomainSeederConfig> {
    return { ...this.config };
  }
}

export * from './aggregate-seeder.js';
export * from './ai-enhanced-seeder.js';
export * from './event-sourced-seeder.js';
export * from './geographic-seeder.js';
export * from './scenario-seeder.js';
export * from './shared-seeder-types.js';
