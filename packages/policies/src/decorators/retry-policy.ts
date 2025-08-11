import { Result } from '@vytches/ddd-utils';
import type {
  IBusinessPolicy,
  IPolicyComposer,
  IPolicyConditionalBuilder,
  PolicyCondition,
  PolicyRequest,
} from '../core/interfaces/business-policy.interface';
import { PolicyViolation } from '../core/models/policy-violation';

export interface PolicyRetryConfig {
  /**
   * Maximum number of retry attempts for policy evaluation
   */
  maxAttempts: number;

  /**
   * Base delay between retries in milliseconds
   */
  baseDelay: number;

  /**
   * Maximum delay between retries in milliseconds
   */
  maxDelay?: number;

  /**
   * Backoff strategy for retry delays
   */
  backoff?: 'linear' | 'exponential' | 'fixed';

  /**
   * Backoff multiplier for exponential strategy
   */
  backoffMultiplier?: number;

  /**
   * Whether to add random jitter to delays
   */
  jitter?: boolean;

  /**
   * Function to determine if a policy violation should trigger retry
   * Business logic specific - e.g., retry on transient failures, not validation errors
   */
  shouldRetry?: (violation: PolicyViolation) => boolean;

  /**
   * Function to determine if an exception should trigger retry
   */
  shouldRetryOnException?: (error: Error) => boolean;

  /**
   * Whether to enable retry metrics collection
   */
  enableMetrics?: boolean;

  /**
   * Custom context modifier for retries (e.g., add retry attempt info)
   */
  contextModifier?: <U>(request: PolicyRequest<U>, attempt: number) => PolicyRequest<U>;
}

export interface RetryAttempt {
  attempt: number;
  delay?: number;
  timestamp: Date;
  error?: PolicyViolation | Error;
}

export interface RetryMetrics {
  totalAttempts: number;
  successfulEvaluations: number;
  failedEvaluations: number;
  retriedEvaluations: number;
  averageAttempts: number;
  maxAttemptsReached: number;
}

export class PolicyRetryBehavior<T> implements IBusinessPolicy<T> {
  private readonly metrics: RetryMetrics = {
    totalAttempts: 0,
    successfulEvaluations: 0,
    failedEvaluations: 0,
    retriedEvaluations: 0,
    averageAttempts: 0,
    maxAttemptsReached: 0,
  };

  public readonly id: string;
  public readonly domain: string;
  public readonly name: string;

  constructor(
    private readonly innerPolicy: IBusinessPolicy<T>,
    private readonly config: PolicyRetryConfig
  ) {
    this.id = `policy_retry_${innerPolicy.id}`;
    this.domain = innerPolicy.domain;
    this.name = `Policy Retry ${innerPolicy.name}`;
  }

  /**
   * Check policy with retry logic
   */
  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    const attempts: RetryAttempt[] = [];
    let lastResult: Result<T, PolicyViolation> | null = null;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      this.metrics.totalAttempts++;

