import { TestHarness, type TestHarnessOptions } from '../core/test-harness';
import { UnifiedEventBus, type UnifiedEventHandler } from '@vytches-ddd/events';
import type { IDomainEvent, IAuditEvent } from '@vytches-ddd/contracts';
import { Logger } from '@vytches-ddd/logging';

// Import IIntegrationEvent type through declaration merging
export interface IIntegrationEvent<T = any> {
  eventType: string;
  eventVersion?: number;
  payload: T;
  metadata?: any;
}

/**
 * Event capture entry for test assertions
 */
export interface EventCapture {
  eventType: string;
  payload?: unknown;
  metadata?: unknown;
  contextId?: string;
  timestamp: Date;
  order: number;
}

/**
 * Event subscription configuration for testing
 */
export interface EventSubscription {
  eventType: string;
  contexts?: string | string[];
  handler: UnifiedEventHandler;
}

/**
 * Event test scenario builder for complex test cases
 */
export interface EventTestScenario {
  name: string;
  events: Array<IDomainEvent | IIntegrationEvent | IAuditEvent>;
  expectedHandlerCalls: number;
  expectedEventTypes: string[];
  timeout?: number;
}

/**
 * Options for EventTestHarness configuration
 */
export interface EventTestHarnessOptions extends TestHarnessOptions {
  /** Auto-capture all published events */
  captureAllEvents?: boolean;
  /** Context ID for filtering events */
  contextId?: string;
  /** Maximum events to capture before clearing */
  maxCapturedEvents?: number;
  /** Enable detailed event logging */
  enableEventLogging?: boolean;
}

/**
 * Event assertion utilities for testing
 */
export interface EventAssertions {
  eventWasPublished(eventType: string): boolean;
  eventWasPublishedWithPayload(eventType: string, payload: unknown): boolean;
  eventWasPublishedInContext(eventType: string, contextId: string): boolean;
  getEventsOfType(eventType: string): EventCapture[];
  getEventsByContext(contextId: string): EventCapture[];
  getAllCapturedEvents(): EventCapture[];
  getEventCount(): number;
  getEventCountByType(eventType: string): number;
  verifyEventOrder(expectedOrder: string[]): boolean;
  hasHandlerBeenCalled(eventType: string): boolean;
  getHandlerCallCount(eventType: string): number;
}

/**
 * Comprehensive Event Testing Harness
 *
 * Provides a complete testing environment for event-driven scenarios in DDD applications.
 * Supports event publishing, subscription management, assertion utilities, and scenario testing.
 *
 * Key Features:
 * - Event capture and replay
 * - Handler call tracking
 * - Context-aware event filtering
 * - Scenario-based testing
 * - Comprehensive assertions
 * - Time-based event testing
 *
 * Usage Examples:
 * ```typescript
 * // Basic event testing
 * const harness = new EventTestHarness();
 * await harness.initialize();
 *
 * // Publish and capture events
 * await harness.publishEvent(new OrderCreatedEvent(orderData));
 * expect(harness.assertions.eventWasPublished('OrderCreatedEvent')).toBe(true);
 *
 * // Test event handlers
 * harness.subscribeToEvent('OrderCreatedEvent', async (event) => {
 *   // Handler logic
 * });
 *
 * // Run scenario tests
 * await harness.runScenario({
 *   name: 'Order Processing Flow',
 *   events: [orderCreated, paymentProcessed, orderShipped],
 *   expectedHandlerCalls: 3,
 *   expectedEventTypes: ['OrderCreatedEvent', 'PaymentProcessedEvent', 'OrderShippedEvent']
 * });
 * ```
 */
export class EventTestHarness extends TestHarness {
  private eventBus: UnifiedEventBus;
  private capturedEvents: EventCapture[] = [];
  private handlerCallCounts = new Map<string, number>();
  private subscriptions: EventSubscription[] = [];
  private eventCapture = new Map<string, boolean>();
  private scenarioPromises = new Map<string, Promise<void>>();
  private logger: ReturnType<typeof Logger.forContext>;
  private eventCounter = 0;
  private eventTestOptions: EventTestHarnessOptions;

