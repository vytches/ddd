import type { OnModuleInit } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { DiscoveryService, MetadataScanner, ModuleRef } from '@nestjs/core';
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import type { Constructor, IDependencyContainer } from '@vytches/ddd-di';
import type { HandlerInfo, VytchesContextOptions } from '../types';

interface HandlerMetadata {
  type: 'command' | 'query' | 'event' | 'domain-service';
  messageType: Constructor;
}

@Injectable()
export class VytchesExplorerService implements OnModuleInit {
  private container!: IDependencyContainer; // SimpleContainer - loaded dynamically
  private contextOptions?: VytchesContextOptions;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly discoveryService?: DiscoveryService,
    private readonly metadataScanner?: MetadataScanner
  ) {
    // Container will be initialized in onModuleInit
  }

  /**
   * Initialize the explorer service
   */
  async onModuleInit(): Promise<void> {
    console.log('🚀 VytchesExplorerService initializing...');

    try {
      // Initialize container with lazy-loading
      const { SimpleContainer } = await import('@vytches/ddd-di');
      this.container = new SimpleContainer();

      // Auto-discover handlers
      const handlers = await this.discoverHandlers();
      console.log(`✅ Discovered ${handlers.length} handlers`);

      // Register handlers in container
      await this.registerHandlers(handlers);

      console.log('✅ VytchesExplorerService initialized successfully');
    } catch (error) {
      console.error('❌ VytchesExplorerService initialization failed:', error);
      throw error;
    }
  }

  /**
   * Configure context options
   */
  configureContext(options: VytchesContextOptions): void {
    this.contextOptions = options;
    console.log(`🔧 Context configured: ${options.name}`);
  }

  /**
   * Get the container instance
   */
  getContainer(): IDependencyContainer {
    return this.container;
  }

  /**
   * Get discovered handlers
   */
  getHandlers(): HandlerInfo[] {
    // Return discovered handlers
    return [];
  }

  /**
   * Auto-discover command and query handlers
   */
  private async discoverHandlers(): Promise<HandlerInfo[]> {
    const handlers: HandlerInfo[] = [];

    if (!this.discoveryService) {
      console.warn('DiscoveryService not available, skipping auto-discovery');
      return handlers;
    }

    try {
      // Get all providers from the module
      const providers = this.discoveryService.getProviders();

      for (const provider of providers) {
        const handlerInfo = this.extractHandlerInfo(provider);
        if (handlerInfo) {
          handlers.push(handlerInfo);
        }
      }
    } catch (error) {
      console.warn('Error during handler discovery:', error);
    }

    return handlers;
  }

  /**
   * Extract handler information from provider
   */
  private extractHandlerInfo(provider: InstanceWrapper): HandlerInfo | null {
    try {
      const { metatype } = provider;

      if (!metatype || typeof metatype !== 'function') {
        return null;
      }

      // Check for handler decorators
      const handlerMetadata = this.getHandlerMetadata(metatype as Constructor);

      if (handlerMetadata) {
        return {
          type: handlerMetadata.type,
          messageType: handlerMetadata.messageType,
          handlerType: metatype as Constructor,
          metadata: handlerMetadata,
        };
      }
    } catch (error) {
      console.warn(`Error extracting handler info from ${provider.name}:`, error);
    }

    return null;
  }

  /**
   * Get handler metadata from class
   */
  private getHandlerMetadata(target: Constructor): HandlerMetadata | null {
    try {
      // Check for command handler metadata
      const commandMetadata = Reflect.getMetadata('command-handler', target);
      if (commandMetadata) {
        return {
          type: 'command',
          messageType: commandMetadata.command,
        };
      }

      // Check for query handler metadata
      const queryMetadata = Reflect.getMetadata('query-handler', target);
      if (queryMetadata) {
        return {
          type: 'query',
          messageType: queryMetadata.query,
        };
      }

      // Check for event handler metadata
      const eventMetadata = Reflect.getMetadata('event-handler', target);
      if (eventMetadata) {
        return {
          type: 'event',
          messageType: eventMetadata.event,
        };
      }

      // Check for domain service metadata
      const serviceMetadata = Reflect.getMetadata('domain-service', target);
      if (serviceMetadata) {
        return {
          type: 'domain-service',
          messageType: target,
        };
      }
    } catch (error) {
      console.warn(`Error getting metadata from ${target.name}:`, error);
    }

    return null;
  }

  /**
   * Register discovered handlers in the container
   */
  private async registerHandlers(handlers: HandlerInfo[]): Promise<void> {
    const { ServiceLifetime } = await import('@vytches/ddd-di');

    for (const handler of handlers) {
      try {
        // Register handler in container
        this.container.register(handler.handlerType, handler.handlerType, {
          lifetime: ServiceLifetime.Transient,
        });

        console.log(`✅ Registered ${handler.type} handler: ${handler.handlerType.name}`);
      } catch (error) {
        console.warn(`Failed to register handler ${handler.handlerType.name}:`, error);
      }
    }
  }

  /**
   * Get context configuration (legacy VP-012 compatibility)
   */
  getContextConfiguration(): Record<string, unknown> | null {
    return ((this as Record<string, unknown>).contextConfig as Record<string, unknown>) || null;
  }

  /**
   * Discover handlers for specific context and type (legacy VP-012 compatibility)
   */
  async discoverContextHandlers(_context: string, _type: string): Promise<HandlerInfo[]> {
    // For legacy compatibility, return empty array
    // In real implementation, this would filter handlers by context and type
    return [];
  }

  /**
   * Discover all handlers in all contexts (legacy VP-012 compatibility)
   */
  async discoverAllContextHandlers(): Promise<HandlerInfo[]> {
    // For legacy compatibility, return the discovered handlers
    return await this.discoverHandlers();
  }
}
