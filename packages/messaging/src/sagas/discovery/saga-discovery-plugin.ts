import type { Constructor } from '@vytches/ddd-di';
import { Logger } from '@vytches/ddd-logging';
import type { SagaMetadata } from '../interfaces';
import { isSagaClass, getSagaMetadata, getSagaType } from '../decorators';
import { SagaDiscoveryError } from '../errors';

/**
 * @llm-summary Contract for saga discovery result functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * SagaDiscoveryResult interface implementing integration layer component for saga discovery result operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSagaDiscoveryResult implements SagaDiscoveryResult {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface SagaDiscoveryResult {
  /** Saga class constructor */
  sagaClass: Constructor;

  /** Saga type identifier */
  sagaType: string;

  /** Complete saga metadata */
  metadata: SagaMetadata;

  /** Event types this saga can handle */
  handledEvents: string[];

  /** Event types that can start this saga */
  startEvents: string[];

  /** Steps defined in this saga */
  steps: string[];

  /** Compensation handlers available */
  compensationHandlers: string[];
}

/**
 * @llm-summary SagaDiscoveryPlugin class for saga discovery plugin operations
 * @llm-domain Integration
 * @llm-complexity Simple
 *
 * @description
 * SagaDiscoveryPlugin class implementing integration layer component for saga discovery plugin operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SagaDiscoveryPlugin();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SagaDiscoveryPlugin());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SagaDiscoveryPlugin {
  private readonly logger: ReturnType<typeof Logger.forContext>;
  private readonly discoveredSagas: Map<string, SagaDiscoveryResult> = new Map();

  constructor() {
    this.logger = Logger.forContext('SagaDiscoveryPlugin');
  }

  /**
   * Discover all saga classes from given constructors
   * @param constructors - Array of constructor functions to scan
   * @returns Array of discovered saga information
   */
  discoverSagas(constructors: Constructor[]): SagaDiscoveryResult[] {
    this.logger.info('Starting saga discovery', {
      totalConstructors: constructors.length,
    });

    const results: SagaDiscoveryResult[] = [];

    for (const constructor of constructors) {
      try {
        const result = this.analyzeSagaClass(constructor);
        if (result) {
          results.push(result);
          this.discoveredSagas.set(result.sagaType, result);

          this.logger.debug('Saga discovered', {
            sagaType: result.sagaType,
            className: constructor.name,
            handledEvents: result.handledEvents,
            startEvents: result.startEvents,
            stepsCount: result.steps.length,
            compensationHandlersCount: result.compensationHandlers.length,
          });
        }
      } catch (error) {
        this.logger.warn('Failed to analyze potential saga class', {
          className: constructor.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.info('Saga discovery completed', {
      discoveredSagas: results.length,
      sagaTypes: results.map(r => r.sagaType),
    });

    return results;
  }

  /**
   * Discover sagas from a module or assembly
   * @param module - Module object containing exported classes
   * @returns Array of discovered saga information
   */
  discoverSagasFromModule(module: Record<string, any>): SagaDiscoveryResult[] {
    this.logger.debug('Discovering sagas from module', {
      exportedKeys: Object.keys(module),
    });

    const constructors: Constructor[] = [];

    for (const [key, value] of Object.entries(module)) {
      if (this.isConstructor(value)) {
        constructors.push(value as Constructor);
      }
    }

    return this.discoverSagas(constructors);
  }

  /**
   * Get discovered saga by type
   * @param sagaType - Saga type identifier
   * @returns Discovered saga result or undefined
   */
  getDiscoveredSaga(sagaType: string): SagaDiscoveryResult | undefined {
    return this.discoveredSagas.get(sagaType);
  }

  /**
   * Get all discovered sagas
   * @returns Array of all discovered saga results
   */
  getAllDiscoveredSagas(): SagaDiscoveryResult[] {
    return Array.from(this.discoveredSagas.values());
  }

  /**
   * Find sagas that can handle a specific event type
   * @param eventType - Event type to search for
   * @returns Array of saga results that can handle the event
   */
  findSagasForEvent(eventType: string): SagaDiscoveryResult[] {
    const matchingSagas: SagaDiscoveryResult[] = [];

    for (const saga of this.discoveredSagas.values()) {
      if (saga.handledEvents.includes(eventType)) {
        matchingSagas.push(saga);
      }
    }

    this.logger.debug('Found sagas for event', {
      eventType,
      matchingSagas: matchingSagas.map(s => s.sagaType),
    });

    return matchingSagas;
  }

  /**
   * Find sagas that can be started by a specific event type
   * @param eventType - Event type to search for
   * @returns Array of saga results that can be started by the event
   */
  findSagasStartedByEvent(eventType: string): SagaDiscoveryResult[] {
    const matchingSagas: SagaDiscoveryResult[] = [];

    for (const saga of this.discoveredSagas.values()) {
      if (saga.startEvents.includes(eventType)) {
        matchingSagas.push(saga);
      }
    }

    this.logger.debug('Found sagas started by event', {
      eventType,
      matchingSagas: matchingSagas.map(s => s.sagaType),
    });

    return matchingSagas;
  }

  /**
   * Clear all discovered sagas
   */
  clear(): void {
    this.logger.debug('Clearing discovered sagas', {
      previousCount: this.discoveredSagas.size,
    });

    this.discoveredSagas.clear();
  }

  /**
   * Validate discovered sagas for conflicts and issues
   * @returns Array of validation errors
   */
  validateDiscoveredSagas(): string[] {
    const errors: string[] = [];

    // Check for duplicate saga types
    const sagaTypes = new Set<string>();
    for (const saga of this.discoveredSagas.values()) {
      if (sagaTypes.has(saga.sagaType)) {
        errors.push(`Duplicate saga type found: ${saga.sagaType}`);
      }
      sagaTypes.add(saga.sagaType);
    }

    // Check for conflicting start events
    const startEventMappings = new Map<string, string[]>();
    for (const saga of this.discoveredSagas.values()) {
      for (const startEvent of saga.startEvents) {
        if (!startEventMappings.has(startEvent)) {
          startEventMappings.set(startEvent, []);
        }
        startEventMappings.get(startEvent)!.push(saga.sagaType);
      }
    }

    for (const [eventType, sagaTypes] of startEventMappings.entries()) {
      if (sagaTypes.length > 1) {
        errors.push(`Multiple sagas can start from event ${eventType}: ${sagaTypes.join(', ')}`);
      }
    }

    return errors;
  }

  /**
   * Analyze a single class to determine if it's a saga
   * @param constructor - Constructor function to analyze
   * @returns Saga discovery result or null if not a saga
   */
  private analyzeSagaClass(constructor: Constructor): SagaDiscoveryResult | null {
    // Check if class is decorated with @Saga
    if (!isSagaClass(constructor)) {
      return null;
    }

    const sagaType = getSagaType(constructor);
    if (!sagaType) {
      throw new SagaDiscoveryError(
        `Saga class ${constructor.name} has no saga type`,
        constructor.name,
        { phase: 'metadata_extraction', constructor: constructor.name }
      );
    }

    const metadata = getSagaMetadata(constructor);
    if (!metadata) {
      throw new SagaDiscoveryError(
        `Saga class ${constructor.name} has no metadata`,
        constructor.name,
        { phase: 'metadata_extraction', constructor: constructor.name }
      );
    }

    // Extract event information
    const handledEvents = new Set<string>();
    const startEvents = new Set<string>();
    const steps = new Set<string>();
    const compensationHandlers = new Set<string>();

    // Process event handlers
    if (metadata.eventHandlers) {
      for (const [methodName, handlerOptions] of metadata.eventHandlers.entries()) {
        const eventTypes = Array.isArray(handlerOptions.eventType)
          ? handlerOptions.eventType
          : [handlerOptions.eventType];

        for (const eventType of eventTypes) {
          handledEvents.add(eventType);

          if (handlerOptions.canStartSaga) {
            startEvents.add(eventType);
          }
        }

        if (handlerOptions.stepName) {
          steps.add(handlerOptions.stepName);
        }
      }
    }

    // Process compensation handlers
    if (metadata.compensationHandlers) {
      for (const [methodName, handlerOptions] of metadata.compensationHandlers.entries()) {
        compensationHandlers.add(methodName);
      }
    }

    // Add start events from saga configuration
    if (metadata.saga?.startEvents) {
      for (const startEvent of metadata.saga.startEvents) {
        startEvents.add(startEvent);
      }
    }

    const result: SagaDiscoveryResult = {
      sagaClass: constructor,
      sagaType, // Already checked for null above
      metadata,
      handledEvents: Array.from(handledEvents),
      startEvents: Array.from(startEvents),
      steps: Array.from(steps),
      compensationHandlers: Array.from(compensationHandlers),
    };

    return result;
  }

  /**
   * Check if a value is a constructor function
   * @param value - Value to check
   */
  private isConstructor(value: unknown): boolean {
    return typeof value === 'function' && value.prototype && value.prototype.constructor === value;
  }
}

/**
 * @llm-summary sagaDiscoveryPlugin constant
 * @llm-domain Integration
 *
 * @description
 * sagaDiscoveryPlugin constant implementing integration layer component for saga discovery plugin operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(sagaDiscoveryPlugin);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const sagaDiscoveryPlugin = new SagaDiscoveryPlugin();