      try {
        // Modify context if needed
        const modifiedRequest = this.config.contextModifier
          ? (this.config.contextModifier(request, attempt) as PolicyRequest<T>)
          : request;

        // Execute policy
        const result = await this.innerPolicy.check(modifiedRequest);
        lastResult = result;

        if (result.isSuccess) {
          this.metrics.successfulEvaluations++;
          if (attempt > 1) {
            this.metrics.retriedEvaluations++;
          }
          this.updateAverageAttempts();
          return result;
        }

        // Check if we should retry this violation
        if (!this.shouldRetryViolation(result.error) || attempt === this.config.maxAttempts) {
          attempts.push({
            attempt,
            timestamp: new Date(),
            delay: 0,
            error: result.error,
          });
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt);
        attempts.push({
          attempt,
          delay,
          timestamp: new Date(),
          error: result.error,
        });

        // Wait before retry
        if (attempt < this.config.maxAttempts) {
          await this.sleep(delay);
        }
      } catch (error) {
        const policyError = error instanceof Error ? error : new Error(String(error));

        if (!this.shouldRetryException(policyError) || attempt === this.config.maxAttempts) {
          attempts.push({
            attempt,
            timestamp: new Date(),
            delay: 0,
            error: policyError,
          });

          // Convert exception to policy violation
          const violation = new PolicyViolation({
            code: 'POLICY_EXECUTION_ERROR',
            message: `Policy execution failed: ${policyError.message}`,
            severity: 'ERROR',
            policyId: this.innerPolicy.id,
            domain: this.innerPolicy.domain,
            details: {
              originalError: policyError,
              attempts: attempts.length,
              retryConfig: this.config,
            },
          });

          lastResult = Result.fail(violation);
          break;
        }

        const delay = this.calculateDelay(attempt);
        attempts.push({
          attempt,
          delay,
          timestamp: new Date(),
          error: policyError,
        });

        if (attempt < this.config.maxAttempts) {
          await this.sleep(delay);
        }
      }
    }

    // All attempts failed
    this.metrics.failedEvaluations++;
    if (attempts.length >= this.config.maxAttempts) {
      this.metrics.maxAttemptsReached++;
    }
    this.updateAverageAttempts();

    // Enhance final violation with retry information
    if (lastResult && lastResult.isFailure) {
      const enhancedViolation = new PolicyViolation({
        code: lastResult.error.code,
        message: `${lastResult.error.message} (after ${attempts.length} attempts)`,
        severity: lastResult.error.severity,
        ...(lastResult.error.field && { field: lastResult.error.field }),
        policyId: this.innerPolicy.id,
        domain: this.innerPolicy.domain,
        details: {
          ...lastResult.error.details,
          retryAttempts: attempts,
          totalAttempts: attempts.length,
          retryConfig: this.config,
        },
      });

      return Result.fail(enhancedViolation);
    }

    // Fallback violation if no result
    const fallbackViolation = new PolicyViolation({
      code: 'RETRY_EXHAUSTED',
      message: `Policy retry exhausted after ${attempts.length} attempts`,
      severity: 'ERROR',
      policyId: this.innerPolicy.id,
      domain: this.innerPolicy.domain,
      details: { attempts, retryConfig: this.config },
    });

    return Result.fail(fallbackViolation);
  }

  /**
   * Determine if violation should trigger retry
   */
  private shouldRetryViolation(violation: PolicyViolation): boolean {
    if (this.config.shouldRetry) {
      return this.config.shouldRetry(violation);
    }

    // Default: don't retry ERROR violations (they're typically validation errors)
    // Only retry warnings or specific transient error codes
    return (
      violation.severity === 'WARNING' ||
      violation.code.includes('TIMEOUT') ||
      violation.code.includes('UNAVAILABLE') ||
      violation.code.includes('TRANSIENT')
    );
  }

  /**
   * Determine if exception should trigger retry
   */
  private shouldRetryException(error: Error): boolean {
    if (this.config.shouldRetryOnException) {
      return this.config.shouldRetryOnException(error);
    }

    // Default: retry on network/timeout errors, not on logic errors
    const retryableErrors = ['TIMEOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];

    return retryableErrors.some(
      pattern => error.message.includes(pattern) || error.name.includes(pattern)
    );
  }

  /**
   * Calculate delay for retry attempt
   */
  private calculateDelay(attempt: number): number {
    let delay: number;

    switch (this.config.backoff || 'exponential') {
      case 'linear':
        delay = this.config.baseDelay * attempt;
        break;
      case 'exponential':
        // eslint-disable-next-line no-case-declarations
        const multiplier = this.config.backoffMultiplier || 2;
        delay = this.config.baseDelay * Math.pow(multiplier, attempt - 1);
        break;
      case 'fixed':
      default:
        delay = this.config.baseDelay;
        break;
    }

    // Apply max delay limit
    if (this.config.maxDelay) {
      delay = Math.min(delay, this.config.maxDelay);
    }

    // Add jitter if enabled
    if (this.config.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }

    return Math.max(0, Math.floor(delay));
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update average attempts metric
   */
  private updateAverageAttempts(): void {
    const totalEvaluations = this.metrics.successfulEvaluations + this.metrics.failedEvaluations;
    if (totalEvaluations > 0) {
      this.metrics.averageAttempts = this.metrics.totalAttempts / totalEvaluations;
    }
  }

  /**
   * Get retry metrics
   */
  public getRetryMetrics(): RetryMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset retry metrics
   */
  public resetMetrics(): void {
    Object.assign(this.metrics, {
      totalAttempts: 0,
      successfulEvaluations: 0,
      failedEvaluations: 0,
      retriedEvaluations: 0,
      averageAttempts: 0,
      maxAttemptsReached: 0,
    });
  }

  // Implement IBusinessPolicy interface

  public and(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return this.innerPolicy.and(other);
  }

  public or(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return this.innerPolicy.or(other);
  }

  public not(): IBusinessPolicy<T> {
    return new PolicyRetryBehavior(this.innerPolicy.not(), this.config);
  }

  public when(condition: PolicyCondition<T>): IPolicyConditionalBuilder<T> {
    return this.innerPolicy.when(condition);
  }

  /**
   * Create retry policy behavior
   */
  public static create<T>(
    policy: IBusinessPolicy<T>,
    config: PolicyRetryConfig
  ): PolicyRetryBehavior<T> {
    return new PolicyRetryBehavior(policy, config);
  }

  /**
   * Create retry policy with default configuration
   */
  public static withDefaults<T>(
    policy: IBusinessPolicy<T>,
    maxAttempts = 3
  ): PolicyRetryBehavior<T> {
    return new PolicyRetryBehavior(policy, {
      maxAttempts,
      baseDelay: 1000,
      maxDelay: 30000,
      backoff: 'exponential',
      backoffMultiplier: 2,
      jitter: true,
      enableMetrics: true,
    });
  }
}

export class PolicyRetryBehaviorFactory {
  /**
   * Create retry policy for transient failures
   */
  public static forTransientFailures<T>(
    policy: IBusinessPolicy<T>,
    maxAttempts = 3
  ): PolicyRetryBehavior<T> {
    return PolicyRetryBehavior.create(policy, {
      maxAttempts,
      baseDelay: 1000,
      backoff: 'exponential',
      jitter: true,
      shouldRetry: violation =>
        violation.code.includes('TIMEOUT') ||
        violation.code.includes('UNAVAILABLE') ||
        violation.severity === 'WARNING',
    });
  }

  /**
   * Create retry policy for external service calls
   */
  public static forExternalServices<T>(
    policy: IBusinessPolicy<T>,
    options: {
      maxAttempts?: number;
      baseDelay?: number;
      maxDelay?: number;
    } = {}
  ): PolicyRetryBehavior<T> {
    return PolicyRetryBehavior.create(policy, {
      maxAttempts: options.maxAttempts || 5,
      baseDelay: options.baseDelay || 2000,
      maxDelay: options.maxDelay || 60000,
      backoff: 'exponential',
      backoffMultiplier: 2,
      jitter: true,
      shouldRetryOnException: error =>
        error.message.includes('ECONNRESET') ||
        error.message.includes('TIMEOUT') ||
        error.message.includes('UNAVAILABLE'),
      enableMetrics: true,
    });
  }

  /**
   * Create retry policy with custom logic
   */
  public static withCustomLogic<T>(
    policy: IBusinessPolicy<T>,
    shouldRetry: (violation: PolicyViolation) => boolean,
    maxAttempts = 3,
    baseDelay = 1000
  ): PolicyRetryBehavior<T> {
    return PolicyRetryBehavior.create(policy, {
      maxAttempts,
      baseDelay,
      backoff: 'exponential',
      jitter: true,
      shouldRetry,
      enableMetrics: true,
    });
  }
}
