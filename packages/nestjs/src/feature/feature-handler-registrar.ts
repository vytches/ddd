import {
  Injectable,
  Inject,
  Optional,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- runtime class needed for NestJS DI metadata
import { ModuleRef } from '@nestjs/core';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- runtime class needed for NestJS DI metadata
import { ModulesContainer } from '@nestjs/core/injector/modules-container';
import type { Module } from '@nestjs/core/injector/module';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Required for DI tokens
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import type { IEventBus } from '@vytches/ddd-contracts';
import { Logger } from '@vytches/ddd-logging';
import { LOCAL_EVENT_BUS, FEATURE_ANCHOR_INJECTION } from '../constants';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- runtime class needed for NestJS @Optional() DI token
import { VytchesExplorerService } from '../services/vytches-explorer.service';

interface BusLike {
  register?(messageType: unknown, handler: unknown): void;
  registerFactory?(messageType: unknown, factory: () => unknown): void;
  registerHandler?(eventType: unknown, handler: unknown): void;
}

// Class constructor reference used as reflection key — intentional Function usage
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type ClassRef = Function;

interface HandlerEntry {
  messageType: ClassRef;
  handlerType: ClassRef;
  handlerKind: 'command' | 'query' | 'event';
}

/**
 * Internal service created by VytchesDDDModule.forFeature().
 *
 * On onModuleInit() it:
 * 1. Locates its own NestJS module via the unique anchor Symbol.
 * 2. Extracts all handlers with scope !== 'global' from that module.
 * 3. Registers them in the per-context command/query/event buses.
 * 4. Claims their message types with VytchesExplorerService so the global
 *    fallback does not double-register them.
 */
@Injectable()
export class FeatureHandlerRegistrar implements OnModuleInit, OnModuleDestroy {
  private readonly logger = Logger.forContext('FeatureHandlerRegistrar');

  constructor(
    @Inject(ICommandBus) private readonly commandBus: ICommandBus,
    @Inject(IQueryBus) private readonly queryBus: IQueryBus,
    @Inject(LOCAL_EVENT_BUS) private readonly localEventBus: IEventBus,
    @Inject(FEATURE_ANCHOR_INJECTION) private readonly anchorToken: symbol,
    private readonly moduleRef: ModuleRef,
    private readonly modulesContainer: ModulesContainer,
    @Optional() private readonly explorerService?: VytchesExplorerService
  ) {}

  async onModuleInit(): Promise<void> {
    const ownModule = this.findOwnModule();

    if (!ownModule) {
      this.logger.warn(
        'FeatureHandlerRegistrar: could not locate own module — skipping local registration'
      );
      return;
    }

    const handlers = this.extractHandlers(ownModule);
    await this.registerHandlersInLocalBuses(handlers);

    if (this.explorerService && handlers.length > 0) {
      this.explorerService.claimHandlerTypes(handlers.map(h => h.messageType));
    }

    this.logger.info(`Feature module: registered ${handlers.length} handler(s) in local buses`);
  }

  onModuleDestroy(): void {
    // Call dispose() on buses that support it (e.g. EnhancedCommandBus / EnhancedQueryBus
    // run a setInterval for cache cleanup — skipping dispose() causes a leak in tests).
    const disposable = (bus: unknown): bus is { dispose(): void } =>
      typeof (bus as { dispose?: unknown }).dispose === 'function';

    if (disposable(this.commandBus)) this.commandBus.dispose();
    if (disposable(this.queryBus)) this.queryBus.dispose();
    if (disposable(this.localEventBus)) (this.localEventBus as { dispose(): void }).dispose();
  }

  private findOwnModule(): Module | undefined {
    for (const [, mod] of this.modulesContainer.entries()) {
      if (mod.providers.has(this.anchorToken as unknown as never)) {
        return mod;
      }
    }
    return undefined;
  }

  private extractHandlers(mod: Module): HandlerEntry[] {
    const handlers: HandlerEntry[] = [];

    for (const [, wrapper] of mod.providers.entries()) {
      const { metatype } = wrapper;
      if (!metatype || typeof metatype !== 'function') continue;

      const handlerKind = Reflect.getMetadata('di:handler-type', metatype) as
        | 'command'
        | 'query'
        | 'event'
        | undefined;
      const handlerMetadata = Reflect.getMetadata('di:handler-metadata', metatype) as
        | { messageType?: ClassRef }
        | undefined;
      const scope =
        (Reflect.getMetadata('di:handler-scope', metatype) as string | undefined) ?? 'context';

      if (
        (handlerKind === 'command' || handlerKind === 'query' || handlerKind === 'event') &&
        handlerMetadata?.messageType &&
        scope !== 'global'
      ) {
        handlers.push({
          messageType: handlerMetadata.messageType,
          handlerType: metatype,
          handlerKind,
        });
      }
    }

    return handlers;
  }

  private async registerHandlersInLocalBuses(handlers: HandlerEntry[]): Promise<void> {
    for (const { messageType, handlerType, handlerKind } of handlers) {
      try {
        const handlerFactory = (): unknown =>
          this.moduleRef.get(handlerType as new (...args: unknown[]) => unknown, {
            strict: false,
          });

        if (handlerKind === 'command') {
          const bus = this.commandBus as unknown as BusLike;
          if (typeof bus.registerFactory === 'function') {
            bus.registerFactory(messageType, handlerFactory);
          } else if (typeof bus.register === 'function') {
            bus.register(messageType, handlerFactory());
          }
        } else if (handlerKind === 'query') {
          const bus = this.queryBus as unknown as BusLike;
          if (typeof bus.registerFactory === 'function') {
            bus.registerFactory(messageType, handlerFactory);
          } else if (typeof bus.register === 'function') {
            bus.register(messageType, handlerFactory());
          }
        } else {
          const bus = this.localEventBus as unknown as BusLike;
          const instance = handlerFactory();
          if (typeof bus.registerHandler === 'function') {
            bus.registerHandler(messageType, instance);
          }
        }
      } catch (error) {
        this.logger.warn('Failed to register handler in feature bus', {
          handlerName: (handlerType as { name?: string }).name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
