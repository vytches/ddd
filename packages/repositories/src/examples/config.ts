/**
 * @fileoverview Configuration system for @vytches/ddd-repositories examples
 *
 * This module provides comprehensive configuration management for all repository
 * examples, including framework integrations, performance settings, and
 * environment-specific configurations.
 *
 * @example
 * ```typescript
 * import { exampleConfig, getFrameworkConfig } from './config';
 *
 * // Get basic configuration
 * const config = exampleConfig.basic.userRepository;
 *
 * // Get NestJS-specific configuration
 * const nestjsConfig = getFrameworkConfig('nestjs', 'intermediate');
 * ```
 */

import { EntityId } from '@vytches/ddd-contracts';
import { randomUUID } from 'crypto';

// ===== TYPES AND INTERFACES =====

export interface DatabaseConfig {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite' | 'redis';
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  connectionPoolSize?: number;
  ssl?: boolean;
  timeout?: number;
}

export interface CacheConfig {
  enabled: boolean;
  provider: 'redis' | 'memcached' | 'in-memory';
  ttl: number;
  maxSize?: number;
  compressionEnabled?: boolean;
}

export interface PerformanceConfig {
  batchSize: number;
  maxConcurrentOperations: number;
  enableOptimisticLocking: boolean;
  enableQueryOptimization: boolean;
  memoryPoolSize?: number;
  enableMetrics: boolean;
}

export interface EventSourcingConfig {
  enableEventStore: boolean;
  eventStoreType: 'postgresql' | 'eventstore' | 'mongodb';
  snapshotFrequency: number;
  enableProjections: boolean;
  compressionAlgorithm?: 'gzip' | 'lz4' | 'snappy';
}

export interface MultiTenantConfig {
  enabled: boolean;
  isolationLevel: 'SHARED' | 'ISOLATED' | 'DEDICATED';
  tenantIdField: string;
  enableTenantValidation: boolean;
  enableCrossTenantQueries: boolean;
}

export interface AIConfig {
  enabled: boolean;
  models: string[];
  trainingDataRetention: number;
  retrainingThreshold: number;
  enablePredictiveCaching: boolean;
  enableQueryOptimization: boolean;
  enableAccessPatternLearning: boolean;
}

export interface DistributedConfig {
  enabled: boolean;
  regions: string[];
  consistencyLevel: 'eventual' | 'strong' | 'linearizable';
  replicationStrategy: 'master-slave' | 'multi-master' | 'consensus';
  enableCrossRegionFailover: boolean;
}

export interface ExampleConfig {
  database: DatabaseConfig;
  cache: CacheConfig;
  performance: PerformanceConfig;
  eventSourcing: EventSourcingConfig;
  multiTenant: MultiTenantConfig;
  ai: AIConfig;
  distributed: DistributedConfig;
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableStructuredLogging: boolean;
    enableMetrics: boolean;
  };
}

export interface FrameworkConfig extends ExampleConfig {
  framework: 'nestjs' | 'express' | 'fastify' | 'manual';
  moduleConfig?: Record<string, unknown>;
  decoratorConfig?: Record<string, unknown>;
  diConfig?: Record<string, unknown>;
}

export type ComplexityLevel = 'basic' | 'intermediate' | 'advanced';
export type ExampleType = 'domain' | 'framework';

// ===== CONFIGURATION PRESETS =====

/**
 * Basic configuration for simple repository examples
 */
export const basicConfig: ExampleConfig = {
  database: {
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: 'vytches_ddd_examples',
    connectionPoolSize: 10,
    timeout: 30000,
  },
  cache: {
    enabled: true,
    provider: 'in-memory',
    ttl: 300000, // 5 minutes
    maxSize: 10000,
  },
  performance: {
    batchSize: 100,
    maxConcurrentOperations: 50,
    enableOptimisticLocking: true,
    enableQueryOptimization: true,
    enableMetrics: true,
  },
  eventSourcing: {
    enableEventStore: false,
    eventStoreType: 'postgresql',
    snapshotFrequency: 100,
    enableProjections: false,
  },
  multiTenant: {
    enabled: false,
    isolationLevel: 'SHARED',
    tenantIdField: 'tenantId',
    enableTenantValidation: true,
    enableCrossTenantQueries: false,
  },
  ai: {
    enabled: false,
    models: [],
    trainingDataRetention: 7,
    retrainingThreshold: 0.1,
    enablePredictiveCaching: false,
    enableQueryOptimization: false,
    enableAccessPatternLearning: false,
  },
  distributed: {
    enabled: false,
    regions: ['local'],
    consistencyLevel: 'strong',
    replicationStrategy: 'master-slave',
    enableCrossRegionFailover: false,
  },
  logging: {
    level: 'info',
    enableStructuredLogging: true,
    enableMetrics: true,
  },
};

