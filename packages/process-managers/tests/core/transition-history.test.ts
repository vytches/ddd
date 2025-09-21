import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import {
  TransitionHistory,
  TransitionHistoryError,
  type IProcessManagerTransition,
  type TransitionHistoryOptions,
} from '../../src/core/transition-history';
import type { IProcessManagerContext } from '../../src/interfaces';

describe('TransitionHistory', () => {
  let transitionHistory: TransitionHistory;
  let context: IProcessManagerContext;
  const processManagerId = 'test-process-123';

  beforeEach(() => {
    transitionHistory = new TransitionHistory(processManagerId);
    context = {
      correlationId: 'test-correlation-123',
      userId: 'user-456',
      sessionId: 'session-789',
      tenantId: 'tenant-abc',
      metadata: { source: 'test' },
      processedAt: new Date(),
    };
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      const history = new TransitionHistory(processManagerId);
      expect(history.getSize()).toBe(0);
      expect(history.getTransitions()).toHaveLength(0);
    });

    it('should create with custom options', () => {
      const options: TransitionHistoryOptions = {
        maxHistorySize: 100,
        includeSnapshots: false,
        enableLogging: true,
      };
      const history = new TransitionHistory(processManagerId, options);
      expect(history.getSize()).toBe(0);
    });
  });

  describe('recordTransition', () => {
    it('should record a basic transition', () => {
      transitionHistory.recordTransition('PENDING', 'IN_PROGRESS', 'START_PROCESSING', context);

      const transitions = transitionHistory.getTransitions();
      expect(transitions).toHaveLength(1);
      const firstTransition = transitions[0]!;
      expect(firstTransition.fromState).toBe('PENDING');
      expect(firstTransition.toState).toBe('IN_PROGRESS');
      expect(firstTransition.trigger).toBe('START_PROCESSING');
      expect(firstTransition.processManagerId).toBe(processManagerId);
    });

    it('should record transition with metadata', () => {
      const metadata = {
        executionTime: 1500,
        success: true,
        state: { orderId: 'order-123', amount: 100 },
      };

      transitionHistory.recordTransition(
        'PENDING',
        'IN_PROGRESS',
        'START_PROCESSING',
        context,
        metadata
      );

      const transition = transitionHistory.getLastTransition()!;
      expect(transition.executionTime).toBe(1500);
      expect(transition.success).toBe(true);
      expect(transition.snapshot).toEqual({ orderId: 'order-123', amount: 100 });
    });

    it('should record transition with error details', () => {
      const metadata = {
        success: false,
        errorDetails: 'Payment service unavailable',
      };

      transitionHistory.recordTransition(
        'IN_PROGRESS',
        'FAILED',
        'PAYMENT_ERROR',
        context,
        metadata
      );

      const transition = transitionHistory.getLastTransition()!;
      expect(transition.success).toBe(false);
      expect(transition.errorDetails).toBe('Payment service unavailable');
    });

    it('should include context information', () => {
      transitionHistory.recordTransition('PENDING', 'IN_PROGRESS', 'START', context);

      const transition = transitionHistory.getLastTransition()!;
      expect(transition.context.correlationId).toBe('test-correlation-123');
      expect(transition.context.userId).toBe('user-456');
      expect(transition.context.sessionId).toBe('session-789');
      expect(transition.context.tenantId).toBe('tenant-abc');
    });

    it('should generate unique transition IDs', () => {
      transitionHistory.recordTransition('A', 'B', 'TRIGGER1', context);
      transitionHistory.recordTransition('B', 'C', 'TRIGGER2', context);

      const transitions = transitionHistory.getTransitions();
      expect(transitions[0]!.id).not.toBe(transitions[1]!.id);
      expect(transitions[0]!.id).toMatch(/^transition_\d+_[a-z0-9]+$/);
    });

    it('should set success to true by default', () => {
      transitionHistory.recordTransition('A', 'B', 'TRIGGER', context);

      const transition = transitionHistory.getLastTransition()!;
      expect(transition.success).toBe(true);
    });
  });

  describe('getTransitions with filtering', () => {
    beforeEach(() => {
      // Set up test data
      transitionHistory.recordTransition('PENDING', 'IN_PROGRESS', 'START', context);
      transitionHistory.recordTransition('IN_PROGRESS', 'COMPLETED', 'FINISH', context);
      transitionHistory.recordTransition('PENDING', 'FAILED', 'ERROR', context);
      transitionHistory.recordTransition('FAILED', 'PENDING', 'RETRY', context);
    });

    it('should filter by fromState', () => {
      const transitions = transitionHistory.getTransitions({ fromState: 'PENDING' });
      expect(transitions).toHaveLength(2);
      expect(transitions.every(t => t.fromState === 'PENDING')).toBe(true);
    });

    it('should filter by toState', () => {
      const transitions = transitionHistory.getTransitions({ toState: 'PENDING' });
      expect(transitions).toHaveLength(1);
      expect(transitions[0]!.fromState).toBe('FAILED');
    });

    it('should filter by trigger', () => {
      const transitions = transitionHistory.getTransitions({ trigger: 'START' });
      expect(transitions).toHaveLength(1);
      expect(transitions[0]!.trigger).toBe('START');
    });

    it('should filter by date range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);

      const transitions = transitionHistory.getTransitions({
        startDate: oneHourAgo,
      });
      expect(transitions).toHaveLength(4); // All recent transitions
    });

    it('should apply limit', () => {
      const transitions = transitionHistory.getTransitions({ limit: 2 });
      expect(transitions).toHaveLength(2);
    });

    it('should combine multiple filters', () => {
      const transitions = transitionHistory.getTransitions({
        fromState: 'PENDING',
        limit: 1,
      });
      expect(transitions).toHaveLength(1);
      expect(transitions[0]!.fromState).toBe('PENDING');
    });

    it('should return transitions in reverse chronological order', () => {
      const transitions = transitionHistory.getTransitions();
      expect(transitions).toHaveLength(4);

      // Verify descending timestamp order
      for (let i = 1; i < transitions.length; i++) {
        expect(transitions[i - 1]!.timestamp.getTime()).toBeGreaterThanOrEqual(
          transitions[i]!.timestamp.getTime()
        );
      }
    });
  });

  describe('getLastTransition', () => {
    it('should return undefined when no transitions exist', () => {
      expect(transitionHistory.getLastTransition()).toBeUndefined();
    });

    it('should return the most recent transition', () => {
      transitionHistory.recordTransition('A', 'B', 'FIRST', context);
      transitionHistory.recordTransition('B', 'C', 'SECOND', context);

      const lastTransition = transitionHistory.getLastTransition()!;
      expect(lastTransition.trigger).toBe('SECOND');
      expect(lastTransition.fromState).toBe('B');
      expect(lastTransition.toState).toBe('C');
    });
  });

  describe('state-specific queries', () => {
    beforeEach(() => {
      transitionHistory.recordTransition('PENDING', 'IN_PROGRESS', 'START', context);
      transitionHistory.recordTransition('IN_PROGRESS', 'COMPLETED', 'FINISH', context);
      transitionHistory.recordTransition('PENDING', 'CANCELLED', 'CANCEL', context);
    });

    it('should get transitions from specific state', () => {
      const fromPending = transitionHistory.getTransitionsFromState('PENDING');
      expect(fromPending).toHaveLength(2);
      expect(fromPending.every(t => t.fromState === 'PENDING')).toBe(true);
    });

    it('should get transitions to specific state', () => {
      const toPending = transitionHistory.getTransitionsToState('PENDING');
      expect(toPending).toHaveLength(0);

      const toCompleted = transitionHistory.getTransitionsToState('COMPLETED');
      expect(toCompleted).toHaveLength(1);
      expect(toCompleted[0]!.fromState).toBe('IN_PROGRESS');
    });
  });

  describe('getStatistics', () => {
    it('should return zero statistics for empty history', () => {
      const stats = transitionHistory.getStatistics();
      expect(stats.totalTransitions).toBe(0);
      expect(stats.averageExecutionTime).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.mostCommonFromState).toBeNull();
    });

    it('should calculate statistics correctly', () => {
      // Add transitions with execution times
      transitionHistory.recordTransition('A', 'B', 'TRIGGER1', context, {
        executionTime: 1000,
        success: true,
      });
      transitionHistory.recordTransition('B', 'C', 'TRIGGER1', context, {
        executionTime: 2000,
        success: true,
      });
      transitionHistory.recordTransition('A', 'C', 'TRIGGER2', context, {
        executionTime: 3000,
        success: false,
      });

      const stats = transitionHistory.getStatistics();
      expect(stats.totalTransitions).toBe(3);
      expect(stats.averageExecutionTime).toBe(2000); // (1000 + 2000 + 3000) / 3
      expect(stats.successRate).toBeCloseTo(2 / 3); // 2 successful out of 3
      expect(stats.mostCommonFromState).toBe('A'); // 2 transitions from A
      expect(stats.mostCommonTrigger).toBe('TRIGGER1'); // 2 transitions with TRIGGER1
    });

    it('should handle missing execution times', () => {
      transitionHistory.recordTransition('A', 'B', 'TRIGGER', context, { success: true });
      transitionHistory.recordTransition('B', 'C', 'TRIGGER', context, {
        executionTime: 1000,
        success: true,
      });

      const stats = transitionHistory.getStatistics();
      expect(stats.averageExecutionTime).toBe(1000); // Only count non-undefined times
    });
  });

  describe('validateTransitionChain', () => {
    it('should validate empty history as valid', () => {
      const result = transitionHistory.validateTransitionChain();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate single transition as valid', () => {
      transitionHistory.recordTransition('A', 'B', 'TRIGGER', context);
      const result = transitionHistory.validateTransitionChain();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate consistent chain', () => {
      transitionHistory.recordTransition('A', 'B', 'T1', context);
      transitionHistory.recordTransition('B', 'C', 'T2', context);
      transitionHistory.recordTransition('C', 'D', 'T3', context);

      const result = transitionHistory.validateTransitionChain();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect inconsistent chain', () => {
      transitionHistory.recordTransition('A', 'B', 'T1', context);
      transitionHistory.recordTransition('C', 'D', 'T2', context); // B != C

      const result = transitionHistory.validateTransitionChain();
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Inconsistent chain');
    });
  });

  describe('size management', () => {
    it('should respect maxHistorySize option', () => {
      const limitedHistory = new TransitionHistory(processManagerId, { maxHistorySize: 2 });

      limitedHistory.recordTransition('A', 'B', 'T1', context);
      limitedHistory.recordTransition('B', 'C', 'T2', context);
      limitedHistory.recordTransition('C', 'D', 'T3', context);

      expect(limitedHistory.getSize()).toBe(2);
      const transitions = limitedHistory.getTransitions();
      expect(transitions[0]!.trigger).toBe('T3'); // Most recent
      expect(transitions[1]!.trigger).toBe('T2'); // Second most recent
    });

    it('should return current size', () => {
      expect(transitionHistory.getSize()).toBe(0);

      transitionHistory.recordTransition('A', 'B', 'TRIGGER', context);
      expect(transitionHistory.getSize()).toBe(1);
    });
  });

  describe('export/import functionality', () => {
    beforeEach(() => {
      transitionHistory.recordTransition('PENDING', 'IN_PROGRESS', 'START', context, {
        executionTime: 1500,
        success: true,
      });
      transitionHistory.recordTransition('IN_PROGRESS', 'COMPLETED', 'FINISH', context, {
        executionTime: 2000,
        success: true,
      });
    });

    it('should export to JSON format', () => {
      const exported = transitionHistory.exportToJson();
      const data = JSON.parse(exported);

      expect(data.metadata).toBeDefined();
      expect(data.metadata.totalTransitions).toBe(2);
      expect(data.transitions).toHaveLength(2);
      expect(data.transitions[0]!.fromState).toBe('PENDING');
    });

    it('should import from JSON format', () => {
      const exported = transitionHistory.exportToJson();
      const newHistory = new TransitionHistory(processManagerId);

      newHistory.importFromJson(exported);

      expect(newHistory.getSize()).toBe(2);
      const imported = newHistory.getTransitions();
      expect(imported[0]!.fromState).toBe('IN_PROGRESS'); // Most recent first
      expect(imported[1]!.fromState).toBe('PENDING');
    });

    it('should handle invalid JSON import', () => {
      const newHistory = new TransitionHistory(processManagerId);

      const [error] = safeRun(() => {
        newHistory.importFromJson('{"invalid": "format"}');
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Invalid transition history format');
    });

    it('should validate imported transitions', () => {
      const invalidJson = JSON.stringify({
        transitions: [
          { fromState: 'A', toState: 'B' }, // Missing required fields
          {
            id: 'valid-id',
            processManagerId,
            fromState: 'B',
            toState: 'C',
            trigger: 'TRIGGER',
            timestamp: new Date(),
            context,
            success: true,
          },
        ],
      });

      const newHistory = new TransitionHistory(processManagerId);
      newHistory.importFromJson(invalidJson);

      expect(newHistory.getSize()).toBe(1); // Only valid transition imported
    });
  });

  describe('clear functionality', () => {
    it('should clear all transitions', () => {
      transitionHistory.recordTransition('A', 'B', 'TRIGGER', context);
      transitionHistory.recordTransition('B', 'C', 'TRIGGER', context);

      expect(transitionHistory.getSize()).toBe(2);

      transitionHistory.clear();

      expect(transitionHistory.getSize()).toBe(0);
      expect(transitionHistory.getTransitions()).toHaveLength(0);
      expect(transitionHistory.getLastTransition()).toBeUndefined();
    });
  });

  describe('snapshot functionality', () => {
    it('should include snapshots when enabled', () => {
      const historyWithSnapshots = new TransitionHistory(processManagerId, {
        includeSnapshots: true,
      });
      const state = { orderId: 'order-123', amount: 100 };

      historyWithSnapshots.recordTransition('A', 'B', 'TRIGGER', context, { state });

      const transition = historyWithSnapshots.getLastTransition()!;
      expect(transition.snapshot).toEqual(state);
    });

    it('should exclude snapshots when disabled', () => {
      const historyWithoutSnapshots = new TransitionHistory(processManagerId, {
        includeSnapshots: false,
      });
      const state = { orderId: 'order-123', amount: 100 };

      historyWithoutSnapshots.recordTransition('A', 'B', 'TRIGGER', context, { state });

      const transition = historyWithoutSnapshots.getLastTransition()!;
      expect(transition.snapshot).toBeUndefined();
    });

    it('should handle non-serializable state gracefully', () => {
      const state: any = { circular: {} };
      state.circular = state; // Create circular reference

      transitionHistory.recordTransition('A', 'B', 'TRIGGER', context, { state });

      const transition = transitionHistory.getLastTransition()!;
      expect(transition.snapshot).toBeUndefined();
    });
  });

  describe('time window queries', () => {
    it('should get transitions within time window', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const twoHoursAgo = new Date(now.getTime() - 7200000);

      transitionHistory.recordTransition('A', 'B', 'T1', context);

      const transitions = transitionHistory.getTransitionsInTimeWindow(oneHourAgo, now);
      expect(transitions).toHaveLength(1);

      const emptyTransitions = transitionHistory.getTransitionsInTimeWindow(
        twoHoursAgo,
        oneHourAgo
      );
      expect(emptyTransitions).toHaveLength(0);
    });
  });

  describe('success/failure queries', () => {
    beforeEach(() => {
      transitionHistory.recordTransition('A', 'B', 'T1', context, { success: true });
      transitionHistory.recordTransition('B', 'C', 'T2', context, { success: false });
      transitionHistory.recordTransition('C', 'D', 'T3', context, { success: true });
    });

    it('should get failed transitions', () => {
      const failed = transitionHistory.getFailedTransitions();
      expect(failed).toHaveLength(1);
      expect(failed[0]!.trigger).toBe('T2');
      expect(failed[0]!.success).toBe(false);
    });

    it('should get successful transitions', () => {
      const successful = transitionHistory.getSuccessfulTransitions();
      expect(successful).toHaveLength(2);
      expect(successful.every(t => t.success)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty filter options', () => {
      transitionHistory.recordTransition('A', 'B', 'TRIGGER', context);
      const transitions = transitionHistory.getTransitions({});
      expect(transitions).toHaveLength(1);
    });

    it('should handle non-matching filters', () => {
      transitionHistory.recordTransition('A', 'B', 'TRIGGER', context);
      const transitions = transitionHistory.getTransitions({ fromState: 'NON_EXISTENT' });
      expect(transitions).toHaveLength(0);
    });

    it('should handle null state in snapshot creation', () => {
      transitionHistory.recordTransition('A', 'B', 'TRIGGER', context, { state: null });
      const transition = transitionHistory.getLastTransition()!;
      expect(transition.snapshot).toBeUndefined();
    });

    it('should handle primitive state in snapshot creation', () => {
      transitionHistory.recordTransition('A', 'B', 'TRIGGER', context, { state: 'string' });
      const transition = transitionHistory.getLastTransition()!;
      expect(transition.snapshot).toBeUndefined();
    });
  });
});
