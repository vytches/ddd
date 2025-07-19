# Base Types

These are shared fundamental types used across package examples. Import them from your application's base type definitions.

```typescript
// Import from your application
import { 
  BaseEntity, 
  Money, 
  EntityId, 
  Result, 
  BaseDomainEvent,
  DomainError,
  ValidationResult,
  AuditInfo,
  Pagination,
  QueryResult,
  CommandResult,
  ServiceResponse
} from './types';

// Or define inline if needed:

/**
 * Base entity with common fields
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Money value object
 */
export interface Money {
  value: number;
  currency: string;
}

/**
 * Entity ID value object
 */
export interface EntityId {
  value: string;
  type?: string;
}

/**
 * Common result pattern
 */
export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

/**
 * Common domain event structure
 */
export interface BaseDomainEvent {
  eventType: string;
  aggregateId: string;
  occurredAt: Date;
  payload: any;
}

/**
 * Common error types
 */
export interface DomainError {
  code: string;
  message: string;
  details?: any;
}

/**
 * Common validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Common audit information
 */
export interface AuditInfo {
  userId: string;
  timestamp: Date;
  action: string;
  details?: any;
}

/**
 * Common pagination
 */
export interface Pagination {
  page: number;
  size: number;
  total: number;
}

/**
 * Common query result
 */
export interface QueryResult<T> {
  data: T[];
  pagination: Pagination;
  totalCount: number;
}

/**
 * Common command result
 */
export interface CommandResult {
  success: boolean;
  id?: string;
  message?: string;
  errors?: string[];
}

/**
 * Common service response
 */
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}
```