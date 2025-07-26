# Custom Container Implementation - Advanced Example

**Version**: 1.0.0  
**Package**: @vytches/ddd-di  
**Complexity**: advanced  
**Domain**: Custom Infrastructure  
**Patterns**: Custom Container, Plugin Architecture, Extensibility  
**Dependencies**: @vytches/ddd-di

## Description

This example demonstrates how to build custom DI containers with advanced
features like plugin systems, custom lifecycle management, and specialized
resolution strategies. You'll learn to extend VytchesDDD's DI capabilities for
specific enterprise requirements.

## Business Context

Some enterprise applications require specialized DI containers with custom
features like tenant isolation, advanced caching, or specific security
requirements. Building custom containers allows you to extend VytchesDDD's core
functionality while maintaining compatibility with the broader ecosystem.

## Code Example

```typescript
// custom-container/advanced-container.ts
import {
  IContainer,
  ServiceRegistration,
  ServiceLifetime,
} from '@vytches/ddd-di';
import { User } from '../types'; // Import from application

/**
 * Custom container interface with advanced features
 */
export interface IAdvancedContainer extends IContainer {
  registerWithTenant<T>(
    serviceId: string,
    implementation: new (...args: any[]) => T,
    tenantId: string,
    lifetime?: ServiceLifetime
  ): void;

  resolveWithTenant<T>(serviceId: string, tenantId: string): T;
  registerPlugin(plugin: IContainerPlugin): void;
  enableAuditing(enabled: boolean): void;
  getContainerMetrics(): ContainerMetrics;
}

/**
 * Container plugin interface
 */
export interface IContainerPlugin {
  name: string;
  version: string;
  onBeforeResolve?(serviceId: string, context: any): void;
  onAfterResolve?(serviceId: string, instance: any, context: any): void;
  onBeforeRegister?(serviceId: string, registration: ServiceRegistration): void;
  onAfterRegister?(serviceId: string, registration: ServiceRegistration): void;
}

/**
 * Container metrics interface
 */
export interface ContainerMetrics {
  totalRegistrations: number;
  totalResolutions: number;
  resolutionTime: { min: number; max: number; avg: number };
  memoryUsage: number;
  activeInstances: number;
  pluginCount: number;
}

/**
 * Advanced container implementation
 */
export class AdvancedContainer implements IAdvancedContainer {
  private services: Map<string, ServiceRegistration> = new Map();
  private tenantServices: Map<string, Map<string, ServiceRegistration>> =
    new Map();
  private instances: Map<string, any> = new Map();
  private tenantInstances: Map<string, Map<string, any>> = new Map();
  private plugins: IContainerPlugin[] = [];
  private auditingEnabled = false;
  private metrics: ContainerMetrics = {
    totalRegistrations: 0,
    totalResolutions: 0,
    resolutionTime: { min: 0, max: 0, avg: 0 },
    memoryUsage: 0,
    activeInstances: 0,
    pluginCount: 0,
  };
  private resolutionTimes: number[] = [];

  /**
   * Registers a service with standard lifetime
   */
  register<T>(
    serviceId: string,
    implementation: new (...args: any[]) => T,
    lifetime: ServiceLifetime = ServiceLifetime.Transient
  ): void {
    // ⭐ FOCUS: Custom registration with plugin hooks
    const registration: ServiceRegistration = {
      serviceId,
      implementation,
      lifetime,
      registeredAt: new Date(),
    };

    this.executePluginHook('onBeforeRegister', serviceId, registration);

    this.services.set(serviceId, registration);
    this.metrics.totalRegistrations++;

    this.executePluginHook('onAfterRegister', serviceId, registration);

    if (this.auditingEnabled) {
      console.log(
        `AdvancedContainer: Registered ${serviceId} with lifetime ${lifetime}`
      );
    }
  }

  /**
   * Registers a service with tenant isolation
   */
  registerWithTenant<T>(
    serviceId: string,
    implementation: new (...args: any[]) => T,
    tenantId: string,
    lifetime: ServiceLifetime = ServiceLifetime.Transient
  ): void {
    // ⭐ FOCUS: Tenant-specific service registration
    const registration: ServiceRegistration = {
      serviceId,
      implementation,
      lifetime,
      tenantId,
      registeredAt: new Date(),
    };

    if (!this.tenantServices.has(tenantId)) {
      this.tenantServices.set(tenantId, new Map());
    }

    this.tenantServices.get(tenantId)!.set(serviceId, registration);
    this.metrics.totalRegistrations++;

    if (this.auditingEnabled) {
      console.log(
        `AdvancedContainer: Registered ${serviceId} for tenant ${tenantId}`
      );
    }
  }

  /**
   * Resolves a service with metrics tracking
   */
  resolve<T>(serviceId: string): T {
    const startTime = Date.now();

    try {
      // ⭐ FOCUS: Custom resolution with plugin hooks
      this.executePluginHook('onBeforeResolve', serviceId, null);

      const registration = this.services.get(serviceId);
      if (!registration) {
        throw new Error(`Service ${serviceId} not registered`);
      }

      const instance = this.resolveInstance<T>(serviceId, registration);

      this.executePluginHook('onAfterResolve', serviceId, instance);

      this.updateMetrics(startTime);

      return instance;
    } catch (error) {
      this.updateMetrics(startTime);
      throw error;
    }
  }

  /**
   * Resolves a service with tenant isolation
   */
  resolveWithTenant<T>(serviceId: string, tenantId: string): T {
    const startTime = Date.now();

    try {
      // ⭐ FOCUS: Tenant-specific resolution
      const tenantServices = this.tenantServices.get(tenantId);
      if (!tenantServices) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      const registration = tenantServices.get(serviceId);
      if (!registration) {
        throw new Error(
          `Service ${serviceId} not registered for tenant ${tenantId}`
        );
      }

      const instance = this.resolveInstanceWithTenant<T>(
        serviceId,
        registration,
        tenantId
      );

      this.updateMetrics(startTime);

      return instance;
    } catch (error) {
      this.updateMetrics(startTime);
      throw error;
    }
  }

  /**
   * Registers an instance directly
   */
  registerInstance<T>(serviceId: string, instance: T): void {
    const registration: ServiceRegistration = {
      serviceId,
      instance,
      lifetime: ServiceLifetime.Singleton,
      registeredAt: new Date(),
    };

    this.services.set(serviceId, registration);
    this.instances.set(serviceId, instance);
    this.metrics.totalRegistrations++;
    this.metrics.activeInstances++;

    if (this.auditingEnabled) {
      console.log(`AdvancedContainer: Registered instance ${serviceId}`);
    }
  }

  /**
   * Registers a container plugin
   */
  registerPlugin(plugin: IContainerPlugin): void {
    // ⭐ FOCUS: Plugin system for extensibility
    this.plugins.push(plugin);
    this.metrics.pluginCount++;

    if (this.auditingEnabled) {
      console.log(
        `AdvancedContainer: Registered plugin ${plugin.name} v${plugin.version}`
      );
    }
  }

  /**
   * Enables or disables auditing
   */
  enableAuditing(enabled: boolean): void {
    this.auditingEnabled = enabled;
    console.log(
      `AdvancedContainer: Auditing ${enabled ? 'enabled' : 'disabled'}`
    );
  }

  /**
   * Gets container metrics
   */
  getContainerMetrics(): ContainerMetrics {
    // ⭐ FOCUS: Advanced metrics collection
    return {
      ...this.metrics,
      memoryUsage: this.calculateMemoryUsage(),
      activeInstances: this.instances.size + this.getTotalTenantInstances(),
    };
  }

  /**
   * Disposes container resources
   */
  dispose(): void {
    this.services.clear();
    this.tenantServices.clear();
    this.instances.clear();
    this.tenantInstances.clear();
    this.plugins.length = 0;
    this.resolutionTimes.length = 0;

    console.log('AdvancedContainer: Disposed');
  }

  private resolveInstance<T>(
    serviceId: string,
    registration: ServiceRegistration
  ): T {
    if (registration.lifetime === ServiceLifetime.Singleton) {
      let instance = this.instances.get(serviceId);
      if (!instance) {
        instance = new registration.implementation();
        this.instances.set(serviceId, instance);
        this.metrics.activeInstances++;
      }
      return instance;
    }

    if (registration.lifetime === ServiceLifetime.Transient) {
      return new registration.implementation();
    }

    // Scoped lifetime (simplified)
    return new registration.implementation();
  }

  private resolveInstanceWithTenant<T>(
    serviceId: string,
    registration: ServiceRegistration,
    tenantId: string
  ): T {
    if (registration.lifetime === ServiceLifetime.Singleton) {
      if (!this.tenantInstances.has(tenantId)) {
        this.tenantInstances.set(tenantId, new Map());
      }

      const tenantInstanceMap = this.tenantInstances.get(tenantId)!;
      let instance = tenantInstanceMap.get(serviceId);

      if (!instance) {
        instance = new registration.implementation();
        tenantInstanceMap.set(serviceId, instance);
        this.metrics.activeInstances++;
      }

      return instance;
    }

    return new registration.implementation();
  }

  private executePluginHook(
    hookName: keyof IContainerPlugin,
    ...args: any[]
  ): void {
    for (const plugin of this.plugins) {
      const hook = plugin[hookName];
      if (typeof hook === 'function') {
        try {
          hook.apply(plugin, args);
        } catch (error) {
          console.error(
            `Plugin ${plugin.name} hook ${hookName} failed:`,
            error
          );
        }
      }
    }
  }

  private updateMetrics(startTime: number): void {
    const duration = Date.now() - startTime;
    this.resolutionTimes.push(duration);
    this.metrics.totalResolutions++;

    if (this.resolutionTimes.length > 1000) {
      this.resolutionTimes.shift(); // Keep only last 1000 measurements
    }

    this.metrics.resolutionTime = {
      min: Math.min(...this.resolutionTimes),
      max: Math.max(...this.resolutionTimes),
      avg:
        this.resolutionTimes.reduce((sum, time) => sum + time, 0) /
        this.resolutionTimes.length,
    };
  }

  private calculateMemoryUsage(): number {
    // Simplified memory calculation
    return (this.instances.size + this.getTotalTenantInstances()) * 1024; // Rough estimate
  }

  private getTotalTenantInstances(): number {
    let total = 0;
    for (const [, instanceMap] of this.tenantInstances) {
      total += instanceMap.size;
    }
    return total;
  }
}
```