  constructor(options: EventTestHarnessOptions = {}) {
    // Merge with TestHarness defaults to ensure all required fields are present
    super({
      ...options,
      autoCleanup: options.autoCleanup ?? true,
      enableTimeFreezing: options.enableTimeFreezing ?? false,
      setupTimeout: options.setupTimeout ?? 30000,
      teardownTimeout: options.teardownTimeout ?? 10000,
      verbose: options.verbose ?? false,
    });
    this.eventTestOptions = options;
    this.logger = Logger.forContext('EventTestHarness');

    // Initialize event bus with test-specific configuration
    this.eventBus = new UnifiedEventBus({
      enableLogging: options.enableEventLogging ?? false,
      onError: (error, eventType) => {
        this.logger.error('Event handler error in test', error, {
          eventType,
          testContext: this.eventTestOptions.contextId,
        });
      },
    });
  }

  /**
   * Initialize the event test harness
   */
  protected async performInitialization(): Promise<void> {
    this.logger.debug('Initializing EventTestHarness', {
      captureAllEvents: this.eventTestOptions.captureAllEvents,
      contextId: this.eventTestOptions.contextId,
      maxCapturedEvents: this.eventTestOptions.maxCapturedEvents,
    });

    // Clear any existing state
    this.clearCapturedEvents();
    this.clearHandlerCallCounts();
    this.clearSubscriptions();
  }

  /**
   * Setup the event test harness for each test
   */
  protected async performSetup(): Promise<void> {
    this.logger.debug('Setting up EventTestHarness', {
      captureAllEvents: this.eventTestOptions.captureAllEvents,
      contextId: this.eventTestOptions.contextId,
      maxCapturedEvents: this.eventTestOptions.maxCapturedEvents,
    });

    // Setup event capture if enabled
    if (this.eventTestOptions.captureAllEvents) {
      this.setupEventCapture();
    }

    // Clear any existing state
    this.clearCapturedEvents();
    this.clearHandlerCallCounts();
    this.clearSubscriptions();
  }

  /**
   * Teardown and cleanup resources for each test
   */
  protected async performTeardown(): Promise<void> {
    this.logger.debug('Tearing down EventTestHarness', {
      capturedEventCount: this.capturedEvents.length,
      subscriptionCount: this.subscriptions.length,
    });

    // Clear all subscriptions
    this.clearSubscriptions();

    // Clear captured events
    this.clearCapturedEvents();

    // Clear handler call counts
    this.clearHandlerCallCounts();

    // Wait for any pending scenarios
    await this.waitForPendingScenarios();
  }

  /**
   * Reset the harness to initial state
   */
  protected async performReset(): Promise<void> {
    this.logger.debug('Resetting EventTestHarness');

    // Clear all state
    this.clearCapturedEvents();
    this.clearHandlerCallCounts();
    this.clearSubscriptions();

    // Reset event counter
    this.eventCounter = 0;

    // Wait for any pending scenarios
    await this.waitForPendingScenarios();
  }

  /**
   * Dispose the harness and clean up all resources
   */
  protected async performDisposal(): Promise<void> {
    this.logger.debug('Disposing EventTestHarness');

    // Clear all state
    this.clearCapturedEvents();
    this.clearHandlerCallCounts();
    this.clearSubscriptions();

    // Clear scenario promises
    this.scenarioPromises.clear();

    // Clear event capture setup
    this.eventCapture.clear();
  }

  // ==========================================
  // EVENT PUBLISHING
  // ==========================================

  /**
   * Publish a single event
   */
  async publishEvent(event: IDomainEvent | IIntegrationEvent | IAuditEvent): Promise<void> {
    this.logger.debug('Publishing test event', {
      eventType: event.eventType,
      contextId: this.eventTestOptions.contextId,
    });

    // Add context if specified
    const contextualEvent = this.addContextToEvent(event);

    await this.eventBus.publish(contextualEvent);

    // Capture event if auto-capture is enabled
    if (this.eventTestOptions.captureAllEvents) {
      this.captureEvent(contextualEvent);
    }
  }

