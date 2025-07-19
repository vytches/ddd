/**
 * @fileoverview DI Package Example Types
 * @version 1.0.0
 * @package @vytches-ddd/di
 */

/**
 * User entity interface for DI examples
 */
export interface User {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User creation data interface
 */
export interface CreateUserData {
  email: string;
  name: string;
}

/**
 * User update data interface
 */
export interface UpdateUserData {
  email?: string;
  name?: string;
  isActive?: boolean;
}

/**
 * Order entity interface for DI examples
 */
export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Order item interface
 */
export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
}

/**
 * Order status enumeration
 */
export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled'
}

/**
 * Order creation data interface
 */
export interface CreateOrderData {
  userId: string;
  items: Omit<OrderItem, 'id'>[];
}

/**
 * Payment entity interface for DI examples
 */
export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: PaymentMethod;
  createdAt: Date;
  processedAt?: Date;
}

/**
 * Payment status enumeration
 */
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

/**
 * Payment method enumeration
 */
export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
  BANK_TRANSFER = 'bank_transfer'
}

/**
 * Payment processing data interface
 */
export interface ProcessPaymentData {
  orderId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  paymentDetails: Record<string, any>;
}

/**
 * Email notification data interface
 */
export interface EmailNotificationData {
  to: string;
  subject: string;
  body: string;
  template?: string;
  variables?: Record<string, any>;
}

/**
 * DI configuration interface
 */
export interface DIConfig {
  enableAutoDiscovery?: boolean;
  enableContextIsolation?: boolean;
  defaultLifetime?: 'transient' | 'singleton' | 'scoped';
  timeout?: number;
  maxRetries?: number;
}

/**
 * Service metrics interface
 */
export interface ServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime: Date;
}

/**
 * Database connection interface
 */
export interface DatabaseConnection {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  connectionTimeout?: number;
  maxConnections?: number;
}

/**
 * Cache configuration interface
 */
export interface CacheConfig {
  provider: 'memory' | 'redis' | 'memcached';
  ttl: number;
  maxSize?: number;
  host?: string;
  port?: number;
}

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Error response interface
 */
export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  correlationId?: string;
}

/**
 * Result wrapper interface
 */
export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

/**
 * Pagination parameters interface
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response interface
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}