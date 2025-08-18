import { BaseProcessManager } from '../../src/core/base-process-manager';
import type {
  IProcessManagerEvent,
  IProcessManagerContext,
  ProcessManagerResult,
  IProcessManagerState,
} from '../../src/interfaces';

/**
 * Mock Process Manager implementation for testing repository functionality.
 * Provides a simple, controllable implementation for unit tests.
 */
export class MockProcessManager extends BaseProcessManager<IProcessManagerState> {
  private handledEvents: IProcessManagerEvent[] = [];
  private mockResult: ProcessManagerResult | undefined;
  private mockCanHandle = true;
  private mockIsComplete = false;
  private mockCorrelationData: Record<string, unknown> = {};

  constructor(params: {
    id: string;
    type: string;
    initialState: IProcessManagerState;
    version?: number;
    createdAt?: Date;
    timeout?: number;
  }) {
    super(params);

    // Initialize mock correlation data from state
    this.mockCorrelationData = { ...params.initialState.correlationData };
  }

  /**
   * Mock implementation that records events and returns configured result
   */
  canHandle(event: IProcessManagerEvent): boolean {
    return this.mockCanHandle;
  }

  /**
   * Mock implementation that tracks handled events
   */
  protected async handleSecure(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    this.handledEvents.push(event);

    // Set status to running when handling events
    this.setRunning();

    // Return configured mock result or default success
    return this.mockResult || this.createSuccessResult();
  }

  /**
   * Mock implementation with configurable completion status
   */
  isComplete(): boolean {
    return this.mockIsComplete;
  }

  /**
   * Mock implementation that returns configured correlation data
   */
  getCorrelationData(): Record<string, unknown> {
    return { ...this.mockCorrelationData };
  }

  /**
   * Test helpers for configuring mock behavior
   */

  /**
   * Configure whether this process manager can handle events
   */
  setCanHandle(canHandle: boolean): void {
    this.mockCanHandle = canHandle;
  }

  /**
   * Configure the result returned by handleSecure
   */
  setMockResult(result: ProcessManagerResult): void {
    this.mockResult = result;
  }

  /**
   * Configure whether this process is complete
   */
  setMockIsComplete(isComplete: boolean): void {
    this.mockIsComplete = isComplete;
  }

  /**
   * Configure correlation data returned by getCorrelationData
   */
  setMockCorrelationData(data: Record<string, unknown>): void {
    this.mockCorrelationData = { ...data };
  }

  /**
   * Get the list of events that have been handled
   */
  getHandledEvents(): IProcessManagerEvent[] {
    return [...this.handledEvents];
  }

  /**
   * Clear the handled events list
   */
  clearHandledEvents(): void {
    this.handledEvents = [];
  }

  /**
   * Get the number of events handled
   */
  getHandledEventCount(): number {
    return this.handledEvents.length;
  }

  /**
   * Check if a specific event type was handled
   */
  wasEventTypeHandled(eventType: string): boolean {
    return this.handledEvents.some(event => event.eventType === eventType);
  }

  /**
   * Get the last handled event
   */
  getLastHandledEvent(): IProcessManagerEvent | undefined {
    return this.handledEvents[this.handledEvents.length - 1];
  }

  /**
   * Override updateState to handle the test scenario
   */
  override async updateState(newState: Partial<IProcessManagerState>): Promise<void> {
    await super.updateState(newState);
  }

  /**
   * Simulate a state update with version increment
   */
  async simulateStateUpdate(newState: Partial<IProcessManagerState>): Promise<void> {
    await this.updateState({
      ...newState,
      version: this.state.version + 1,
    });
  }

  /**
   * Simulate process completion
   */
  simulateCompletion(): void {
    this.setMockIsComplete(true);
    this.complete();
  }

  /**
   * Simulate process failure
   */
  simulateFailure(error: Error): void {
    this.fail(error);
  }

  /**
   * Create a mock event for testing
   */
  static createMockEvent(overrides: Partial<IProcessManagerEvent> = {}): IProcessManagerEvent {
    return {
      id: 'mock-event-id',
      eventType: 'MockEvent',
      eventName: 'Mock Event',
      aggregateId: 'mock-aggregate-id',
      aggregateType: 'MockAggregate',
      aggregateVersion: 1,
      timestamp: new Date(),
      payload: { mockData: 'test' },
      metadata: { source: 'test' },
      correlationId: 'mock-correlation-id',
      causationId: 'mock-causation-id',
      ...overrides,
    };
  }

  /**
   * Create a mock context for testing
   */
  static createMockContext(
    overrides: Partial<IProcessManagerContext> = {}
  ): IProcessManagerContext {
    return {
      correlationId: 'mock-correlation-id',
      processedAt: new Date(),
      userId: 'test-user',
      tenantId: 'test-tenant',
      requestId: 'mock-request-id',
      sessionId: 'mock-session-id',
      metadata: { source: 'test' },
      services: {
        commandDispatcher: undefined,
        eventPublisher: undefined,
        repositories: undefined,
        externalServices: undefined,
        logger: undefined,
      },
      securityContext: {
        userId: 'test-user',
        tenantId: 'test-tenant',
        roles: ['user'],
        permissions: ['read', 'write'],
        sessionId: 'mock-session-id',
        requestId: 'mock-request-id',
      },
      ...overrides,
    };
  }
}
