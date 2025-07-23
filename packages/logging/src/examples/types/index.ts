/**
 * Logging Package - Type Definitions
 *
 * Common types used across logging examples.
 * These types represent application-level concepts that would exist in your domain.
 */

// Core Domain Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
  isActive: boolean;
  preferences?: Record<string, any>;
  sensitiveData?: {
    ssn?: string;
    phoneNumber?: string;
    address?: string;
  };
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  paymentInfo?: {
    method: string;
    cardNumber?: string; // Should be masked in logs
    expiryDate?: string;
  };
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
  createdAt: Date;
}

// Business Command/Query Types (for CQRS examples)
export interface CreateUserCommand {
  name: string;
  email: string;
  role: string;
  initialPreferences?: Record<string, any>;
}

export interface UpdateUserCommand {
  userId: string;
  name?: string;
  email?: string;
  preferences?: Record<string, any>;
}

export interface GetUserQuery {
  userId: string;
  includePreferences?: boolean;
}

export interface GetUsersByRoleQuery {
  role: string;
  limit?: number;
  offset?: number;
}

export interface CreateOrderCommand {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  paymentMethod: string;
  shippingAddress: Address;
}

export interface ProcessOrderCommand {
  orderId: string;
  processingNotes?: string;
}

export interface GetOrderQuery {
  orderId: string;
  includeItems?: boolean;
}

export interface GetOrderHistoryQuery {
  customerId: string;
  startDate?: Date;
  endDate?: Date;
  status?: string;
  limit?: number;
}

// Supporting Types
export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata: {
    timestamp: Date;
    requestId: string;
    duration: number;
  };
}

// Logging-Specific Types
export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  tenantId?: string;
  operationName?: string;
  className?: string;
  methodName?: string;
  boundedContext?: string;
  correlationId?: string;
}

export interface LogMaskingConfig {
  enabled: boolean;
  sensitiveKeys: string[];
  replacement: string;
  customMaskers?: Record<string, (value: any) => string>;
}

export interface LogLevel {
  name: string;
  value: number;
  color?: string;
}

export interface LogEntry {
  level: string;
  message: string;
  timestamp: Date;
  context?: LogContext;
  data?: Record<string, any>;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface LoggerConfiguration {
  level: string;
  enableConsoleOutput: boolean;
  enableFileOutput?: boolean;
  enableRemoteLogging?: boolean;
  masking?: LogMaskingConfig;
  contextDetection?: {
    enabled: boolean;
    stackTraceAnalysis: boolean;
    boundedContextDetection: boolean;
  };
  formatting?: {
    colorize: boolean;
    timestamp: boolean;
    prettyPrint: boolean;
  };
}

// Business Domain Events (for logging examples)
export interface UserRegisteredEvent {
  eventId: string;
  eventType: 'UserRegistered';
  userId: string;
  userData: CreateUserCommand;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface UserUpdatedEvent {
  eventId: string;
  eventType: 'UserUpdated';
  userId: string;
  changes: Partial<UpdateUserCommand>;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface OrderCreatedEvent {
  eventId: string;
  eventType: 'OrderCreated';
  orderId: string;
  orderData: CreateOrderCommand;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface OrderProcessedEvent {
  eventId: string;
  eventType: 'OrderProcessed';
  orderId: string;
  processingData: ProcessOrderCommand;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Error Types
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class BusinessError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}

// HTTP/API Types (for NestJS examples)
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
  requestId: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Monitoring and Observability Types
export interface MetricsData {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<
    string,
    {
      status: 'up' | 'down';
      message?: string;
      details?: Record<string, any>;
    }
  >;
  timestamp: Date;
}

export interface PerformanceMetrics {
  requestDuration: number;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  activeConnections: number;
  timestamp: Date;
}

// Configuration Types for Examples
export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string; // Should be masked in logs
  database: string;
  ssl?: boolean;
  connectionTimeout?: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string; // Should be masked in logs
  db?: number;
  keyPrefix?: string;
}

export interface ExternalServiceConfig {
  baseUrl: string;
  apiKey: string; // Should be masked in logs
  timeout: number;
  retries: number;
  circuitBreaker?: {
    enabled: boolean;
    threshold: number;
    resetTimeout: number;
  };
}

// Export commonly used type unions
export type LogLevelType = 'error' | 'warn' | 'info' | 'debug' | 'trace';
export type OrderStatus = Order['status'];
export type UserRole = 'admin' | 'user' | 'manager' | 'guest';

// Export commonly used interfaces for examples
export type {
  User as UserData,
  Order as OrderData,
  Product as ProductData,
  LogContext as LoggingContext,
  LoggerConfiguration as LoggingConfig,
  ServiceResponse as Response,
};
