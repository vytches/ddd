/**
 * Domain Services Examples - Type Definitions
 * 
 * These types represent common domain entities and value objects
 * used throughout the domain services examples.
 */

// Core Domain Types
export interface User {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  inventory: number;
  categoryId: string;
  status: ProductStatus;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  processedAt?: Date;
}

export interface Inventory {
  productId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lastUpdated: Date;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  address: Address;
  loyaltyLevel: LoyaltyLevel;
  totalSpent: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// Enums
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled'
}

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DISCONTINUED = 'discontinued'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
  BANK_TRANSFER = 'bank_transfer'
}

export enum LoyaltyLevel {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum'
}

// Command Types
export interface CreateUserCommand {
  email: string;
  name: string;
}

export interface CreateOrderCommand {
  userId: string;
  items: CreateOrderItemCommand[];
}

export interface CreateOrderItemCommand {
  productId: string;
  quantity: number;
}

export interface ProcessPaymentCommand {
  orderId: string;
  amount: number;
  method: PaymentMethod;
}

export interface UpdateInventoryCommand {
  productId: string;
  quantity: number;
  operation: 'add' | 'subtract' | 'set';
}

export interface CancelOrderCommand {
  orderId: string;
  reason: string;
}

// Event Types
export interface UserCreatedEvent {
  userId: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface OrderCreatedEvent {
  orderId: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  createdAt: Date;
}

export interface OrderCancelledEvent {
  orderId: string;
  reason: string;
  cancelledAt: Date;
}

export interface PaymentProcessedEvent {
  paymentId: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  processedAt: Date;
}

export interface InventoryUpdatedEvent {
  productId: string;
  previousQuantity: number;
  newQuantity: number;
  operation: string;
  updatedAt: Date;
}

// Service Result Types
export interface OrderProcessingResult {
  orderId: string;
  status: OrderStatus;
  paymentId?: string;
  inventoryUpdates: InventoryUpdate[];
  notifications: NotificationSent[];
}

export interface InventoryUpdate {
  productId: string;
  quantityReserved: number;
  success: boolean;
  error?: string;
}

export interface NotificationSent {
  type: 'email' | 'sms' | 'push';
  recipient: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

// Configuration Types
export interface OrderServiceConfig {
  maxRetries: number;
  timeoutMs: number;
  enableNotifications: boolean;
  inventoryReservationTimeout: number;
}

export interface PaymentServiceConfig {
  provider: string;
  apiKey: string;
  timeout: number;
  retryAttempts: number;
}

// Repository Interfaces (for examples)
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
  delete(id: string): Promise<void>;
}

export interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  findByUserId(userId: string): Promise<Order[]>;
  save(order: Order): Promise<Order>;
  delete(id: string): Promise<void>;
}

export interface IProductRepository {
  findById(id: string): Promise<Product | null>;
  findByCategory(categoryId: string): Promise<Product[]>;
  save(product: Product): Promise<Product>;
  updateInventory(productId: string, quantity: number): Promise<void>;
}

export interface IPaymentRepository {
  findById(id: string): Promise<Payment | null>;
  findByOrderId(orderId: string): Promise<Payment[]>;
  save(payment: Payment): Promise<Payment>;
}

// External Service Interfaces
export interface INotificationService {
  sendEmail(recipient: string, subject: string, body: string): Promise<void>;
  sendSMS(recipient: string, message: string): Promise<void>;
  sendPush(recipient: string, message: string): Promise<void>;
}

export interface IPaymentGateway {
  processPayment(payment: Payment): Promise<PaymentResult>;
  refundPayment(paymentId: string, amount: number): Promise<RefundResult>;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

// Domain Service Context Types
export interface ServiceContext {
  userId?: string;
  correlationId: string;
  requestId: string;
  timestamp: Date;
  source: string;
}

export interface OrderProcessingContext extends ServiceContext {
  orderId: string;
  customerId: string;
  priority: 'low' | 'normal' | 'high';
}

export interface PaymentContext extends ServiceContext {
  paymentId: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
}