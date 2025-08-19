/**
 * MockUnifiedEventBus - Mock implementation for testing event-driven workflows
 *
 * Provides controlled event bus simulation with:
 * - Event publishing and subscription
 * - Event history tracking
 * - Selective event filtering
 * - Async operation simulation
 * - Error injection capabilities
 */

import { safeRun } from '@vytches/ddd-utils';
import type { IProcessManagerEvent } from '../../src/interfaces';

export interface MockEventBusOptions {
  enableLogging?: boolean;
  trackEventHistory?: boolean;
  enableAsyncSimulation?: boolean;
  defaultDelay?: number;
}

export interface EventSubscription {
  id: string;
  eventType: string;
  handler: (event: IProcessManagerEvent) => void | Promise<void>;
  filter?: (event: IProcessManagerEvent) => boolean;
}

export interface EventPublishHistory {
  event: IProcessManagerEvent;
  publishedAt: Date;
  subscriberCount: number;
  deliveryResults: Array<{
    subscriptionId: string;
    success: boolean;
    error?: Error;
    processingTime: number;
  }>;
}

export class MockUnifiedEventBus {
  private subscriptions = new Map<string, EventSubscription>();
  private eventHistory: EventPublishHistory[] = [];
  private publishCallbacks: Array<(event: IProcessManagerEvent) => void> = [];
  private failureSimulation = new Map<string, Error>(); // subscriptionId -> Error

  private options: Required<MockEventBusOptions>;
  private subscriptionCounter = 0;

  constructor(options: MockEventBusOptions = {}) {
    this.options = {
      enableLogging: false,
      trackEventHistory: true,
      enableAsyncSimulation: false,
      defaultDelay: 5,
      ...options,
    };
  }

  /**
   * Publishes an event to all matching subscribers
   */
  async publish(event: IProcessManagerEvent): Promise<void> {
    const publishStartTime = Date.now();
    const matchingSubscriptions = this.getMatchingSubscriptions(event);

    if (this.options.enableLogging) {
      console.log(
        `MockEventBus: Publishing event '${event.eventType}' to ${matchingSubscriptions.length} subscribers`
      );
    }

    const deliveryResults: EventPublishHistory['deliveryResults'] = [];

    // Process all subscriptions
    for (const subscription of matchingSubscriptions) {
      const handlerStartTime = Date.now();

      // Check for simulated failures
      const simulatedError = this.failureSimulation.get(subscription.id);
      if (simulatedError) {
        deliveryResults.push({
          subscriptionId: subscription.id,
          success: false,
          error: simulatedError,
          processingTime: Date.now() - handlerStartTime,
        });
        continue;
      }

      // Simulate async delay if enabled
      if (this.options.enableAsyncSimulation) {
        await this.simulateDelay();
      }

      // Execute the handler
      const [error] = await safeRun(() => subscription.handler(event));

      deliveryResults.push({
        subscriptionId: subscription.id,
        success: !error,
        ...(error && { error }),
        processingTime: Date.now() - handlerStartTime,
      });
    }

    // Track event history
    if (this.options.trackEventHistory) {
      this.eventHistory.push({
        event,
        publishedAt: new Date(),
        subscriberCount: matchingSubscriptions.length,
        deliveryResults,
      });
    }

    // Notify callbacks
    for (const callback of this.publishCallbacks) {
      try {
        callback(event);
      } catch (error) {
        if (this.options.enableLogging) {
          console.error('MockEventBus: Error in publish callback:', error);
        }
      }
    }
  }

  /**
   * Publishes multiple events in sequence
   */
  async publishMany(events: IProcessManagerEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Subscribes to events by type
   */
  subscribe(
    eventType: string,
    handler: (event: IProcessManagerEvent) => void | Promise<void>,
    filter?: (event: IProcessManagerEvent) => boolean
  ): string {
    const subscriptionId = `sub-${++this.subscriptionCounter}`;

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      eventType,
      handler,
      ...(filter && { filter }),
    });

    if (this.options.enableLogging) {
      console.log(
        `MockEventBus: Subscribed to event type '${eventType}' with ID '${subscriptionId}'`
      );
    }

