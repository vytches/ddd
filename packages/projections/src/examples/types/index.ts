// Application-specific types for projections examples
// These types are used across all examples to maintain consistency

export interface ProjectionData {
  id: string;
  eventId: string;
  eventType: string;
  data: any;
  metadata: ProjectionMetadata;
  timestamp: Date;
  version: number;
}

export interface ProjectionMetadata {
  aggregateId: string;
  aggregateType: string;
  causationId?: string;
  correlationId?: string;
  userId?: string;
  source: string;
}

export interface ProjectionCheckpoint {
  projectionName: string;
  position: number;
  processedAt: Date;
  eventCount: number;
  lastEventId: string;
}

export interface ProjectionSnapshot {
  projectionName: string;
  data: any;
  version: number;
  createdAt: Date;
  eventCount: number;
  checksum?: string;
}

export interface ProjectionCapability {
  name: string;
  version: string;
  enabled: boolean;
  configuration: any;
}

export interface ProjectionEngine {
  name: string;
  projections: ProjectionInstance[];
  capabilities: ProjectionCapability[];
  status: 'running' | 'stopped' | 'rebuilding' | 'error';
  statistics: ProjectionStatistics;
}

export interface ProjectionInstance {
  name: string;
  status: 'active' | 'inactive' | 'rebuilding' | 'error';
  position: number;
  lastProcessed: Date;
  errorCount: number;
  processingRate: number;
}

export interface ProjectionStatistics {
  totalEventsProcessed: number;
  averageProcessingTime: number;
  errorsPerHour: number;
  throughputPerSecond: number;
  uptime: number;
}

export interface ProjectionError {
  projectionName: string;
  eventId: string;
  error: string;
  timestamp: Date;
  retryCount: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ProjectionRebuildOptions {
  fromPosition?: number;
  toPosition?: number;
  batchSize?: number;
  parallelism?: number;
  skipSnapshots?: boolean;
  validateData?: boolean;
}

export interface ProjectionPerformanceMetrics {
  eventsPerSecond: number;
  memoryUsage: number;
  cpuUsage: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
}

export interface EventSourcedProjection {
  projectionName: string;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  eventHandlers: Map<string, Function>;
  currentState: any;
  version: number;
  lastEventPosition: number;
}

export interface ProjectionOrchestration {
  orchestrationId: string;
  projections: ProjectionOrchestrationItem[];
  dependencies: ProjectionDependency[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
}

export interface ProjectionOrchestrationItem {
  projectionName: string;
  priority: number;
  parallelizable: boolean;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
}

export interface ProjectionDependency {
  source: string;
  target: string;
  dependencyType: 'sequential' | 'data' | 'resource';
  required: boolean;
}

// Business Domain Types
export interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
  lastLoginAt?: Date;
  preferences?: any;
}

export interface OrderData {
  id: string;
  customerId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: Date;
  shippingAddress: Address;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface ProductData {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
  metadata: any;
}

export interface InventoryData {
  productId: string;
  quantity: number;
  reserved: number;
  available: number;
  lastUpdated: Date;
  warehouse: string;
}

export interface CustomerAnalytics {
  customerId: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: Date;
  lifetimeValue: number;
  segment: 'new' | 'regular' | 'vip' | 'inactive';
}

export interface SalesMetrics {
  date: Date;
  totalSales: number;
  orderCount: number;
  averageOrderValue: number;
  topProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  regions: Array<{
    region: string;
    sales: number;
    orderCount: number;
  }>;
}

// AI and ML Types
export interface PredictiveAnalytics {
  modelId: string;
  predictions: Array<{
    key: string;
    value: number;
    confidence: number;
    factors: Array<{
      name: string;
      weight: number;
      impact: number;
    }>;
  }>;
  accuracy: number;
  lastTraining: Date;
}

export interface AnomalyDetection {
  detected: boolean;
  anomalies: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    timestamp: Date;
    affectedMetrics: string[];
    suggestedActions: string[];
  }>;
  baseline: any;
  threshold: number;
}

// Configuration and Setup Types
export interface ProjectionConfiguration {
  name: string;
  batchSize: number;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffDelay: number;
  };
  checkpointInterval: number;
  snapshotFrequency: number;
  capabilities: string[];
  errorHandling: {
    strategy: 'retry' | 'skip' | 'stop';
    deadLetterQueue: boolean;
    maxErrorsPerHour: number;
  };
}

export interface ProjectionValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  warnings: string[];
  performance: {
    processingTime: number;
    memoryUsage: number;
  };
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: Date;
    requestId: string;
    duration: number;
    [key: string]: any;
  };
}

export type ProjectionEventType =
  | 'UserRegistered'
  | 'UserUpdated'
  | 'UserDeactivated'
  | 'OrderPlaced'
  | 'OrderConfirmed'
  | 'OrderShipped'
  | 'OrderDelivered'
  | 'OrderCancelled'
  | 'PaymentProcessed'
  | 'PaymentFailed'
  | 'InventoryUpdated'
  | 'ProductCreated'
  | 'ProductUpdated'
  | 'ProductDiscontinued';

export type ProjectionCapabilityType =
  | 'checkpoint'
  | 'circuit-breaker'
  | 'dead-letter'
  | 'snapshot'
  | 'retry'
  | 'monitoring'
  | 'scaling'
  | 'validation';
