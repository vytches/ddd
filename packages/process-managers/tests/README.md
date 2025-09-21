# Process Managers Testing Framework

Enterprise-grade testing framework for VytchesDDD Process Managers, providing
comprehensive testing utilities for workflow orchestration, state management,
and event-driven business processes.

## Overview

This testing framework supports the VF-008 Process Managers implementation with:

- **Process Manager Test Harness**: Integration testing with event simulation
- **Workflow Scenario Builder**: Fluent API for complex workflow testing
- **Mock Implementations**: Complete mock ecosystem for isolated testing
- **Edge Case Testing**: Concurrency, race conditions, and boundary testing
- **Integration Testing**: VytchesDDD system integration validation

## Quick Start

```typescript
import { ProcessManagerTestHarness, WorkflowScenarioBuilder } from './utils';
import { BaseProcessManager } from '../src/core/base-process-manager';

// Create test harness
const harness = new ProcessManagerTestHarness({
  enableEventTracking: true,
  enableMockServices: true,
});

await harness.initialize();
await harness.setup();

// Build workflow scenario
const scenario = WorkflowScenarioBuilder.create('Order Processing')
  .withProcessManager(orderProcessManager)
  .withHarness(harness)
  .whenEvent(orderCreatedEvent)
  .expectStateChange('initial', 'order-created')
  .expectCommandEmitted('ProcessPayment')
  .expectCompletion(5000);

const result = await scenario.execute();
expect(result.success).toBe(true);
```

## Testing Utilities

### ProcessManagerTestHarness

Enterprise-grade test harness providing:

```typescript
interface ProcessManagerTestHarnessOptions {
  enableEventTracking?: boolean; // Track event sequences
  enableStateLogging?: boolean; // Log state transitions
  maxScenarioTimeout?: number; // Workflow timeout
  enableMockServices?: boolean; // Inject mock services
}

class ProcessManagerTestHarness {
  // Event simulation
  createTestEvent(
    overrides?: Partial<IProcessManagerEvent>
  ): IProcessManagerEvent;
  createTestContext(
    overrides?: Partial<IProcessManagerContext>
  ): IProcessManagerContext;
  simulateEventSequence(
    processManager,
    events,
    delayBetween?
  ): Promise<ProcessManagerResult[]>;

  // State validation
  verifyStateTransition(assertion: StateTransitionAssertion): void;
  assertWorkflowCompleted(assertion: WorkflowAssertion): void;

  // Mock access
  getMockEventBus(): MockUnifiedEventBus;
  getMockRepository(): MockProcessManagerRepository;
  getMockOrchestrator(): MockProcessManagerOrchestrator;

  // Time control
  advanceTime(milliseconds: number): void;
  simulateTimeout(processManager, timeoutMs): Promise<boolean>;
}
```

### WorkflowScenarioBuilder

Fluent API for complex workflow testing:

```typescript
WorkflowScenarioBuilder.create('Scenario Name')
  .withProcessManager(processManager)
  .withHarness(harness)
  .withTimeout(30000)

  // Event sequence
  .whenEvent(event1)
  .thenWait(100)
  .whenEvent(event2)
  .thenAssert(() => expect(condition).toBe(true))

  // Expectations
  .expectStateChange('from', 'to', 1000)
  .expectCommandEmitted('CommandType')
  .expectEventEmitted('EventType')
  .expectCompletion(5000)
  .expectFailure('Error message')

  .execute(); // Returns ScenarioExecutionResult
```

### Mock Implementations

#### MockProcessManagerOrchestrator

```typescript
const orchestrator = new MockProcessManagerOrchestrator({
  enableLogging: true,
  maxConcurrentProcesses: 100,
});

// Register process managers
orchestrator.registerProcessManager({
  id: 'order-pm',
  type: 'OrderProcessManager',
  factory: () => new OrderProcessManager(),
  canHandle: event => event.eventType === 'OrderCreated',
});

// Process events
const results = await orchestrator.processEvent(event, context);

// Verify processing
const history = orchestrator.getHandledEvents();
const statistics = orchestrator.getStatistics();
```

#### MockProcessManagerRepository

```typescript
const repository = new MockProcessManagerRepository({
  enableOptimisticLocking: true,
  enableAuditLog: true,
});

// Persistence operations
await repository.save(processManager);
const loaded = await repository.load(processManager.id);
const results = await repository.query({ status: 'RUNNING' });

// Simulation
repository.simulateOptimisticLockingFailure(id);
repository.simulateFailure(id, new Error('Database error'));

// Verification
const auditLog = repository.getAuditLog();
const statistics = repository.getStatistics();
```

#### MockUnifiedEventBus