```typescript
// plugins/logging-plugin.ts
import {
  IContainerPlugin,
  ServiceRegistration,
} from '../custom-container/advanced-container';

/**
 * Logging plugin for container operations
 */
export class LoggingPlugin implements IContainerPlugin {
  name = 'LoggingPlugin';
  version = '1.0.0';

  onBeforeResolve(serviceId: string, context: any): void {
    // ⭐ FOCUS: Plugin hook for logging
    console.log(`LoggingPlugin: Resolving service ${serviceId}`);
  }

  onAfterResolve(serviceId: string, instance: any, context: any): void {
    console.log(`LoggingPlugin: Resolved service ${serviceId} successfully`);
  }

  onBeforeRegister(serviceId: string, registration: ServiceRegistration): void {
    console.log(`LoggingPlugin: Registering service ${serviceId}`);
  }

  onAfterRegister(serviceId: string, registration: ServiceRegistration): void {
    console.log(
      `LoggingPlugin: Registered service ${serviceId} with lifetime ${registration.lifetime}`
    );
  }
}
```

```typescript
// plugins/security-plugin.ts
import {
  IContainerPlugin,
  ServiceRegistration,
} from '../custom-container/advanced-container';

/**
 * Security plugin for container operations
 */
export class SecurityPlugin implements IContainerPlugin {
  name = 'SecurityPlugin';
  version = '1.0.0';

  private secureServices = new Set([
    'userService',
    'authService',
    'paymentService',
  ]);

  onBeforeResolve(serviceId: string, context: any): void {
    // ⭐ FOCUS: Security validation plugin
    if (this.secureServices.has(serviceId)) {
      // Simulate security check
      if (!this.validateSecurityContext(context)) {
        throw new Error(`Security validation failed for service ${serviceId}`);
      }
    }
  }

  onBeforeRegister(serviceId: string, registration: ServiceRegistration): void {
    if (this.secureServices.has(serviceId)) {
      console.log(`SecurityPlugin: Registering secure service ${serviceId}`);
    }
  }

  private validateSecurityContext(context: any): boolean {
    // Simplified security validation
    return true; // Always pass for demo
  }
}
```

