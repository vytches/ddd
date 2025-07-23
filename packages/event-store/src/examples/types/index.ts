// Application-specific types for event-store examples
// These types represent your application's domain objects and DTOs

/**
 * Core event storage domain types
 */
export interface CreateOrderData {
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  shippingAddress: Address;
  billingAddress: Address;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

/**
 * Event store specific types
 */
export interface EventStoreConfig {
  connectionString?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  batchSize?: number;
  snapshotFrequency?: number;
}

export interface StreamInfo {
  streamId: string;
  eventCount: number;
  firstEventNumber: number;
  lastEventNumber: number;
  createdAt: Date;
  lastModified: Date;
}

export interface ReplayOptions {
  fromEventNumber?: number;
  toEventNumber?: number;
  batchSize?: number;
  includeMetadata?: boolean;
  filterEventTypes?: string[];
}

export interface ReplayResult {
  totalEventsProcessed: number;
  successfulEvents: number;
  failedEvents: number;
  startTime: Date;
  endTime: Date;
  errors: ReplayError[];
}

export interface ReplayError {
  eventNumber: number;
  eventType: string;
  error: string;
  timestamp: Date;
}

/**
 * Projection types
 */
export interface OrderSummaryProjection {
  orderId: string;
  customerId: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  itemCount: number;
  createdAt: Date;
  lastUpdated: Date;
}

export interface CustomerOrderHistory {
  customerId: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate?: Date;
  preferredCategories: string[];
}

/**
 * Serialization types
 */
export interface SerializationStrategy {
  name: string;
  contentType: string;
  serialize: (data: any) => string;
  deserialize: <T>(data: string) => T;
}

export interface EventMetadata {
  eventId: string;
  eventType: string;
  streamId: string;
  eventNumber: number;
  timestamp: Date;
  version: string;
  correlationId?: string;
  causationId?: string;
  userId?: string;
  contentType: string;
}

/**
 * Performance monitoring types
 */
export interface PerformanceMetrics {
  operationType: 'append' | 'read' | 'replay';
  duration: number;
  eventCount: number;
  throughputEventsPerSecond: number;
  memoryUsage: number;
  timestamp: Date;
}

export interface StorageMetrics {
  totalEvents: number;
  totalStreams: number;
  storageSize: number;
  averageEventSize: number;
  compressionRatio: number;
}

/**
 * Enterprise features
 */
export interface TenantContext {
  tenantId: string;
  region: string;
  tier: 'basic' | 'premium' | 'enterprise';
}

export interface ComplianceSettings {
  retentionDays: number;
  encryptionEnabled: boolean;
  auditingEnabled: boolean;
  anonymizePii: boolean;
}

export interface BackupConfiguration {
  enabled: boolean;
  schedule: string;
  destination: string;
  compressionEnabled: boolean;
  encryptionKey?: string;
}

/**
 * Error handling types
 */
export interface EventStoreErrorContext {
  operation: string;
  streamId?: string;
  eventNumber?: number;
  errorCode: string;
  timestamp: Date;
}

/**
 * Migration types
 */
export interface EventMigration {
  fromVersion: string;
  toVersion: string;
  eventType: string;
  migrationFunction: (event: any) => any;
}

export interface MigrationResult {
  migratedEvents: number;
  failedEvents: number;
  duration: number;
  errors: string[];
}

/**
 * Distributed storage types
 */
export interface ShardConfiguration {
  shardId: string;
  nodeId: string;
  startRange: string;
  endRange: string;
  replica: boolean;
}

export interface ConsistencyLevel {
  level: 'eventual' | 'strong' | 'bounded';
  maxStaleMs?: number;
}

export interface ReplicationSettings {
  replicas: number;
  syncMode: 'async' | 'sync';
  backupNodes: string[];
}

/**
 * Query and filtering types
 */
export interface EventQuery {
  streamId?: string;
  eventTypes?: string[];
  fromDate?: Date;
  toDate?: Date;
  correlationId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface QueryResult<T = any> {
  events: T[];
  totalCount: number;
  hasMore: boolean;
  nextToken?: string;
}

/**
 * Snapshot types
 */
export interface AggregateSnapshot {
  aggregateId: string;
  aggregateType: string;
  version: number;
  data: any;
  timestamp: Date;
  checksum: string;
}

export interface SnapshotStrategy {
  frequency: number; // Every N events
  maxAge: number; // Max age in minutes
  compressionEnabled: boolean;
}