  /**
   * Publish multiple events
   */
  async publishEvents(
    events: Array<IDomainEvent | IIntegrationEvent | IAuditEvent>
  ): Promise<void> {
    this.logger.debug('Publishing multiple test events', {
      eventCount: events.length,
      contextId: this.eventTestOptions.contextId,
    });

    const contextualEvents = events.map(event => this.addContextToEvent(event));

    await this.eventBus.publishMany(contextualEvents);

    // Capture events if auto-capture is enabled
    if (this.eventTestOptions.captureAllEvents) {
      contextualEvents.forEach(event => this.captureEvent(event));
    }
  }

  /**
   * Publish events from an aggregate
   */
  async publishEventsForAggregate(aggregate: {
    getDomainEvents(): IDomainEvent[];
    commit(): void;
  }): Promise<void> {
    this.logger.debug('Publishing aggregate events in test', {
      aggregateType: aggregate.constructor.name,
      eventCount: aggregate.getDomainEvents().length,
    });

    // Capture events BEFORE publishing if auto-capture is enabled
    const eventsToCapture: Array<IDomainEvent | IIntegrationEvent | IAuditEvent> = [];
    if (this.eventTestOptions.captureAllEvents) {
      aggregate.getDomainEvents().forEach(event => {
        const contextualEvent = this.addContextToEvent(event);
        eventsToCapture.push(contextualEvent);
      });
    }

    await this.eventBus.publishEventsForAggregate(aggregate);

    // Now capture the events after publishing (but we saved them before commit cleared them)
    if (this.eventTestOptions.captureAllEvents) {
      eventsToCapture.forEach(event => this.captureEvent(event));
    }
  }

  // ==========================================
  // EVENT SUBSCRIPTION
  // ==========================================

  /**
   * Subscribe to events of a specific type
   */
  subscribeToEvent<T extends IDomainEvent | IIntegrationEvent | IAuditEvent>(
    eventType: string,
    handler: UnifiedEventHandler<T>,
    contexts?: string | string[]
  ): void {
    this.logger.debug('Subscribing to event in test', {
      eventType,
      contexts,
      handlerName: handler.name || 'anonymous',
    });

    // Wrap handler to track calls
    const wrappedHandler: UnifiedEventHandler<T> = async event => {
      this.incrementHandlerCallCount(eventType);
      await handler(event);
    };

    this.eventBus.subscribe(eventType, contexts, wrappedHandler);

    this.subscriptions.push({
      eventType,
      contexts: contexts || [],
      handler: wrappedHandler as UnifiedEventHandler,
    });
  }

  /**
   * Subscribe to events with context filtering
   */
  subscribeToContext<T extends IDomainEvent | IIntegrationEvent | IAuditEvent>(
    contextId: string | string[],
    eventType: string,
    handler: UnifiedEventHandler<T>
  ): void {
    this.logger.debug('Subscribing to context in test', {
      contextId,
      eventType,
      handlerName: handler.name || 'anonymous',
    });

    // Wrap handler to track calls
    const wrappedHandler: UnifiedEventHandler<T> = async event => {
      this.incrementHandlerCallCount(eventType);
      await handler(event);
    };

    this.eventBus.subscribeToContext(contextId, eventType, wrappedHandler);

    this.subscriptions.push({
      eventType,
      contexts: contextId,
      handler: wrappedHandler as UnifiedEventHandler,
    });
  }

  /**
   * Register a class-based event handler
   */
  registerHandler<T extends IDomainEvent | IIntegrationEvent | IAuditEvent>(
    eventType: string,
    handler: { handle(event: T): Promise<void> | void }
  ): void {
    this.logger.debug('Registering class-based handler in test', {
      eventType,
      handlerClass: handler.constructor.name,
    });

    // Wrap handler to track calls
    const wrappedHandler = {
      handle: async (event: T) => {
        this.incrementHandlerCallCount(eventType);
        await handler.handle(event);
      },
    };

    this.eventBus.registerHandler(eventType, wrappedHandler);
  }

  // ==========================================
  // EVENT SCENARIO TESTING
  // ==========================================

