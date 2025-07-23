// repositories/src/examples/types/index.ts
// Common types and interfaces used across repository examples

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// User Domain Types
export interface User extends BaseEntity {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  profile?: UserProfile;
  preferences?: UserPreferences;
  roles: string[];
}

export interface UserProfile {
  bio?: string;
  avatar?: string;
  phoneNumber?: string;
  address?: Address;
  dateOfBirth?: Date;
}

export interface UserPreferences {
  language: string;
  timezone: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  theme: 'light' | 'dark' | 'auto';
}

export interface CreateUserData {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  roles?: string[];
}

export interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  profile?: Partial<UserProfile>;
  preferences?: Partial<UserPreferences>;
  roles?: string[];
}

// Product Domain Types
export interface Product extends BaseEntity {
  name: string;
  description: string;
  price: number;
  category: string;
  sku: string;
  tags: string[];
  isActive: boolean;
  inventory: ProductInventory;
  metadata?: Record<string, unknown>;
}

export interface ProductInventory {
  quantity: number;
  reserved: number;
  available: number;
  minStock: number;
  locations: StockLocation[];
}

export interface StockLocation {
  locationId: string;
  locationName: string;
  quantity: number;
  reserved: number;
}

export interface CreateProductData {
  name: string;
  description: string;
  price: number;
  category: string;
  sku: string;
  tags?: string[];
  initialQuantity?: number;
  minStock?: number;
}

export interface UpdateProductData {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  tags?: string[];
  isActive?: boolean;
  minStock?: number;
}

// Order Domain Types
export interface Order extends BaseEntity {
  orderNumber: string;
  customerId: string;
  status: OrderStatus;
  items: OrderItem[];
  pricing: OrderPricing;
  shipping: ShippingDetails;
  billingAddress: Address;
  shippingAddress: Address;
  paymentMethod: PaymentMethod;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  options?: Record<string, unknown>;
}

export interface OrderPricing {
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
}

export interface ShippingDetails {
  method: string;
  carrier: string;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
}

export interface PaymentMethod {
  type: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer' | 'cash';
  provider?: string;
  maskedNumber?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault?: boolean;
}

export interface CreateOrderData {
  customerId: string;
  items: Omit<OrderItem, 'totalPrice'>[];
  billingAddress: Address;
  shippingAddress: Address;
  paymentMethod: PaymentMethod;
  notes?: string;
}

// Event Store Types
export interface StoredEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventData: unknown;
  eventMetadata: EventMetadata;
  streamVersion: number;
  globalSequence: number;
  timestamp: Date;
}

export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  source?: string;
  [key: string]: unknown;
}

export interface EventStream {
  streamId: string;
  aggregateType: string;
  events: StoredEvent[];
  version: number;
  created: Date;
  lastModified: Date;
}

// Audit Log Types
export interface AuditLog extends BaseEntity {
  entityType: string;
  entityId: string;
  action: AuditAction;
  userId: string;
  changes: ChangeRecord[];
  metadata: AuditMetadata;
  ipAddress?: string;
  userAgent?: string;
}

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'ARCHIVE';

export interface ChangeRecord {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: 'ADD' | 'UPDATE' | 'REMOVE';
}

export interface AuditMetadata {
  source: string;
  reason?: string;
  sessionId?: string;
  requestId?: string;
  [key: string]: unknown;
}

// Transaction Context
export interface TransactionContext {
  transactionId: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

// Unit of Work Types
export interface WorkUnit {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  entity: unknown;
  originalEntity?: unknown;
  timestamp: Date;
}

export interface UnitOfWorkResult {
  success: boolean;
  affectedEntities: number;
  errors: Error[];
  transactionId: string;
  duration: number;
}

// Repository Query Types
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: OrderByClause[];
  where?: WhereClause[];
  include?: string[];
  exclude?: string[];
}

export interface OrderByClause {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface WhereClause {
  field: string;
  operator: ComparisonOperator;
  value: unknown;
  logical?: LogicalOperator;
}

export type ComparisonOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'notIn'
  | 'like'
  | 'notLike'
  | 'isNull'
  | 'isNotNull'
  | 'between';

export type LogicalOperator = 'AND' | 'OR';

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Cache Types
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string;
  tags?: string[];
  compress?: boolean;
}

export interface CacheKey {
  namespace: string;
  key: string;
  version?: string;
}

// Connection and Database Types
export interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  pool?: PoolConfig;
  ssl?: boolean;
  timeout?: number;
}

export interface PoolConfig {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export interface DatabaseTransaction {
  id: string;
  startTime: Date;
  isolationLevel: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  isReadOnly: boolean;
}

// Health Check Types
export interface RepositoryHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: DatabaseHealth;
  cache?: CacheHealth;
  lastChecked: Date;
  uptime: number;
  metrics: RepositoryMetrics;
}

export interface DatabaseHealth {
  connected: boolean;
  responseTime: number;
  activeConnections: number;
  maxConnections: number;
  version?: string;
}

export interface CacheHealth {
  connected: boolean;
  responseTime: number;
  hitRate: number;
  memoryUsage: number;
  maxMemory: number;
}

export interface RepositoryMetrics {
  queriesPerSecond: number;
  averageQueryTime: number;
  slowQueries: number;
  cacheHitRate: number;
  errorRate: number;
  totalQueries: number;
}

// Domain Event Integration Types
export interface RepositoryEvent {
  eventType: 'ENTITY_CREATED' | 'ENTITY_UPDATED' | 'ENTITY_DELETED' | 'BATCH_OPERATION';
  entityType: string;
  entityId: string;
  payload: unknown;
  metadata: EventMetadata;
  timestamp: Date;
}

// Multi-Tenancy Types
export interface TenantContext {
  tenantId: string;
  tenantName: string;
  isolationLevel: 'SHARED' | 'ISOLATED' | 'DEDICATED';
  schema?: string;
  connectionString?: string;
}

// Specification Pattern Types
export interface RepositorySpecification<T> {
  isSatisfiedBy(entity: T): boolean;
  and(other: RepositorySpecification<T>): RepositorySpecification<T>;
  or(other: RepositorySpecification<T>): RepositorySpecification<T>;
  not(): RepositorySpecification<T>;
  toQueryOptions(): QueryOptions;
}

// Repository Configuration
export interface RepositoryConfig {
  enableCaching: boolean;
  enableAuditing: boolean;
  enableEventSourcing: boolean;
  defaultPageSize: number;
  maxPageSize: number;
  queryTimeout: number;
  retryAttempts: number;
  enableMetrics: boolean;
}

// Import/Export Types
export interface ExportOptions {
  format: 'JSON' | 'CSV' | 'XML' | 'EXCEL';
  fields?: string[];
  filters?: WhereClause[];
  compression?: boolean;
  encryption?: boolean;
}

export interface ImportResult {
  success: boolean;
  totalRecords: number;
  successfulImports: number;
  failedImports: number;
  errors: ImportError[];
  duration: number;
}

export interface ImportError {
  line: number;
  field?: string;
  error: string;
  data: unknown;
}
