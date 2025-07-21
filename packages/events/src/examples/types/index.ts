/**
 * @llm-summary Application types for events package examples
 * @llm-domain Integration
 * @llm-complexity Simple
 * 
 * @description
 * Shared types used across events package examples to demonstrate
 * real-world integration scenarios and business contexts.
 * 
 * @example
 * ```typescript
 * import { Order, User, Payment } from './types';
 * 
 * const order: Order = {
 *   id: 'order-123',
 *   userId: 'user-456', 
 *   items: [{ productId: 'prod-1', quantity: 2, price: 29.99 }],
 *   status: 'pending',
 *   total: 59.98,
 *   createdAt: new Date()
 * };
 * ```
 * 
 * @since 1.0.0
 * @public
 */

// Base entities
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt?: Date;
}

// User domain
export interface User extends BaseEntity {
  email: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  preferences: {
    notifications: boolean;
    language: string;
  };
}

// Order domain  
export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Order extends BaseEntity {
  userId: string;
  items: OrderItem[];
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  shippingAddress: Address;
  paymentMethod: string;
  notes?: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// Payment domain
export interface Payment extends BaseEntity {
  orderId: string;
  amount: number;
  currency: string;
  method: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  processedAt?: Date;
}

// Inventory domain
export interface Product extends BaseEntity {
  name: string;
  description: string;
  price: number;
  category: string;
  stockLevel: number;
  minStockLevel: number;
  isActive: boolean;
}

export interface InventoryReservation extends BaseEntity {
  productId: string;
  orderId: string;
  quantity: number;
  reservedAt: Date;
  expiresAt: Date;
  status: 'active' | 'expired' | 'fulfilled' | 'cancelled';
}

// Event data interfaces
export interface OrderCreatedEventData {
  orderId: string;
  userId: string;
  total: number;
  items: OrderItem[];
  createdAt: Date;
}

export interface PaymentProcessedEventData {
  paymentId: string;
  orderId: string;
  amount: number;
  status: 'completed' | 'failed';
  transactionId?: string;
  processedAt: Date;
}

export interface InventoryUpdatedEventData {
  productId: string;
  previousStock: number;
  newStock: number;
  reason: 'sale' | 'restock' | 'adjustment' | 'damage';
  updatedAt: Date;
}

export interface UserRegisteredEventData {
  userId: string;
  email: string;
  name: string;
  registrationSource: 'web' | 'mobile' | 'api';
  registeredAt: Date;
}

// Command interfaces
export interface CreateOrderCommand {
  userId: string;
  items: Omit<OrderItem, 'total'>[];
  shippingAddress: Address;
  paymentMethod: string;
  notes?: string;
}

export interface ProcessPaymentCommand {
  orderId: string;
  amount: number;
  currency: string;
  method: Payment['method'];
  paymentDetails: Record<string, unknown>;
}

export interface UpdateInventoryCommand {
  productId: string;
  quantityChange: number;
  reason: InventoryUpdatedEventData['reason'];
}

// Context interfaces
export interface EventContext {
  correlationId: string;
  causationId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  source: 'web' | 'mobile' | 'api' | 'system';
  metadata?: Record<string, unknown>;
}

// Error interfaces
export interface BusinessError extends Error {
  code: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export interface ValidationError extends BusinessError {
  field: string;
  value: unknown;
  constraints: string[];
}

// Result patterns
export interface SuccessResult<T> {
  success: true;
  data: T;
  metadata?: Record<string, unknown>;
}

export interface ErrorResult {
  success: false;
  error: BusinessError;
  metadata?: Record<string, unknown>;
}

export type Result<T> = SuccessResult<T> | ErrorResult;

// Configuration interfaces
export interface EventSystemConfig {
  enableAuditEvents: boolean;
  enableIntegrationEvents: boolean;
  batchSize: number;
  retryAttempts: number;
  timeoutMs: number;
  enableMetrics: boolean;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  connectionTimeout: number;
  maxConnections: number;
}