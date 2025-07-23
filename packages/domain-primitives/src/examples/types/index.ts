// Domain Primitives Example Types
// These types are used in the documentation examples to demonstrate
// domain primitive patterns and usage scenarios

// ==================
// Error Types
// ==================

export interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface CreateUserDto {
  email: string;
  name: string;
  password: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

export interface ErrorContext {
  userId?: string;
  correlationId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: Date;
  };
}

// ==================
// Actor Types
// ==================

export interface AuditEntry {
  id: string;
  actor: {
    type: string;
    id: string;
    source: string;
    metadata?: Record<string, unknown>;
  };
  action: string;
  resource: string;
  timestamp: Date;
  changes?: Record<string, unknown>;
  result: 'success' | 'failure';
}

export interface ActionContext {
  requestId: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  permissions?: string[];
}

export interface ActorMetadata {
  name?: string;
  email?: string;
  department?: string;
  role?: string;
  organization?: string;
  location?: string;
}

// ==================
// Domain Interface Types
// ==================

export interface DomainEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface DomainEvent {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  metadata: {
    actor: {
      type: string;
      id: string;
    };
    timestamp: Date;
    version: number;
  };
}

export interface Repository<T extends DomainEntity> {
  save(entity: T): Promise<T>;
  findById(id: string): Promise<T | null>;
  delete(id: string): Promise<void>;
}

// ==================
// Intermediate Types
// ==================

export interface ErrorHierarchy {
  baseError: string;
  categories: {
    domain: string[];
    application: string[];
    infrastructure: string[];
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ActorContext {
  actor: {
    type: string;
    id: string;
    source: string;
  };
  context: {
    environment: string;
    service: string;
    version: string;
    region?: string;
  };
  metadata: Record<string, unknown>;
}

export interface CompositePattern {
  errors: ErrorHierarchy[];
  actors: ActorContext[];
  interfaces: Array<{
    name: string;
    contracts: string[];
  }>;
}

// ==================
// Advanced Types
// ==================

export interface DistributedError {
  originService: string;
  propagationPath: string[];
  errorChain: Array<{
    service: string;
    error: {
      code: string;
      message: string;
      timestamp: Date;
    };
  }>;
  correlationId: string;
  rootCause?: {
    service: string;
    error: unknown;
  };
}

export interface ActorOrchestration {
  orchestratorId: string;
  actors: Array<{
    id: string;
    type: string;
    role: string;
    status: 'active' | 'pending' | 'completed' | 'failed';
  }>;
  workflow: {
    steps: Array<{
      id: string;
      actorId: string;
      action: string;
      status: string;
      result?: unknown;
    }>;
  };
  startTime: Date;
  endTime?: Date;
}

export interface AIEnhancedPrimitive {
  errorPrediction: {
    likelihood: number;
    predictedErrors: Array<{
      type: string;
      probability: number;
      preventiveAction: string;
    }>;
  };
  actorIntelligence: {
    behaviorPattern: string;
    anomalyScore: number;
    recommendations: string[];
  };
}

// ==================
// Framework Integration Types
// ==================

export interface NestJSErrorFilter {
  catch(exception: unknown, host: unknown): void;
}

export interface NestJSActorInterceptor {
  intercept(context: unknown, next: unknown): unknown;
}

export interface DIConfiguration {
  providers: Array<{
    provide: string;
    useClass?: unknown;
    useFactory?: () => unknown;
    inject?: string[];
  }>;
}

// ==================
// Response Types
// ==================

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  metadata?: {
    timestamp: Date;
    version: string;
    [key: string]: unknown;
  };
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// Export type utilities
export type Result<T, E = Error> = SuccessResponse<T> | ErrorResponse;