  /**
   * Run a complete event scenario test
   */
  async runScenario(scenario: EventTestScenario): Promise<void> {
    this.logger.info('Running event test scenario', {
      scenarioName: scenario.name,
      eventCount: scenario.events.length,
      expectedHandlerCalls: scenario.expectedHandlerCalls,
    });

    const scenarioStart = Date.now();
    const timeout = scenario.timeout || 5000;

    const scenarioPromise = this.executeScenario(scenario);
    this.scenarioPromises.set(scenario.name, scenarioPromise);

    try {
      await Promise.race([
        scenarioPromise,
        this.createTimeoutPromise(timeout, `Scenario '${scenario.name}' timed out`),
      ]);

      this.logger.info('Event scenario completed successfully', {
        scenarioName: scenario.name,
        duration: Date.now() - scenarioStart,
        capturedEventCount: this.capturedEvents.length,
      });
    } finally {
      this.scenarioPromises.delete(scenario.name);
    }
  }

  /**
   * Execute the scenario logic
   */
  private async executeScenario(scenario: EventTestScenario): Promise<void> {
    // Clear previous captures for clean scenario
    this.clearCapturedEvents();
    this.clearHandlerCallCounts();

    // Enable event capture for scenario
    const originalCaptureFlag = this.eventTestOptions.captureAllEvents;
    this.eventTestOptions.captureAllEvents = true;
    this.setupEventCapture();

    try {
      // Publish all scenario events
      await this.publishEvents(scenario.events);

      // Wait a bit for async handlers to complete
      await this.delay(100);

      // Verify scenario expectations
      this.verifyScenarioExpectations(scenario);
    } finally {
      // Restore original capture setting
      this.eventTestOptions.captureAllEvents = originalCaptureFlag ?? false;
    }
  }

  /**
   * Verify scenario expectations
   */
  private verifyScenarioExpectations(scenario: EventTestScenario): void {
    // Verify expected event types were published
    for (const expectedType of scenario.expectedEventTypes) {
      if (!this.assertions.eventWasPublished(expectedType)) {
        throw new Error(
          `Expected event type '${expectedType}' was not published in scenario '${scenario.name}'`
        );
      }
    }

    // Verify handler call count if specified
    if (scenario.expectedHandlerCalls !== undefined) {
      const totalCalls = Array.from(this.handlerCallCounts.values()).reduce(
        (sum, count) => sum + count,
        0
      );
      if (totalCalls !== scenario.expectedHandlerCalls) {
        throw new Error(
          `Expected ${scenario.expectedHandlerCalls} handler calls but got ${totalCalls} in scenario '${scenario.name}'`
        );
      }
    }
  }

  // ==========================================
  // EVENT CAPTURE AND ASSERTIONS
  // ==========================================

  /**
   * Setup automatic event capture
   */
  private setupEventCapture(): void {
    if (this.eventCapture.has('setup')) return;

    // Override the event bus publish method to capture events
    const originalPublish = this.eventBus.publish.bind(this.eventBus);
    this.eventBus.publish = async event => {
      await originalPublish(event);
      this.captureEvent(event);
    };

    // Override the event bus publishMany method to capture events
    const originalPublishMany = this.eventBus.publishMany.bind(this.eventBus);
    this.eventBus.publishMany = async events => {
      await originalPublishMany(events);
      events.forEach(event => this.captureEvent(event));
    };

    // Override the event bus publishEventsForAggregate method to capture events
    const originalPublishEventsForAggregate = this.eventBus.publishEventsForAggregate.bind(
      this.eventBus
    );
    this.eventBus.publishEventsForAggregate = async aggregate => {
      const events = aggregate.getDomainEvents();
      await originalPublishEventsForAggregate(aggregate);
      events.forEach(event => this.captureEvent(this.addContextToEvent(event)));
    };

    this.eventCapture.set('setup', true);
  }