```typescript
// plugins/caching-plugin.ts
import {
  IContainerPlugin,
  ServiceRegistration,
} from '../custom-container/advanced-container';

/**
 * Caching plugin for container operations
 */
export class CachingPlugin implements IContainerPlugin {
  name = 'CachingPlugin';
  version = '1.0.0';

  private cache = new Map<string, { instance: any; expiry: number }>();
  private cacheTtl = 300000; // 5 minutes

  onAfterResolve(serviceId: string, instance: any, context: any): void {
    // ⭐ FOCUS: Caching plugin for performance
    if (this.shouldCache(serviceId)) {
      const expiry = Date.now() + this.cacheTtl;
      this.cache.set(serviceId, { instance, expiry });
      console.log(`CachingPlugin: Cached instance of ${serviceId}`);
    }
  }

  onBeforeResolve(serviceId: string, context: any): void {
    const cached = this.cache.get(serviceId);
    if (cached && Date.now() < cached.expiry) {
      console.log(`CachingPlugin: Using cached instance of ${serviceId}`);
      // In real implementation, we'd modify the resolution flow
    }
  }

  private shouldCache(serviceId: string): boolean {
    // Only cache certain services
    return ['userService', 'configService'].includes(serviceId);
  }
}
```

```typescript
// services/tenant-user.service.ts
import { DomainService } from '@vytches/ddd-di';
import { User, CreateUserData } from '../types'; // Import from application

/**
 * Tenant-specific user service
 */
export class TenantUserService {
  private users: Map<string, User> = new Map();

  constructor(private tenantId: string) {
    console.log(`TenantUserService: Initialized for tenant ${tenantId}`);
  }

  /**
   * Creates user for specific tenant
   */
  async createUser(userData: CreateUserData): Promise<User> {
    // ⭐ FOCUS: Tenant-specific business logic
    const user: User = {
      id: this.generateUserId(),
      email: userData.email,
      name: userData.name,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(user.id, user);

    console.log(
      `TenantUserService: Created user ${user.id} for tenant ${this.tenantId}`
    );
    return user;
  }

  /**
   * Gets user by ID for tenant
   */
  async getUserById(userId: string): Promise<User | null> {
    const user = this.users.get(userId);
    console.log(
      `TenantUserService: Retrieved user ${userId} for tenant ${this.tenantId}`
    );
    return user || null;
  }

  private generateUserId(): string {
    return `${this.tenantId}_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// app.ts
