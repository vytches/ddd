import type { OnModuleInit } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { DiscoveryService, MetadataScanner, ModuleRef } from '@nestjs/core';
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import type { IEventBus } from '@vytches/ddd-contracts';
import type { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';

/**
 * VytchesExplorerService - Clean handler discovery following @nestjs/cqrs patterns
 *
 * Simple, synchronous discovery that happens during module initialization.
 * No temporal coupling, no race conditions, no complex bridge patterns.
 */
@Injectable()
export class VytchesExplorerService implements OnModuleInit {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly moduleRef: ModuleRef
  ) {}

  async onModuleInit() {
    await this.explore();
  }

  private async explore() {
    // Guard against undefined discovery service in tests
    if (!this.discoveryService) {
      return;
    }

    // Get all providers from NestJS container
    const providers = this.discoveryService.getProviders();

    // Find handlers using metadata
    const commandHandlers = this.findHandlers(providers, 'di:handler-type', 'command');
    const queryHandlers = this.findHandlers(providers, 'di:handler-type', 'query');
    const eventHandlers = this.findHandlers(providers, 'di:handler-type', 'event');

    // Register with buses if available
    await this.registerHandlers(commandHandlers, 'command');
    await this.registerHandlers(queryHandlers, 'query');
    await this.registerHandlers(eventHandlers, 'event');
  }

  private findHandlers(
    providers: InstanceWrapper[],
    metadataKey: string,
    expectedType: string
  ): InstanceWrapper[] {
    return providers.filter(wrapper => {
      if (!wrapper.metatype || !wrapper.instance) return false;

      const handlerType = Reflect.getMetadata(metadataKey, wrapper.metatype);
      return handlerType === expectedType;
    });
  }

  private async registerHandlers(
    handlers: InstanceWrapper[],
    busType: 'command' | 'query' | 'event'
  ) {
    if (handlers.length === 0) return;

    try {
      const bus = this.getBus(busType);
      if (!bus) return;

      for (const handler of handlers) {
        const handlerMetadata = Reflect.getMetadata('di:handler-metadata', handler.metatype);
        if (handlerMetadata?.messageType) {
          // Register handler with appropriate bus method
          if (busType === 'command' && 'register' in bus) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (bus as any).register(handlerMetadata.messageType, handler.instance);
          } else if (busType === 'query' && 'register' in bus) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (bus as any).register(handlerMetadata.messageType, handler.instance);
          } else if (busType === 'event' && 'registerHandler' in bus) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (bus as any).registerHandler(handlerMetadata.messageType, handler.instance);
          }
        }
      }
    } catch {
      // Silent fail - buses might not be configured
    }
  }

  private getBus(type: 'command' | 'query' | 'event') {
    try {
      switch (type) {
        case 'command':
          return this.moduleRef.get('ICommandBus', { strict: false });
        case 'query':
          return this.moduleRef.get('IQueryBus', { strict: false });
        case 'event':
          return this.moduleRef.get('IEventBus', { strict: false });
        default:
          return null;
      }
    } catch {
      return null;
    }
  }
}