/**
 * Intermediate configuration with advanced features enabled
 */
export const intermediateConfig: ExampleConfig = {
  ...basicConfig,
  cache: {
    ...basicConfig.cache,
    provider: 'redis',
    ttl: 600000, // 10 minutes
    compressionEnabled: true,
  },
  performance: {
    ...basicConfig.performance,
    batchSize: 1000,
    maxConcurrentOperations: 100,
    memoryPoolSize: 50000,
  },
  eventSourcing: {
    enableEventStore: true,
    eventStoreType: 'postgresql',
    snapshotFrequency: 50,
    enableProjections: true,
    compressionAlgorithm: 'gzip',
  },
  multiTenant: {
    enabled: true,
    isolationLevel: 'ISOLATED',
    tenantIdField: 'tenantId',
    enableTenantValidation: true,
    enableCrossTenantQueries: true,
  },
  logging: {
    level: 'debug',
    enableStructuredLogging: true,
    enableMetrics: true,
  },
};

/**
 * Advanced configuration with all features enabled for enterprise scenarios
 */
export const advancedConfig: ExampleConfig = {
  ...intermediateConfig,
  database: {
    ...intermediateConfig.database,
    connectionPoolSize: 100,
    timeout: 60000,
  },
  cache: {
    ...intermediateConfig.cache,
    maxSize: 1000000,
    compressionEnabled: true,
  },
  performance: {
    ...intermediateConfig.performance,
    batchSize: 10000,
    maxConcurrentOperations: 500,
    memoryPoolSize: 1000000,
  },
  eventSourcing: {
    ...intermediateConfig.eventSourcing,
    snapshotFrequency: 25,
    compressionAlgorithm: 'lz4',
  },
  multiTenant: {
    ...intermediateConfig.multiTenant,
    isolationLevel: 'DEDICATED',
  },
  ai: {
    enabled: true,
    models: ['predictive_cache', 'query_optimizer', 'pattern_analyzer'],
    trainingDataRetention: 30,
    retrainingThreshold: 0.05,
    enablePredictiveCaching: true,
    enableQueryOptimization: true,
    enableAccessPatternLearning: true,
  },
  distributed: {
    enabled: true,
    regions: ['us-east', 'eu-west', 'asia-pacific'],
    consistencyLevel: 'linearizable',
    replicationStrategy: 'multi-master',
    enableCrossRegionFailover: true,
  },
};

/**
 * High-frequency trading configuration optimized for extreme performance
 */
export const highFrequencyTradingConfig: ExampleConfig = {
  database: {
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: 'hft_trading',
    connectionPoolSize: 200,
    timeout: 1000, // Very short timeout
    ssl: false, // Disable SSL for performance
  },
  cache: {
    enabled: true,
    provider: 'in-memory', // Fastest cache
    ttl: 1000, // 1 second TTL
    maxSize: 10000000, // Large cache
  },
  performance: {
    batchSize: 50000,
    maxConcurrentOperations: 1000,
    enableOptimisticLocking: true,
    enableQueryOptimization: true,
    memoryPoolSize: 100000000, // 100MB pool
    enableMetrics: true,
  },
  eventSourcing: {
    enableEventStore: true,
    eventStoreType: 'postgresql',
    snapshotFrequency: 10000, // Frequent snapshots
    enableProjections: true,
    compressionAlgorithm: 'lz4', // Fast compression
  },
  multiTenant: {
    enabled: false, // Disabled for performance
    isolationLevel: 'SHARED',
    tenantIdField: 'tenantId',
    enableTenantValidation: false,
    enableCrossTenantQueries: false,
  },
  ai: {
    enabled: true,
    models: ['ultra_fast_predictor', 'latency_optimizer'],
    trainingDataRetention: 1, // 1 day only
    retrainingThreshold: 0.02,
    enablePredictiveCaching: true,
    enableQueryOptimization: true,
    enableAccessPatternLearning: true,
  },
  distributed: {
    enabled: true,
    regions: ['us-east-1a', 'us-east-1b', 'us-east-1c'], // Same AZ for lowest latency
    consistencyLevel: 'eventual', // Accept eventual consistency for speed
    replicationStrategy: 'master-slave',
    enableCrossRegionFailover: true,
  },
  logging: {
    level: 'warn', // Minimal logging for performance
    enableStructuredLogging: true,
    enableMetrics: true,
  },
};

