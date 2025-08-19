import { Logger } from '@vytches/ddd-logging';
import { Result } from '@vytches/ddd-utils';
import {
  ProcessTimeoutAction,
  TimeoutBackoffStrategy,
} from '../interfaces/process-timeout.interface';
import type {
  IProcessTimeout,
  ProcessTimeoutConfiguration,
  TimeoutHandler,
  TimeoutHandlerResult,
  ProcessTimeoutOptions,
  ProcessTimeoutMetrics,
  TimeoutScheduleResult,
  ProcessTimeoutEvent,
  ProcessRetryPolicy,
  ProcessTimeoutType,
} from '../interfaces/process-timeout.interface';
import type { IProcessManagerContext } from '../interfaces/process-manager-context.interface';

/**
 * Error thrown when timeout operations fail
 */
export class ProcessTimeoutError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ProcessTimeoutError';
  }
}

/**
 * Manages timeouts for process managers with enterprise-grade capabilities
 */
export class ProcessTimeoutManager {
  private readonly logger = Logger.forContext('ProcessTimeoutManager');
  private readonly activeTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly timeoutRegistry = new Map<string, IProcessTimeout>();
  private readonly timeoutHandlers = new Map<ProcessTimeoutAction, TimeoutHandler>();
  private readonly retryAttempts = new Map<string, number>();
  private readonly metrics: ProcessTimeoutMetrics = {
    totalTimeouts: 0,
    activeTimeouts: 0,
    expiredTimeouts: 0,
    cancelledTimeouts: 0,
    retriedTimeouts: 0,
    escalatedTimeouts: 0,
    averageTimeoutDuration: 0,
    timeoutsByType: {} as Record<ProcessTimeoutType, number>,
    timeoutsByAction: {} as Record<ProcessTimeoutAction, number>,
  };

  private cleanupInterval?: NodeJS.Timeout;

  constructor(private readonly options: ProcessTimeoutOptions = {}) {
    this.options = {
      enableTimeouts: true,
      defaultTimeoutAfter: 30000, // 30 seconds
      maxConcurrentTimeouts: 1000,
      timeoutCleanupInterval: 60000, // 1 minute
      enableMetrics: true,
      ...options,
    };

    this.registerDefaultHandlers();
    this.startCleanupInterval();

    this.logger.info('ProcessTimeoutManager initialized', {
      options: this.options,
    });
  }