    return subscriptionId;
  }

  /**
   * Unsubscribes from events
   */
  unsubscribe(subscriptionId: string): boolean {
    const existed = this.subscriptions.has(subscriptionId);
    this.subscriptions.delete(subscriptionId);
    this.failureSimulation.delete(subscriptionId);

    if (this.options.enableLogging && existed) {
      console.log(`MockEventBus: Unsubscribed '${subscriptionId}'`);
    }

    return existed;
  }

  /**
   * Adds a callback to be notified when events are published
   */
  onEventPublished(callback: (event: IProcessManagerEvent) => void): void {
    this.publishCallbacks.push(callback);
  }

  /**
   * Gets all published events
   */
  getPublishedEvents(): IProcessManagerEvent[] {
    return this.eventHistory.map(h => h.event);
  }

  /**
   * Gets full event history with delivery details
   */
  getEventHistory(): EventPublishHistory[] {
    return [...this.eventHistory];
  }

  /**
   * Gets events of a specific type
   */
  getEventsByType(eventType: string): IProcessManagerEvent[] {
    return this.eventHistory.filter(h => h.event.eventType === eventType).map(h => h.event);
  }

  /**
   * Gets events by correlation ID
   */
  getEventsByCorrelation(correlationId: string): IProcessManagerEvent[] {
    return this.eventHistory.filter(h => h.event.correlationId === correlationId).map(h => h.event);
  }

  /**
   * Gets current subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Gets subscriptions by event type
   */
  getSubscriptionsForEventType(eventType: string): EventSubscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => sub.eventType === eventType);
  }

  /**
   * Clears all event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Clears all subscriptions
   */
  clearSubscriptions(): void {
    this.subscriptions.clear();
    this.failureSimulation.clear();
  }

  /**
   * Resets the event bus to initial state
   */
  reset(): void {
    this.clearHistory();
    this.clearSubscriptions();
    this.publishCallbacks = [];
    this.subscriptionCounter = 0;
  }

  /**
   * Simulates subscription handler failure
   */
  simulateSubscriptionFailure(subscriptionId: string, error: Error): void {
    this.failureSimulation.set(subscriptionId, error);
  }

  /**
   * Verifies that an event was published
   */
  verifyEventPublished(eventType: string, payload?: any): boolean {
    return this.eventHistory.some(h => {
      if (h.event.eventType !== eventType) {
        return false;
      }

      if (payload !== undefined) {
        return JSON.stringify(h.event.payload) === JSON.stringify(payload);
      }

      return true;
    });
  }

  /**
   * Verifies that events were published in a specific order
   */
  verifyEventSequence(eventTypes: string[]): boolean {
    const publishedTypes = this.eventHistory.map(h => h.event.eventType);

    if (publishedTypes.length < eventTypes.length) {
      return false;
    }

    let sequenceIndex = 0;
    for (const publishedType of publishedTypes) {
      if (publishedType === eventTypes[sequenceIndex]) {
        sequenceIndex++;
        if (sequenceIndex === eventTypes.length) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Gets delivery statistics
   */
  getDeliveryStatistics(): {
    totalEvents: number;
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageProcessingTime: number;
  } {
    let totalDeliveries = 0;
    let successfulDeliveries = 0;
    let failedDeliveries = 0;
    let totalProcessingTime = 0;

    for (const history of this.eventHistory) {
      for (const result of history.deliveryResults) {
        totalDeliveries++;
        totalProcessingTime += result.processingTime;

        if (result.success) {
          successfulDeliveries++;
        } else {
          failedDeliveries++;
        }
      }
    }

    return {
      totalEvents: this.eventHistory.length,
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      averageProcessingTime: totalDeliveries > 0 ? totalProcessingTime / totalDeliveries : 0,
    };
  }

  private getMatchingSubscriptions(event: IProcessManagerEvent): EventSubscription[] {
    const matching: EventSubscription[] = [];

    for (const subscription of this.subscriptions.values()) {
      if (subscription.eventType === event.eventType || subscription.eventType === '*') {
        if (!subscription.filter || subscription.filter(event)) {
          matching.push(subscription);
        }
      }
    }

    return matching;
  }

  private async simulateDelay(): Promise<void> {
    if (this.options.defaultDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.options.defaultDelay));
    }
  }
}
