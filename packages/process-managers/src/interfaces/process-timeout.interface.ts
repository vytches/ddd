import type { IProcessManagerContext } from './process-manager-context.interface';

/**
 * Represents a timeout configuration for process managers
 */
export interface IProcessTimeout {
  timeoutId: string;
  processId: string;
  timeoutType: ProcessTimeoutType;
  scheduledAt: Date;
  expiresAt: Date;
  isActive: boolean;
  configuration: ProcessTimeoutConfiguration;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for process timeouts
 */
export interface ProcessTimeoutConfiguration {
  timeoutAfter: number; // milliseconds
  timeoutAction: ProcessTimeoutAction;
  retryPolicy?: ProcessRetryPolicy;
  escalationRules?: ProcessEscalationRule[];
  customData?: Record<string, unknown>;
}

/**
 * Types of timeouts that can be applied to processes
 */
export enum ProcessTimeoutType {
  STEP_TIMEOUT = 'STEP_TIMEOUT',
  PROCESS_TIMEOUT = 'PROCESS_TIMEOUT',
  ESCALATION_TIMEOUT = 'ESCALATION_TIMEOUT',
  CLEANUP_TIMEOUT = 'CLEANUP_TIMEOUT',
}

/**
 * Actions to take when a timeout expires
 */
export enum ProcessTimeoutAction {
  FAIL_PROCESS = 'FAIL_PROCESS',
  RETRY_STEP = 'RETRY_STEP',
  ESCALATE = 'ESCALATE',
  COMPENSATE = 'COMPENSATE',
  CUSTOM_ACTION = 'CUSTOM_ACTION',
}

/**
 * Retry policy for timeout handling
 */
export interface ProcessRetryPolicy {
  maxAttempts: number;
  backoffStrategy: TimeoutBackoffStrategy;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  retryCondition?: (error: Error) => boolean;
}

/**
 * Backoff strategies for retry policies
 */
export enum TimeoutBackoffStrategy {
  LINEAR = 'LINEAR',
  EXPONENTIAL = 'EXPONENTIAL',
  FIXED = 'FIXED',
}

/**
 * Escalation rule for timeout handling
 */
export interface ProcessEscalationRule {
  level: number;
  action: ProcessTimeoutAction;
  notificationTargets: string[];
  escalationDelay: number;
  condition?: (timeout: IProcessTimeout, context: IProcessManagerContext) => boolean;
  customHandler?: string; // Handler identifier for custom actions
}

/**
 * Result of timeout scheduling operation
 */
export interface TimeoutScheduleResult {
  success: boolean;
  timeoutId?: string;
  error?: string;
  scheduledFor?: Date;
}

/**
 * Timeout event data
 */
export interface ProcessTimeoutEvent {
  timeoutId: string;
  processId: string;
  timeoutType: ProcessTimeoutType;
  action: ProcessTimeoutAction;
  context: IProcessManagerContext;
  metadata?: Record<string, unknown>;
}

/**
 * Handler function type for timeout actions
 */
export type TimeoutHandler = (
  timeout: IProcessTimeout,
  context: IProcessManagerContext
) => Promise<TimeoutHandlerResult>;

/**
 * Result of timeout handler execution
 */
export interface TimeoutHandlerResult {
  success: boolean;
  shouldRetry?: boolean;
  escalate?: boolean;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Options for timeout management
 */
export interface ProcessTimeoutOptions {
  enableTimeouts?: boolean;
  defaultTimeoutAfter?: number;
  maxConcurrentTimeouts?: number;
  timeoutCleanupInterval?: number;
  enableMetrics?: boolean;
}

/**
 * Timeout metrics for monitoring
 */
export interface ProcessTimeoutMetrics {
  totalTimeouts: number;
  activeTimeouts: number;
  expiredTimeouts: number;
  cancelledTimeouts: number;
  retriedTimeouts: number;
  escalatedTimeouts: number;
  averageTimeoutDuration: number;
  timeoutsByType: Record<ProcessTimeoutType, number>;
  timeoutsByAction: Record<ProcessTimeoutAction, number>;
}
