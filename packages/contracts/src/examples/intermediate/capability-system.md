# Capability System Architecture

**Version**: 1.0.0
**Package**: @vytches-ddd/contracts
**Complexity**: Intermediate
**Domain**: Foundation
**Patterns**: capability-registry, extensible-architecture, plugin-system
**Dependencies**: @vytches-ddd/contracts

## Description

The capability system provides an extensible architecture for adding cross-cutting functionality to domain objects. Capabilities can be dynamically registered, discovered, and composed to create flexible and maintainable systems that support features like caching, logging, validation, and custom business behaviors.

## Business Context

Modern applications need flexible architecture that allows adding functionality without modifying core domain logic. The capability system enables features like audit logging, caching, performance monitoring, and business-specific behaviors to be added declaratively and composed together for powerful combinations.

## Core Capability System

### Base Capability Implementation

```typescript
// src/domain/capabilities/capability-foundation.ts
import { 
  ICapability, 
  CapabilityMetadata, 
  ICapabilityRegistry,
  CapabilityType 
} from '@vytches-ddd/contracts';

// Base capability class
export abstract class BaseCapability implements ICapability {
  constructor(
    public readonly name: string,
    public readonly type: CapabilityType,
    public readonly metadata: CapabilityMetadata = {}
  ) {
    this.metadata = {
      version: '1.0.0',
      description: '',
      dependencies: [],
      priority: 0,
      enabled: true,
      ...metadata
    };
  }

  abstract execute(context: CapabilityContext): Promise<CapabilityResult>;

  // Lifecycle methods
  async initialize(): Promise<void> {
    // Override in implementations
  }

  async dispose(): Promise<void> {
    // Override in implementations
  }

  // Capability introspection
  canExecute(context: CapabilityContext): boolean {
    return this.metadata.enabled ?? true;
  }

  getConfiguration(): Record<string, any> {
    return this.metadata.configuration || {};
  }

  updateConfiguration(config: Record<string, any>): void {
    this.metadata.configuration = { ...this.metadata.configuration, ...config };
  }
}

// Capability context for execution
export interface CapabilityContext {
  operation: string;
  target: any;
  parameters: Record<string, any>;
  metadata: Record<string, any>;
  timestamp: Date;
}

// Capability execution result
export interface CapabilityResult {
  success: boolean;
  data?: any;
  error?: Error;
  metadata?: Record<string, any>;
  continueExecution: boolean;
}
```

### Logging Capability

```typescript
// src/capabilities/logging/logging-capability.ts
export class LoggingCapability extends BaseCapability {
  constructor(
    private readonly logger: ILogger,
    metadata: CapabilityMetadata = {}
  ) {
    super('logging', 'cross-cutting', {
      ...metadata,
      description: 'Provides comprehensive logging for operations',
      priority: 100 // High priority for logging
    });
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    const { operation, target, parameters, metadata } = context;

    try {
      // Log operation start
      this.logger.info('Operation started', {
        operation,
        target: target.constructor.name,
        parameters: this.sanitizeParameters(parameters),
        correlationId: metadata.correlationId,
        timestamp: context.timestamp
      });

      // For post-operation logging, return success to continue
      return {
        success: true,
        continueExecution: true,
        metadata: {
          loggedAt: new Date(),
          logLevel: 'info'
        }
      };

    } catch (error) {
      this.logger.error('Logging capability failed', {
        operation,
        error: error.message
      });

      // Don't fail the operation if logging fails
      return {
        success: false,
        error,
        continueExecution: true
      };
    }
  }

  private sanitizeParameters(parameters: Record<string, any>): Record<string, any> {
    const sanitized = { ...parameters };
    
    // Remove sensitive information
    const sensitiveKeys = ['password', 'token', 'secret', 'key'];
    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

// Performance logging capability
export class PerformanceLoggingCapability extends BaseCapability {
  private startTimes = new Map<string, number>();

  constructor(
    private readonly logger: ILogger,
    metadata: CapabilityMetadata = {}
  ) {
    super('performance-logging', 'monitoring', {
      ...metadata,
      description: 'Tracks operation performance metrics',
      priority: 90
    });
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    const { operation, target, metadata } = context;
    const operationKey = `${target.constructor.name}.${operation}`;

    if (metadata.phase === 'before') {
      // Record start time
      this.startTimes.set(operationKey, Date.now());
    } else if (metadata.phase === 'after') {
      // Calculate duration and log
      const startTime = this.startTimes.get(operationKey);
      if (startTime) {
        const duration = Date.now() - startTime;
        
        this.logger.info('Operation completed', {
          operation: operationKey,
          duration: `${duration}ms`,
          correlationId: metadata.correlationId
        });

        // Clean up
        this.startTimes.delete(operationKey);

        // Log performance warnings for slow operations
        if (duration > 1000) {
          this.logger.warn('Slow operation detected', {
            operation: operationKey,
            duration: `${duration}ms`
          });
        }
      }
    }

    return {
      success: true,
      continueExecution: true,
      metadata: {
        performanceTracked: true
      }
    };
  }
}
```

