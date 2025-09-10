import { safeRun } from '@vytches/ddd-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BaseProcessManager } from '../../src/core/base-process-manager';
import type {
  IProcessManagerContext,
  IProcessManagerEvent,
  IProcessManagerState,
  ProcessManagerResult,
} from '../../src/interfaces';
import { ProcessManagerStatus } from '../../src/interfaces';
import { ConcurrencyScenarios, ConcurrencyTestHelper } from '../edge-cases/concurrency-test-helper';
import { ProcessManagerTestHarness } from '../utils/process-manager-test-harness';
import { WorkflowScenarioBuilder } from '../utils/workflow-scenario-builder';

// Test implementation for integration testing
class OrderProcessManager extends BaseProcessManager {
  canHandle(event: IProcessManagerEvent): boolean {
    return ['OrderCreated', 'PaymentProcessed', 'InventoryReserved', 'ShippingConfirmed'].includes(
      event.eventType
    );
  }

  protected async handleSecure(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    this.setRunning();

    switch (event.eventType) {
      case 'OrderCreated':
        return this.handleOrderCreated(event, context);
      case 'PaymentProcessed':
        return this.handlePaymentProcessed(event, context);
      case 'InventoryReserved':
        return this.handleInventoryReserved(event, context);
      case 'ShippingConfirmed':
        return this.handleShippingConfirmed(event, context);
      default:
        return this.createFailureResult('Unknown event type');
    }
  }

  isComplete(): boolean {
    return this.state.currentStep === 'completed';
  }

  getCorrelationData(): Record<string, unknown> {
    return {
      orderId: this.state.stepData.orderId,
      customerId: this.state.stepData.customerId,
    };
  }

  private async handleOrderCreated(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    const payload = event.payload as { orderId: string; customerId: string; amount: number };
    this.updateState({
      currentStep: 'order-created',
      stepData: {
        orderId: payload.orderId,
        customerId: payload.customerId,
        amount: payload.amount,
      },
    });

    // Emit commands for next steps
    const commands = [
      {
        type: 'ProcessPayment',
        payload: {
          orderId: payload.orderId,
          amount: payload.amount,
        },
      },
      {
        type: 'ReserveInventory',
        payload: {
          orderId: payload.orderId,
          items: (event.payload as any).items,
        },
      },
    ];

    return this.createSuccessResult(commands, undefined, true);
  }

  private async handlePaymentProcessed(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    const payload = event.payload as { paymentId: string };
    this.updateState({
      currentStep: 'payment-processed',
      stepData: {
        ...this.state.stepData,
        paymentId: payload.paymentId,
        paymentStatus: 'confirmed',
      },
    });

    // Check if we can proceed to shipping
    if (this.state.stepData.inventoryStatus === 'reserved') {
      return this.proceedToShipping(context);
    }

    this.setWaiting();
    return this.createSuccessResult(undefined, undefined, true);
  }

  private async handleInventoryReserved(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    const payload = event.payload as { reservationId: string };
    this.updateState({
      currentStep: 'inventory-reserved',
      stepData: {
        ...this.state.stepData,
        inventoryStatus: 'reserved',
        reservationId: payload.reservationId,
      },
    });

    // Check if we can proceed to shipping
    if (this.state.stepData.paymentStatus === 'confirmed') {
      return this.proceedToShipping(context);
    }

    this.setWaiting();
    return this.createSuccessResult(undefined, undefined, true);
  }

  private async handleShippingConfirmed(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    const payload = event.payload as { shippingId: string };
    this.updateState({
      currentStep: 'completed',
      stepData: {
        ...this.state.stepData,
        shippingId: payload.shippingId,
        completedAt: new Date(),
      },
    });

    this.complete();

    // Emit completion events
    const events = [
      {
        eventType: 'OrderCompleted',
        payload: {
          orderId: this.state.stepData.orderId,
          customerId: this.state.stepData.customerId,
          completedAt: new Date(),
        },
      },
    ];

    return this.createSuccessResult(undefined, events, false);
  }

