/**
 * @fileoverview Shared Resilience Utilities
 * @version 1.0.0
 * @package @vytches-ddd/resilience
 * @description Shared utilities, constants, and helper functions for resilience examples.
 */

/**
 * Common resilience configuration constants
 */
export const RESILIENCE_CONSTANTS = {
  // Circuit Breaker defaults
  CIRCUIT_BREAKER: {
    DEFAULT_FAILURE_THRESHOLD: 5,
    DEFAULT_RESET_TIMEOUT: 30000,
    DEFAULT_HALF_OPEN_MAX_CALLS: 3,
    DEFAULT_MONITORING_WINDOW: 120000,
  },

  // Retry defaults
  RETRY: {
    DEFAULT_MAX_ATTEMPTS: 3,
    DEFAULT_BASE_DELAY: 1000,
    DEFAULT_MAX_DELAY: 10000,
    DEFAULT_BACKOFF: 'exponential' as const,
    DEFAULT_JITTER: true,
  },

  // Timeout defaults
  TIMEOUT: {
    DEFAULT_TIMEOUT: 5000,
    FAST_OPERATION_TIMEOUT: 2000,
    SLOW_OPERATION_TIMEOUT: 30000,
    DEFAULT_STRATEGY: 'graceful' as const,
  },

  // Bulkhead defaults
  BULKHEAD: {
    DEFAULT_MAX_CONCURRENCY: 10,
    DEFAULT_QUEUE_SIZE: 50,
    DEFAULT_QUEUE_TIMEOUT: 30000,
    DEFAULT_REJECTION_STRATEGY: 'fail' as const,
  },

  // Health monitoring
  HEALTH: {
    HEALTHY_THRESHOLD: 0.8,
    DEGRADED_THRESHOLD: 0.6,
    UNHEALTHY_THRESHOLD: 0.3,
    CHECK_INTERVAL: 30000,
  },
};

/**
 * Common error types for resilience patterns
 */
export const RESILIENCE_ERRORS = {
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
  RETRY_EXHAUSTED: 'RETRY_EXHAUSTED',
  TIMEOUT_EXCEEDED: 'TIMEOUT_EXCEEDED',
  BULKHEAD_REJECTED: 'BULKHEAD_REJECTED',
  RESOURCE_EXHAUSTED: 'RESOURCE_EXHAUSTED',
  CONFIGURATION_INVALID: 'CONFIGURATION_INVALID',
};

/**
 * Resilience pattern types
 */
export type ResiliencePatternType =
  | 'circuit-breaker'
  | 'retry'
  | 'timeout'
  | 'bulkhead'
  | 'composite';

/**
 * Service health status
 */
export interface ServiceHealthStatus {
  serviceId: string;
  healthScore: number;
  responseTime: number;
  errorRate: number;
  successRate: number;
  lastCheck: Date;
  isHealthy: boolean;
}

/**
 * Resilience execution context
 */
export interface ResilienceExecutionContext {
  operationId: string;
  correlationId: string;
  startTime: Date;
  attempt: number;
  previousAttempts: Array<{
    attempt: number;
    error?: Error;
    duration: number;
    timestamp: Date;
  }>;
  metadata?: Record<string, any>;
}

/**
 * Resilience metrics interface
 */
export interface ResilienceMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  errorRate: number;
  lastExecutionTime?: Date;
  circuitBreakerState?: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  retryAttempts?: number;
  timeoutOccurrences?: number;
  bulkheadRejections?: number;
}

/**
 * Helper function to create standardized execution context
 */
export function createExecutionContext(
  operationId: string,
  correlationId: string,
  metadata?: Record<string, any>
): ResilienceExecutionContext {
  return {
    operationId,
    correlationId,
    startTime: new Date(),
    attempt: 1,
    previousAttempts: [],
    metadata: metadata || {},
  };
}

/**
 * Helper function to calculate health score from metrics
 */
export function calculateHealthScore(
  successfulRequests: number,
  failedRequests: number,
  averageResponseTime: number,
  errorRate: number
): number {
  const totalRequests = successfulRequests + failedRequests;
  if (totalRequests === 0) return 1.0;

  const successRate = successfulRequests / totalRequests;
  const responseTimeFactor = Math.max(0, 1 - averageResponseTime / 10000); // 10s baseline
  const errorRateFactor = 1 - errorRate;

  // Weighted calculation
  return successRate * 0.5 + responseTimeFactor * 0.3 + errorRateFactor * 0.2;
}

/**
 * Helper function to determine if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const retryableConditions = [
    'ECONNRESET', // Connection reset
    'ECONNREFUSED', // Connection refused
    'ETIMEDOUT', // Connection timeout
    'ENOTFOUND', // DNS resolution failed
    'socket hang up', // Socket closed unexpectedly
    '502', // Bad Gateway
    '503', // Service Unavailable
    '504', // Gateway Timeout
    'TIMEOUT', // Generic timeout
    'CONNECTION_RESET', // Connection reset
    'SERVICE_BUSY', // Service busy
    'RATE_LIMITED', // Rate limiting
    'TEMPORARY_UNAVAILABLE', // Temporary unavailability
  ];

  return retryableConditions.some(condition => error.message.includes(condition));
}

/**
 * Helper function to classify failure types
 */
