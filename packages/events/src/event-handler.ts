/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import type { IDomainEvent } from '@vytches-ddd/contracts';
import { EVENT_HANDLER_METADATA, EVENT_HANDLER_OPTIONS } from '@vytches-ddd/contracts';

/**
 * Opcje dla dekoratora EventHandler
 */
export interface EventHandlerOptions {
  /**
   * Czy handler jest aktywny
   * Może być używane do warunkowego włączania handlerów
   */
  active?: boolean;

  /**
   * Dostępna od wersji
   * Można używać do włączania handlerów tylko w określonych wersjach
   */
  availableFrom?: string;

  /**
   * Priorytet handlera (wyższy = wcześniejsze wykonanie)
   */
  priority?: number;

  /**
   * Dodatkowe metadane
   */
  [key: string]: any;
}

/**
 * Dekorator dla handlerów zdarzeń domenowych
 * Może być stosowany na klasach lub metodach
 *
 * @param eventType - Typ zdarzenia do obsługi
 * @param options - Opcjonalne ustawienia handlera
 *
 * @example
 * // Użycie na klasie
 * @EventHandler(UserCreatedEvent)
 * export class UserCreatedHandler implements IEventHandler<UserCreatedEvent> {
 *   handle(event: UserCreatedEvent): void {
 *     // Obsługa zdarzenia
 *   }
 * }
 *
 * @example
 * // Użycie na metodzie
 * export class UserNotifications {
 *   @EventHandler(UserCreatedEvent)
 *   onUserCreated(event: UserCreatedEvent): void {
 *     // Obsługa zdarzenia
 *   }
 * }
 *
 * @example
 * // Użycie z opcjami
 * @EventHandler(UserCreatedEvent, { active: false })
 * export class DisabledHandler implements IEventHandler<UserCreatedEvent> {
 *   handle(event: UserCreatedEvent): void {
 *     // Ten handler nie będzie aktywowany
 *   }
 * }
 *
 * @example
 * // Użycie z wersjonowaniem
 * @EventHandler(NewFeatureEvent, { availableFrom: '1.2.0' })
 * export class NewFeatureHandler implements IEventHandler<NewFeatureEvent> {
 *   handle(event: NewFeatureEvent): void {
 *     // Ten handler będzie aktywny tylko od wersji 1.2.0
 *   }
 * }
 */
export function EventHandler<T extends IDomainEvent>(
  eventType: new (...args: any[]) => T,
  options: EventHandlerOptions = {}
) {
  return function (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: TypedPropertyDescriptor<any>
  ) {
    const metadata = { eventType };

    if (propertyKey !== undefined && descriptor !== undefined) {
      // Użycie jako dekorator metody
      Reflect.defineMetadata(EVENT_HANDLER_METADATA, metadata, descriptor.value);
      Reflect.defineMetadata(EVENT_HANDLER_OPTIONS, options, descriptor.value);
      return descriptor;
    } else {
      // Użycie jako dekorator klasy
      Reflect.defineMetadata(EVENT_HANDLER_METADATA, metadata, target);
      Reflect.defineMetadata(EVENT_HANDLER_OPTIONS, options, target);

      // Dodaj metodę pomocniczą dla adaptera
      if (!target.prototype.getEventType) {
        target.prototype.getEventType = function () {
          return eventType;
        };
      }

      return target;
    }
  };
}
