/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IEventHandler } from '@vytches-ddd/contracts';
import { isEventHandler } from '@vytches-ddd/contracts';
import type { IEventBus, BaseEventBusOptions } from '@vytches-ddd/contracts';

import { BaseEventBus } from '../base-event-bus';
import type { IIntegrationEventBus } from '../event-bus';
import type { IIntegrationEvent } from './integration-event-interfaces';

export interface ContextAwareEventBus<TEvent = any> extends IEventBus<TEvent> {
  subscribeWithContext(
    eventType: string | (new (...args: any[]) => TEvent),
    handler: (event: TEvent) => Promise<void> | void,
    context: string
  ): void;
}

export interface InMemoryIntegrationEventBusOptions extends BaseEventBusOptions {
  /**
   * Whether to process events synchronously
   */
  synchronous?: boolean;
}

export class InMemoryIntegrationEventBus
  extends BaseEventBus<IIntegrationEvent>
  implements IIntegrationEventBus
{
  private readonly handlerContexts = new Map<
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    Function | IEventHandler<IIntegrationEvent>,
    string
  >();

  /**
   * Creates a new in-memory integration event bus
   */
  constructor(options: InMemoryIntegrationEventBusOptions = {}) {
    super(options);
  }

  override subscribe<T extends IIntegrationEvent>(
    eventType: string | (new (...args: any[]) => T),
    handler: (event: T) => Promise<void> | void,
    context?: string // Opcjonalny kontekst
  ): void {
    // Wywołujemy oryginalną metodę subscribe z klasy bazowej
    super.subscribe(eventType, handler);

    // Jeśli określono kontekst, zapisujemy go
    if (context) {
      this.handlerContexts.set(handler as any, context);
    }
  }

  // Również nadpisujemy registerHandler dla zachowania spójności
  override registerHandler<T extends IIntegrationEvent>(
    eventType: string | (new (...args: any[]) => T),
    handler: IEventHandler<T>,
    context?: string // Opcjonalny kontekst
  ): void {
    super.registerHandler(eventType, handler);

    if (context) {
      this.handlerContexts.set(handler as any, context);
    }

    const eventName = this.getEventName(eventType);
    this.log(
      `Registered class handler to ${eventName}${context ? ` for context: ${context}` : ''}`
    );
  }

  protected override buildPublishPipeline(): (event: IIntegrationEvent) => Promise<void> {
    const basePipeline = async (event: IIntegrationEvent): Promise<void> => {
      const eventName = this.getEventTypeName(event);
      const handlers = this.handlers.get(eventName);

      if (!handlers || handlers.size === 0) {
        this.log(`No handlers for ${eventName}`);
        return;
      }

      const targetContext = event.metadata?.targetContext;
      const promises: Promise<void>[] = [];

      for (const handler of handlers) {
        // Sprawdź, czy handler powinien otrzymać event
        const handlerContext = this.handlerContexts.get(handler);

        // Filtruj tylko jeśli zarówno target jak i handler mają określony kontekst
        if (!targetContext || !handlerContext || targetContext === handlerContext) {
          try {
            let result: void | Promise<void>;

            if (isEventHandler(handler)) {
              result = handler.handle(event);
            } else {
              result = handler(event);
            }

            if (result instanceof Promise) {
              promises.push(result);
            }
          } catch (error) {
            this.handleError(error as Error, eventName);
          }
        }
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }
    };

    // Zastosuj middleware - reszta logiki pozostaje bez zmian
    let pipeline = basePipeline;
    if (this.options.middlewares) {
      for (let i = this.options.middlewares.length - 1; i >= 0; i--) {
        pipeline = this.options.middlewares[i]!(pipeline);
      }
    }

    return pipeline;
  }

  /**
   * Dostosowanie komunikatów logowania dla eventów integracyjnych (opcjonalnie)
   */
  protected override log(message: string): void {
    if (this.options.enableLogging && this.options.logger) {
      this.options.logger(`[IntegrationEventBus] ${message}`);
    }
  }
}
