/**
 * @llm-summary Application types for CQRS package examples
 * @llm-domain Integration
 * @llm-complexity Simple
 *
 * @description
 * Shared types used across CQRS package examples to demonstrate
 * Command Query Responsibility Segregation patterns and real-world integration scenarios.
 *
 * @example
 * ```typescript
 * import { CreateUserCommand, UserQuery, User } from './types';
 *
 * const command: CreateUserCommand = {
 *   userId: 'user-123',
 *   email: 'user@example.com',
 *   name: 'John Doe',
 *   role: 'user'
 * };
 * ```
 *
 * @since 1.0.0
 * @public
 */

// Base interfaces
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt?: Date;
  version: number;
}

export interface BaseCommand {
  commandId: string;
  timestamp: Date;
  userId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface BaseQuery {
  queryId: string;
  timestamp: Date;
  userId?: string;
  correlationId?: string;
  filters?: Record<string, unknown>;
  pagination?: PaginationOptions;
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

// User domain
export interface User extends BaseEntity {
  email: string;
  name: string;
  role: 'admin' | 'user' | 'moderator';
  status: 'active' | 'inactive' | 'suspended';
  profile: UserProfile;
  preferences: UserPreferences;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
  bio?: string;
  location?: string;
  phoneNumber?: string;
}

export interface UserPreferences {
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  language: string;
  timezone: string;
  theme: 'light' | 'dark' | 'auto';
}

// Order domain
export interface Order extends BaseEntity {
  userId: string;
  items: OrderItem[];
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  currency: string;
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod: string;
  notes?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specifications?: Record<string, string>;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// Product domain
export interface Product extends BaseEntity {
  name: string;
  description: string;
  price: number;
  currency: string;
  category: ProductCategory;
  inventory: ProductInventory;
  specifications: Record<string, string>;
  images: string[];
  isActive: boolean;
  tags: string[];
}

export interface ProductCategory {
  id: string;
  name: string;
  parentId?: string;
  path: string[];
}

export interface ProductInventory {
  stockLevel: number;
  reservedQuantity: number;
  availableQuantity: number;
  minStockLevel: number;
  maxStockLevel: number;
  reorderPoint: number;
}

// Command interfaces
export interface CreateUserCommand extends BaseCommand {
  email: string;
  name: string;
  role: User['role'];
  profile: Omit<UserProfile, 'avatar'>;
  initialPreferences?: Partial<UserPreferences>;
}

export interface UpdateUserCommand extends BaseCommand {
  userId: string;
  email?: string;
  name?: string;
  role?: User['role'];
  profile?: Partial<UserProfile>;
  preferences?: Partial<UserPreferences>;
}

export interface DeactivateUserCommand extends BaseCommand {
  userId: string;
  reason: string;
  deactivatedBy: string;
}

export interface CreateOrderCommand extends BaseCommand {
  userId: string;
  items: Omit<OrderItem, 'totalPrice'>[];
  shippingAddress: Address;
  billingAddress?: Address;
  paymentMethod: string;
  notes?: string;
}

export interface UpdateOrderStatusCommand extends BaseCommand {
  orderId: string;
  status: Order['status'];
  reason?: string;
  updatedBy: string;
}

export interface CancelOrderCommand extends BaseCommand {
  orderId: string;
  reason: string;
  cancelledBy: string;
  refundAmount?: number;
}

export interface CreateProductCommand extends BaseCommand {
  name: string;
  description: string;
  price: number;
  currency: string;
  categoryId: string;
  initialStock: number;
  specifications: Record<string, string>;
  images: string[];
  tags: string[];
}

export interface UpdateProductInventoryCommand extends BaseCommand {
  productId: string;
  quantityChange: number;
  reason: 'sale' | 'restock' | 'adjustment' | 'damage' | 'return';
  reference?: string;
}

// Query interfaces
export interface GetUserByIdQuery extends BaseQuery {
  userId: string;
  includeProfile?: boolean;
  includePreferences?: boolean;
}

export interface GetUsersByRoleQuery extends BaseQuery {
  role: User['role'];
  status?: User['status'];
  includeInactive?: boolean;
}

export interface SearchUsersQuery extends BaseQuery {
  searchTerm?: string;
  role?: User['role'];
  status?: User['status'];
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface GetOrderByIdQuery extends BaseQuery {
  orderId: string;
  includeItems?: boolean;
  includeHistory?: boolean;
}

export interface GetOrdersByUserQuery extends BaseQuery {
  userId: string;
  status?: Order['status'];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface GetOrdersReportQuery extends BaseQuery {
  dateFrom: Date;
  dateTo: Date;
  status?: Order['status'];
  groupBy?: 'day' | 'week' | 'month';
  includeMetrics?: boolean;
}

export interface GetProductByIdQuery extends BaseQuery {
  productId: string;
  includeInventory?: boolean;
  includeCategory?: boolean;
}

export interface SearchProductsQuery extends BaseQuery {
  searchTerm?: string;
  categoryId?: string;
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  tags?: string[];
}

export interface GetLowStockProductsQuery extends BaseQuery {
  threshold?: number;
  categoryId?: string;
  includeReorderSuggestions?: boolean;
}

// Response interfaces
export interface CommandResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
  validationErrors?: ValidationError[];
  metadata?: Record<string, unknown>;
}

export interface QueryResult<T = unknown> {
  success: boolean;
  data?: T;
  totalCount?: number;
  pageInfo?: PageInfo;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface PageInfo {
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

// Event interfaces for CQRS integration
export interface DomainEventData {
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventData: unknown;
  version: number;
  timestamp: Date;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, unknown>;
}

// Handler context interfaces
export interface CommandContext {
  commandId: string;
  userId?: string;
  correlationId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface QueryContext {
  queryId: string;
  userId?: string;
  correlationId?: string;
  timestamp: Date;
  filters?: Record<string, unknown>;
  pagination?: PaginationOptions;
}

// Configuration interfaces
export interface CQRSConfig {
  enableCommandValidation: boolean;
  enableQueryCaching: boolean;
  enableMetrics: boolean;
  enableTracing: boolean;
  commandTimeout: number;
  queryTimeout: number;
  retryAttempts: number;
  circuitBreakerThreshold: number;
}

// Metrics and monitoring
export interface CommandMetrics {
  commandType: string;
  executionTime: number;
  success: boolean;
  timestamp: Date;
  userId?: string;
  errorType?: string;
}

export interface QueryMetrics {
  queryType: string;
  executionTime: number;
  success: boolean;
  resultCount: number;
  timestamp: Date;
  userId?: string;
  cacheHit?: boolean;
}

// Specialized result types
export interface UserListResult {
  users: User[];
  totalCount: number;
  pageInfo: PageInfo;
}

export interface OrderListResult {
  orders: Order[];
  totalCount: number;
  pageInfo: PageInfo;
}

export interface ProductListResult {
  products: Product[];
  totalCount: number;
  pageInfo: PageInfo;
}

export interface OrderReportResult {
  summary: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    topSellingProducts: Array<{
      productId: string;
      productName: string;
      quantitySold: number;
      revenue: number;
    }>;
  };
  periodData: Array<{
    period: string;
    orderCount: number;
    revenue: number;
  }>;
  statusBreakdown: Record<Order['status'], number>;
}