// ===== CONFIGURATION COLLECTIONS =====

/**
 * Organized configuration for all examples by complexity level
 */
export const exampleConfig = {
  basic: {
    userRepository: basicConfig,
    productRepository: basicConfig,
    orderRepository: basicConfig,
  },
  intermediate: {
    financialUnitOfWork: intermediateConfig,
    productSpecification: intermediateConfig,
    multiTenantUser: intermediateConfig,
  },
  advanced: {
    globalTradingAccount: advancedConfig,
    highFrequencyTrading: highFrequencyTradingConfig,
    intelligentCustomer: advancedConfig,
  },
};

// ===== FRAMEWORK-SPECIFIC CONFIGURATIONS =====

/**
 * NestJS-specific configuration extensions
 */
export const nestjsConfigurations = {
  basic: {
    moduleConfig: {
      imports: ['TypeOrmModule', 'CacheModule'],
      providers: ['UserRepository', 'UserService'],
      controllers: ['UserController'],
      exports: ['UserService'],
    },
    decoratorConfig: {
      useInjectableDecorator: true,
      useRepositoryDecorator: false,
      useEntityDecorator: true,
    },
    diConfig: {
      useNestJSDI: true,
      useVytchesDI: false,
      containerType: 'standard',
    },
  },
  intermediate: {
    moduleConfig: {
      imports: ['TypeOrmModule', 'CacheModule', 'EventEmitterModule', 'BullModule'],
      providers: ['UserRepository', 'UserService', 'UnitOfWorkFactory', 'SpecificationRegistry'],
      controllers: ['UserController', 'AdminController'],
      exports: ['UserService', 'UnitOfWorkFactory'],
    },
    decoratorConfig: {
      useInjectableDecorator: true,
      useRepositoryDecorator: true,
      useEntityDecorator: true,
      useEventHandlerDecorator: true,
    },
    diConfig: {
      useNestJSDI: true,
      useVytchesDI: true, // Hybrid approach
      containerType: 'advanced',
    },
  },
  advanced: {
    moduleConfig: {
      imports: [
        'TypeOrmModule',
        'CacheModule',
        'EventEmitterModule',
        'BullModule',
        'ElasticsearchModule',
        'PrometheusModule',
      ],
      providers: [
        'UserRepository',
        'UserService',
        'AIRepositoryOrchestrator',
        'GlobalConsistencyManager',
        'TensorFlowModule',
      ],
      controllers: ['UserController', 'AdminController', 'MetricsController'],
      exports: ['UserService', 'AIRepositoryOrchestrator'],
    },
    decoratorConfig: {
      useInjectableDecorator: true,
      useRepositoryDecorator: true,
      useEntityDecorator: true,
      useEventHandlerDecorator: true,
      useMetricsDecorator: true,
      useCircuitBreakerDecorator: true,
    },
    diConfig: {
      useNestJSDI: false, // Use only VytchesDDD DI for advanced scenarios
      useVytchesDI: true,
      containerType: 'enterprise',
    },
  },
};

/**
 * Express.js-specific configuration extensions
 */
export const expressConfigurations = {
  basic: {
    middlewares: ['cors', 'body-parser', 'helmet'],
    routeConfig: {
      prefix: '/api',
      versionPrefix: '/v1',
      enableOpenAPI: false,
    },
  },
  intermediate: {
    middlewares: ['cors', 'body-parser', 'helmet', 'compression', 'rate-limiter'],
    routeConfig: {
      prefix: '/api',
      versionPrefix: '/v1',
      enableOpenAPI: true,
      enableMetrics: true,
    },
  },
  advanced: {
    middlewares: [
      'cors',
      'body-parser',
      'helmet',
      'compression',
      'rate-limiter',
      'prometheus-metrics',
      'request-tracing',
    ],
    routeConfig: {
      prefix: '/api',
      versionPrefix: '/v1',
      enableOpenAPI: true,
      enableMetrics: true,
      enableTracing: true,
    },
  },
};

