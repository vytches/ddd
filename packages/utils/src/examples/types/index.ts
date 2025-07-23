// Utilities Example Types
// These types are used in the documentation examples to demonstrate
// utility patterns and usage scenarios

// ==================
// Result Pattern Types
// ==================

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  status: number;
  timestamp: Date;
}

export interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ==================
// Safe Execution Types
// ==================

export interface TestScenario<T> {
  name: string;
  input: T;
  expectedOutput?: unknown;
  shouldFail: boolean;
  errorType?: string;
}

export interface ExecutionContext {
  testName: string;
  timeout?: number;
  retries?: number;
  metadata?: Record<string, unknown>;
}

export interface ExecutionResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  executionTime: number;
  attemptCount: number;
}

// ==================
// Library Utils Types
// ==================

export interface UtilityOptions {
  generateUUID?: boolean;
  validateInput?: boolean;
  logExecution?: boolean;
  cacheResults?: boolean;
}

export interface CacheConfig {
  ttl: number;
  maxSize: number;
  keyGenerator?: (input: unknown) => string;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  includeStackTrace: boolean;
  formatters?: Array<(message: unknown) => string>;
}

// ==================
// Intermediate Types
// ==================

export interface ChainableOperation<TInput, TOutput> {
  name: string;
  operation: (input: TInput) => TOutput | Promise<TOutput>;
  condition?: (input: TInput) => boolean;
  onError?: (error: Error) => TOutput;
}

export interface Pipeline<TInput, TOutput> {
  operations: ChainableOperation<unknown, unknown>[];
  execute: (input: TInput) => Promise<TOutput>;
  addOperation: <TNext>(op: ChainableOperation<TOutput, TNext>) => Pipeline<TInput, TNext>;
}

export interface AsyncResult<T, E = Error> {
  value?: T;
  error?: E;
  isSuccess: boolean;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ResultAggregator<T> {
  results: Array<AsyncResult<T>>;
  successCount: number;
  failureCount: number;
  totalCount: number;
  getSuccessful: () => T[];
  getFailures: () => Error[];
  hasAllSucceeded: () => boolean;
  hasAnyFailed: () => boolean;
}

// ==================
// Advanced Types
// ==================

export interface Monad<T> {
  value: T;
  map: <U>(fn: (value: T) => U) => Monad<U>;
  flatMap: <U>(fn: (value: T) => Monad<U>) => Monad<U>;
  filter: (predicate: (value: T) => boolean) => Monad<T>;
}

export interface Railway<T, E = Error> {
  isSuccess: boolean;
  value?: T;
  error?: E;
  continue: <U>(fn: (value: T) => Railway<U, E>) => Railway<U, E>;
  recover: (fn: (error: E) => Railway<T, E>) => Railway<T, E>;
  tap: (fn: (value: T) => void) => Railway<T, E>;
  tapError: (fn: (error: E) => void) => Railway<T, E>;
}

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: {
    before: number;
    after: number;
    delta: number;
  };
  operationsPerSecond?: number;
  gcCollections?: number;
}

export interface OptimizationHints {
  enableMemoization: boolean;
  useWebWorkers: boolean;
  batchSize?: number;
  parallelism?: number;
  cacheStrategy?: 'none' | 'memory' | 'disk';
}

// ==================
// Framework Integration Types
// ==================

export interface NestJSResultInterceptor {
  intercept(context: unknown, next: unknown): unknown;
}

export interface NestJSExceptionFilter {
  catch(exception: unknown, host: unknown): void;
}

export interface DIConfiguration {
  providers: Array<{
    provide: string;
    useClass?: unknown;
    useFactory?: () => unknown;
    inject?: string[];
  }>;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    timestamp: Date;
    requestId?: string;
    version?: string;
  };
}

// ==================
// Utility Function Types
// ==================

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: Error) => boolean;
}

export interface ThrottleConfig {
  limit: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface MemoizeConfig {
  maxAge: number;
  maxSize: number;
  keyGenerator?: (...args: unknown[]) => string;
  serialize?: (value: unknown) => string;
  deserialize?: (value: string) => unknown;
}

// ==================
// Error Types
// ==================

export interface UtilityError extends Error {
  code: string;
  context?: Record<string, unknown>;
  originalError?: Error;
  timestamp: Date;
}

export interface AggregatedError extends Error {
  errors: Error[];
  successCount: number;
  failureCount: number;
  context?: Record<string, unknown>;
}

// ==================
// Configuration Types
// ==================

export interface UtilityConfig {
  result: {
    enableStackTrace: boolean;
    defaultErrorMessage: string;
    includeMetadata: boolean;
  };
  safeRun: {
    enableLogging: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    includePerformanceMetrics: boolean;
  };
  libUtils: {
    defaultUUIDVersion: 'v4' | 'v1';
    enableValidation: boolean;
    caching: CacheConfig;
  };
}

// ==================
// Response Types
// ==================

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  metadata?: {
    timestamp: Date;
    version: string;
    [key: string]: unknown;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: Date;
  };
}

export type UtilityResult<T> = SuccessResponse<T> | ErrorResponse;

// ==================
// Export All Types
// ==================

// Type utilities
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncOptional<T> = Promise<Optional<T>>;
export type ResultOf<T> = T extends (...args: unknown[]) => infer R ? R : never;
