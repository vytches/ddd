/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/**
 * ACL Discovery Plugin
 *
 * Discovers ACL adapters and configurations for automatic registration
 */

import 'reflect-metadata';

// Import types we need

// Discovery interfaces (duplicated to avoid circular dependency)
interface IContainer {
  resolve<T>(token: string | symbol | Function): T | undefined;
  register(token: string | symbol | Function, factory: any, options?: any): void;
  registerInstance(token: string | symbol | Function, instance: any): void;
}

interface IDiscoveryPlugin {
  readonly name: string;
  readonly packageName: string;
  readonly priority: number;
  isAvailable(): boolean;
  discoverInContext(
    contextName: string,
    modules: unknown[],
    container: IContainer
  ): Promise<DiscoveryResult>;
  validate(results: DiscoveryResult): ValidationResult;
}

interface DiscoveryResult {
  contextName: string;
  pluginName: string;
  componentsFound: number;
  components: DiscoveredComponent[];
  errors?: string[] | undefined;
}

interface DiscoveredComponent {
  id: string;
  type: string;
  contextName: string;
  metadata: Record<string, unknown>;
  constructor?: Function;
}

interface ValidationResult {
  valid: boolean;
  errors?: string[] | undefined;
  warnings?: string[] | undefined;
}

/**
 * Metadata keys for ACL decorators
 */
export const ACL_METADATA = {
  ADAPTER: 'acl:adapter',
  SERVICE: 'acl:service',
  CONTEXT: 'acl:context',
  CONFIG: 'acl:config',
} as const;

/**
 * ACL Discovery Plugin Implementation
 */
export class ACLDiscoveryPlugin implements IDiscoveryPlugin {
  readonly name = 'ACL';
  readonly packageName = '@vytches/ddd-acl';
  readonly priority = 20; // Run after DI but before CQRS

  /**
   * Check if ACL package is available
   */
  isAvailable(): boolean {
    try {
      // ACL package is available if we can import it
      require.resolve('@vytches/ddd-acl');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Discover ACL components in the given context
   */
  async discoverInContext(
    contextName: string,
    modules: unknown[],
    container: IContainer
  ): Promise<DiscoveryResult> {
    const components: DiscoveredComponent[] = [];
    const errors: string[] = [];

    try {
      // Scan modules for ACL adapters
      for (const module of modules) {
        if (!module || typeof module !== 'object') {
          continue;
        }

        // Scan exported values
        for (const [key, value] of Object.entries(module)) {
          if (typeof value === 'function' && value.prototype) {
            const adapters = this.scanForACLAdapters(value, contextName);
            components.push(...adapters);
          }
        }
      }

      // Register discovered adapters in container
      for (const component of components) {
        await this.registerAdapter(component, container);
      }
    } catch (error) {
      errors.push(`Discovery error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      contextName,
      pluginName: this.name,
      componentsFound: components.length,
      components,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate discovered ACL components
   */
  validate(results: DiscoveryResult): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const component of results.components) {
      // Validate adapter has required metadata
      if (!component.metadata.serviceName) {
        errors.push(`ACL adapter ${component.id} missing service name`);
      }

      // Check for duplicate adapters
      const duplicates = results.components.filter(c => c.id === component.id && c !== component);
      if (duplicates.length > 0) {
        warnings.push(`Duplicate ACL adapter found: ${component.id}`);
      }

      // Validate context alignment
      if (component.contextName !== results.contextName) {
        warnings.push(
          `ACL adapter ${component.id} context mismatch: ${component.contextName} vs ${results.contextName}`
        );
      }

      // Check for required configuration
      if (component.metadata.requiresConfig && !component.metadata.config) {
        errors.push(`ACL adapter ${component.id} requires configuration but none provided`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Scan a class for ACL adapter metadata
   */
  private scanForACLAdapters(target: Function, contextName: string): DiscoveredComponent[] {
    const components: DiscoveredComponent[] = [];

    // Check for @ACLAdapter decorator metadata
    const adapterMetadata = Reflect.getMetadata(ACL_METADATA.ADAPTER, target);
    if (adapterMetadata) {
      const serviceName = Reflect.getMetadata(ACL_METADATA.SERVICE, target) || target.name;
      const context = Reflect.getMetadata(ACL_METADATA.CONTEXT, target) || contextName;
      const config = Reflect.getMetadata(ACL_METADATA.CONFIG, target);

      components.push({
        id: `acl.${serviceName.toLowerCase()}`,
        type: 'acl-adapter',
        contextName: context,
        metadata: {
          serviceName,
          adapterType: adapterMetadata.type || 'standard',
          resilience: adapterMetadata.resilience || 'standard',
          requiresConfig: adapterMetadata.requiresConfig || false,
          config,
          ...adapterMetadata,
        },
        constructor: target,
      });
    }

    // Check for @ACLService decorator (simplified ACL)
    const serviceMetadata = Reflect.getMetadata(ACL_METADATA.SERVICE, target);
    if (serviceMetadata && !adapterMetadata) {
      components.push({
        id: `acl.${serviceMetadata.toLowerCase()}`,
        type: 'acl-service',
        contextName,
        metadata: {
          serviceName: serviceMetadata,
          simplified: true,
        },
        constructor: target,
      });
    }

    return components;
  }

  /**
   * Register discovered adapter in container
   */
  private async registerAdapter(
    component: DiscoveredComponent,
    container: IContainer
  ): Promise<void> {
    if (!component.constructor) {
      return;
    }

    const { serviceName, resilience, config } = component.metadata;

    // Create token for the adapter
    const token = `ACL.${serviceName}`;

    // Register in container with metadata
    container.register(token, component.constructor, {
      lifetime: 'singleton', // ACL adapters are typically singletons
      metadata: {
        type: 'acl-adapter',
        context: component.contextName,
        serviceName,
        resilience,
        config,
      },
    });

    // Also register by service name for convenience
    container.register(`${serviceName}ACL`, component.constructor, {
      lifetime: 'singleton',
      metadata: { alias: token },
    });
  }
}

/**
 * Decorator for marking ACL adapters
 */
export function ACLAdapter(options?: {
  serviceName?: string;
  type?: 'standard' | 'enhanced' | 'resilient';
  resilience?: 'none' | 'standard' | 'critical';
  requiresConfig?: boolean;
}) {
  return function (target: Function) {
    Reflect.defineMetadata(ACL_METADATA.ADAPTER, options || {}, target);

    if (options?.serviceName) {
      Reflect.defineMetadata(ACL_METADATA.SERVICE, options.serviceName, target);
    }
  };
}

/**
 * Decorator for ACL configuration
 */
export function ACLConfig(config: Record<string, unknown>) {
  return function (target: Function) {
    Reflect.defineMetadata(ACL_METADATA.CONFIG, config, target);
  };
}

/**
 * Decorator for ACL context
 */
export function ACLContext(contextName: string) {
  return function (target: Function) {
    Reflect.defineMetadata(ACL_METADATA.CONTEXT, contextName, target);
  };
}