### Caching Capability

```typescript
// src/capabilities/caching/caching-capability.ts
export class CachingCapability extends BaseCapability {
  constructor(
    private readonly cache: ICache,
    metadata: CapabilityMetadata = {}
  ) {
    super('caching', 'performance', {
      ...metadata,
      description: 'Provides intelligent caching for operations',
      priority: 200, // Higher priority to execute before business logic
      configuration: {
        ttl: 3600, // 1 hour default
        maxSize: 1000,
        keyPrefix: 'capability_cache_'
      }
    });
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    const { operation, target, parameters, metadata } = context;
    const config = this.getConfiguration();

    // Only cache read operations by default
    if (metadata.phase !== 'before' || !this.isCacheableOperation(operation)) {
      return {
        success: true,
        continueExecution: true
      };
    }

    try {
      const cacheKey = this.generateCacheKey(target, operation, parameters);
      const cachedResult = await this.cache.get(cacheKey);

      if (cachedResult !== null) {
        // Cache hit - return cached result and stop execution
        return {
          success: true,
          data: cachedResult,
          continueExecution: false, // Stop execution, use cached result
          metadata: {
            cacheHit: true,
            cacheKey
          }
        };
      }

      // Cache miss - continue execution and store result later
      return {
        success: true,
        continueExecution: true,
        metadata: {
          cacheKey,
          shouldCache: true
        }
      };

    } catch (error) {
      // If caching fails, continue with normal execution
      return {
        success: false,
        error,
        continueExecution: true
      };
    }
  }

  // Post-execution method to cache results
  async cacheResult(
    cacheKey: string,
    result: any,
    ttl?: number
  ): Promise<void> {
    const config = this.getConfiguration();
    const actualTtl = ttl || config.ttl;

    try {
      await this.cache.set(cacheKey, result, actualTtl);
    } catch (error) {
      // Log cache write failure but don't throw
      console.warn('Failed to cache result:', error.message);
    }
  }

  private isCacheableOperation(operation: string): boolean {
    const cacheableOperations = ['get', 'find', 'search', 'query', 'list'];
    return cacheableOperations.some(op => operation.toLowerCase().includes(op));
  }

  private generateCacheKey(
    target: any,
    operation: string,
    parameters: Record<string, any>
  ): string {
    const config = this.getConfiguration();
    const keyBase = `${config.keyPrefix}${target.constructor.name}.${operation}`;
    
    // Create deterministic key from parameters
    const paramString = this.serializeParameters(parameters);
    const hash = this.simpleHash(paramString);
    
    return `${keyBase}.${hash}`;
  }

  private serializeParameters(parameters: Record<string, any>): string {
    // Sort keys for consistent serialization
    const sortedKeys = Object.keys(parameters).sort();
    const sortedParams: Record<string, any> = {};
    
    for (const key of sortedKeys) {
      sortedParams[key] = parameters[key];
    }
    
    return JSON.stringify(sortedParams);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
```

### Validation Capability

```typescript
// src/capabilities/validation/validation-capability.ts
export class ValidationCapability extends BaseCapability {
  constructor(
    private readonly validators: Map<string, IValidator[]> = new Map(),
    metadata: CapabilityMetadata = {}
  ) {
    super('validation', 'business-logic', {
      ...metadata,
      description: 'Provides comprehensive validation for operations',
      priority: 300 // Highest priority - validate before everything else
    });
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    const { operation, target, parameters, metadata } = context;

    // Only validate on 'before' phase
    if (metadata.phase !== 'before') {
      return {
        success: true,
        continueExecution: true
      };
    }

    try {
      const operationKey = `${target.constructor.name}.${operation}`;
      const validators = this.validators.get(operationKey) || [];

      const validationResults: ValidationResult[] = [];

      // Run all validators
      for (const validator of validators) {
        const result = await validator.validate(parameters);
        validationResults.push(result);
      }

      // Check if any validation failed
      const failures = validationResults.filter(r => !r.isValid);
      
      if (failures.length > 0) {
        const allErrors = failures.flatMap(f => f.errors);
        
        return {
          success: false,
          error: new ValidationError('Validation failed', allErrors),
          continueExecution: false, // Stop execution on validation failure
          metadata: {
            validationResults,
            failureCount: failures.length
          }
        };
      }

      return {
        success: true,
        continueExecution: true,
        metadata: {
          validationResults,
          validatorCount: validators.length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: new Error(`Validation capability failed: ${error.message}`),
        continueExecution: false
      };
    }
  }

  // Register validator for specific operation
  addValidator(
    targetClass: string,
    operation: string,
    validator: IValidator
  ): void {
    const key = `${targetClass}.${operation}`;
    if (!this.validators.has(key)) {
      this.validators.set(key, []);
    }
    this.validators.get(key)!.push(validator);
  }

  // Remove validator
  removeValidator(
    targetClass: string,
    operation: string,
    validator: IValidator
  ): void {
    const key = `${targetClass}.${operation}`;
    const validators = this.validators.get(key);
    if (validators) {
      const index = validators.indexOf(validator);
      if (index !== -1) {
        validators.splice(index, 1);
      }
    }
  }
}

interface IValidator {
  validate(data: any): Promise<ValidationResult>;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

class ValidationError extends Error {
  constructor(message: string, public readonly errors: string[]) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### Capability Registry

```typescript
// src/capabilities/registry/capability-registry.ts
export class CapabilityRegistry implements ICapabilityRegistry {
  private capabilities = new Map<string, ICapability>();
  private capabilitiesByType = new Map<CapabilityType, ICapability[]>();
  private executionOrder: ICapability[] = [];

