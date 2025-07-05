import type { BaseEventBusOptions, IDomainEvent } from '@vytches-ddd/contracts';
import { BaseEventBus } from '../base-event-bus';
import type { IDomainEventBus } from '../event-bus';

/**
 * Options specific to InMemoryEventBus
 */
export interface InMemoryDomainEventBusOptions extends BaseEventBusOptions {
  /**
   * Whether to process events synchronously
   */
  synchronous?: boolean;
}

/**
 * In-memory implementation of EventBus
 * Processes events locally within the same process
 */
export class InMemoryDomainEventBus extends BaseEventBus<IDomainEvent> implements IDomainEventBus {
  /**
   * Creates a new in-memory event bus
   */
  constructor(options: InMemoryDomainEventBusOptions = {}, useDI = true) {
    super(options, useDI);
  }

  protected override log(message: string): void {
    if (this.options.enableLogging && this.options.logger) {
      this.options.logger(`[DomainEventBus] ${message}`);
    }
  }
}