// ===== CONFIGURATION UTILITIES =====

/**
 * Get framework-specific configuration
 */
export function getFrameworkConfig(
  framework: 'nestjs' | 'express' | 'fastify',
  complexity: ComplexityLevel
): FrameworkConfig {
  const level = complexity;

  // Get the appropriate config based on complexity level
  let baseConfig: ExampleConfig;
  switch (level) {
    case 'basic':
      baseConfig = exampleConfig.basic.userRepository;
      break;
    case 'intermediate':
      baseConfig = exampleConfig.intermediate.financialUnitOfWork;
      break;
    case 'advanced':
      baseConfig = exampleConfig.advanced.globalTradingAccount;
      break;
    default:
      baseConfig = exampleConfig.basic.userRepository;
      break;
  }

  switch (framework) {
    case 'nestjs':
      return {
        ...baseConfig,
        framework,
        moduleConfig: nestjsConfigurations[complexity].moduleConfig,
        decoratorConfig: nestjsConfigurations[complexity].decoratorConfig,
        diConfig: nestjsConfigurations[complexity].diConfig,
      };

    case 'express':
      return {
        ...baseConfig,
        framework,
        moduleConfig: expressConfigurations[complexity],
      };

    case 'fastify':
      return {
        ...baseConfig,
        framework,
        moduleConfig: {
          plugins: ['@fastify/cors', '@fastify/helmet', '@fastify/redis'],
          routePrefix: '/api/v1',
        },
      };

    default:
      throw new Error(`Unsupported framework: ${framework}`);
  }
}

/**
 * Get environment-specific configuration overrides
 */
export function getEnvironmentConfig(
  environment: 'development' | 'staging' | 'production'
): Partial<ExampleConfig> {
  const commonOverrides = {
    development: {
      logging: { level: 'debug' as const },
      database: { timeout: 60000 },
      cache: { ttl: 60000 }, // 1 minute cache in dev
    },
    staging: {
      logging: { level: 'info' as const },
      database: { timeout: 30000 },
      performance: { enableMetrics: true },
    },
    production: {
      logging: { level: 'warn' as const },
      database: { timeout: 15000, ssl: true },
      cache: { compressionEnabled: true },
      performance: { enableMetrics: true, enableQueryOptimization: true },
    },
  };

  return commonOverrides[environment] as Partial<ExampleConfig>;
}

/**
 * Merge configurations with deep merge support
 */
export function mergeConfigurations(...configs: Partial<ExampleConfig>[]): Partial<ExampleConfig> {
  return configs.reduce((merged, config) => {
    return deepMerge(merged, config);
  }, basicConfig);
}

/**
 * Validate configuration completeness and correctness
 */
