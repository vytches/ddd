// repositories/src/examples/shared/index.ts
// Common utilities and helper functions for repository examples

import type {
  QueryOptions,
  WhereClause,
  OrderByClause,
  PaginationResult,
  ConnectionConfig,
  CacheKey,
  TransactionContext,
  RepositoryMetrics,
  ExportOptions,
} from '../types';

// Query Builder Utilities
export function buildQueryOptions(options: Partial<QueryOptions> = {}): QueryOptions {
  return {
    limit: options.limit ?? 50,
    offset: options.offset ?? 0,
    orderBy: options.orderBy ?? [{ field: 'createdAt', direction: 'DESC' }],
    where: options.where ?? [],
    include: options.include ?? [],
    exclude: options.exclude ?? [],
  };
}

export function addWhereClause(
  options: QueryOptions,
  field: string,
  operator: string,
  value: any
): QueryOptions {
  const whereClause: WhereClause = {
    field,
    operator: operator as any,
    value,
    logical: options.where && options.where.length > 0 ? 'AND' : 'AND',
  };

  return {
    ...options,
    where: [...(options.where || []), whereClause],
  };
}

export function addOrderBy(
  options: QueryOptions,
  field: string,
  direction: 'ASC' | 'DESC' = 'ASC'
): QueryOptions {
  const orderByClause: OrderByClause = { field, direction };
  return {
    ...options,
    orderBy: [...(options.orderBy || []), orderByClause],
  };
}