export function classifyFailure(error: Error): string {
  if (error.message.includes('CIRCUIT_BREAKER_OPEN')) return 'Circuit Breaker';
  if (error.message.includes('TIMEOUT')) return 'Timeout';
  if (error.message.includes('BULKHEAD_REJECTED')) return 'Resource Exhaustion';
  if (error.message.includes('RETRY_EXHAUSTED')) return 'Persistent Failure';
  if (error.message.includes('ECONNRESET')) return 'Network Error';
  if (error.message.includes('ECONNREFUSED')) return 'Connection Refused';
  if (error.message.includes('503')) return 'Service Unavailable';
  return 'Unknown';
}

/**
 * Helper function to generate resilience policy recommendations
 */
export function generateResilienceRecommendations(
  metrics: ResilienceMetrics,
  healthStatus: ServiceHealthStatus
): {
  pattern: ResiliencePatternType;
  configuration: Record<string, any>;
  reasoning: string;
}[] {
  const recommendations = [];

  // Circuit Breaker recommendations
  if (metrics.errorRate > 0.1) {
    // > 10% error rate
    recommendations.push({
      pattern: 'circuit-breaker' as ResiliencePatternType,
      configuration: {
        failureThreshold: Math.max(3, Math.floor(10 * (1 - metrics.errorRate))),
        resetTimeout: healthStatus.healthScore < 0.5 ? 60000 : 30000,
      },
      reasoning: `High error rate (${(metrics.errorRate * 100).toFixed(1)}%) requires circuit breaker protection`,
    });
  }

  // Retry recommendations
  if (metrics.failedExecutions > 0 && healthStatus.healthScore > 0.3) {
    recommendations.push({
      pattern: 'retry' as ResiliencePatternType,
      configuration: {
        maxAttempts: healthStatus.healthScore > 0.7 ? 3 : 2,
        baseDelay: healthStatus.responseTime > 2000 ? 2000 : 1000,
        backoff: 'exponential',
      },
      reasoning: 'Failed executions with reasonable health score suggest transient failures',
    });
  }

  // Timeout recommendations
  if (healthStatus.responseTime > 5000) {
    // > 5 seconds
    recommendations.push({
      pattern: 'timeout' as ResiliencePatternType,
      configuration: {
        defaultTimeout: Math.min(healthStatus.responseTime * 1.5, 30000),
        strategy: healthStatus.healthScore < 0.5 ? 'abort' : 'graceful',
      },
      reasoning: `High response time (${healthStatus.responseTime}ms) requires timeout protection`,
    });
  }

  return recommendations;
}

/**
 * Helper function to create mock service health data for testing
 */
export function createMockServiceHealth(serviceId: string, healthScore = 0.8): ServiceHealthStatus {
  const errorRate = Math.max(0, 1 - healthScore);
  const responseTime = Math.floor((1 - healthScore) * 5000 + 200); // 200ms to 5200ms

  return {
    serviceId,
    healthScore,
    responseTime,
    errorRate,
    successRate: 1 - errorRate,
    lastCheck: new Date(),
    isHealthy: healthScore > RESILIENCE_CONSTANTS.HEALTH.HEALTHY_THRESHOLD,
  };
}

/**
 * Helper function for exponential backoff calculation
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitter = true
): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  if (jitter) {
    // Add ±25% jitter
    const jitterRange = cappedDelay * 0.25;
    const jitterOffset = (Math.random() * 2 - 1) * jitterRange;
    return Math.max(0, cappedDelay + jitterOffset);
  }

  return cappedDelay;
}

/**
 * Helper function to format resilience metrics for display
 */
export function formatResilienceMetrics(metrics: ResilienceMetrics): {
  successRate: string;
  errorRate: string;
  avgResponseTime: string;
  totalExecutions: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
} {
  const successRate =
    metrics.totalExecutions > 0
      ? (metrics.successfulExecutions / metrics.totalExecutions) * 100
      : 0;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (metrics.errorRate > 0.3) status = 'unhealthy';
  else if (metrics.errorRate > 0.1) status = 'degraded';

  return {
    successRate: `${successRate.toFixed(1)}%`,
    errorRate: `${(metrics.errorRate * 100).toFixed(1)}%`,
    avgResponseTime: `${metrics.averageExecutionTime.toFixed(0)}ms`,
    totalExecutions: metrics.totalExecutions,
    status,
  };
}

/**
 * Common resilience testing utilities
 */
export const ResilienceTestUtils = {
  /**
   * Create a function that fails intermittently for testing
   */
  createFlakeyFunction: (failureRate = 0.3, delay = 100) => {
    return async () => {
      await new Promise(resolve => setTimeout(resolve, delay));
      if (Math.random() < failureRate) {
        throw new Error('Simulated service failure');
      }
      return { success: true, timestamp: new Date() };
    };
  },

  /**
   * Create a function that times out for testing
   */
  createSlowFunction: (delay = 10000) => {
    return async () => {
      await new Promise(resolve => setTimeout(resolve, delay));
      return { success: true, timestamp: new Date() };
    };
  },

  /**
   * Create a function that fails consistently for testing
   */
  createFailingFunction: (errorMessage = 'Service unavailable') => {
    return async () => {
      throw new Error(errorMessage);
    };
  },
};

export default {
  RESILIENCE_CONSTANTS,
  RESILIENCE_ERRORS,
  createExecutionContext,
  calculateHealthScore,
  isRetryableError,
  classifyFailure,
  generateResilienceRecommendations,
  createMockServiceHealth,
  calculateBackoffDelay,
  formatResilienceMetrics,
  ResilienceTestUtils,
};
