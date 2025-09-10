import type { ModuleMetadata, Type } from '@nestjs/common';

/**
 * Main configuration options for VytchesDDD NestJS integration
 */
export interface VytchesDDDOptions {
  /**
   * Enable auto-discovery of DDD decorators
   */
  autoDiscovery?: boolean | AutoDiscoveryOptions;

  /**
   * CQRS configuration
   */
  cqrs?: CQRSOptions;

  /**
   * Event system configuration
   */
  events?: EventOptions;

  /**
   * Messaging configuration
   */
  messaging?: MessagingOptions;

  /**
   * Custom container configuration
   */
  container?: ContainerOptions;
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
    timeout?: number;
    retries?: number;
  };

  /**
   * Query bus configuration
   */
  queryBus?: {
    timeout?: number;
    cache?: boolean;
  };
}

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  /**
   * Middleware class
   */
  class: Type<unknown>;

  /**
   * Middleware options
   */
  options?: Record<string, unknown>;

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
    config?: Record<string, unknown>;
  };

  /**
   * Event bus configuration
   */
  eventBus?: {
    type: 'unified' | 'domain' | 'integration';
    config?: Record<string, unknown>;
  };

  /**
   * Enable event replay
   */
  replay?: boolean;
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
  config?: Record<string, unknown>;

  /**
   * Enable saga orchestration
   */
  sagas?: boolean;
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
  factory?: () => unknown;
}

/**
 * Feature module options
 */
export interface VytchesDDDFeatureOptions {
  /**
   * Services to register
   */
  services?: string[] | Type<unknown>[];

  /**
   * Command/Query handlers to register
   */
  handlers?: Type<unknown>[];

  /**
   * Event handlers to register
   */
  eventHandlers?: Type<unknown>[];

  /**
   * Bounded context for this feature
   */
  context?: string;
}

/**
 * Testing module options
 */
export interface VytchesDDDTestOptions {
  /**
   * Mock services
   */
  mocks?: Record<string, unknown>;

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
  inject?: unknown[];

  /**
   * Factory function to create options
   */
  useFactory?: (...args: unknown[]) => Promise<VytchesDDDOptions> | VytchesDDDOptions;

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
