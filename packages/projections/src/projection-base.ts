import type { IExtendedDomainEvent } from '@vytches/ddd-contracts';
import type { IProjection } from './projection-interfaces';

/**
 * @llm-summary BaseProjection class for base projection operations
 * @llm-domain Architecture
 * @llm-complexity Expert
 *
 * @description
 * BaseProjection class implementing architectural component for base projection operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new BaseProjection();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export abstract class BaseProjection<TReadModel> implements IProjection<TReadModel> {
  abstract readonly name: string;
  abstract readonly eventTypes: string[];

  abstract createInitialState(): TReadModel | Promise<TReadModel>;
  abstract apply(readModel: TReadModel, event: IExtendedDomainEvent): TReadModel;

  /**
   * Check if projection handles specific event type
   */
  handles(eventType: string): boolean {
    return this.eventTypes.includes(eventType);
  }

  /**
   * Helper for type-safe event handling
   */
  protected when<TEvent extends IExtendedDomainEvent>(
    readModel: TReadModel,
    event: IExtendedDomainEvent,
    eventType: string,
    handler: (state: TReadModel, event: TEvent) => TReadModel
  ): TReadModel {
    if (event.eventType === eventType) {
      return handler(readModel, event as TEvent);
    }
    return readModel;
  }

  /**
   * Helper for multiple event types
   */
  protected whenAny<TEvent extends IExtendedDomainEvent>(
    readModel: TReadModel,
    event: IExtendedDomainEvent,
    eventTypes: string[],
    handler: (state: TReadModel, event: TEvent) => TReadModel
  ): TReadModel {
    if (eventTypes.includes(event.eventType)) {
      return handler(readModel, event as TEvent);
    }
    return readModel;
  }

  /**
   * Helper for conditional application
   */
  protected applyIf<TEvent extends IExtendedDomainEvent>(
    readModel: TReadModel,
    event: IExtendedDomainEvent,
    condition: (event: TEvent) => boolean,
    handler: (state: TReadModel, event: TEvent) => TReadModel
  ): TReadModel {
    if (this.handles(event.eventType) && condition(event as TEvent)) {
      return handler(readModel, event as TEvent);
    }
    return readModel;
  }

  /**
   * Helper for safe property updates
   */
  protected updateState<K extends keyof TReadModel>(
    readModel: TReadModel,
    updates: Partial<Pick<TReadModel, K>>
  ): TReadModel {
    return { ...readModel, ...updates };
  }

  /**
   * Helper for nested state updates
   */
  protected updateNestedState<K extends keyof TReadModel>(
    readModel: TReadModel,
    key: K,
    updater: (current: TReadModel[K]) => TReadModel[K]
  ): TReadModel {
    return {
      ...readModel,
      [key]: updater(readModel[key]),
    };
  }

  /**
   * Helper for array state updates
   */
  protected updateArrayState<K extends keyof TReadModel>(
    readModel: TReadModel,
    key: K,
    updater: (current: TReadModel[K] extends (infer U)[] ? U[] : never) => TReadModel[K]
  ): TReadModel {
    return {
      ...readModel,
      [key]: updater(readModel[key] as any),
    };
  }
}