  // Register capability
  register(capability: ICapability): void {
    // Check for conflicts
    if (this.capabilities.has(capability.name)) {
      throw new Error(`Capability '${capability.name}' is already registered`);
    }

    // Register capability
    this.capabilities.set(capability.name, capability);

    // Group by type
    if (!this.capabilitiesByType.has(capability.type)) {
      this.capabilitiesByType.set(capability.type, []);
    }
    this.capabilitiesByType.get(capability.type)!.push(capability);

    // Update execution order (sort by priority, higher first)
    this.updateExecutionOrder();

    // Initialize capability
    capability.initialize();
  }

  // Unregister capability
  unregister(name: string): void {
    const capability = this.capabilities.get(name);
    if (!capability) return;

    // Remove from main registry
    this.capabilities.delete(name);

    // Remove from type grouping
    const typeGroup = this.capabilitiesByType.get(capability.type);
    if (typeGroup) {
      const index = typeGroup.indexOf(capability);
      if (index !== -1) {
        typeGroup.splice(index, 1);
      }
    }

    // Update execution order
    this.updateExecutionOrder();

    // Dispose capability
    capability.dispose();
  }

  // Get capability by name
  get(name: string): ICapability | undefined {
    return this.capabilities.get(name);
  }

  // Get capabilities by type
  getByType(type: CapabilityType): ICapability[] {
    return this.capabilitiesByType.get(type) || [];
  }

  // Get all capabilities in execution order
  getAllInExecutionOrder(): ICapability[] {
    return [...this.executionOrder];
  }

  // Execute capabilities for operation
  async executeCapabilities(
    operation: string,
    target: any,
    parameters: Record<string, any>,
    phase: 'before' | 'after' = 'before'
  ): Promise<CapabilityExecutionResult> {
    const context: CapabilityContext = {
      operation,
      target,
      parameters,
      metadata: { phase },
      timestamp: new Date()
    };

    const results: CapabilityResult[] = [];
    let shouldContinue = true;
    let finalResult: any = undefined;

    for (const capability of this.executionOrder) {
      if (!shouldContinue) break;
      
      if (!capability.canExecute(context)) continue;

      try {
        const result = await capability.execute(context);
        results.push(result);

        if (!result.success && result.error) {
          // Capability failed
          if (!result.continueExecution) {
            shouldContinue = false;
            finalResult = result.error;
            break;
          }
        } else if (result.data !== undefined && !result.continueExecution) {
          // Capability provided result (e.g., cache hit)
          shouldContinue = false;
          finalResult = result.data;
          break;
        }

      } catch (error) {
        const errorResult: CapabilityResult = {
          success: false,
          error: error as Error,
          continueExecution: false
        };
        results.push(errorResult);
        shouldContinue = false;
        finalResult = error;
        break;
      }
    }

    return {
      shouldContinueExecution: shouldContinue,
      results,
      finalResult,
      executedCapabilities: results.length
    };
  }

  // Get registry statistics
  getStatistics(): RegistryStatistics {
    const capabilityCount = this.capabilities.size;
    const typeDistribution: Record<CapabilityType, number> = {};

    for (const [type, capabilities] of this.capabilitiesByType) {
      typeDistribution[type] = capabilities.length;
    }

    return {
      totalCapabilities: capabilityCount,
      typeDistribution,
      executionOrder: this.executionOrder.map(c => ({
        name: c.name,
        type: c.type,
        priority: c.metadata.priority || 0
      }))
    };
  }

