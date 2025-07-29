import type { IExtendedDomainEvent } from '@vytches/ddd-contracts';
import { Logger } from '@vytches/ddd-logging';
import type {
  ISagaOrchestrator,
  ISagaRepository,
  ISagaDefinition,
  ISaga,
  ISagaExecutionContext,
  ISagaProcessingResult,
  ISagaOrchestratorConfig,
  ISagaOrchestratorStatistics,
} from '../interfaces';
import { SagaStatus } from '../interfaces';
import {
  SagaDefinitionNotFoundError,
  SagaInstanceLimitExceededError,
  SagaConfigurationError,
  SagaOrchestrationError,
} from '../errors';

/**
 * @llm-summary SagaOrchestrator class for saga orchestrator operations
 * @llm-domain Integration
 * @llm-complexity Expert
 *
 * @description
 * SagaOrchestrator class implementing integration layer component for saga orchestrator operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SagaOrchestrator();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class SagaOrchestrator implements ISagaOrchestrator {
  private readonly logger: ReturnType<typeof Logger.forContext>;
  private readonly sagaDefinitions: Map<string, ISagaDefinition> = new Map();
  private readonly startEventMappings: Map<string, Set<string>> = new Map();
  private readonly statistics: ISagaOrchestratorStatistics;
  private readonly config: Required<ISagaOrchestratorConfig>;

  constructor(
    private readonly sagaRepository: ISagaRepository,
    config: Partial<ISagaOrchestratorConfig> = {}
  ) {
    this.logger = Logger.forContext('SagaOrchestrator');

    this.config = {
      maxConcurrentExecutions: 100,
      defaultOperationTimeout: 30000,
      defaultSagaTimeout: 3600000, // 1 hour
      enableAutoRetry: true,
      maxRetryAttempts: 3,
      retryDelay: {
        initial: 1000,
        multiplier: 2,
        maximum: 30000,
      },
      enableMetrics: true,
      enableAuditing: true,
      deadLetterQueue: {
        enabled: true,
        maxRetentionDays: 7,
        notificationThreshold: 10,
      },
      performance: {
        enableProfiling: true,
        slowOperationThresholdMs: 5000,
        metricsCollectionInterval: 60000,
      },
      cleanup: {
        enableAutoCleanup: true,
        completedSagaRetentionDays: 30,
        failedSagaRetentionDays: 90,
        cleanupIntervalHours: 24,
      },
      ...config,
    };

    this.statistics = this.initializeStatistics();

    this.logger.info('SagaOrchestrator initialized', {
      maxConcurrentExecutions: this.config.maxConcurrentExecutions,
      enableMetrics: this.config.enableMetrics,
      enableAuditing: this.config.enableAuditing,
      autoCleanup: this.config.cleanup.enableAutoCleanup,
    });
  }

  /**
   * Start a new saga instance
   * @param event - Event that triggers saga start
   * @param context - Execution context
   * @returns Started saga instance
   */
  async startSaga(event: IExtendedDomainEvent, context: ISagaExecutionContext): Promise<ISaga> {
    this.logger.info('Starting new saga', {
      eventType: event.eventType,
      correlationId: context.correlationId,
      userId: context.userId,
    });

    const startTime = Date.now();

    try {
      // Find saga definitions that can handle this start event
      const candidateDefinitions = this.findSagaDefinitionsForEvent(event.eventType);

      if (candidateDefinitions.length === 0) {
        this.logger.warn('No saga definition found for start event', {
          eventType: event.eventType,
          availableDefinitions: Array.from(this.sagaDefinitions.keys()),
        });
        throw new SagaDefinitionNotFoundError(
          event.eventType,
          Array.from(this.sagaDefinitions.keys())
        );
      }

      // For now, use the first matching definition
      // In future, we could add logic to select based on correlation data
      const definition = candidateDefinitions[0]!;

      // Check instance limits
      if (definition.maxInstances) {
        const existingCount = await this.sagaRepository.count(
          definition.sagaType,
          SagaStatus.STARTED
        );
        if (existingCount >= definition.maxInstances) {
          this.logger.warn('Maximum instances reached for saga type', {
            sagaType: definition.sagaType,
            maxInstances: definition.maxInstances,
            existingCount,
          });
          throw new SagaInstanceLimitExceededError(
            definition.sagaType,
            definition.maxInstances,
            existingCount
          );
        }
      }

      // Create new saga instance
      const saga = await definition.createInstance(event, context);

      // Save saga to repository
      await this.sagaRepository.save(saga);

      // Update statistics
      if (this.config.enableMetrics) {
        this.updateStatistics('sagaStarted', saga, Date.now() - startTime);
      }

      this.logger.info('Saga started successfully', {
        sagaId: saga.sagaId,
        sagaType: saga.sagaType,
        eventType: event.eventType,
        initialStep: saga.state.currentStep,
        timeoutAt: saga.state.timeoutAt,
      });

      return saga;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error('Failed to start saga', error instanceof Error ? error : undefined, {
        event_type: event.eventType,
        correlation_id: context.correlationId,
        execution_time: executionTime,
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
      });

      if (this.config.enableMetrics) {
        this.updateStatistics('sagaStartFailed', null, executionTime);
      }

      throw error;
    }
  }

  /**
   * Process incoming event against all active sagas
   * @param event - Domain event to process
   * @param context - Execution context
   * @returns Array of processing results
   */
  async processEvent(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaProcessingResult[]> {
    this.logger.debug('Processing event against sagas', {
      eventType: event.eventType,
      correlationId: context.correlationId,
    });

    const startTime = Date.now();
    const results: ISagaProcessingResult[] = [];

    try {
      // Find sagas that might be interested in this event
      const candidateSagas = await this.findSagasForEvent(event, context);

      this.logger.debug('Found candidate sagas for event', {
        eventType: event.eventType,
        candidateCount: candidateSagas.length,
      });

      // Process event in each saga
      for (const saga of candidateSagas) {
        const sagaResult = await this.processSagaEvent(saga, event, context);
        results.push(sagaResult);

        // Handle saga completion or failure
        if (sagaResult.sagaCompleted) {
          await this.completeSaga(saga.sagaId, context);
        } else if (sagaResult.requiresCompensation) {
          await this.compensateSaga(saga.sagaId, context);
        }
      }

      // Check if this event can start new sagas
      if (this.canStartSaga(event.eventType)) {
        try {
          const newSaga = await this.startSaga(event, context);
          const startResult: ISagaProcessingResult = {
            sagaId: newSaga.sagaId,
            sagaType: newSaga.sagaType,
            success: true,
            commands: [],
            events: [],
            sagaCompleted: false,
            requiresCompensation: false,
            metrics: {
              processingTimeMs: Date.now() - startTime,
              stepExecuted: newSaga.state.currentStep,
              timestamp: new Date(),
            },
          };
          results.push(startResult);
        } catch (error) {
          // Log but don't fail the entire event processing
          this.logger.warn('Failed to start new saga from event', {
            eventType: event.eventType,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const totalExecutionTime = Date.now() - startTime;

      this.logger.debug('Event processing completed', {
        eventType: event.eventType,
        processedSagas: results.length,
        totalExecutionTime,
        successfulProcessing: results.filter(r => r.success).length,
      });

      if (this.config.enableMetrics) {
        this.updateStatistics('eventProcessed', null, totalExecutionTime);
      }

      return results;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error('Event processing failed', error instanceof Error ? error : undefined, {
        event_type: event.eventType,
        correlation_id: context.correlationId,
        execution_time: executionTime,
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
      });

      if (this.config.enableMetrics) {
        this.updateStatistics('eventProcessingFailed', null, executionTime);
      }

      throw error;
    }
  }

  /**
   * Complete a saga successfully
   * @param sagaId - Saga identifier
   * @param context - Execution context
   */
  async completeSaga(sagaId: string, context: ISagaExecutionContext): Promise<void> {
    this.logger.info('Completing saga', { sagaId, correlationId: context.correlationId });

    try {
      const saga = await this.sagaRepository.findById(sagaId);
      if (!saga) {
        this.logger.warn('Saga not found for completion', { sagaId });
        return;
      }

      // Update saga state to completed
      await this.sagaRepository.updateState(
        sagaId,
        {
          status: SagaStatus.COMPLETED,
          updatedAt: new Date(),
        },
        saga.state.version
      );

      if (this.config.enableMetrics) {
        const totalDuration = Date.now() - saga.state.createdAt.getTime();
        this.updateStatistics('sagaCompleted', saga, totalDuration);
      }

      this.logger.info('Saga completed successfully', {
        sagaId,
        sagaType: saga.sagaType,
        totalDuration: Date.now() - saga.state.createdAt.getTime(),
      });
    } catch (error) {
      this.logger.error('Failed to complete saga', error instanceof Error ? error : undefined, {
        saga_id: sagaId,
        error_message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Cancel a saga
   * @param sagaId - Saga identifier
   * @param reason - Cancellation reason
   * @param context - Execution context
   */
  async cancelSaga(sagaId: string, reason: string, context: ISagaExecutionContext): Promise<void> {
    this.logger.info('Cancelling saga', { sagaId, reason, correlationId: context.correlationId });

    try {
      const saga = await this.sagaRepository.findById(sagaId);
      if (!saga) {
        this.logger.warn('Saga not found for cancellation', { sagaId });
        return;
      }

      // Update saga state to cancelled
      await this.sagaRepository.updateState(
        sagaId,
        {
          status: SagaStatus.CANCELLED,
          updatedAt: new Date(),
          error: {
            message: `Saga cancelled: ${reason}`,
            step: saga.state.currentStep,
            timestamp: new Date(),
          },
        },
        saga.state.version
      );

      if (this.config.enableMetrics) {
        this.updateStatistics('sagaCancelled', saga, 0);
      }

      this.logger.info('Saga cancelled successfully', {
        sagaId,
        sagaType: saga.sagaType,
        reason,
      });
    } catch (error) {
      this.logger.error('Failed to cancel saga', error instanceof Error ? error : undefined, {
        saga_id: sagaId,
        cancellation_reason: reason,
        error_message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Compensate a failed saga
   * @param sagaId - Saga identifier
   * @param context - Execution context
   */
  async compensateSaga(sagaId: string, context: ISagaExecutionContext): Promise<void> {
    this.logger.info('Starting saga compensation', {
      sagaId,
      correlationId: context.correlationId,
    });

    try {
      const saga = await this.sagaRepository.findById(sagaId);
      if (!saga) {
        this.logger.warn('Saga not found for compensation', { sagaId });
        return;
      }

      // Update saga state to compensating
      await this.sagaRepository.updateState(
        sagaId,
        {
          status: SagaStatus.COMPENSATING,
          updatedAt: new Date(),
        },
        saga.state.version
      );

      // Execute compensation logic
      // This is a simplified approach - in a real implementation,
      // we would need to determine which steps to compensate
      const compensationResult = await saga.compensate(saga.state.currentStep, context);

      // Update final status based on compensation result
      const finalStatus = compensationResult.success ? SagaStatus.COMPENSATED : SagaStatus.FAILED;
      await this.sagaRepository.updateState(
        sagaId,
        {
          status: finalStatus,
          updatedAt: new Date(),
        },
        saga.state.version + 1
      );

      if (this.config.enableMetrics) {
        this.updateStatistics('sagaCompensated', saga, 0);
      }

      this.logger.info('Saga compensation completed', {
        sagaId,
        sagaType: saga.sagaType,
        success: compensationResult.success,
        finalStatus,
      });
    } catch (error) {
      this.logger.error('Failed to compensate saga', error instanceof Error ? error : undefined, {
        saga_id: sagaId,
        error_message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Handle saga timeout
   * @param sagaId - Saga identifier
   * @param context - Execution context
   */
  async handleTimeout(sagaId: string, context: ISagaExecutionContext): Promise<void> {
    this.logger.info('Handling saga timeout', { sagaId, correlationId: context.correlationId });

    try {
      const saga = await this.sagaRepository.findById(sagaId);
      if (!saga) {
        this.logger.warn('Saga not found for timeout handling', { sagaId });
        return;
      }

      // Update saga state to timed out
      await this.sagaRepository.updateState(
        sagaId,
        {
          status: SagaStatus.TIMED_OUT,
          updatedAt: new Date(),
          error: {
            message: 'Saga execution timed out',
            step: saga.state.currentStep,
            timestamp: new Date(),
          },
        },
        saga.state.version
      );

      // Trigger compensation for timed out saga
      await this.compensateSaga(sagaId, context);

      if (this.config.enableMetrics) {
        this.updateStatistics('sagaTimedOut', saga, 0);
      }

      this.logger.info('Saga timeout handled', {
        sagaId,
        sagaType: saga.sagaType,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle saga timeout',
        error instanceof Error ? error : undefined,
        {
          saga_id: sagaId,
          error_message: error instanceof Error ? error.message : String(error),
        }
      );
      throw error;
    }
  }

  /**
   * Register saga definition
   * @param definition - Saga definition to register
   */
  registerSagaDefinition(definition: ISagaDefinition): void {
    this.logger.info('Registering saga definition', {
      sagaType: definition.sagaType,
      displayName: definition.displayName,
      startEvents: definition.startEvents,
    });

    // Validate definition
    const validationErrors = definition.validate();
    if (validationErrors.length > 0) {
      this.logger.error('Invalid saga definition', undefined, {
        saga_type: definition.sagaType,
        validation_errors: validationErrors,
      });
      throw new SagaConfigurationError(
        definition.sagaType,
        'Invalid saga definition',
        validationErrors,
        {
          displayName: definition.displayName,
          startEvents: definition.startEvents,
          steps: definition.steps.length,
        }
      );
    }

    // Register definition
    this.sagaDefinitions.set(definition.sagaType, definition);

    // Update start event mappings
    for (const startEvent of definition.startEvents) {
      if (!this.startEventMappings.has(startEvent)) {
        this.startEventMappings.set(startEvent, new Set());
      }
      this.startEventMappings.get(startEvent)!.add(definition.sagaType);
    }

    this.logger.info('Saga definition registered successfully', {
      sagaType: definition.sagaType,
      totalDefinitions: this.sagaDefinitions.size,
    });
  }

  /**
   * Get registered saga definitions
   * @returns Array of registered saga definitions
   */
  getSagaDefinitions(): ISagaDefinition[] {
    return Array.from(this.sagaDefinitions.values());
  }

  /**
   * Get saga definition by type
   * @param sagaType - Type of saga definition
   * @returns Saga definition or null if not found
   */
  getSagaDefinition(sagaType: string): ISagaDefinition | null {
    return this.sagaDefinitions.get(sagaType) || null;
  }

  /**
   * Process timed out sagas
   * @param context - Execution context
   * @returns Number of sagas processed
   */
  async processTimedOutSagas(context: ISagaExecutionContext): Promise<number> {
    this.logger.debug('Processing timed out sagas');

    try {
      const timedOutSagas = await this.sagaRepository.findTimedOut();

      this.logger.debug('Found timed out sagas', { count: timedOutSagas.length });

      let processedCount = 0;
      for (const saga of timedOutSagas) {
        try {
          await this.handleTimeout(saga.sagaId, context);
          processedCount++;
        } catch (error) {
          this.logger.warn('Failed to handle timeout for saga', {
            sagaId: saga.sagaId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.logger.debug('Timed out sagas processed', {
        totalFound: timedOutSagas.length,
        processed: processedCount,
      });

      return processedCount;
    } catch (error) {
      this.logger.error(
        'Failed to process timed out sagas',
        error instanceof Error ? error : undefined,
        {
          error_message: error instanceof Error ? error.message : String(error),
        }
      );
      throw error;
    }
  }

  /**
   * Get saga orchestrator statistics
   * @returns Current orchestrator statistics
   */
  getStatistics(): ISagaOrchestratorStatistics {
    return { ...this.statistics };
  }

  /**
   * Find saga definitions that can handle a start event
   * @param eventType - Event type
   */
  private findSagaDefinitionsForEvent(eventType: string): ISagaDefinition[] {
    const sagaTypes = this.startEventMappings.get(eventType) || new Set();
    const definitions: ISagaDefinition[] = [];

    for (const sagaType of sagaTypes) {
      const definition = this.sagaDefinitions.get(sagaType);
      if (definition) {
        definitions.push(definition);
      }
    }

    return definitions;
  }

  /**
   * Find sagas that might be interested in an event
   * @param event - Domain event
   * @param context - Execution context
   */
  private async findSagasForEvent(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISaga[]> {
    // This is a simplified approach - in a real implementation,
    // we would use more sophisticated correlation logic

    const candidateSagas: ISaga[] = [];

    // First, try to find sagas by correlation
    const correlationData = { correlationId: context.correlationId };
    const correlatedSagas = await this.sagaRepository.findByCorrelation(correlationData);

    for (const saga of correlatedSagas) {
      if (saga.canHandle(event)) {
        candidateSagas.push(saga);
      }
    }

    return candidateSagas;
  }

  /**
   * Process event in a specific saga
   * @param saga - Saga instance
   * @param event - Domain event
   * @param context - Execution context
   */
  private async processSagaEvent(
    saga: ISaga,
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaProcessingResult> {
    const startTime = Date.now();

    try {
      const result = await saga.handleEvent(event, context);

      // Save updated saga state
      await this.sagaRepository.save(saga);

      const processingTime = Date.now() - startTime;

      const processResult: ISagaProcessingResult = {
        sagaId: saga.sagaId,
        sagaType: saga.sagaType,
        success: result.success,
        ...(result.error
          ? {
              error: {
                message: result.error.message,
                code: result.error.code,
                ...(result.error.details ? { details: result.error.details } : {}),
              },
            }
          : {}),
        commands: result.commands || [],
        events: result.events || [],
        sagaCompleted: result.completesSaga || false,
        requiresCompensation: result.requiresCompensation || false,
        metrics: {
          processingTimeMs: processingTime,
          stepExecuted: saga.state.currentStep,
          timestamp: new Date(),
        },
      };

      return processResult;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      return {
        sagaId: saga.sagaId,
        sagaType: saga.sagaType,
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'SAGA_PROCESSING_ERROR',
        },
        commands: [],
        events: [],
        sagaCompleted: false,
        requiresCompensation: true,
        metrics: {
          processingTimeMs: processingTime,
          stepExecuted: saga.state.currentStep,
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Check if event type can start a saga
   * @param eventType - Event type
   */
  private canStartSaga(eventType: string): boolean {
    return this.startEventMappings.has(eventType);
  }

  /**
   * Initialize statistics object
   */
  private initializeStatistics(): ISagaOrchestratorStatistics {
    return {
      activeSagas: 0,
      sagasByStatus: {},
      sagasByType: {},
      totalEventsProcessed: 0,
      eventsPerMinute: 0,
      averageCompletionTimeMs: 0,
      successRate: 0,
      compensatedSagas: 0,
      timedOutSagas: 0,
      systemLoad: {
        cpuUsage: 0,
        memoryUsage: 0,
        activeConnections: 0,
      },
      performance: {
        slowestOperationMs: 0,
        fastestOperationMs: 0,
        averageOperationMs: 0,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Update statistics based on operation
   * @param operation - Type of operation
   * @param saga - Saga instance (if applicable)
   * @param duration - Operation duration
   */
  private updateStatistics(operation: string, saga: ISaga | null, duration: number): void {
    if (!this.config.enableMetrics) return;

    // Update timestamp
    this.statistics.timestamp = new Date();

    // Update operation-specific statistics
    switch (operation) {
      case 'sagaStarted':
        this.statistics.activeSagas++;
        break;
      case 'sagaCompleted':
      case 'sagaCancelled':
      case 'sagaCompensated':
        this.statistics.activeSagas--;
        break;
      case 'eventProcessed':
        this.statistics.totalEventsProcessed++;
        break;
    }

    // Update performance metrics
    if (duration > 0) {
      if (
        this.statistics.performance.slowestOperationMs === 0 ||
        duration > this.statistics.performance.slowestOperationMs
      ) {
        this.statistics.performance.slowestOperationMs = duration;
      }
      if (
        this.statistics.performance.fastestOperationMs === 0 ||
        duration < this.statistics.performance.fastestOperationMs
      ) {
        this.statistics.performance.fastestOperationMs = duration;
      }

      // Simple running average (would use more sophisticated calculation in production)
      this.statistics.performance.averageOperationMs =
        (this.statistics.performance.averageOperationMs + duration) / 2;
    }
  }
}