export function validateConfiguration(config: ExampleConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate database configuration
  if (!config.database.host) {
    errors.push('Database host is required');
  }
  if (!config.database.database) {
    errors.push('Database name is required');
  }
  if (config.database.port <= 0 || config.database.port > 65535) {
    errors.push('Database port must be between 1 and 65535');
  }

  // Validate performance settings
  if (config.performance.batchSize <= 0) {
    errors.push('Batch size must be greater than 0');
  }
  if (config.performance.maxConcurrentOperations <= 0) {
    errors.push('Max concurrent operations must be greater than 0');
  }

  // Validate cache configuration
  if (config.cache.enabled && config.cache.ttl <= 0) {
    errors.push('Cache TTL must be greater than 0 when cache is enabled');
  }

  // Validate multi-tenant configuration
  if (config.multiTenant.enabled && !config.multiTenant.tenantIdField) {
    errors.push('Tenant ID field is required when multi-tenancy is enabled');
  }

  // Validate distributed configuration
  if (config.distributed.enabled && config.distributed.regions.length === 0) {
    errors.push('At least one region must be specified when distributed mode is enabled');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sample data configuration interface
 */
interface SampleDataConfig {
  users: {
    count: number;
    fields: {
      id: () => string;
      email: () => string;
      name: () => string;
      createdAt: () => Date;
      isActive: () => boolean;
    };
  };
  products: {
    count: number;
    fields: {
      id: () => string;
      name: () => string;
      price: () => number;
      inStock: () => boolean;
    };
  };
}

/**
 * Generate sample data configuration for testing
 */
export function generateSampleDataConfig(recordCount = 1000): SampleDataConfig {
  return {
    users: {
      count: recordCount,
      fields: {
        id: () => EntityId.createUuid(randomUUID()).value,
        email: () => `user${Math.floor(Math.random() * 10000)}@example.com`,
        name: () => `User ${Math.floor(Math.random() * 10000)}`,
        createdAt: () => new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        isActive: () => Math.random() > 0.1,
      },
    },
    products: {
      count: Math.floor(recordCount * 0.1),
      fields: {
        id: () => EntityId.createUuid(randomUUID()).value,
        name: () => `Product ${Math.floor(Math.random() * 1000)}`,
        price: () => Math.floor(Math.random() * 10000) / 100,
        inStock: () => Math.random() > 0.2,
      },
    },
  };
}

// ===== HELPER FUNCTIONS =====

/**
 * Deep merge utility function
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target } as T;

  for (const key in source) {
    const sourceValue = source[key];
    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      result[key] = deepMerge(
        (target[key] as Record<string, unknown>) || {},
        sourceValue as Record<string, unknown>
      ) as T[Extract<keyof T, string>];
    } else {
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Configuration presets for common scenarios
 */
export const configurationPresets = {
  /**
   * E-commerce platform configuration
   */
  ecommerce: mergeConfigurations(intermediateConfig, {
    multiTenant: {
      enabled: true,
      isolationLevel: 'ISOLATED',
      tenantIdField: 'tenantId',
      enableTenantValidation: true,
      enableCrossTenantQueries: false,
    },
    cache: {
      enabled: true,
      provider: 'redis',
      ttl: 300000,
      maxSize: 100000,
    },
    performance: {
      batchSize: 500,
      maxConcurrentOperations: 200,
      enableOptimisticLocking: true,
      enableQueryOptimization: true,
      enableMetrics: true,
    },
  }),

  /**
   * Financial services configuration
   */
  financial: mergeConfigurations(advancedConfig, {
    eventSourcing: {
      enableEventStore: true,
      eventStoreType: 'postgresql',
      snapshotFrequency: 10,
      enableProjections: true,
      compressionAlgorithm: 'lz4',
    },
    distributed: {
      enabled: true,
      regions: ['us-east-1', 'eu-west-1'],
      replicationStrategy: 'master-slave',
      consistencyLevel: 'linearizable',
      enableCrossRegionFailover: true,
    },
    logging: {
      level: 'info',
      enableStructuredLogging: true,
      enableMetrics: true,
    },
  }),

  /**
   * IoT platform configuration
   */
  iot: mergeConfigurations(intermediateConfig, {
    performance: {
      batchSize: 10000,
      maxConcurrentOperations: 1000,
      enableOptimisticLocking: true,
      enableQueryOptimization: true,
      enableMetrics: true,
    },
    cache: {
      enabled: true,
      ttl: 60000,
      provider: 'redis',
    },
    ai: {
      enabled: true,
      models: ['pattern-recognition', 'predictive-caching'],
      trainingDataRetention: 90,
      retrainingThreshold: 0.8,
      enablePredictiveCaching: true,
      enableQueryOptimization: true,
      enableAccessPatternLearning: true,
    },
  }),

  /**
   * Gaming platform configuration
   */
  gaming: mergeConfigurations(intermediateConfig, {
    cache: {
      enabled: true,
      ttl: 30000,
      provider: 'in-memory',
    },
    performance: {
      enableOptimisticLocking: false,
      batchSize: 1000,
      maxConcurrentOperations: 500,
      enableQueryOptimization: true,
      enableMetrics: true,
    },
    distributed: {
      enabled: true,
      regions: ['us-west-2'],
      replicationStrategy: 'multi-master',
      consistencyLevel: 'eventual',
      enableCrossRegionFailover: false,
    },
  }),
};

// Export default configuration
export default exampleConfig;
