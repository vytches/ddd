import type { ModuleMetadata, Provider, Type } from '@nestjs/common';

/**
 * Main configuration options for VytchesDDD NestJS integration
 */
export interface VytchesDDDOptions {
  /**
   * Simple feature selection (intermediate complexity)
   * Example: { features: ['acl', 'cqrs', 'events'] }
   */
  features?: string[];

  /**
   * Legacy auto-discovery of DDD decorators (backward compatibility)
   */
  autoDiscovery?: boolean | AutoDiscoveryOptions;

  /**
   * Plugin-based discovery configuration (advanced)
   */
  discovery?: {
    enabled: boolean;
    plugins?: any[]; // IDiscoveryPlugin instances
    parallel?: boolean;
    timeout?: number;
    debug?: boolean;
  };

  /**
   * Bounded contexts configuration (enterprise)
   */
  contexts?: Record<
    string,
    {
      modules: any[];
      accessMatrix?: string[]; // List of contexts this context can access
    }
  >;

  /**
   * CQRS configuration
   */
  cqrs?: CQRSOptions;

  /**
   * Event system configuration
   */
  events?: EventOptions;

  /**
   * ACL configuration
   */
  acl?: ACLOptions;

  /**
   * Domain Services configuration
   */
  domainServices?: DomainServicesOptions;

  /**
   * Resilience configuration
   */
  resilience?: ResilienceOptions;

  /**
   * Policies configuration
   */
  policies?: PoliciesOptions;

  /**
   * Messaging configuration
   */
  messaging?: MessagingOptions;

  /**
   * Custom container configuration
   */
  container?: ContainerOptions;

  /**
   * Custom NestJS providers (pure NestJS style)
   * These will be added to the module's providers array
   * @example
   * providers: [
   *   { provide: IEventBus, useClass: CustomEventBus },
   *   { provide: ICommandBus, useFactory: () => new CustomCommandBus() },
   * ]
   */
  providers?: Provider[];
}

/**
 * Auto-discovery configuration
 */
export interface AutoDiscoveryOptions {
  /**
   * Enable/disable auto-discovery
   */
  enabled: boolean;

  /**
   * File patterns to scan for decorated classes
   * @default ['**\/*.service.ts', '**\/*.handler.ts']
   */
  patterns?: string[];

  /**
   * Bounded contexts to discover
   */
  contexts?: string[];

  /**
   * Exclude patterns
   */
  exclude?: string[];
}

/**
 * CQRS configuration options
 */
export interface CQRSOptions {
  /**
   * Auto-register command and query handlers
   */
  autoRegisterHandlers?: boolean;

  /**
   * Middleware configuration
   */
  middleware?: MiddlewareConfig[];

  /**
   * Command bus configuration
   */
  commandBus?: {
    /**
     * Implementation to use
     * 'simple' - Basic CommandBus
     * 'enhanced' - EnhancedCommandBus with middleware support
     * Type<ICommandBus> - Custom implementation class
     * Factory function - For dynamic creation
     */
    implementation?: 'simple' | 'enhanced' | Type<any> | (() => any);

    /**
     * Custom provider token (for multiple bus instances)
     */
    token?: string | symbol;

    /**
     * Interface token for dependency injection (e.g., abstract class)
     */
    interfaceToken?: string | symbol | Type<any>;

    /**
     * Configuration options
     */
    timeout?: number;
    retries?: number;

    /**
     * Bus-specific middleware (overrides global)
     */
    middleware?: MiddlewareConfig[];
  };

  /**
   * Query bus configuration
   */
  queryBus?: {
    /**
     * Implementation to use
     * 'simple' - Basic QueryBus
     * 'enhanced' - EnhancedQueryBus with caching
     * Type<IQueryBus> - Custom implementation class
     * Factory function - For dynamic creation
     */
    implementation?: 'simple' | 'enhanced' | Type<any> | (() => any);

    /**
     * Custom provider token (for multiple bus instances)
     */
    token?: string | symbol;

    /**
     * Interface token for dependency injection (e.g., abstract class)
     */
    interfaceToken?: string | symbol | Type<any>;

    /**
     * Configuration options
     */
    timeout?: number;
    cache?: boolean;

    /**
     * Bus-specific middleware (overrides global)
     */
    middleware?: MiddlewareConfig[];
  };
}

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  /**
   * Middleware class
   */
  class: Type<any>;

  /**
   * Middleware options
   */
  options?: Record<string, any>;

  /**
   * Apply only to specific contexts
   */
  contexts?: string[];
}

/**
 * Event system configuration
 */
export interface EventOptions {
  /**
   * Event store configuration
   */
  eventStore?: {
    type: 'memory' | 'postgresql' | 'mongodb';
    config?: Record<string, any>;
  };

  /**
   * Event bus configuration
   */
  eventBus?: {
    type: 'unified' | 'domain' | 'integration';
    config?: Record<string, any>;
    /**
     * Interface token for dependency injection (e.g., abstract class)
     */
    interfaceToken?: string | symbol | Type<any>;
  };

  /**
   * Event dispatcher configuration
   */
  dispatcher?: {
    /**
     * Enable/disable event dispatcher
     */
    enabled?: boolean;
    /**
     * Custom dispatcher implementation
     * Type<IEventDispatcher> - Custom implementation class
     * Factory function - For dynamic creation
     * Instance - Pre-created instance
     */
    implementation?: Type<any> | (() => any) | any;
    /**
     * Custom provider token for dispatcher
     */
    token?: string | symbol | Type<any>;
    /**
     * Interface token for dependency injection (e.g., abstract class)
     */
    interfaceToken?: string | symbol | Type<any>;
  };

