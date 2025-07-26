/**
 * @fileoverview Application-specific types for resilience package examples
 * @package @vytches/ddd-resilience
 * @version 1.0.0
 */

// Domain entities
export interface PaymentRequest {
  id: string;
  amount: number;
  currency: string;
  merchantId: string;
  customerId: string;
  paymentMethod: PaymentMethod;
  metadata?: Record<string, unknown>;
}

export interface PaymentResponse {
  id: string;
  status: PaymentStatus;
  transactionId?: string;
  errorCode?: string;
  errorMessage?: string;
  processingTime: number;
  timestamp: Date;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  shippingAddress: Address;
  billingAddress: Address;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sku: string;
}

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address: Address;
  tier: CustomerTier;
  preferences: CustomerPreferences;
  createdAt: Date;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface InventoryItem {
  productId: string;
  sku: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  warehouseId: string;
  location: string;
  lastUpdated: Date;
}

export interface NotificationRequest {
  id: string;
  recipientId: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject: string;
  content: string;
  priority: NotificationPriority;
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ExternalApiRequest {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retryConfig?: RetryConfig;
}

export interface ExternalApiResponse {
  status: number;
  statusText: string;
  data: unknown;
  headers: Record<string, string>;
  responseTime: number;
  requestId: string;
}

// Service configurations
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  maxConnections: number;
  connectionTimeout: number;
  queryTimeout: number;
  retryAttempts: number;
}

export interface ExternalServiceConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retryPolicy: RetryPolicy;
  circuitBreakerConfig: CircuitBreakerConfig;
  rateLimitConfig: RateLimitConfig;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  retryCondition?: (error: Error) => boolean;
}

export interface RetryPolicy {
  enabled: boolean;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  retryableErrors: string[];
  nonRetryableErrors: string[];
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringWindow: number;
  halfOpenMaxCalls: number;
  minimumThroughput: number;
}

export interface BulkheadConfig {
  enabled: boolean;
  maxConcurrency: number;
  queueSize: number;
  queueTimeout: number;
  rejectionStrategy: 'drop' | 'wait' | 'fail';
}

export interface TimeoutConfig {
  enabled: boolean;
  defaultTimeout: number;
  operationTimeouts: Record<string, number>;
  timeoutStrategy: 'abort' | 'graceful';
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  burstSize: number;
  windowSizeMs: number;
  strategy: 'sliding_window' | 'fixed_window' | 'token_bucket';
}

// Resilience contexts
export interface ResilienceContext {
  operationId: string;
  correlationId: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  startTime: Date;
  attempt: number;
  previousAttempts: AttemptHistory[];
  metadata?: Record<string, unknown>;
}

export interface AttemptHistory {
  attempt: number;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  error?: Error;
  retryReason?: string;
}

export interface ResilienceMetrics {
  operationName: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  timeoutCalls: number;
  circuitBreakerOpen: boolean;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  throughput: number;
  timestamp: Date;
}

export interface HealthCheckResult {
  serviceName: string;
  status: HealthStatus;
  responseTime: number;
  details?: Record<string, unknown>;
  timestamp: Date;
  uptime: number;
  dependencies: DependencyHealth[];
}

export interface DependencyHealth {
  name: string;
  status: HealthStatus;
  responseTime: number;
  errorRate: number;
  lastError?: string;
}

// System monitoring
export interface SystemResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
  openConnections: number;
  threadPoolSize: number;
  queueLength: number;
  timestamp: Date;
}

export interface AlertConfiguration {
  name: string;
  description: string;
  conditions: AlertCondition[];
  severity: AlertSeverity;
  channels: AlertChannel[];
  cooldownPeriod: number;
  escalationRules: EscalationRule[];
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number;
  aggregation: 'avg' | 'max' | 'min' | 'sum' | 'count';
}

export interface EscalationRule {
  level: number;
  delay: number;
  channels: AlertChannel[];
  recipients: string[];
}

// Enterprise features
export interface MultiRegionConfig {
  regions: RegionConfig[];
  failoverStrategy: 'automatic' | 'manual';
  loadBalancingStrategy: 'round_robin' | 'weighted' | 'latency_based';
  healthCheckInterval: number;
  syncStrategy: 'async' | 'sync' | 'eventual_consistency';
}

export interface RegionConfig {
  regionId: string;
  regionName: string;
  endpoints: string[];
  weight: number;
  priority: number;
  healthCheckUrl: string;
  resilienceConfig: ResilienceConfig;
}

export interface ResilienceConfig {
  retry: RetryPolicy;
  circuitBreaker: CircuitBreakerConfig;
  bulkhead: BulkheadConfig;
  timeout: TimeoutConfig;
  rateLimit: RateLimitConfig;
}

export interface ChaosEngineeringConfig {
  enabled: boolean;
  experiments: ChaosExperiment[];
  schedule: ChaosSchedule;
  safetyLimits: SafetyLimits;
  monitoringConfig: ChaosMonitoringConfig;
}

export interface ChaosExperiment {
  name: string;
  type: 'latency' | 'error' | 'timeout' | 'resource_exhaustion' | 'network_partition';
  target: string;
  parameters: Record<string, unknown>;
  duration: number;
  probability: number;
  conditions: string[];
}

export interface ChaosSchedule {
  enabled: boolean;
  cron: string;
  timezone: string;
  randomization: boolean;
  excludePeriods: TimePeriod[];
}

export interface SafetyLimits {
  maxConcurrentExperiments: number;
  maxImpactPercentage: number;
  emergencyStopConditions: string[];
  monitoringThresholds: Record<string, number>;
}

export interface ChaosMonitoringConfig {
  metricsCollection: boolean;
  alertingEnabled: boolean;
  reportingInterval: number;
  storageRetention: number;
}

// Enums
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  DIGITAL_WALLET = 'digital_wallet',
  CRYPTOCURRENCY = 'cryptocurrency',
}

export enum OrderStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum CustomerTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  ENTERPRISE = 'enterprise',
}

export enum NotificationType {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  WEBHOOK = 'webhook',
  SLACK = 'slack',
}

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH_NOTIFICATION = 'push_notification',
  IN_APP = 'in_app',
  WEBHOOK = 'webhook',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical',
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum AlertChannel {
  EMAIL = 'email',
  SMS = 'sms',
  SLACK = 'slack',
  PAGERDUTY = 'pagerduty',
  WEBHOOK = 'webhook',
}

// Additional types
export interface CustomerPreferences {
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  communication: {
    language: string;
    timezone: string;
    frequency: 'immediate' | 'daily' | 'weekly';
  };
  privacy: {
    dataSharing: boolean;
    analytics: boolean;
    marketing: boolean;
  };
}

export interface TimePeriod {
  start: Date;
  end: Date;
  description?: string;
}

// Service result types
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: ServiceError;
  metadata?: {
    executionTime: number;
    retries: number;
    circuitBreakerState?: string;
    resourceUsage?: SystemResourceMetrics;
  };
}

export interface ServiceError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  timestamp: Date;
}

export interface BatchProcessingRequest {
  batchId: string;
  items: unknown[];
  batchSize: number;
  parallelism: number;
  timeout: number;
  retryPolicy: RetryPolicy;
  failureStrategy: 'fail_fast' | 'continue' | 'retry_failed';
}

export interface BatchProcessingResult<T> {
  batchId: string;
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  results: BatchItemResult<T>[];
  executionTime: number;
  resourceUsage: SystemResourceMetrics;
}

export interface BatchItemResult<T> {
  index: number;
  success: boolean;
  data?: T;
  error?: ServiceError;
  executionTime: number;
  retries: number;
}
