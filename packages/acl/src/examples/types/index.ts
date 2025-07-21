// Application-specific types for ACL examples
// These types represent your application's domain entities and external system contracts

// Core domain entities
export interface Customer {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended';
  registrationDate: Date;
  preferences: CustomerPreferences;
}

export interface CustomerPreferences {
  currency: string;
  language: string;
  notifications: boolean;
  marketingConsent: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  availability: ProductAvailability;
}

export interface ProductAvailability {
  inStock: boolean;
  quantity: number;
  warehouse: string;
  estimatedDelivery?: Date;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  createdAt: Date;
  shippingAddress: Address;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface Address {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

// External system contracts
export interface ExternalCustomerData {
  customer_id: string;
  full_name: string;
  email_address: string;
  account_status: string;
  created_timestamp: number;
  settings: {
    preferred_currency: string;
    locale: string;
    email_notifications: boolean;
    marketing_opt_in: boolean;
  };
}

export interface LegacyInventoryData {
  sku: string;
  product_name: string;
  description: string;
  unit_price: number;
  currency_code: string;
  category_id: string;
  stock_info: {
    available: boolean;
    count: number;
    location: string;
    delivery_estimate: string | null;
  };
}

export interface ThirdPartyOrderData {
  order_reference: string;
  buyer_id: string;
  line_items: Array<{
    product_sku: string;
    qty: number;
    price_per_unit: number;
    line_total: number;
  }>;
  grand_total: number;
  currency: string;
  order_state: string;
  timestamp: number;
  delivery_address: {
    address_line_1: string;
    city: string;
    zip_code: string;
    country_code: string;
  };
}

// Integration request/response types
export interface CustomerSyncRequest {
  lastSyncTime?: Date;
  customerIds?: string[];
  includeInactive?: boolean;
}

export interface ProductSyncRequest {
  category?: string;
  modifiedSince?: Date;
  warehouseId?: string;
}

export interface OrderSubmissionRequest {
  order: Order;
  validateInventory: boolean;
  notifyCustomer: boolean;
}

export interface SyncResult {
  success: boolean;
  processedCount: number;
  errorCount: number;
  errors?: Array<{
    id: string;
    message: string;
    details?: any;
  }>;
  lastSyncTime: Date;
}

// Payment system integration
export interface PaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  customerId: string;
  paymentMethod: PaymentMethod;
}

export interface PaymentMethod {
  type: 'credit_card' | 'bank_transfer' | 'digital_wallet';
  details: Record<string, any>;
}

export interface PaymentResult {
  transactionId: string;
  status: 'success' | 'failed' | 'pending';
  amount: number;
  processingFee?: number;
  authorizationCode?: string;
  errorMessage?: string;
}

// External payment gateway response
export interface ExternalPaymentResponse {
  txn_id: string;
  status_code: number;
  message: string;
  amount_charged: number;
  fee_amount: number;
  auth_code: string | null;
  gateway_ref: string;
  timestamp: number;
}

// Notification service types
export interface NotificationRequest {
  recipientId: string;
  channel: 'email' | 'sms' | 'push';
  template: string;
  variables: Record<string, any>;
  priority: 'low' | 'normal' | 'high';
}

export interface NotificationResult {
  id: string;
  status: 'sent' | 'failed' | 'queued';
  deliveredAt?: Date;
  errorMessage?: string;
}

// External notification service response
export interface ExternalNotificationResponse {
  notification_id: string;
  delivery_status: string;
  delivered_timestamp: number | null;
  error_code: string | null;
  error_description: string | null;
}