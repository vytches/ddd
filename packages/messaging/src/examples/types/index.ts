// Application-specific types for messaging examples
// These types simulate a real application's domain models

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export type OrderStatus = 
  | 'pending'
  | 'payment_processing'
  | 'payment_completed'
  | 'inventory_reserved'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface PaymentDetails {
  orderId: string;
  amount: number;
  currency: string;
  method: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer';
  transactionId?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
}

export interface InventoryItem {
  productId: string;
  warehouseId: string;
  availableQuantity: number;
  reservedQuantity: number;
}

export interface ShippingDetails {
  orderId: string;
  address: Address;
  carrier: string;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  status: 'preparing' | 'shipped' | 'in_transit' | 'delivered' | 'returned';
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  tier: 'standard' | 'premium' | 'vip';
  creditLimit?: number;
}

export interface NotificationRequest {
  customerId: string;
  type: 'email' | 'sms' | 'push';
  template: string;
  data: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface ExternalApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: Date;
}

export interface RetryableOperation {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  nextRetryAt?: Date;
}

export interface SagaState {
  sagaId: string;
  type: string;
  currentStep: string;
  completedSteps: string[];
  compensatedSteps: string[];
  data: Record<string, unknown>;
  status: 'started' | 'in_progress' | 'completed' | 'compensating' | 'compensated' | 'failed';
}