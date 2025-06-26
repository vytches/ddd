/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IEventBus } from '@vytches-ddd/contracts';

/**
 * Registry for managing different types of event buses
 */
export class EventBusRegistry {
  private buses = new Map<string, IEventBus<any>>();

  /**
   * Register an event bus with a specific type name
   */
  register<TEvent>(type: string, bus: IEventBus<TEvent>): void {
    this.buses.set(type, bus);
  }

  /**
   * Get a registered event bus by type
   */
  get<TEvent>(type: string): IEventBus<TEvent> | undefined {
    return this.buses.get(type) as IEventBus<TEvent> | undefined;
  }

  /**
   * Check if a specific bus type is registered
   */
  has(type: string): boolean {
    return this.buses.has(type);
  }
}
