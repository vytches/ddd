import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import type { Result } from '@vytches-ddd/utils';
import {
  EventDrivenPolicy,
  EventDrivenPolicyFactory,
  PolicyEventBus,
  withEvents,
  type PolicyEvaluationEvent,
} from '../../src/events';
import type { IBusinessPolicy } from '../../src/core/interfaces';
import type { PolicyViolation } from '../../src/core/models/policy-violation';
import { PolicyContextBuilder, PolicyRequestBuilder } from '../../src/utils';

describe('EventDrivenPolicy', () => {
  let mockPolicy: IBusinessPolicy<{ name: string }>;
  let eventBus: PolicyEventBus;
  let capturedEvents: any[];

  beforeEach(() => {
    // Create mock policy
    mockPolicy = {
      id: 'test-policy',
      domain: 'test',
      name: 'Test Policy',
      check: vi.fn(),
      and: vi.fn(),
      or: vi.fn(),
      not: vi.fn(),
      when: vi.fn(),
    };

    // Create event bus with capture handler
    capturedEvents = [];
    eventBus = new PolicyEventBus({ enableMetrics: true });
    eventBus.subscribe({
      eventTypes: ['POLICY_EVALUATION_STARTED', 'POLICY_EVALUATED', 'POLICY_EVALUATION_ERROR'],
      handler: event => {
        capturedEvents.push(event);
      },
    });
  });

  describe('Basic Functionality', () => {
    it('should wrap policy and maintain interface', () => {
      const eventDrivenPolicy = new EventDrivenPolicy(mockPolicy, {
        eventBus,
        emitCompletionEvents: true,
      });

      expect(eventDrivenPolicy.id).toBe('test-policy');
      expect(eventDrivenPolicy.domain).toBe('test');
      expect(eventDrivenPolicy.name).toBe('Test Policy');
    });

    it('should emit completion events on successful policy execution', async () => {
      const successResult = {
        isSuccess: true,
        isFailure: false,
        value: { name: 'test' },
      } as Result<{ name: string }, PolicyViolation>;
      (mockPolicy.check as any).mockResolvedValue(successResult);

      const eventDrivenPolicy = new EventDrivenPolicy(mockPolicy, {
        eventBus,
        emitCompletionEvents: true,
      });

      const context = PolicyContextBuilder.forUser('test-user').build();
      const request = PolicyRequestBuilder.forEntityAndContext({ name: 'test' }, context).build();

      const result = await eventDrivenPolicy.check(request);

      expect(result).toBe(successResult);
      expect(mockPolicy.check).toHaveBeenCalledWith(request);
      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].type).toBe('POLICY_EVALUATED');
      expect(capturedEvents[0].policyId).toBe('test-policy');
      expect(capturedEvents[0].result).toBe(successResult);
    });

    it('should emit completion events on policy violation', async () => {
      const failureResult = {
        isSuccess: false,
        isFailure: true,
        error: new Error('Policy violation'),
      } as Result<{ name: string }, PolicyViolation>;
      (mockPolicy.check as any).mockResolvedValue(failureResult);

      const eventDrivenPolicy = new EventDrivenPolicy(mockPolicy, {
        eventBus,
        emitCompletionEvents: true,
      });

      const context = PolicyContextBuilder.forUser('test-user').build();
      const request = PolicyRequestBuilder.forEntityAndContext({ name: 'test' }, context).build();

      const result = await eventDrivenPolicy.check(request);

      expect(result).toBe(failureResult);
      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].type).toBe('POLICY_EVALUATED');
      expect(capturedEvents[0].result).toBe(failureResult);
    });

    it('should emit error events on policy execution exception', async () => {
      const errorMessage = 'Policy execution failed';
      (mockPolicy.check as any).mockRejectedValue(new Error(errorMessage));

      const eventDrivenPolicy = new EventDrivenPolicy(mockPolicy, {
        eventBus,
        emitErrorEvents: true,
      });

      const context = PolicyContextBuilder.forUser('test-user').build();
      const request = PolicyRequestBuilder.forEntityAndContext({ name: 'test' }, context).build();

      const [error] = await safeRun(async () => {
        await eventDrivenPolicy.check(request);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe(errorMessage);
      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].type).toBe('POLICY_EVALUATION_ERROR');
      expect(capturedEvents[0].error.message).toBe(errorMessage);
    });

    it('should emit start events when configured', async () => {
      const successResult = {
        isSuccess: true,
        isFailure: false,
        value: { name: 'test' },
      } as Result<{ name: string }, PolicyViolation>;
      (mockPolicy.check as any).mockResolvedValue(successResult);

      const eventDrivenPolicy = new EventDrivenPolicy(mockPolicy, {
        eventBus,
        emitStartEvents: true,
        emitCompletionEvents: true,
      });

      const context = PolicyContextBuilder.forUser('test-user').build();
      const request = PolicyRequestBuilder.forEntityAndContext({ name: 'test' }, context).build();

      await eventDrivenPolicy.check(request);

      expect(capturedEvents).toHaveLength(2);
      expect(capturedEvents[0].type).toBe('POLICY_EVALUATION_STARTED');
      expect(capturedEvents[1].type).toBe('POLICY_EVALUATED');
    });
  });

  describe('Event Configuration', () => {
    it('should not emit events when disabled', async () => {
      const successResult = {
        isSuccess: true,
        isFailure: false,
        value: { name: 'test' },
      } as Result<{ name: string }, PolicyViolation>;
      (mockPolicy.check as any).mockResolvedValue(successResult);

      const eventDrivenPolicy = new EventDrivenPolicy(mockPolicy, {
        eventBus,
        emitStartEvents: false,
        emitCompletionEvents: false,
        emitErrorEvents: false,
      });

      const context = PolicyContextBuilder.forUser('test-user').build();
      const request = PolicyRequestBuilder.forEntityAndContext({ name: 'test' }, context).build();

      await eventDrivenPolicy.check(request);

      expect(capturedEvents).toHaveLength(0);
    });

    it('should include entity data when configured', async () => {
      const successResult = {
        isSuccess: true,
        isFailure: false,
        value: { name: 'test' },
      } as Result<{ name: string }, PolicyViolation>;
      (mockPolicy.check as any).mockResolvedValue(successResult);

      const eventDrivenPolicy = new EventDrivenPolicy(mockPolicy, {
        eventBus,
        emitCompletionEvents: true,
        includeEntityInEvents: true,
      });

      const context = PolicyContextBuilder.forUser('test-user').build();
      const entity = { name: 'test-entity' };
      const request = PolicyRequestBuilder.forEntityAndContext(entity, context).build();

      await eventDrivenPolicy.check(request);

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].entity).toEqual(entity);
    });

    it('should exclude entity data when configured', async () => {
      const successResult = {
        isSuccess: true,
        isFailure: false,
        value: { name: 'test' },
      } as Result<{ name: string }, PolicyViolation>;
      (mockPolicy.check as any).mockResolvedValue(successResult);

      const eventDrivenPolicy = new EventDrivenPolicy(mockPolicy, {
        eventBus,
        emitCompletionEvents: true,
        includeEntityInEvents: false,
      });

      const context = PolicyContextBuilder.forUser('test-user').build();
      const entity = { name: 'test-entity' };
      const request = PolicyRequestBuilder.forEntityAndContext(entity, context).build();

      await eventDrivenPolicy.check(request);

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].entity).toEqual({});
    });

    it('should include full context when configured', async () => {
      const successResult = {
        isSuccess: true,
        isFailure: false,
        value: { name: 'test' },
      } as Result<{ name: string }, PolicyViolation>;
      (mockPolicy.check as any).mockResolvedValue(successResult);

      const eventDrivenPolicy = new EventDrivenPolicy(mockPolicy, {
        eventBus,
        emitCompletionEvents: true,
        includeContextInEvents: true,
      });

      const context = PolicyContextBuilder.forUser('test-user')
        .withTenantId('test-tenant')
        .withMetadata({ environment: 'test' })
        .build();

      const request = PolicyRequestBuilder.forEntityAndContext({ name: 'test' }, context).build();

      await eventDrivenPolicy.check(request);

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].context.userId).toBe('test-user');
      expect(capturedEvents[0].context.tenantId).toBe('test-tenant');
    });

    it('should include minimal context when configured', async () => {
      const successResult = {
        isSuccess: true,
        isFailure: false,
        value: { name: 'test' },
      } as Result<{ name: string }, PolicyViolation>;
      (mockPolicy.check as any).mockResolvedValue(successResult);

      const eventDrivenPolicy = new EventDrivenPolicy(mockPolicy, {
        eventBus,
        emitCompletionEvents: true,
        includeContextInEvents: false,
      });

      const context = PolicyContextBuilder.forUser('test-user')
        .withTenantId('test-tenant')
        .withMetadata({ environment: 'test' })
        .build();

      const request = PolicyRequestBuilder.forEntityAndContext({ name: 'test' }, context).build();

      await eventDrivenPolicy.check(request);

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].context.userId).toBe('test-user');
      expect(capturedEvents[0].context.tenantId).toBeUndefined();
    });

    it('should include version, tags, and metadata in events', async () => {
      const successResult = {
        isSuccess: true,
        isFailure: false,
        value: { name: 'test' },
      } as Result<{ name: string }, PolicyViolation>;
      (mockPolicy.check as any).mockResolvedValue(successResult);

      const eventDrivenPolicy = new EventDrivenPolicy(mockPolicy, {
        eventBus,
        emitCompletionEvents: true,
        version: '1.2.3',
        tags: ['security', 'compliance'],
        metadata: { environment: 'production', region: 'us-east-1' },
      });

      const context = PolicyContextBuilder.forUser('test-user').build();
      const request = PolicyRequestBuilder.forEntityAndContext({ name: 'test' }, context).build();

      await eventDrivenPolicy.check(request);

      expect(capturedEvents).toHaveLength(1);
      const event = capturedEvents[0] as PolicyEvaluationEvent;
      expect(event.version).toBe('1.2.3');
      expect(event.tags).toEqual(['security', 'compliance']);
      expect(event.metadata).toEqual({ environment: 'production', region: 'us-east-1' });
    });
  });

  describe('Policy Composition', () => {
    it('should delegate and/or/not operations to inner policy', () => {
      const mockComposer = { and: vi.fn(), or: vi.fn(), group: vi.fn() };
      (mockPolicy.and as any).mockReturnValue(mockComposer);
      (mockPolicy.or as any).mockReturnValue(mockComposer);
      (mockPolicy.not as any).mockReturnValue(mockPolicy);

      const eventDrivenPolicy = new EventDrivenPolicy(mockPolicy, { eventBus });
      const otherPolicy = mockPolicy;

      const andResult = eventDrivenPolicy.and(otherPolicy);
      expect(mockPolicy.and).toHaveBeenCalledWith(otherPolicy);
      expect(andResult).toBe(mockComposer);

      const orResult = eventDrivenPolicy.or(otherPolicy);
      expect(mockPolicy.or).toHaveBeenCalledWith(otherPolicy);
      expect(orResult).toBe(mockComposer);

      const notResult = eventDrivenPolicy.not();
      expect(mockPolicy.not).toHaveBeenCalled();
      expect(notResult).toBe(mockPolicy);
    });
  });

  describe('Factory Methods', () => {
    it('should create event-driven policy with default events', async () => {
      const successResult = {
        isSuccess: true,
        isFailure: false,
        value: { name: 'test' },
      } as Result<{ name: string }, PolicyViolation>;
      (mockPolicy.check as any).mockResolvedValue(successResult);

      const eventDrivenPolicy = EventDrivenPolicy.withDefaultEvents(mockPolicy, eventBus);

      const context = PolicyContextBuilder.forUser('test-user').build();
      const request = PolicyRequestBuilder.forEntityAndContext({ name: 'test' }, context).build();

      await eventDrivenPolicy.check(request);

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].type).toBe('POLICY_EVALUATED');
    });

    it('should create event-driven policy with audit events', async () => {
      const successResult = {
        isSuccess: true,
        isFailure: false,
        value: { name: 'test' },
      } as Result<{ name: string }, PolicyViolation>;
      (mockPolicy.check as any).mockResolvedValue(successResult);

      const eventDrivenPolicy = EventDrivenPolicy.withAuditEvents(mockPolicy, eventBus, {
        version: '1.0.0',
        tags: ['audit'],
      });

      const context = PolicyContextBuilder.forUser('test-user').build();
      const request = PolicyRequestBuilder.forEntityAndContext({ name: 'test' }, context).build();

      await eventDrivenPolicy.check(request);

      expect(capturedEvents).toHaveLength(2); // Start + completion events
      expect(capturedEvents[0].type).toBe('POLICY_EVALUATION_STARTED');
      expect(capturedEvents[1].type).toBe('POLICY_EVALUATED');
      expect(capturedEvents[1].version).toBe('1.0.0');
      expect(capturedEvents[1].tags).toEqual(['audit']);
    });

    it('should create event-driven policy with performance events', async () => {
      const successResult = {
        isSuccess: true,
        isFailure: false,
        value: { name: 'test' },
      } as Result<{ name: string }, PolicyViolation>;
      (mockPolicy.check as any).mockResolvedValue(successResult);

      const eventDrivenPolicy = EventDrivenPolicy.withPerformanceEvents(mockPolicy, eventBus);

      const context = PolicyContextBuilder.forUser('test-user').build();
      const request = PolicyRequestBuilder.forEntityAndContext({ name: 'test' }, context).build();

      await eventDrivenPolicy.check(request);

      expect(capturedEvents).toHaveLength(2); // Start + completion events
      expect(capturedEvents[1].entity).toEqual({}); // No entity for performance
    });
  });

  describe('Event Emission Resilience', () => {
    it('should not fail policy execution if event emission fails', async () => {
      const successResult = {
        isSuccess: true,
        isFailure: false,
        value: { name: 'test' },
      } as Result<{ name: string }, PolicyViolation>;
      (mockPolicy.check as any).mockResolvedValue(successResult);

      // Create event bus that will fail
      const failingEventBus = new PolicyEventBus();
      vi.spyOn(failingEventBus, 'publish').mockRejectedValue(new Error('Event bus failed'));

      const eventDrivenPolicy = new EventDrivenPolicy(mockPolicy, {
        eventBus: failingEventBus,
        emitCompletionEvents: true,
      });

      const context = PolicyContextBuilder.forUser('test-user').build();
      const request = PolicyRequestBuilder.forEntityAndContext({ name: 'test' }, context).build();

      // Should not throw, even though event emission fails
      const result = await eventDrivenPolicy.check(request);
      expect(result).toBe(successResult);
    });
  });

  describe('Decorator Function', () => {
    it('should work as decorator function', () => {
      const decorator = withEvents({ eventBus, emitCompletionEvents: true });
      const eventDrivenPolicy = decorator(mockPolicy);

      expect(eventDrivenPolicy).toBeInstanceOf(EventDrivenPolicy);
      expect(eventDrivenPolicy.id).toBe('test-policy');
    });
  });

  describe('EventDrivenPolicyFactory', () => {
    let factory: EventDrivenPolicyFactory;

    beforeEach(() => {
      factory = new EventDrivenPolicyFactory(eventBus, {
        emitCompletionEvents: true,
        includeEntityInEvents: false,
      });
    });

    it('should create policies with factory defaults', async () => {
      const successResult = {
        isSuccess: true,
        isFailure: false,
        value: { name: 'test' },
      } as Result<{ name: string }, PolicyViolation>;
      (mockPolicy.check as any).mockResolvedValue(successResult);

      const eventDrivenPolicy = factory.create(mockPolicy);

      const context = PolicyContextBuilder.forUser('test-user').build();
      const request = PolicyRequestBuilder.forEntityAndContext({ name: 'test' }, context).build();

      await eventDrivenPolicy.check(request);

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].entity).toEqual({}); // Default excludes entity
    });

    it('should create audit policies', async () => {
      const successResult = {
        isSuccess: true,
        isFailure: false,
        value: { name: 'test' },
      } as Result<{ name: string }, PolicyViolation>;
      (mockPolicy.check as any).mockResolvedValue(successResult);

      const eventDrivenPolicy = factory.createWithAudit(mockPolicy, {
        version: '2.0.0',
      });

      const context = PolicyContextBuilder.forUser('test-user').build();
      const request = PolicyRequestBuilder.forEntityAndContext({ name: 'test' }, context).build();

      await eventDrivenPolicy.check(request);

      expect(capturedEvents).toHaveLength(2); // Start + completion
      expect(capturedEvents[1].version).toBe('2.0.0');
    });

    it('should create performance monitoring policies', async () => {
      const successResult = {
        isSuccess: true,
        isFailure: false,
        value: { name: 'test' },
      } as Result<{ name: string }, PolicyViolation>;
      (mockPolicy.check as any).mockResolvedValue(successResult);

      const eventDrivenPolicy = factory.createWithPerformanceMonitoring(mockPolicy, {
        environment: 'production',
      });

      const context = PolicyContextBuilder.forUser('test-user').build();
      const request = PolicyRequestBuilder.forEntityAndContext({ name: 'test' }, context).build();

      await eventDrivenPolicy.check(request);

      expect(capturedEvents).toHaveLength(2); // Start + completion
      expect(capturedEvents[1].metadata).toEqual({ environment: 'production' });
    });
  });
});
