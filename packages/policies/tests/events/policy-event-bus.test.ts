import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import {
  PolicyEventBus,
  PolicyEventHandlers,
  globalPolicyEventBus,
  type PolicyEvaluationEvent,
  type PolicyEventHandler,
} from '../../src/events';
import type { PolicyContext } from '../../src/core/interfaces';

describe('PolicyEventBus', () => {
  let eventBus: PolicyEventBus;
  let mockHandler: PolicyEventHandler;

  beforeEach(() => {
    eventBus = new PolicyEventBus({
      enableMetrics: true,
      maxHandlers: 10,
    });
    mockHandler = vi.fn() as unknown as PolicyEventHandler;
  });

  describe('Event Subscription', () => {
    it('should subscribe to policy events', () => {
      const subscriptionId = eventBus.subscribe({
        eventTypes: ['POLICY_EVALUATED'],
        handler: mockHandler,
      });

      expect(subscriptionId).toBeDefined();
      expect(typeof subscriptionId).toBe('string');
      expect(eventBus.getSubscriptions()).toHaveLength(1);
    });

    it('should reject subscription when max handlers exceeded', () => {
      // Fill up to max handlers
      for (let i = 0; i < 10; i++) {
        eventBus.subscribe({
          eventTypes: ['POLICY_EVALUATED'],
          handler: vi.fn(),
        });
      }

      const [error] = safeRun(() => {
        eventBus.subscribe({
          eventTypes: ['POLICY_EVALUATED'],
          handler: vi.fn(),
        });
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Maximum number of event handlers');
    });

    it('should unsubscribe from events', () => {
      const subscriptionId = eventBus.subscribe({
        eventTypes: ['POLICY_EVALUATED'],
        handler: mockHandler,
      });

      const result = eventBus.unsubscribe(subscriptionId);
      expect(result).toBe(true);
      expect(eventBus.getSubscriptions()).toHaveLength(0);
    });

    it('should return false when unsubscribing non-existent subscription', () => {
      const result = eventBus.unsubscribe('non-existent');
      expect(result).toBe(false);
    });

    it('should enable/disable subscriptions', () => {
      const subscriptionId = eventBus.subscribe({
        eventTypes: ['POLICY_EVALUATED'],
        handler: mockHandler,
      });

      const disableResult = eventBus.setSubscriptionEnabled(subscriptionId, false);
      expect(disableResult).toBe(true);

      const subscription = eventBus.getSubscriptions().find(s => s.id === subscriptionId);
      expect(subscription?.enabled).toBe(false);

      const enableResult = eventBus.setSubscriptionEnabled(subscriptionId, true);
      expect(enableResult).toBe(true);
    });
  });

  describe('Event Publishing', () => {
    it('should publish events to matching handlers', async () => {
      eventBus.subscribe({
        eventTypes: ['POLICY_EVALUATED'],
        handler: mockHandler,
      });

      const event: PolicyEvaluationEvent<{ name: string }> = {
        type: 'POLICY_EVALUATED',
        policyId: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        entity: { name: 'test' },
        result: { isSuccess: true, isFailure: false, value: { name: 'test' } } as any,
        context: createTestContext(),
        duration: 100,
        timestamp: new Date(),
        executionId: 'exec-123',
      };

      await eventBus.publish(event);

      expect(mockHandler).toHaveBeenCalledOnce();
      expect(mockHandler).toHaveBeenCalledWith(event);
    });

    it('should not publish to disabled handlers', async () => {
      const subscriptionId = eventBus.subscribe({
        eventTypes: ['POLICY_EVALUATED'],
        handler: mockHandler,
      });

      eventBus.setSubscriptionEnabled(subscriptionId, false);

      const event: PolicyEvaluationEvent<{ name: string }> = {
        type: 'POLICY_EVALUATED',
        policyId: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        entity: { name: 'test' },
        result: { isSuccess: true, isFailure: false, value: { name: 'test' } } as any,
        context: createTestContext(),
        duration: 100,
        timestamp: new Date(),
        executionId: 'exec-123',
      };

      await eventBus.publish(event);

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should filter events by domain', async () => {
      eventBus.subscribe({
        eventTypes: ['POLICY_EVALUATED'],
        domains: ['finance'],
        handler: mockHandler,
      });

      const testEvent: PolicyEvaluationEvent<{ name: string }> = {
        type: 'POLICY_EVALUATED',
        policyId: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        entity: { name: 'test' },
        result: { isSuccess: true, isFailure: false, value: { name: 'test' } } as any,
        context: createTestContext(),
        duration: 100,
        timestamp: new Date(),
        executionId: 'exec-123',
      };

      const financeEvent: PolicyEvaluationEvent<{ name: string }> = {
        ...testEvent,
        domain: 'finance',
      };

      await eventBus.publish(testEvent);
      expect(mockHandler).not.toHaveBeenCalled();

      await eventBus.publish(financeEvent);
      expect(mockHandler).toHaveBeenCalledOnce();
    });

    it('should filter events by policy ID', async () => {
      eventBus.subscribe({
        eventTypes: ['POLICY_EVALUATED'],
        policyIds: ['allowed-policy'],
        handler: mockHandler,
      });

      const testEvent: PolicyEvaluationEvent<{ name: string }> = {
        type: 'POLICY_EVALUATED',
        policyId: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        entity: { name: 'test' },
        result: { isSuccess: true, isFailure: false, value: { name: 'test' } } as any,
        context: createTestContext(),
        duration: 100,
        timestamp: new Date(),
        executionId: 'exec-123',
      };

      const allowedEvent: PolicyEvaluationEvent<{ name: string }> = {
        ...testEvent,
        policyId: 'allowed-policy',
      };

      await eventBus.publish(testEvent);
      expect(mockHandler).not.toHaveBeenCalled();

      await eventBus.publish(allowedEvent);
      expect(mockHandler).toHaveBeenCalledOnce();
    });

    it('should filter events by tags', async () => {
      eventBus.subscribe({
        eventTypes: ['POLICY_EVALUATED'],
        tags: ['critical'],
        handler: mockHandler,
      });

      const normalEvent: PolicyEvaluationEvent<{ name: string }> = {
        type: 'POLICY_EVALUATED',
        policyId: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        entity: { name: 'test' },
        result: { isSuccess: true, isFailure: false, value: { name: 'test' } } as any,
        context: createTestContext(),
        duration: 100,
        timestamp: new Date(),
        executionId: 'exec-123',
      };

      const criticalEvent: PolicyEvaluationEvent<{ name: string }> = {
        ...normalEvent,
        tags: ['critical', 'security'],
      };

      await eventBus.publish(normalEvent);
      expect(mockHandler).not.toHaveBeenCalled();

      await eventBus.publish(criticalEvent);
      expect(mockHandler).toHaveBeenCalledOnce();
    });
  });

  describe('Error Handling', () => {
    it('should handle handler errors gracefully with log strategy', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        return;
      });

      const errorEventBus = new PolicyEventBus({
        errorStrategy: 'log',
      });

      errorEventBus.subscribe({
        eventTypes: ['POLICY_EVALUATED'],
        handler: () => {
          throw new Error('Handler error');
        },
      });

      const event: PolicyEvaluationEvent<{ name: string }> = {
        type: 'POLICY_EVALUATED',
        policyId: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        entity: { name: 'test' },
        result: { isSuccess: true, isFailure: false, value: { name: 'test' } } as any,
        context: createTestContext(),
        duration: 100,
        timestamp: new Date(),
        executionId: 'exec-123',
      };

      // Should not throw
      await eventBus.publish(event);

      consoleSpy.mockRestore();
    });

    it('should ignore handler errors with ignore strategy', async () => {
      const ignoreEventBus = new PolicyEventBus({
        errorStrategy: 'ignore',
      });

      ignoreEventBus.subscribe({
        eventTypes: ['POLICY_EVALUATED'],
        handler: () => {
          throw new Error('Handler error');
        },
      });

      const event: PolicyEvaluationEvent<{ name: string }> = {
        type: 'POLICY_EVALUATED',
        policyId: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        entity: { name: 'test' },
        result: { isSuccess: true, isFailure: false, value: { name: 'test' } } as any,
        context: createTestContext(),
        duration: 100,
        timestamp: new Date(),
        executionId: 'exec-123',
      };

      // Should not throw
      await ignoreEventBus.publish(event);
    });

    it('should throw handler errors with throw strategy', async () => {
      const throwEventBus = new PolicyEventBus({
        errorStrategy: 'throw',
      });

      throwEventBus.subscribe({
        eventTypes: ['POLICY_EVALUATED'],
        handler: () => {
          throw new Error('Handler error');
        },
      });

      const event: PolicyEvaluationEvent<{ name: string }> = {
        type: 'POLICY_EVALUATED',
        policyId: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        entity: { name: 'test' },
        result: { isSuccess: true, isFailure: false, value: { name: 'test' } } as any,
        context: createTestContext(),
        duration: 100,
        timestamp: new Date(),
        executionId: 'exec-123',
      };

      const [error] = await safeRun(async () => {
        await throwEventBus.publish(event);
      });

      expect(error).toBeDefined();
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Handler error');
    });
  });

  describe('Metrics', () => {
    it('should track event metrics when enabled', async () => {
      const event: PolicyEvaluationEvent<{ name: string }> = {
        type: 'POLICY_EVALUATED',
        policyId: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        entity: { name: 'test' },
        result: { isSuccess: true, isFailure: false, value: { name: 'test' } } as any,
        context: createTestContext(),
        duration: 100,
        timestamp: new Date(),
        executionId: 'exec-123',
      };

      await eventBus.publish(event);

      const metrics = eventBus.getMetrics();
      expect(metrics.totalEvents).toBe(1);
      expect(metrics.eventsByType.get('POLICY_EVALUATED')).toBe(1);
      expect(metrics.lastEventTime).toBeDefined();
    });

    it('should track handler metrics', () => {
      eventBus.subscribe({
        eventTypes: ['POLICY_EVALUATED'],
        handler: mockHandler,
      });

      eventBus.subscribe({
        eventTypes: ['POLICY_EVALUATION_ERROR'],
        handler: mockHandler,
        enabled: false,
      });

      const metrics = eventBus.getMetrics();
      expect(metrics.totalHandlers).toBe(2);
      expect(metrics.enabledHandlers).toBe(1);
    });

    it('should reset metrics', async () => {
      const event: PolicyEvaluationEvent<{ name: string }> = {
        type: 'POLICY_EVALUATED',
        policyId: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        entity: { name: 'test' },
        result: { isSuccess: true, isFailure: false, value: { name: 'test' } } as any,
        context: createTestContext(),
        duration: 100,
        timestamp: new Date(),
        executionId: 'exec-123',
      };

      await eventBus.publish(event);
      expect(eventBus.getMetrics().totalEvents).toBe(1);

      eventBus.resetMetrics();
      expect(eventBus.getMetrics().totalEvents).toBe(0);
    });
  });

  describe('Parallel vs Sequential Execution', () => {
    it('should execute handlers in parallel when configured', async () => {
      const parallelBus = new PolicyEventBus({
        parallelExecution: true,
      });

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      parallelBus.subscribe({
        eventTypes: ['POLICY_EVALUATED'],
        handler: handler1,
        priority: 1,
      });

      parallelBus.subscribe({
        eventTypes: ['POLICY_EVALUATED'],
        handler: handler2,
        priority: 2,
      });

      const event: PolicyEvaluationEvent<{ name: string }> = {
        type: 'POLICY_EVALUATED',
        policyId: 'test-policy',
        domain: 'test',
        name: 'Test Policy',
        entity: { name: 'test' },
        result: { isSuccess: true, isFailure: false, value: { name: 'test' } } as any,
        context: createTestContext(),
        duration: 100,
        timestamp: new Date(),
        executionId: 'exec-123',
      };

      await parallelBus.publish(event);

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });
  });

  describe('PolicyEventHandlers Utilities', () => {
    it('should create logging handler', () => {
      const loggingHandler = PolicyEventHandlers.createLoggingHandler({
        logLevel: 'info',
        includeEntity: true,
      });

      expect(typeof loggingHandler).toBe('function');
    });

    it('should create filtering handler', () => {
      const filterFn = (event: any) => event.domain === 'finance';
      const baseHandler = vi.fn();

      const filteringHandler = PolicyEventHandlers.createFilteringHandler(filterFn, baseHandler);

      expect(typeof filteringHandler).toBe('function');
    });

    it('should create metrics handler', () => {
      const metricsCollector = vi.fn();
      const metricsHandler = PolicyEventHandlers.createMetricsHandler(metricsCollector);

      expect(typeof metricsHandler).toBe('function');
    });
  });

  describe('Global Event Bus', () => {
    it('should provide global event bus instance', () => {
      expect(globalPolicyEventBus).toBeInstanceOf(PolicyEventBus);
    });
  });
});

// Helper function to create test context
function createTestContext(): PolicyContext {
  return {
    userId: 'test-user',
    timestamp: new Date(),
    environment: 'test',
    features: {},
    metadata: {},
  };
}