```typescript
const eventBus = new MockUnifiedEventBus({
  enableLogging: true,
  trackEventHistory: true,
});

// Event operations
await eventBus.publish(event);
await eventBus.publishMany([event1, event2]);
const subscriptionId = eventBus.subscribe('EventType', handler);

// Verification
const published = eventBus.getPublishedEvents();
const history = eventBus.getEventHistory();
const verified = eventBus.verifyEventPublished('EventType', payload);
const sequence = eventBus.verifyEventSequence(['Event1', 'Event2']);
```

## Edge Case Testing

### ConcurrencyTestHelper

Specialized testing for concurrent operations:

```typescript
const concurrencyHelper = new ConcurrencyTestHelper(harness);

// Race condition testing
const raceScenario = {
  name: 'State Update Race',
  operations: [
    { id: 'op1', type: 'state-update', stateUpdate: { field1: 'value1' } },
    { id: 'op2', type: 'state-update', stateUpdate: { field2: 'value2' } },
  ],
};

const raceResult = await concurrencyHelper.testRaceCondition(
  processManager,
  raceScenario
);

// Optimistic locking conflicts
const lockingResult = await concurrencyHelper.testOptimisticLockingConflict(
  processManager,
  concurrentUpdates
);

// Load testing
const loadScenario = {
  name: 'High Load Test',
  concurrentOperations: 100,
  operationsPerSecond: 50,
  operationFactory: index => ({ id: `op-${index}`, type: 'timeout-check' }),
};

const loadResult = await concurrencyHelper.performLoadTest(
  processManager,
  loadScenario
);

// Timeout precision
const timeoutResult = await concurrencyHelper.testTimeoutPrecision(
  processManager,
  1000, // Expected timeout
  50 // Tolerance
);
```

### Built-in Scenarios

```typescript
import { ConcurrencyScenarios } from './edge-cases/concurrency-test-helper';

// Pre-built scenarios
const stateRace = ConcurrencyScenarios.stateUpdateRace(5);
const eventRace = ConcurrencyScenarios.eventProcessingRace(events);
const loadTest = ConcurrencyScenarios.highLoadTest(100, 50);
```

## Integration Testing

Comprehensive integration testing with VytchesDDD systems:

```typescript
describe('Process Manager Integration', () => {
  let harness: ProcessManagerTestHarness;
  let processManager: OrderProcessManager;

  beforeEach(async () => {
    harness = new ProcessManagerTestHarness();
    await harness.initialize();
    await harness.setup();

    processManager = new OrderProcessManager(id, type, initialState);
  });

  it('should integrate with UnifiedEventBus', async () => {
    const eventBus = harness.getMockEventBus();

    // Test event publishing and subscription
    let eventsReceived = 0;
    eventBus.subscribe('OrderCompleted', () => eventsReceived++);

    // Process workflow
    await harness.simulateEventSequence(processManager, events);

    // Verify integration
    expect(eventBus.verifyEventPublished('OrderCompleted')).toBe(true);
    expect(eventsReceived).toBe(1);
  });

  it('should integrate with Repository persistence', async () => {
    const repository = harness.getMockRepository();

    // Save initial state
    await repository.save(processManager);

    // Process events
    await processManager.handle(event, context);

    // Save updated state
    await repository.save(processManager);

    // Verify persistence
    const loaded = await repository.load(processManager.id);
    expect(loaded?.state.version).toBe(processManager.state.version);
  });
});
```

## Test File Organization

```
tests/
├── core/
│   └── base-process-manager.test.ts     # Unit tests for BaseProcessManager
├── edge-cases/
│   ├── base-process-manager-edge-cases.test.ts  # Edge case scenarios
│   └── concurrency-test-helper.ts       # Concurrency testing utilities
├── integration/
│   └── process-manager-integration.test.ts      # Full integration tests
├── mocks/
│   ├── mock-process-manager-orchestrator.ts     # Mock orchestrator
│   ├── mock-process-manager-repository.ts       # Mock repository
│   ├── mock-unified-event-bus.ts        # Mock event bus
│   ├── mock-process-manager-services.ts # Mock services
│   └── index.ts                         # Mock exports
├── utils/
│   ├── process-manager-test-harness.ts  # Main test harness
│   ├── workflow-scenario-builder.ts     # Scenario builder
│   └── index.ts                         # Utility exports
└── README.md                            # This documentation
```

## Testing Patterns

### VytchesDDD Testing Standards

All tests follow VytchesDDD enterprise standards:

```typescript
// ✅ ALWAYS use safeRun for error testing
const [error, result] = await safeRun(() =>
  processManager.handle(event, context)
);
expect(error).toBeInstanceOf(ValidationError);

// ✅ ALWAYS use proper beforeEach/afterEach
beforeEach(async () => {
  harness = new ProcessManagerTestHarness();
  await harness.initialize();
  await harness.setup();
});

afterEach(async () => {
  await harness.dispose();
});

// ✅ ALWAYS test both success and failure paths
it('should succeed with valid data', async () => {
  const [error, result] = await safeRun(() => operation());
  expect(error).toBeUndefined();
  expect(result).toBeDefined();
});

it('should fail with invalid data', async () => {
  const [error] = await safeRun(() => operation());
  expect(error).toBeInstanceOf(ValidationError);
});
```