  /**
   * Enable event replay
   */
  replay?: boolean;
}

/**
 * ACL configuration
 */
export interface ACLOptions {
  /**
   * ACL adapters to register
   */
  adapters?: Record<string, any>;

  /**
   * Default timeout for ACL operations
   */
  timeout?: number;

  /**
   * Enable circuit breaker for external services
   */
  circuitBreaker?: boolean;

  /**
   * Retry configuration
   */
  retry?: {
    maxAttempts?: number;
    baseDelay?: number;
  };
}

/**
 * Domain Services configuration
 */
export interface DomainServicesOptions {
  /**
   * Domain services to register
   */
  services?: Type<any>[];

  /**
   * Auto-discover domain services
   */
  autoDiscover?: boolean;

  /**
   * Service registration options
   */
  registration?: {
    lifetime?: 'transient' | 'singleton' | 'scoped';
    context?: string;
  };
}

/**
 * Resilience configuration
 */
export interface ResilienceOptions {
  /**
   * Circuit breaker configuration
   */
  circuitBreaker?: {
    failureThreshold?: number;
    resetTimeout?: number;
    halfOpenRequests?: number;
  };

  /**
   * Retry configuration
   */
  retry?: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoff?: 'exponential' | 'linear';
  };

  /**
   * Bulkhead configuration
   */
  bulkhead?: {
    maxConcurrent?: number;
    maxQueue?: number;
  };

  /**
   * Timeout configuration
   */
  timeout?: {
    default?: number;
    perOperation?: Record<string, number>;
  };
}

/**
 * Policies configuration
 */
export interface PoliciesOptions {
  /**
   * Policy definitions to register
   */
  policies?: any[];

  /**
   * Policy registry configuration
   */
  registry?: {
    strict?: boolean;
    throwOnDuplicate?: boolean;
  };

  /**
   * Enable policy caching
   */
  cache?: {
    enabled?: boolean;
    ttl?: number;
  };

  /**
   * Policy execution options
   */
  execution?: {
    timeout?: number;
    parallel?: boolean;
  };
}

/**
 * Messaging configuration
 */
export interface MessagingOptions {
  /**
   * Message broker provider
   */
  provider?: 'redis' | 'rabbitmq' | 'kafka' | 'memory';

  /**
   * Provider configuration
   */
  config?: Record<string, any>;

  /**
   * Enable saga orchestration
   */
  sagas?: boolean;

  /**
   * Saga orchestrator configuration
   */
  orchestrator?: {
    maxConcurrentExecutions?: number;
    enableMetrics?: boolean;
    enableAutoRetry?: boolean;
  };

  /**
   * Outbox pattern configuration
   */
  outbox?: {
    enabled?: boolean;
    pollInterval?: number;
    batchSize?: number;
  };
}

/**
 * Container configuration
 */
export interface ContainerOptions {
  /**
   * Use strict mode (throw on missing dependencies)
   */
  strict?: boolean;

  /**
   * Enable debug logging
   */
  debug?: boolean;

  /**
   * Custom container factory
   */
  factory?: () => any;
}

/**
 * Context-specific configuration options
 */
export interface VytchesDDDContextOptions {
  /**
   * Context name
   */
  name: string;

  /**
   * Create isolated container for this context
   */
  isolated?: boolean;

  /**
   * Override global settings for this context
   */
  overrides?: Partial<VytchesDDDOptions>;

  /**
   * Context-specific middleware
   */
  middleware?: MiddlewareConfig[];

  /**
   * Context-specific resilience settings
   */
  resilience?: 'standard' | 'critical' | 'relaxed';
}

/**
 * Feature module options
 */
export interface VytchesDDDFeatureOptions {
  /**
   * Services to register
   */
  services?: string[] | Type<any>[];

  /**
   * Command/Query handlers to register
   */
  handlers?: Type<any>[];

  /**
   * Event handlers to register
   */
  eventHandlers?: Type<any>[];

  /**
   * Bounded context for this feature
   */
  context?: string;

  /**
   * Override settings for this feature
   */
  overrides?: Partial<VytchesDDDOptions>;
}

/**
 * Testing module options
 */
export interface VytchesDDDTestOptions {
  /**
   * Mock services
   */
  mocks?: Record<string, any>;

  /**
   * Override configuration
   */
  overrides?: Partial<VytchesDDDOptions>;

  /**
   * Enable debug mode
   */
  debug?: boolean;
}

/**
 * Module async options
 */
export interface VytchesDDDAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /**
   * Injection token for options
   */
  inject?: any[];

  /**
   * Factory function to create options
   */
  useFactory?: (...args: any[]) => Promise<VytchesDDDOptions> | VytchesDDDOptions;

  /**
   * Use existing options provider
   */
  useExisting?: Type<VytchesDDDOptionsFactory>;

  /**
   * Use class as options provider
   */
  useClass?: Type<VytchesDDDOptionsFactory>;
}

/**
 * Options factory interface
 */
export interface VytchesDDDOptionsFactory {
  createVytchesDDDOptions(): Promise<VytchesDDDOptions> | VytchesDDDOptions;
}
