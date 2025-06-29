/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  IIntegrationEvent,
  IIntegrationEventMetadata,
  IDomainToIntegrationEventTransformer,
} from './integration-event-interfaces';

/**
 * Abstract class for integration event dispatcher
 * Defines the basic contract independent of implementation
 */
export abstract class IIntegrationEventDispatcher {
  /**
   * Dispatches an integration event
   * @param event Integration event to dispatch
   */
  abstract dispatch<T = any>(event: IIntegrationEvent<T>): Promise<void>;

  /**
   * Dispatches multiple integration events
   * @param events Integration events to dispatch
   */
  abstract dispatchBatch<T = any>(events: IIntegrationEvent<T>[]): Promise<void>;

  /**
   * Transforms and dispatches a domain event as an integration event
   * @param domainEvent Domain event
   * @param transformer Event transformer
   * @param additionalMetadata Optional additional metadata
   */
  abstract dispatchFromDomainEvent<D = any, I = any>(
    domainEvent: D,
    transformer: IDomainToIntegrationEventTransformer<D, I>,
    additionalMetadata?: Partial<IIntegrationEventMetadata>
  ): Promise<void>;
}
