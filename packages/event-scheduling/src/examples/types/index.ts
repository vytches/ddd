// Type definitions for event-scheduling examples

import type { JobStatus, SchedulePriority } from '@vytches-ddd/contracts';

// === BASIC EVENT SCHEDULING TYPES ===

export interface OrderData {
  orderId: string;
  customerId: string;
  customerEmail: string;
  total: number;
  items: string[];
  status?: string;
  createdAt?: Date;
}

export interface NotificationData {
  userId: string;
  type: string;
  channel: 'email' | 'sms' | 'push' | 'webhook';
  recipient: string;
  template?: string;
  data?: Record<string, any>;
  amount?: number;
  dueDate?: Date;
  message?: string;
}

export interface SchedulingStats {
  totalScheduled: number;
  completed: number;
  failed: number;
  cancelled: number;
  running: number;
}

export interface JobFilter {
  status?: JobStatus[];
  limit?: number;
  offset?: number;
}

export interface ScheduledJobSummary {
  jobId: string;
  eventType: string;
  scheduledAt: Date;
  status: JobStatus;
  attempts: number;
  nextRetryAt?: Date;
}

// === RECURRING EVENT TYPES ===

export interface RecurringOptions {
  pattern: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number; // Every N periods
  endDate?: Date;
  maxOccurrences?: number;
  dayOfWeek?: number; // 0 = Sunday, 1 = Monday, etc.
  dayOfMonth?: number; // 1-31
  monthOfYear?: number; // 1-12
}

export interface RecurringJobInfo {
  id: string;
  originalEvent: any;
  currentJobId: string;
  nextOccurrence: Date | null;
  isActive: boolean;
  executionCount: number;
}

export interface RecurringJobStatus {
  id: string;
  isActive: boolean;
  executionCount: number;
  nextOccurrence: Date | null;
  currentJobStatus: JobStatus;
  lastExecuted?: Date;
  eventType: string;
}

export interface ReportData {
  type: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  recipients: string[];
  format?: 'pdf' | 'excel' | 'csv';
  filters?: Record<string, any>;
}

export interface BackupData {
  databases: string[];
  destination: string;
  compression: boolean;
  encryption?: boolean;
  retentionDays?: number;
}

export interface BillingData {
  period: {
    year: number;
    month: number;
  };
  customers: string[];
  currency: string;
  taxRate?: number;
}

// === PRIORITY SCHEDULING TYPES ===

export interface CustomerIssueData {
  type: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  description: string;
  reportedAt: Date;
  customerTier: 'basic' | 'premium' | 'enterprise';
  assignedTo?: string;
  category?: string;
}

export interface MaintenanceTaskData {
  type: string;
  estimatedDuration: number; // milliseconds
  resources: string[];
  maintainer: string;
  impact?: 'low' | 'medium' | 'high';
  approvedBy?: string;
}

export interface QueueItem {
  event: any; // PriorityScheduledEvent
  jobId: string;
  addedAt: Date;
}

export interface QueueStats {
  totalQueued: number;
  processing: number;
  byQueue: Record<string, number>;
  byPriority: Record<SchedulePriority, number>;
}

export interface SchedulerStats {
  scheduled: number;
  completed: number;
  failed: number;
  running: number;
  queued: number;
  processing: number;
  queueBreakdown: Record<string, number>;
  priorityBreakdown: Record<SchedulePriority, number>;
}

// === INTERMEDIATE TYPES ===

export interface SchedulingConfiguration {
  timezone: string;
  defaultRetries: number;
  maxConcurrentJobs: number;
  queueCapacity: number;
  enablePersistence: boolean;
}

export interface EventSchedulingContext {
  tenantId?: string;
  userId?: string;
  correlationId?: string;
  source?: string;
  metadata?: Record<string, any>;
}

export interface SchedulingMetrics {
  totalEvents: number;
  successRate: number;
  averageExecutionTime: number;
  queuedEvents: number;
  failedEvents: number;
  retriedEvents: number;
}

export interface DeadLetterQueueItem {
  originalEvent: any;
  jobId: string;
  failureReason: string;
  failedAt: Date;
  attempts: number;
  lastError: string;
}

// === ADVANCED TYPES ===

export interface DistributedSchedulerConfig {
  nodes: string[];
  leaderElection: boolean;
  replicationFactor: number;
  consistency: 'eventual' | 'strong';
  partitioning: 'hash' | 'range' | 'consistent-hash';
}

export interface ClusterNode {
  id: string;
  address: string;
  isLeader: boolean;
  isHealthy: boolean;
  lastHeartbeat: Date;
  assignedPartitions: string[];
}

export interface SchedulingPartition {
  id: string;
  assignedNode: string;
  eventCount: number;
  healthStatus: 'healthy' | 'degraded' | 'failed';
}

export interface GlobalSchedulingMetrics {
  totalNodes: number;
  healthyNodes: number;
  totalPartitions: number;
  leaderNode: string;
  eventThroughput: number;
  averageLatency: number;
  replicationLag: number;
}

// === FRAMEWORK INTEGRATION TYPES ===

export interface NestJSSchedulingConfig {
  moduleConfig: {
    enableHealthCheck: boolean;
    enableMetrics: boolean;
    defaultQueue: string;
  };
  schedulerOptions: {
    maxRetries: number;
    timeout: number;
    concurrency: number;
  };
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  details: {
    scheduler: boolean;
    queues: Record<string, boolean>;
    processing: number;
    uptime: number;
  };
  timestamp: Date;
}

// === UTILITY TYPES ===

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface DateTimeOptions {
  timezone?: string;
  format?: string;
  locale?: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'linear' | 'exponential';
  backoffMultiplier?: number;
  maxBackoffMs?: number;
  retryableErrors?: string[];
}

export interface SchedulingRule {
  name: string;
  condition: (event: any) => boolean;
  action: 'allow' | 'deny' | 'delay' | 'reschedule';
  parameters?: Record<string, any>;
}

// === EVENT TYPES FOR EXAMPLES ===

export interface PaymentProcessingData {
  paymentId: string;
  amount: number;
  currency: string;
  customerId: string;
  paymentMethod: string;
  metadata?: Record<string, any>;
}

export interface InventoryUpdateData {
  productId: string;
  quantity: number;
  operation: 'reserve' | 'release' | 'adjust';
  reason: string;
  warehouseId: string;
}

export interface CustomerCommunicationData {
  customerId: string;
  channel: 'email' | 'sms' | 'push';
  template: string;
  variables: Record<string, any>;
  priority: SchedulePriority;
}

export interface SystemMaintenanceData {
  maintenanceId: string;
  type: 'update' | 'backup' | 'cleanup' | 'migration';
  affectedServices: string[];
  estimatedDuration: number;
  maintenanceWindow: TimeRange;
}

export interface ComplianceAuditData {
  auditId: string;
  auditType: string;
  scope: string[];
  auditDate: Date;
  auditor: string;
  requirements: string[];
}

// === ERROR TYPES ===

export interface SchedulingError extends Error {
  code: string;
  jobId?: string;
  eventType?: string;
  retryable?: boolean;
}

export interface ValidationError extends Error {
  field: string;
  value: any;
  constraint: string;
}

// Re-export commonly used enums from contracts
export { JobStatus, SchedulePriority } from '@vytches-ddd/contracts';