  /**
   * Schedule a timeout for a process
   */
  scheduleTimeout(
    processId: string,
    timeoutType: ProcessTimeoutType,
    configuration: ProcessTimeoutConfiguration,
    context: IProcessManagerContext
  ): Result<IProcessTimeout, ProcessTimeoutError> {
    try {
      if (!this.options.enableTimeouts) {
        return Result.fail(new ProcessTimeoutError('Timeouts are disabled', 'TIMEOUTS_DISABLED'));
      }

      if (this.activeTimeouts.size >= (this.options.maxConcurrentTimeouts || 1000)) {
        return Result.fail(
          new ProcessTimeoutError('Maximum concurrent timeouts reached', 'MAX_TIMEOUTS_EXCEEDED', {
            currentCount: this.activeTimeouts.size,
            limit: this.options.maxConcurrentTimeouts,
          })
        );
      }

      const timeoutId = this.generateTimeoutId(processId, timeoutType);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + configuration.timeoutAfter);

      const timeout: IProcessTimeout = {
        timeoutId,
        processId,
        timeoutType,
        scheduledAt: now,
        expiresAt,
        isActive: true,
        configuration,
        metadata: {
          scheduledBy: context.userId,
          correlationId: context.correlationId,
          sessionId: context.sessionId,
        },
      };

      // Schedule the timeout
      const timer = setTimeout(async () => {
        await this.handleTimeoutExpiration(timeout, context);
      }, configuration.timeoutAfter);

      this.activeTimeouts.set(timeoutId, timer);
      this.timeoutRegistry.set(timeoutId, timeout);
      this.retryAttempts.set(timeoutId, 0);

      // Update metrics
      this.updateMetrics('scheduled', timeoutType, configuration.timeoutAction);

      this.logger.info('Timeout scheduled', {
        timeoutId,
        processId,
        timeoutType,
        expiresAt: expiresAt.toISOString(),
        timeoutAfter: configuration.timeoutAfter,
      });

      return Result.ok(timeout);
    } catch (error) {
      const err = new ProcessTimeoutError(
        `Failed to schedule timeout: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SCHEDULE_TIMEOUT_FAILED',
        { error, processId, timeoutType }
      );

      this.logger.error('Failed to schedule timeout', err, {
        processId,
        timeoutType,
        configuration,
      });

      return Result.fail(err);
    }
  }

  /**
   * Cancel an active timeout
   */
  cancelTimeout(timeoutId: string): Result<void, ProcessTimeoutError> {
    try {
      const timer = this.activeTimeouts.get(timeoutId);
      const timeout = this.timeoutRegistry.get(timeoutId);

      if (!timer || !timeout) {
        return Result.fail(
          new ProcessTimeoutError('Timeout not found or already expired', 'TIMEOUT_NOT_FOUND', {
            timeoutId,
          })
        );
      }

      clearTimeout(timer);
      this.activeTimeouts.delete(timeoutId);

      // Mark as inactive but keep in registry for auditing
      timeout.isActive = false;
      this.retryAttempts.delete(timeoutId);

      // Update metrics
      this.updateMetrics('cancelled', timeout.timeoutType, timeout.configuration.timeoutAction);

      this.logger.info('Timeout cancelled', {
        timeoutId,
        processId: timeout.processId,
        timeoutType: timeout.timeoutType,
      });

      return Result.ok(undefined);
    } catch (error) {
      const err = new ProcessTimeoutError(
        `Failed to cancel timeout: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CANCEL_TIMEOUT_FAILED',
        { error, timeoutId }
      );

      this.logger.error('Failed to cancel timeout', err, { timeoutId });
      return Result.fail(err);
    }
  }

  /**
   * Cancel all timeouts for a specific process
   */
  cancelProcessTimeouts(processId: string): Result<number, ProcessTimeoutError> {
    try {
      let cancelledCount = 0;

      for (const [timeoutId, timeout] of this.timeoutRegistry.entries()) {
        if (timeout.processId === processId && timeout.isActive) {
          const result = this.cancelTimeout(timeoutId);
          if (result.isSuccess) {
            cancelledCount++;
          }
        }
      }

      this.logger.info('Process timeouts cancelled', {
        processId,
        cancelledCount,
      });

      return Result.ok(cancelledCount);
    } catch (error) {
      const err = new ProcessTimeoutError(
        `Failed to cancel process timeouts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CANCEL_PROCESS_TIMEOUTS_FAILED',
        { error, processId }
      );

      this.logger.error('Failed to cancel process timeouts', err, { processId });
      return Result.fail(err);
    }
  }

  /**
   * Handle timeout expiration
   */
  private async handleTimeoutExpiration(
    timeout: IProcessTimeout,
    context: IProcessManagerContext
  ): Promise<void> {
    try {
      this.logger.warn('Timeout expired', {
        timeoutId: timeout.timeoutId,
        processId: timeout.processId,
        timeoutType: timeout.timeoutType,
        action: timeout.configuration.timeoutAction,
      });

      // Remove from active timeouts
      this.activeTimeouts.delete(timeout.timeoutId);
      timeout.isActive = false;

      // Update metrics
      this.updateMetrics('expired', timeout.timeoutType, timeout.configuration.timeoutAction);

      // Check if retry is configured and attempts remain
      if (await this.shouldRetry(timeout)) {
        await this.handleRetry(timeout, context);
        return;
      }

      // Execute timeout action
      const handler = this.timeoutHandlers.get(timeout.configuration.timeoutAction);
      if (handler) {
        const result = await handler(timeout, context);

        if (result.escalate && timeout.configuration.escalationRules) {
          await this.handleEscalation(timeout, context);
        }
      } else {
        this.logger.error('No handler found for timeout action', new Error('No handler found'), {
          timeoutId: timeout.timeoutId,
          action: timeout.configuration.timeoutAction,
        } as Record<string, unknown>);
      }

      // Emit timeout event
      await this.emitTimeoutEvent(timeout, context);
    } catch (error) {
      this.logger.error(
        'Error handling timeout expiration',
        error as Error,
        {
          timeoutId: timeout.timeoutId,
          processId: timeout.processId,
        } as Record<string, unknown>
      );
    }
  }

  /**
   * Register custom timeout handler
   */
  registerTimeoutHandler(action: ProcessTimeoutAction, handler: TimeoutHandler): void {
    this.timeoutHandlers.set(action, handler);

    this.logger.info('Timeout handler registered', {
      action,
      handlerName: handler.name || 'anonymous',
    });
  }

  /**
   * Get all active timeouts for a process
   */
  getActiveTimeouts(processId: string): IProcessTimeout[] {
    return Array.from(this.timeoutRegistry.values()).filter(
      timeout => timeout.processId === processId && timeout.isActive
    );
  }

  /**
   * Get timeout by ID
   */
  getTimeout(timeoutId: string): IProcessTimeout | undefined {
    return this.timeoutRegistry.get(timeoutId);
  }

  /**
   * Get timeout metrics
   */
  getMetrics(): ProcessTimeoutMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all timeouts and cleanup
   */
  destroy(): void {
    // Cancel all active timeouts
    for (const timer of this.activeTimeouts.values()) {
      clearTimeout(timer);
    }

    this.activeTimeouts.clear();
    this.timeoutRegistry.clear();
    this.retryAttempts.clear();

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.logger.info('ProcessTimeoutManager destroyed');
  }

  /**
   * Register default timeout handlers
   */
  private registerDefaultHandlers(): void {
    // Fail process handler
    this.timeoutHandlers.set(
      ProcessTimeoutAction.FAIL_PROCESS,
      async (
        timeout: IProcessTimeout,
        context: IProcessManagerContext
      ): Promise<TimeoutHandlerResult> => {
        this.logger.error('Process failed due to timeout', new Error('Process timeout'), {
          timeoutId: timeout.timeoutId,
          processId: timeout.processId,
          timeoutType: timeout.timeoutType,
        } as Record<string, unknown>);

        return {
          success: true,
          shouldRetry: false,
          escalate: false,
        };
      }
    );

    // Retry step handler
    this.timeoutHandlers.set(
      ProcessTimeoutAction.RETRY_STEP,
      async (
        timeout: IProcessTimeout,
        context: IProcessManagerContext
      ): Promise<TimeoutHandlerResult> => {
        this.logger.info('Retrying step due to timeout', {
          timeoutId: timeout.timeoutId,
          processId: timeout.processId,
        });

        return {
          success: true,
          shouldRetry: true,
          escalate: false,
        };
      }
    );

    // Escalate handler
    this.timeoutHandlers.set(
      ProcessTimeoutAction.ESCALATE,
      async (
        timeout: IProcessTimeout,
        context: IProcessManagerContext
      ): Promise<TimeoutHandlerResult> => {
        this.logger.warn('Escalating timeout', {
          timeoutId: timeout.timeoutId,
          processId: timeout.processId,
        });

        return {
          success: true,
          shouldRetry: false,
          escalate: true,
        };
      }
    );
  }

  /**
   * Check if timeout should be retried
   */
  private async shouldRetry(timeout: IProcessTimeout): Promise<boolean> {
    const retryPolicy = timeout.configuration.retryPolicy;
    if (!retryPolicy) {
      return false;
    }

    const currentAttempts = this.retryAttempts.get(timeout.timeoutId) || 0;
    return currentAttempts < retryPolicy.maxAttempts;
  }

  /**
   * Handle timeout retry
   */
  private async handleRetry(
    timeout: IProcessTimeout,
    context: IProcessManagerContext
  ): Promise<void> {
    const retryPolicy = timeout.configuration.retryPolicy!;
    const currentAttempts = this.retryAttempts.get(timeout.timeoutId) || 0;
    const nextAttempt = currentAttempts + 1;

    this.retryAttempts.set(timeout.timeoutId, nextAttempt);

    // Calculate delay
    const delay = this.calculateRetryDelay(retryPolicy, nextAttempt);

    this.logger.info('Scheduling timeout retry', {
      timeoutId: timeout.timeoutId,
      attempt: nextAttempt,
      maxAttempts: retryPolicy.maxAttempts,
      delay,
    });

    // Schedule retry
    const retryTimer = setTimeout(async () => {
      await this.handleTimeoutExpiration(timeout, context);
    }, delay);

    this.activeTimeouts.set(timeout.timeoutId, retryTimer);
    timeout.isActive = true;

    // Update metrics
    this.updateMetrics('retried', timeout.timeoutType, timeout.configuration.timeoutAction);
  }

  /**
   * Calculate retry delay based on backoff strategy
   */
  private calculateRetryDelay(retryPolicy: ProcessRetryPolicy, attempt: number): number {
    let delay: number;

    switch (retryPolicy.backoffStrategy) {
      case TimeoutBackoffStrategy.LINEAR:
        delay = retryPolicy.baseDelay * attempt;
        break;

      case TimeoutBackoffStrategy.EXPONENTIAL:
        delay = retryPolicy.baseDelay * Math.pow(2, attempt - 1);
        break;

      case TimeoutBackoffStrategy.FIXED:
      default:
        delay = retryPolicy.baseDelay;
        break;
    }

    // Apply jitter if configured
    if (retryPolicy.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }

    // Ensure delay doesn't exceed max
    return Math.min(delay, retryPolicy.maxDelay);
  }

  /**
   * Handle escalation
   */
  private async handleEscalation(
    timeout: IProcessTimeout,
    context: IProcessManagerContext
  ): Promise<void> {
    const escalationRules = timeout.configuration.escalationRules;
    if (!escalationRules || escalationRules.length === 0) {
      return;
    }

    for (const rule of escalationRules) {
      if (rule.condition && !rule.condition(timeout, context)) {
        continue;
      }

      this.logger.warn('Escalating timeout to level', {
        timeoutId: timeout.timeoutId,
        escalationLevel: rule.level,
        targets: rule.notificationTargets,
      });

      // Schedule escalation action
      setTimeout(async () => {
        const handler = this.timeoutHandlers.get(rule.action);
        if (handler) {
          await handler(timeout, context);
        }
      }, rule.escalationDelay);

      // Update metrics
      this.updateMetrics('escalated', timeout.timeoutType, timeout.configuration.timeoutAction);
    }
  }

  /**
   * Emit timeout event
   */
  private async emitTimeoutEvent(
    timeout: IProcessTimeout,
    context: IProcessManagerContext
  ): Promise<void> {
    const event: ProcessTimeoutEvent = {
      timeoutId: timeout.timeoutId,
      processId: timeout.processId,
      timeoutType: timeout.timeoutType,
      action: timeout.configuration.timeoutAction,
      context,
    };

    if (timeout.metadata) {
      event.metadata = timeout.metadata;
    }

    // In a real implementation, this would emit an event through the event bus
    this.logger.info('Timeout event emitted', {
      timeoutId: event.timeoutId,
      processId: event.processId,
      timeoutType: event.timeoutType,
      action: event.action,
    });
  }

  /**
   * Generate unique timeout ID
   */
  private generateTimeoutId(processId: string, timeoutType: ProcessTimeoutType): string {
    return `timeout_${processId}_${timeoutType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update metrics
   */
  private updateMetrics(
    operation: 'scheduled' | 'expired' | 'cancelled' | 'retried' | 'escalated',
    timeoutType: ProcessTimeoutType,
    action: ProcessTimeoutAction
  ): void {
    if (!this.options.enableMetrics) {
      return;
    }

    switch (operation) {
      case 'scheduled':
        this.metrics.totalTimeouts++;
        this.metrics.activeTimeouts++;
        break;
      case 'expired':
        this.metrics.expiredTimeouts++;
        this.metrics.activeTimeouts = Math.max(0, this.metrics.activeTimeouts - 1);
        break;
      case 'cancelled':
        this.metrics.cancelledTimeouts++;
        this.metrics.activeTimeouts = Math.max(0, this.metrics.activeTimeouts - 1);
        break;
      case 'retried':
        this.metrics.retriedTimeouts++;
        break;
      case 'escalated':
        this.metrics.escalatedTimeouts++;
        break;
    }

    // Update type and action counters
    this.metrics.timeoutsByType[timeoutType] = (this.metrics.timeoutsByType[timeoutType] || 0) + 1;
    this.metrics.timeoutsByAction[action] = (this.metrics.timeoutsByAction[action] || 0) + 1;
  }

  /**
   * Start cleanup interval for expired timeouts
   */
  private startCleanupInterval(): void {
    if (!this.options.timeoutCleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTimeouts();
    }, this.options.timeoutCleanupInterval);
  }

  /**
   * Cleanup expired timeouts from registry
   */
  private cleanupExpiredTimeouts(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [timeoutId, timeout] of this.timeoutRegistry.entries()) {
      // Remove expired and inactive timeouts older than 1 hour
      if (!timeout.isActive && now.getTime() - timeout.expiresAt.getTime() > 3600000) {
        this.timeoutRegistry.delete(timeoutId);
        this.retryAttempts.delete(timeoutId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug('Cleaned up expired timeouts', {
        cleanedCount,
        remainingTimeouts: this.timeoutRegistry.size,
      });
    }
  }
}