// Pagination Helpers
export function createPaginationResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginationResult<T> {
  return {
    data,
    total,
    page,
    limit,
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}

export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function validatePaginationParams(
  page: number,
  limit: number
): { page: number; limit: number } {
  const validPage = Math.max(1, Math.floor(page));
  const validLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  return { page: validPage, limit: validLimit };
}

// Connection and Database Utilities
export function createConnectionString(config: ConnectionConfig): string {
  const { host, port, database, username, password } = config;
  return `postgresql://${username}:${password}@${host}:${port}/${database}`;
}

export function validateConnectionConfig(config: ConnectionConfig): string[] {
  const errors: string[] = [];

  if (!config.host) errors.push('Host is required');
  if (!config.port || config.port <= 0) errors.push('Valid port is required');
  if (!config.database) errors.push('Database name is required');
  if (!config.username) errors.push('Username is required');
  if (!config.password) errors.push('Password is required');

  return errors;
}

// Cache Utilities
export function createCacheKey(namespace: string, key: string, version?: string): CacheKey {
  return {
    namespace,
    key,
    version: version || '1.0',
  };
}

export function formatCacheKey(cacheKey: CacheKey): string {
  return `${cacheKey.namespace}:${cacheKey.key}:${cacheKey.version}`;
}

export function parseCacheKey(keyString: string): CacheKey | null {
  const parts = keyString.split(':');
  if (parts.length < 2) return null;

  return {
    namespace: parts[0] || 'default',
    key: parts[1] || keyString,
    version: parts[2] || '1.0',
  };
}

// Transaction Utilities
export function createTransactionContext(
  options: Partial<TransactionContext> = {}
): TransactionContext {
  return {
    transactionId: options.transactionId || generateUniqueId(),
    userId: options.userId || 'anonymous',
    sessionId: options.sessionId || generateUniqueId(),
    correlationId: options.correlationId || generateUniqueId(),
    metadata: options.metadata || {},
  };
}

export function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Validation Utilities
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateRequired(value: any, fieldName: string): string | null {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} is required`;
  }
  return null;
}

export function validateLength(
  value: string,
  min: number,
  max: number,
  fieldName: string
): string | null {
  if (!value) return `${fieldName} is required`;
  if (value.length < min) return `${fieldName} must be at least ${min} characters`;
  if (value.length > max) return `${fieldName} must be no more than ${max} characters`;
  return null;
}

export function validatePositiveNumber(value: number, fieldName: string): string | null {
  if (typeof value !== 'number' || value <= 0) {
    return `${fieldName} must be a positive number`;
  }
  return null;
}

// Error Handling Utilities
export function isRetryableError(error: Error): boolean {
  const retryableErrors = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'Connection terminated unexpectedly',
    'Connection lost',
  ];

  return retryableErrors.some(
    errorType => error.message.includes(errorType) || error.name.includes(errorType)
  );
}

export function getErrorCategory(
  error: Error
): 'CONNECTION' | 'VALIDATION' | 'PERMISSION' | 'NOT_FOUND' | 'UNKNOWN' {
  const message = error.message.toLowerCase();

  if (message.includes('connection') || message.includes('network')) {
    return 'CONNECTION';
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return 'VALIDATION';
  }
  if (message.includes('permission') || message.includes('unauthorized')) {
    return 'PERMISSION';
  }
  if (message.includes('not found') || message.includes('does not exist')) {
    return 'NOT_FOUND';
  }

  return 'UNKNOWN';
}

// Metrics Utilities
export function calculateAverageQueryTime(queryTimes: number[]): number {
  if (queryTimes.length === 0) return 0;
  const total = queryTimes.reduce((sum, time) => sum + time, 0);
  return total / queryTimes.length;
}

export function calculateCacheHitRate(hits: number, misses: number): number {
  const total = hits + misses;
  if (total === 0) return 0;
  return (hits / total) * 100;
}

export function createEmptyMetrics(): RepositoryMetrics {
  return {
    queriesPerSecond: 0,
    averageQueryTime: 0,
    slowQueries: 0,
    cacheHitRate: 0,
    errorRate: 0,
    totalQueries: 0,
  };
}

// Data Transformation Utilities
export function sanitizeForExport(data: any): any {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeForExport);
  }

  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive fields
      if (
        !key.toLowerCase().includes('password') &&
        !key.toLowerCase().includes('secret') &&
        !key.toLowerCase().includes('token')
      ) {
        sanitized[key] = sanitizeForExport(value);
      }
    }
    return sanitized;
  }

  return data;
}

export function formatExportFilename(entityType: string, format: string, timestamp?: Date): string {
  const date = timestamp || new Date();
  const dateString = date.toISOString().split('T')[0];
  return `${entityType}-export-${dateString}.${format.toLowerCase()}`;
}

// Bulk Operation Utilities
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Entity Utilities
export function generateEntityId(): string {
  return `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createBaseEntity(id?: string): {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
} {
  const now = new Date();
  return {
    id: id || generateEntityId(),
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

export function updateEntityVersion(entity: any): any {
  return {
    ...entity,
    updatedAt: new Date(),
    version: (entity.version || 1) + 1,
  };
}

// Health Check Utilities
export function checkDatabaseHealth(startTime: Date, endTime: Date, error?: Error) {
  const responseTime = endTime.getTime() - startTime.getTime();
  return {
    connected: !error,
    responseTime,
    healthy: !error && responseTime < 1000,
  };
}

export function aggregateHealthStatus(checks: boolean[]): 'healthy' | 'degraded' | 'unhealthy' {
  const failedChecks = checks.filter(check => !check).length;
  const totalChecks = checks.length;

  if (failedChecks === 0) return 'healthy';
  if (failedChecks <= totalChecks / 2) return 'degraded';
  return 'unhealthy';
}

// Development and Testing Utilities
export function createMockUser(overrides: any = {}) {
  return {
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    roles: ['user'],
    ...createBaseEntity(),
    ...overrides,
  };
}

export function createMockProduct(overrides: any = {}) {
  return {
    name: 'Test Product',
    description: 'A test product',
    price: 99.99,
    category: 'electronics',
    sku: 'TEST-001',
    tags: ['test'],
    isActive: true,
    inventory: {
      quantity: 100,
      reserved: 0,
      available: 100,
      minStock: 10,
      locations: [],
    },
    ...createBaseEntity(),
    ...overrides,
  };
}

export function createMockOrder(overrides: any = {}) {
  return {
    orderNumber: `ORDER-${Date.now()}`,
    customerId: generateEntityId(),
    status: 'pending',
    items: [],
    pricing: {
      subtotal: 0,
      tax: 0,
      shipping: 0,
      discount: 0,
      total: 0,
      currency: 'USD',
    },
    ...createBaseEntity(),
    ...overrides,
  };
}

export const COMMON_QUERY_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 1000,
  DEFAULT_CACHE_TTL: 300, // 5 minutes
  SLOW_QUERY_THRESHOLD: 1000, // 1 second
  MAX_RETRY_ATTEMPTS: 3,
  CONNECTION_TIMEOUT: 30000, // 30 seconds
  QUERY_TIMEOUT: 60000, // 1 minute
} as const;