  /**
   * Capture an event for later assertions
   */
  private captureEvent(event: IDomainEvent | IIntegrationEvent | IAuditEvent): void {
    const eventMetadata = (event as any).metadata || {};

    const capture: EventCapture = {
      eventType: event.eventType,
      payload: (event as any).payload,
      metadata: eventMetadata,
      contextId: eventMetadata.contextId || this.eventTestOptions.contextId,
      timestamp: new Date(),
      order: ++this.eventCounter,
    };

    this.capturedEvents.push(capture);

    // Enforce max captured events limit
    if (
      this.eventTestOptions.maxCapturedEvents &&
      this.capturedEvents.length > this.eventTestOptions.maxCapturedEvents
    ) {
      this.capturedEvents = this.capturedEvents.slice(-this.eventTestOptions.maxCapturedEvents);
    }

    this.logger.debug('Captured event', {
      eventType: capture.eventType,
      contextId: capture.contextId,
      order: capture.order,
    });
  }

  /**
   * Add context to event if specified
   */
  private addContextToEvent(
    event: IDomainEvent | IIntegrationEvent | IAuditEvent
  ): IDomainEvent | IIntegrationEvent | IAuditEvent {
    if (!this.eventTestOptions.contextId) return event;

    return {
      ...event,
      metadata: {
        ...(event as any).metadata,
        contextId: this.eventTestOptions.contextId,
      },
    };
  }

  /**
   * Increment handler call count
   */
  private incrementHandlerCallCount(eventType: string): void {
    const currentCount = this.handlerCallCounts.get(eventType) || 0;
    this.handlerCallCounts.set(eventType, currentCount + 1);
  }

  /**
   * Get comprehensive event assertions
   */
  get assertions(): EventAssertions {
    return {
      eventWasPublished: (eventType: string) => {
        return this.capturedEvents.some(event => event.eventType === eventType);
      },

      eventWasPublishedWithPayload: (eventType: string, payload: unknown) => {
        return this.capturedEvents.some(
          event =>
            event.eventType === eventType &&
            JSON.stringify(event.payload) === JSON.stringify(payload)
        );
      },

      eventWasPublishedInContext: (eventType: string, contextId: string) => {
        return this.capturedEvents.some(
          event => event.eventType === eventType && event.contextId === contextId
        );
      },

      getEventsOfType: (eventType: string) => {
        return this.capturedEvents.filter(event => event.eventType === eventType);
      },

      getEventsByContext: (contextId: string) => {
        return this.capturedEvents.filter(event => event.contextId === contextId);
      },

      getAllCapturedEvents: () => {
        return [...this.capturedEvents];
      },

      getEventCount: () => {
        return this.capturedEvents.length;
      },

      getEventCountByType: (eventType: string) => {
        return this.capturedEvents.filter(event => event.eventType === eventType).length;
      },

      verifyEventOrder: (expectedOrder: string[]) => {
        const actualOrder = this.capturedEvents
          .sort((a, b) => a.order - b.order)
          .map(event => event.eventType);

        if (actualOrder.length !== expectedOrder.length) return false;

        return actualOrder.every((eventType, index) => eventType === expectedOrder[index]);
      },

      hasHandlerBeenCalled: (eventType: string) => {
        return (this.handlerCallCounts.get(eventType) || 0) > 0;
      },

      getHandlerCallCount: (eventType: string) => {
        return this.handlerCallCounts.get(eventType) || 0;
      },
    };
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Clear all captured events
   */
  clearCapturedEvents(): void {
    this.capturedEvents = [];
    this.eventCounter = 0;
    this.logger.debug('Cleared captured events');
  }

  /**
   * Clear handler call counts
   */
  clearHandlerCallCounts(): void {
    this.handlerCallCounts.clear();
    this.logger.debug('Cleared handler call counts');
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions(): void {
    this.subscriptions = [];
    this.logger.debug('Cleared subscriptions');
  }

  /**
   * Wait for pending scenarios to complete
   */
  private async waitForPendingScenarios(): Promise<void> {
    if (this.scenarioPromises.size === 0) return;

    this.logger.debug('Waiting for pending scenarios', {
      pendingCount: this.scenarioPromises.size,
    });

    await Promise.all(Array.from(this.scenarioPromises.values()));
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise(timeout: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeout);
    });
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the underlying event bus for advanced scenarios
   */
  getEventBus(): UnifiedEventBus {
    return this.eventBus;
  }
}
