import type { IDomainEvent, ISpecification } from '@vytches/ddd-contracts';

/**
 * Interface for routing events to appropriate contexts based on business rules.
 * Determines which bounded contexts should receive specific events.
 *
 * @since 1.0.0
 * @public
 */
export interface IContextRouter {
  determineTargetContexts(event: IDomainEvent): string[];
}

// Implementacja z różnymi opcjami konfiguracji

/**
 * Flexible context router implementation with multiple configuration options.
 * Supports routing rules based on event types, specifications, and predicates.
 *
 * @since 1.0.0
 * @public
 */
export class ContextRouter implements IContextRouter {
  private readonly routingRules: Array<{
    targetContexts: string[];
    condition: EventRoutingCondition;
  }> = [];

  constructor(initialConfig?: ContextRouterConfig) {
    if (initialConfig) {
      this.configure(initialConfig);
    }
  }

  // Konfiguracja routera
  configure(config: ContextRouterConfig): this {
    // Przypadek 1: Prosta tablica kontekstów (wszystkie eventy)
    if (Array.isArray(config)) {
      this.routingRules.push({
        targetContexts: config,
        condition: () => true, // Zawsze prawdziwe
      });
      return this;
    }

    // Przypadek 2: Mapa warunków
    if (config instanceof Map) {
      for (const [context, condition] of config.entries()) {
        this.routingRules.push({
          targetContexts: [context],
          condition: this.normalizeCondition(condition),
        });
      }
      return this;
    }

    // Przypadek 3: Obiekt konfiguracyjny
    const rules = config as Record<string, EventRoutingCondition | string[]>;

    for (const [key, value] of Object.entries(rules)) {
      // Jeśli wartość to tablica stringów, to są to eventy, które powinny trafić do tego kontekstu
      if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
        this.routingRules.push({
          targetContexts: [key],
          condition: event => (value as string[]).includes(event.eventName),
        });
      }
      // W przeciwnym razie traktujemy wartość jako condition
      else {
        this.routingRules.push({
          targetContexts: [key],
          condition: this.normalizeCondition(value as EventRoutingCondition),
        });
      }
    }

    return this;
  }

  // Dodanie prostej reguły: wszystkie eventy do wszystkich kontekstów
  sendAllEventsTo(...contexts: string[]): this {
    this.routingRules.push({
      targetContexts: contexts,
      condition: () => true,
    });
    return this;
  }

  // Dodanie reguły dla konkretnego typu eventu
  sendEventTypeTo(eventName: string, ...contexts: string[]): this {
    this.routingRules.push({
      targetContexts: contexts,
      condition: event => event.eventName === eventName,
    });
    return this;
  }

  // Dodanie reguły korzystającej ze specyfikacji
  sendEventsMatchingSpecificationTo(
    specification: ISpecification<IDomainEvent>,
    ...contexts: string[]
  ): this {
    this.routingRules.push({
      targetContexts: contexts,
      condition: event => specification.isSatisfiedBy(event),
    });
    return this;
  }

  // Dodanie reguły korzystającej z funkcji predykatu
  sendEventsMatchingPredicateTo(
    predicate: (event: IDomainEvent) => boolean,
    ...contexts: string[]
  ): this {
    this.routingRules.push({
      targetContexts: contexts,
      condition: predicate,
    });
    return this;
  }

  // Główna funkcja - określenie kontekstów docelowych dla eventu
  determineTargetContexts(event: IDomainEvent): string[] {
    const targetContexts = new Set<string>();

    for (const rule of this.routingRules) {
      // Sprawdzenie warunku routingu
      if (this.evaluateCondition(rule.condition, event)) {
        // Dodanie kontekstów docelowych
        for (const context of rule.targetContexts) {
          targetContexts.add(context);
        }
      }
    }

    return Array.from(targetContexts);
  }

  private normalizeCondition(condition: EventRoutingCondition): (event: IDomainEvent) => boolean {
    // Jeśli to funkcja, użyj jej bezpośrednio
    if (typeof condition === 'function') {
      return condition;
    }

    // Jeśli to specyfikacja, użyj jej metody isSatisfiedBy
    if (typeof condition === 'object' && 'isSatisfiedBy' in condition) {
      return event => condition.isSatisfiedBy(event);
    }

    // Jeśli to string, traktuj jako typ eventu
    if (typeof condition === 'string') {
      return event => event.eventName === condition;
    }

    // Domyślnie zawsze prawda
    return () => true;
  }

  private evaluateCondition(condition: EventRoutingCondition, event: IDomainEvent): boolean {
    return this.normalizeCondition(condition)(event);
  }

  // Usunięcie wszystkich reguł
  clear(): this {
    this.routingRules.length = 0;
    return this;
  }
}

// Typy pomocnicze
type EventRoutingCondition =
  | string // Typ eventu
  | ((event: IDomainEvent) => boolean) // Funkcja predykatu
  | ISpecification<IDomainEvent> // Specyfikacja
  | boolean; // Stała wartość

type ContextRouterConfig =
  | string[] // Prosta tablica kontekstów
  | Map<string, EventRoutingCondition> // Mapa: kontekst -> warunek
  | Record<string, EventRoutingCondition | string[]>; // Obiekt: { kontekst: warunek }