  private updateExecutionOrder(): void {
    this.executionOrder = Array.from(this.capabilities.values())
      .filter(c => c.metadata.enabled !== false)
      .sort((a, b) => {
        const priorityA = a.metadata.priority || 0;
        const priorityB = b.metadata.priority || 0;
        return priorityB - priorityA; // Higher priority first
      });
  }
}

interface CapabilityExecutionResult {
  shouldContinueExecution: boolean;
  results: CapabilityResult[];
  finalResult?: any;
  executedCapabilities: number;
}

interface RegistryStatistics {
  totalCapabilities: number;
  typeDistribution: Record<CapabilityType, number>;
  executionOrder: Array<{
    name: string;
    type: CapabilityType;
    priority: number;
  }>;
}
```

### Capability-Enabled Domain Service

```typescript
// src/domain/services/capability-enabled-service.ts
export class CapabilityEnabledUserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly capabilityRegistry: ICapabilityRegistry
  ) {}

  async createUser(userData: CreateUserData): Promise<User> {
    // Execute pre-operation capabilities
    const preResult = await this.capabilityRegistry.executeCapabilities(
      'createUser',
      this,
      { userData },
      'before'
    );

    // Check if capabilities prevented execution
    if (!preResult.shouldContinueExecution) {
      if (preResult.finalResult instanceof Error) {
        throw preResult.finalResult;
      }
      return preResult.finalResult; // Could be cached result
    }

    // Execute main business logic
    let result: User;
    let error: Error | undefined;
    
    try {
      const user = User.create(userData);
      await this.userRepository.save(user);
      result = user;
    } catch (e) {
      error = e as Error;
      throw error;
    } finally {
      // Execute post-operation capabilities
      await this.capabilityRegistry.executeCapabilities(
        'createUser',
        this,
        { userData, result, error },
        'after'
      );
    }

    return result;
  }

  async getUser(userId: string): Promise<User | null> {
    // Execute pre-operation capabilities
    const preResult = await this.capabilityRegistry.executeCapabilities(
      'getUser',
      this,
      { userId },
      'before'
    );

    // Check for cached result
    if (!preResult.shouldContinueExecution && preResult.finalResult) {
      return preResult.finalResult;
    }

    // Execute main business logic
    let result: User | null;
    let error: Error | undefined;

    try {
      result = await this.userRepository.findById(EntityId.createText(userId));
    } catch (e) {
      error = e as Error;
      throw error;
    } finally {
      // Execute post-operation capabilities (e.g., cache the result)
      const postResult = await this.capabilityRegistry.executeCapabilities(
        'getUser',
        this,
        { userId, result, error },
        'after'
      );

      // Handle post-operation caching
      if (result && !error) {
        const cachingCapability = this.capabilityRegistry.get('caching') as CachingCapability;
        if (cachingCapability) {
          const cacheMetadata = preResult.results.find(r => r.metadata?.shouldCache);
          if (cacheMetadata?.metadata?.cacheKey) {
            await cachingCapability.cacheResult(cacheMetadata.metadata.cacheKey, result);
          }
        }
      }
    }

    return result;
  }
}

// Setup capability-enabled service
export function createCapabilityEnabledUserService(
  userRepository: IUserRepository,
  logger: ILogger,
  cache: ICache
): CapabilityEnabledUserService {
  const registry = new CapabilityRegistry();
  
  // Register capabilities
  registry.register(new ValidationCapability());
  registry.register(new CachingCapability(cache));
  registry.register(new LoggingCapability(logger));
  registry.register(new PerformanceLoggingCapability(logger));

  return new CapabilityEnabledUserService(userRepository, registry);
}
```

## Key Features

- **Extensible Architecture**: Add functionality without modifying core domain logic
- **Priority-Based Execution**: Control execution order through priority levels
- **Phase-Aware Execution**: Execute capabilities before and after operations
- **Result Interception**: Capabilities can provide results (e.g., cached data)
- **Error Handling**: Comprehensive error handling with continue/stop semantics
- **Configuration Management**: Dynamic capability configuration
- **Type Safety**: Full TypeScript support with generic capabilities
- **Lifecycle Management**: Proper initialization and disposal of capabilities

## Common Pitfalls

- **Priority Conflicts**: Be careful with capability priorities to avoid conflicts
- **Performance Impact**: Monitor performance impact of capability chains
- **Error Propagation**: Ensure proper error handling in capability execution
- **Memory Leaks**: Properly dispose of capabilities and their resources

## Related Examples

- Foundation Contracts - Base interfaces and specifications
- Event Architecture - Using capabilities in event processing
- EntityId Usage - Capability integration with domain entities

## Best Practices

- Keep capabilities focused on single responsibilities
- Use meaningful priorities to control execution order
- Implement proper error handling and recovery
- Design capabilities to be stateless when possible
- Use configuration for capability customization
- Monitor capability performance and resource usage
- Test capability combinations thoroughly
- Document capability dependencies and interactions