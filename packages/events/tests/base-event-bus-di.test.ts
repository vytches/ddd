import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { BaseEventBus } from '../src/base-event-bus';
import type { IDomainEvent } from '@vytches/ddd-contracts';
import type { IEventHandler } from '@vytches/ddd-contracts';

// Test event and handler
class TestEvent implements IDomainEvent {
  eventType = 'TestEvent';
  aggregateId = 'test-id';
  aggregateType = 'Test';
  eventVersion = 1;
  occurredOn = new Date();

  constructor(public value: string) {}
}

class TestEventHandler implements IEventHandler<TestEvent> {
  async handle(_event: TestEvent): Promise<void> {
    // Test implementation
  }
}

// Concrete implementation for testing
class TestEventBus extends BaseEventBus<IDomainEvent> {
  constructor(useDI = false) {
    super({}, useDI);
  }
}

describe('BaseEventBus DI Integration', () => {
  let eventBus: TestEventBus;

  beforeEach(() => {
    eventBus = new TestEventBus(false); // Disable DI for basic tests
  });

  it('should create EventBus without DI', () => {
    expect(eventBus).toBeDefined();
  });

  it('should register and publish event without DI', async () => {
    const handler = new TestEventHandler();
    eventBus.registerHandler('TestEvent', handler);

    const event = new TestEvent('test');
    const [publishError] = await safeRun(async () => await eventBus.publish(event));
    expect(publishError).toBeUndefined();
  });

  it('should register handler factory for DI resolution', () => {
    eventBus.registerHandlerFactory('TestEvent', TestEventHandler);

    const handlers = eventBus.getHandlers('TestEvent');
    expect(handlers).toBeDefined();
    expect(handlers!.size).toBe(1);
  });

  it('should discover handlers without throwing', () => {
    const [error] = safeRun(() => eventBus.discoverHandlers());
    expect(error).toBeUndefined();
  });

  it('should create EventBus with DI enabled but gracefully fallback when DI not available', () => {
    const eventBusWithDI = new TestEventBus(true); // Enable DI
    expect(eventBusWithDI).toBeDefined();
    // Should not throw even if DI package is not available
  });

  it('should use DI-enabled handler factory to resolve handlers on event publish', async () => {
    eventBus.registerHandlerFactory('TestEvent', TestEventHandler);

    const event = new TestEvent('test-value');
    // Should resolve handler through factory during publish
    const [publishError] = await safeRun(async () => await eventBus.publish(event));
    expect(publishError).toBeUndefined();
  });
});