### Error Testing Patterns

```typescript
// Business logic errors
const [businessError, result] = await safeRun(() =>
  processManager.handle(invalidEvent, context)
);
expect(businessError).toBeUndefined();
expect(result?.success).toBe(false);
expect(result?.error?.code).toBe('BUSINESS_RULE_VIOLATION');

// System errors
const [systemError] = await safeRun(() => repository.save(processManager));
expect(systemError).toBeInstanceOf(OptimisticLockingError);

// Async errors
const [asyncError, asyncResult] = await safeRun(
  async () => await processManager.handleAsync(event, context)
);
expect(asyncError).toBeUndefined();
expect(asyncResult?.success).toBe(true);
```

### State Verification Patterns

```typescript
// State transition verification
harness.verifyStateTransition({
  processManagerId: processManager.id,
  fromState: 'initial',
  toState: 'processing',
  triggeredBy: 'OrderCreated',
});

// Workflow completion verification
harness.assertWorkflowCompleted({
  processManagerId: processManager.id,
  expectedFinalState: 'completed',
  expectedStatus: ProcessManagerStatus.COMPLETED,
});

// Event sequence verification
harness.verifyEventsEmitted([
  'OrderCreated',
  'PaymentProcessed',
  'OrderCompleted',
]);
harness.verifyEventSequence([
  'OrderCreated',
  'PaymentProcessed',
  'OrderCompleted',
]);
```

## Performance Testing

### Load Testing

```typescript
it('should handle high event load', async () => {
  const loadScenario = {
    name: 'High Event Load',
    concurrentOperations: 1000,
    operationsPerSecond: 100,
    durationMs: 10000,
    operationFactory: index => ({
      id: `event-${index}`,
      type: 'event',
      event: harness.createTestEvent({ eventType: 'TestEvent' }),
    }),
  };

  const result = await concurrencyHelper.performLoadTest(
    processManager,
    loadScenario
  );

  expect(result.successfulOperations).toBeGreaterThan(900); // 90% success rate
  expect(result.averageExecutionTime).toBeLessThan(50); // Under 50ms average
  expect(result.operationsPerSecond).toBeGreaterThan(80); // Maintain throughput
});
```

### Memory Testing

```typescript
it('should not leak memory during long workflows', async () => {
  const initialMemory = process.memoryUsage().heapUsed;

  // Process many events
  for (let i = 0; i < 1000; i++) {
    const event = harness.createTestEvent({ payload: { index: i } });
    await processManager.handle(event, context);
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  const finalMemory = process.memoryUsage().heapUsed;
  const memoryIncrease = finalMemory - initialMemory;

  // Memory increase should be reasonable
  expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
});
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test categories
pnpm test core                    # Unit tests
pnpm test edge-cases             # Edge case tests
pnpm test integration            # Integration tests

# Run with coverage
pnpm test --coverage

# Run with verbose output
pnpm test --reporter=verbose

# Run specific test file
pnpm test base-process-manager.test.ts
```

## Enterprise Testing Checklist

### ✅ Required Test Categories

- [ ] **Unit Tests**: BaseProcessManager functionality
- [ ] **Integration Tests**: VytchesDDD system integration
- [ ] **Edge Cases**: Concurrency, race conditions, boundary conditions
- [ ] **Error Scenarios**: Business logic errors, system failures
- [ ] **Performance Tests**: Load testing, memory usage
- [ ] **Timeout Tests**: Precision, boundary conditions
- [ ] **State Management**: Transitions, consistency, immutability
- [ ] **Event Handling**: Sequence, correlation, publishing

### ✅ Quality Standards

- [ ] **Coverage**: >80% line, branch, function coverage
- [ ] **safeRun Usage**: All error testing uses safeRun pattern
- [ ] **Test Isolation**: Proper setup/teardown, no test interdependencies
- [ ] **Mock Usage**: Appropriate mocking for external dependencies
- [ ] **Performance**: Tests complete within reasonable time
- [ ] **Documentation**: Test purpose and scenarios clearly documented

### ✅ Enterprise Features

- [ ] **Audit Logging**: Repository operations tracked
- [ ] **Optimistic Locking**: Concurrency control tested
- [ ] **Event Correlation**: Cross-service event tracking
- [ ] **Service Integration**: Command/event dispatch testing
- [ ] **Timeout Management**: Precise timeout detection
- [ ] **Error Recovery**: Graceful failure handling
- [ ] **Multi-tenancy**: Context isolation if applicable

This testing framework ensures the Process Managers implementation meets
enterprise-grade quality standards and supports complex business workflow
orchestration with confidence.