  private async proceedToShipping(context: IProcessManagerContext): Promise<ProcessManagerResult> {
    const commands = [
      {
        type: 'ArrangeShipping',
        payload: {
          orderId: this.state.stepData.orderId,
          customerId: this.state.stepData.customerId,
          items: this.state.stepData.items,
        },
      },
    ];

    return this.createSuccessResult(commands, undefined, true);
  }
}

describe('Process Manager Integration Tests', () => {
  let harness: ProcessManagerTestHarness;
  let processManager: OrderProcessManager;
  let concurrencyHelper: ConcurrencyTestHelper;

  beforeEach(async () => {
    harness = new ProcessManagerTestHarness({
      enableEventTracking: true,
      enableStateLogging: false,
      verbose: false,
    });

    await harness.initialize();
    await harness.setup();

    const initialState: IProcessManagerState = {
      currentStep: 'initial',
      stepData: {},
      version: 0,
      lastModified: new Date(),
      correlationData: {},
    };

    processManager = new OrderProcessManager({
      id: 'order-pm-1',
      type: 'OrderProcessManager',
      initialState,
    });

    concurrencyHelper = new ConcurrencyTestHelper(harness);
  });

  afterEach(async () => {
    await harness.dispose();
  });

  describe('Complete Order Workflow', () => {
    it('should process a complete order workflow successfully', async () => {
      const scenario = WorkflowScenarioBuilder.create('Complete Order Workflow')
        .withDescription('Tests the complete order processing workflow from creation to completion')
        .withProcessManager(processManager)
        .withHarness(harness)
        .withTimeout(10000)

        // Step 1: Order created
        .whenEvent(
          harness.createTestEvent({
            eventType: 'OrderCreated',
            payload: {
              orderId: 'order-123',
              customerId: 'customer-456',
              amount: 99.99,
              items: [{ sku: 'item-1', quantity: 2 }],
            },
          })
        )
        .expectStateChange('initial', 'order-created')
        .expectCommandEmitted('ProcessPayment')
        .expectCommandEmitted('ReserveInventory')

        // Step 2: Payment processed
        .thenWait(100)
        .whenEvent(
          harness.createTestEvent({
            eventType: 'PaymentProcessed',
            payload: {
              orderId: 'order-123',
              paymentId: 'payment-789',
              amount: 99.99,
            },
          })
        )
        .expectStateChange('order-created', 'payment-processed')

        // Step 3: Inventory reserved
        .thenWait(100)
        .whenEvent(
          harness.createTestEvent({
            eventType: 'InventoryReserved',
            payload: {
              orderId: 'order-123',
              reservationId: 'reservation-101',
              items: [{ sku: 'item-1', quantity: 2 }],
            },
          })
        )
        .expectStateChange('payment-processed', 'inventory-reserved')
        .expectCommandEmitted('ArrangeShipping')

        // Step 4: Shipping confirmed
        .thenWait(100)
        .whenEvent(
          harness.createTestEvent({
            eventType: 'ShippingConfirmed',
            payload: {
              orderId: 'order-123',
              shippingId: 'shipping-202',
              trackingNumber: 'TRK123456',
            },
          })
        )
        .expectStateChange('inventory-reserved', 'completed')
        .expectEventEmitted('OrderCompleted')
        .expectCompletion(1000);

      const result = await scenario.execute();

      expect(result.success).toBe(true);
      expect(result.processManagerFinalState.status).toBe(ProcessManagerStatus.COMPLETED);
      expect(result.processManagerFinalState.currentStep).toBe('completed');
      expect(result.expectationResults.every(r => r.satisfied)).toBe(true);
    });

    it('should handle out-of-order events correctly', async () => {
      const scenario = WorkflowScenarioBuilder.create('Out-of-Order Events')
        .withProcessManager(processManager)
        .withHarness(harness)

        // Start with order creation
        .whenEvent(
          harness.createTestEvent({
            eventType: 'OrderCreated',
            payload: { orderId: 'order-123', customerId: 'customer-456', amount: 99.99 },
          })
        )

        // Inventory reserved before payment (out of order)
        .whenEvent(
          harness.createTestEvent({
            eventType: 'InventoryReserved',
            payload: { orderId: 'order-123', reservationId: 'reservation-101' },
          })
        )

        // Payment processed after inventory
        .whenEvent(
          harness.createTestEvent({
            eventType: 'PaymentProcessed',
            payload: { orderId: 'order-123', paymentId: 'payment-789' },
          })
        )

        .expectCommandEmitted('ArrangeShipping'); // Should be emitted after both payment and inventory

      const result = await scenario.execute();
      expect(result.success).toBe(true);
    });
  });

  describe('Event Bus Integration', () => {
    it('should integrate with UnifiedEventBus correctly', async () => {
      const eventBus = harness.getMockEventBus();
      let eventsReceived = 0;

      // Subscribe to events
      eventBus.subscribe('OrderCompleted', () => {
        eventsReceived++;
      });

      // Process order to completion
      const events = [
        harness.createTestEvent({ eventType: 'OrderCreated', payload: { orderId: 'order-123' } }),
        harness.createTestEvent({
          eventType: 'PaymentProcessed',
          payload: { orderId: 'order-123' },
        }),
        harness.createTestEvent({
          eventType: 'InventoryReserved',
          payload: { orderId: 'order-123' },
        }),
        harness.createTestEvent({
          eventType: 'ShippingConfirmed',
          payload: { orderId: 'order-123' },
        }),
      ];

      await harness.simulateEventSequence(processManager, events, 50);

      // Verify event bus integration
      expect(eventBus.getPublishedEvents().length).toBeGreaterThan(0);
      expect(eventBus.verifyEventPublished('OrderCompleted')).toBe(true);
      expect(eventsReceived).toBe(1);
    });
  });

  describe('Repository Integration', () => {
    it('should persist process manager state correctly', async () => {
      const repository = harness.getMockRepository();

      // Save initial state
      await repository.save(processManager);

      // Process an event
      const event = harness.createTestEvent({
        eventType: 'OrderCreated',
        payload: { orderId: 'order-123' },
      });

      const context = harness.createTestContext();
      await processManager.handle(event, context);

      // Save updated state
      await repository.save(processManager);

      // Load from repository
      const loaded = await repository.load(processManager.id);

      expect(loaded).toBeDefined();
      expect(loaded!.state.currentStep).toBe('order-created');
      expect(loaded!.state.version).toBe(1); // Initial (0) + 1 update from handleOrderCreated
    });

    it('should handle optimistic locking conflicts', async () => {
      const repository = harness.getMockRepository();

      // Save initial state
      await repository.save(processManager);

      // Simulate optimistic locking failure
      repository.simulateOptimisticLockingFailure(processManager.id);

      const [error] = await safeRun(() => repository.save(processManager));

      expect(error).toBeDefined();
      expect(error?.message).toContain('Optimistic locking failure');
    });
  });

  describe('Concurrency Testing', () => {
    it('should handle concurrent state updates correctly', async () => {
      const scenario = ConcurrencyScenarios.stateUpdateRace(5);
      const result = await concurrencyHelper.testRaceCondition(processManager, scenario);

      expect(result.results.length).toBe(5);
      expect(result.results.filter(r => r.success).length).toBeGreaterThan(0);

      // At least one operation should succeed
      const successfulResults = result.results.filter(r => r.success);
      expect(successfulResults.length).toBeGreaterThan(0);
    });

    it('should detect version conflicts under concurrent access', async () => {
      const concurrentUpdates = Array.from({ length: 3 }, (_, i) => ({
        id: `update-${i}`,
        stateUpdate: { [`field${i}`]: `value${i}` },
      }));

      const result = await concurrencyHelper.testOptimisticLockingConflict(
        processManager,
        concurrentUpdates
      );

      // Expect some conflicts due to version management
      expect(result.successfulUpdates).toBeGreaterThan(0);
      expect(result.successfulUpdates).toBeLessThanOrEqual(concurrentUpdates.length);
    });

    it('should handle high load scenarios', async () => {
      const loadScenario = ConcurrencyScenarios.highLoadTest(50, 25);
      const result = await concurrencyHelper.performLoadTest(processManager, loadScenario);

      expect(result.totalOperations).toBe(50);
      expect(result.successfulOperations).toBeGreaterThan(40); // Allow some failures
      expect(result.averageExecutionTime).toBeLessThan(100); // Should be fast
    });
  });

  describe('Timeout and Lifecycle', () => {
    it('should detect timeout correctly', async () => {
      const timeoutPM = new OrderProcessManager({
        id: 'timeout-pm',
        type: 'OrderProcessManager',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: {},
        },
        createdAt: new Date(Date.now() - 2000), // Created 2 seconds ago
        timeout: 1000, // 1 second timeout
      });

      const isTimedOut = await harness.simulateTimeout(timeoutPM, 1000);
      expect(isTimedOut).toBe(true);
    });

    it.skip('should handle timeout precision under load', async () => {
      const timeoutPM = new OrderProcessManager({
        id: 'precision-pm',
        type: 'OrderProcessManager',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: {},
        },
        createdAt: harness.getTestClock().now(),
        timeout: 1000, // 1 second timeout
      });

      const result = await concurrencyHelper.testTimeoutPrecision(timeoutPM, 1000, 100);

      expect(result.withinTolerance).toBe(true);
      expect(result.actualTimeoutMs).toBeGreaterThan(900);
      expect(result.actualTimeoutMs).toBeLessThan(1200);
    });
  });

  describe('Error Handling', () => {
    it('should handle service failures gracefully', async () => {
      const services = harness.getMockServices();
      if (services) {
        // Simulate command dispatch failure
        services.simulateFailure(
          'command:ProcessPayment',
          new Error('Payment service unavailable')
        );

        const event = harness.createTestEvent({
          eventType: 'OrderCreated',
          payload: { orderId: 'order-123' },
        });

        const context = harness.createTestContext();
        const [error, result] = await safeRun(() => processManager.handle(event, context));

        // Process manager should handle the event successfully
        expect(error).toBeUndefined();
        expect(result?.success).toBe(true);

        // Manually dispatch commands to test service failure handling
        if (result?.commands) {
          for (const command of result.commands) {
            const [dispatchError] = await safeRun(() => services.commandBus.dispatch(command));
            // Command dispatch should fail for ProcessPayment
            if (command.type === 'ProcessPayment') {
              expect(dispatchError).toBeDefined();
            }
          }
        }

        // Verify that some commands failed
        expect(services.getCommandHistory().some(h => !h.success)).toBe(true);
      }
    });

    it('should fail gracefully when process manager fails', async () => {
      const error = new Error('Critical business rule violation');

      // Debug: Check initial status
      console.log('Initial process manager status:', processManager.status);

      processManager.fail(error);

      // Debug: Check status after fail
      console.log('Process manager status after fail:', processManager.status);

      expect(processManager.status).toBe(ProcessManagerStatus.FAILED);

      // Should not be able to handle events when failed - returns failure result instead of throwing
      const event = harness.createTestEvent({ eventType: 'OrderCreated' });
      const context = harness.createTestContext();

      const [handleError, result] = await safeRun(() => processManager.handle(event, context));

      // Debug: Check result
      console.log('Handle error:', handleError?.message);
      console.log('Handle result success:', result?.success);
      console.log('Handle result error:', result?.error?.message);

      // Should return failure result, not throw error
      expect(handleError).toBeUndefined();
      expect(result).toBeDefined();
      expect(result!.success).toBe(false);
      expect(result!.error?.message).toContain(
        'Cannot handle events when process manager is in FAILED status'
      );
    });
  });
});