import { AdvancedContainer } from './custom-container/advanced-container';
import { LoggingPlugin } from './plugins/logging-plugin';
import { SecurityPlugin } from './plugins/security-plugin';
import { CachingPlugin } from './plugins/caching-plugin';
import { TenantUserService } from './services/tenant-user.service';
import { VytchesDDD, ServiceLifetime } from '@vytches/ddd-di';
import { CreateUserData } from '../types'; // Import from application

/**
 * Application demonstrating custom container implementation
 */
async function demonstrateCustomContainer(): Promise<void> {
  console.log('=== Custom Container Implementation Demo ===\n');

  // ⭐ FOCUS: Create and configure advanced container
  const container = new AdvancedContainer();

  // Enable auditing
  container.enableAuditing(true);

  // Register plugins
  container.registerPlugin(new LoggingPlugin());
  container.registerPlugin(new SecurityPlugin());
  container.registerPlugin(new CachingPlugin());

  console.log('\n1. Plugin Registration:');
  const initialMetrics = container.getContainerMetrics();
  console.log(`Registered ${initialMetrics.pluginCount} plugins`);

  console.log('\n2. Service Registration:');

  // Standard service registration
  container.register(
    'userService',
    TenantUserService,
    ServiceLifetime.Singleton
  );

  // Tenant-specific service registration
  container.registerWithTenant(
    'userService',
    TenantUserService,
    'tenant-a',
    ServiceLifetime.Singleton
  );
  container.registerWithTenant(
    'userService',
    TenantUserService,
    'tenant-b',
    ServiceLifetime.Singleton
  );

  console.log('\n3. Service Resolution:');

  // Standard resolution
  const standardUserService =
    container.resolve<TenantUserService>('userService');

  // Tenant-specific resolution
  const tenantAUserService = container.resolveWithTenant<TenantUserService>(
    'userService',
    'tenant-a'
  );
  const tenantBUserService = container.resolveWithTenant<TenantUserService>(
    'userService',
    'tenant-b'
  );

  console.log('\n4. Service Usage:');

  const userData: CreateUserData = {
    email: 'test@example.com',
    name: 'Test User',
  };

  // Use services
  const standardUser = await standardUserService.createUser(userData);
  const tenantAUser = await tenantAUserService.createUser(userData);
  const tenantBUser = await tenantBUserService.createUser(userData);

  console.log('\n5. Container Metrics:');
  const finalMetrics = container.getContainerMetrics();
  console.log('Final metrics:', finalMetrics);

  console.log('\n6. VytchesDDD Integration:');

  // ⭐ FOCUS: Integrate custom container with VytchesDDD
  await VytchesDDD.configure(container);

  const vytchesService = VytchesDDD.resolve<TenantUserService>('userService');
  const vytchesUser = await vytchesService.createUser({
    email: 'vytches@example.com',
    name: 'VytchesDDD User',
  });

  console.log('VytchesDDD created user:', vytchesUser.id);

  console.log('\n7. Cleanup:');
  container.dispose();

  console.log('\n=== Custom Container Demo Complete ===');
}

// Run the demonstration
demonstrateCustomContainer().catch(console.error);
```

## Key Features

- **Custom Container Interface**: Extended IContainer with advanced features
- **Plugin System**: Extensible architecture with plugin hooks
- **Tenant Isolation**: Multi-tenant service registration and resolution
- **Metrics Collection**: Built-in performance and usage metrics
- **Security Integration**: Plugin-based security validation
- **Caching Support**: Performance optimization through caching plugins
- **Auditing**: Optional operation logging for debugging
- **VytchesDDD Integration**: Seamless integration with the main DI system

## Common Pitfalls

- **Plugin Errors**: Ensure plugins handle errors gracefully
- **Memory Management**: Monitor memory usage with many instances
- **Tenant Isolation**: Prevent cross-tenant data leakage
- **Metrics Overhead**: Balance detailed metrics with performance
- **Plugin Dependencies**: Avoid plugin circular dependencies
- **Container Disposal**: Properly clean up resources on disposal

## Related Examples

- [Framework Integration Patterns](./example-1.md) - Integration with frameworks
- [Enterprise Production Patterns](./example-3.md) - Production-ready patterns
- [Context Isolation](../intermediate/example-2.md) - Bounded context support
