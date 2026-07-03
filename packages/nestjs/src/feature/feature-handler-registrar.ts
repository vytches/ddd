import {
  Injectable,
  Inject,
  Optional,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- runtime class needed for NestJS DI metadata
import { ModuleRef, ModulesContainer } from '@nestjs/core';
import type { Module } from '@nestjs/core/injector/module';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Required for DI tokens
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import type { IEventBus } from '@vytches/ddd-contracts';
import { internalLogger } from '@vytches/ddd-contracts';
import { LOCAL_EVENT_BUS, FEATURE_ANCHOR_INJECTION } from '../constants';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- runtime class needed for NestJS @Optional() DI token
import { VytchesExplorerService } from '../services/vytches-explorer.service';
import { BusRegistrationLedger } from '../services/bus-registration-ledger';

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
  constructor(
    @Inject(ICommandBus) private readonly commandBus: ICommandBus,
    @Inject(IQueryBus) private readonly queryBus: IQueryBus,
    @Inject(LOCAL_EVENT_BUS) private readonly localEventBus: IEventBus,
    @Inject(FEATURE_ANCHOR_INJECTION) private readonly anchorToken: symbol,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Inject(ModulesContainer) private readonly modulesContainer: ModulesContainer,
    @Optional()
    @Inject(VytchesExplorerService)
    private readonly explorerService?: VytchesExplorerService
  ) {}

  async onModuleInit(): Promise<void> {
    const ownModule = this.findOwnModule();

    if (!ownModule) {
      internalLogger.warn(
        'FeatureHandlerRegistrar: could not locate own module — skipping local registration'
      );
      return;
    }

    const handlers = this.extractHandlers(ownModule);
    await this.registerHandlersInLocalBuses(handlers);

    if (this.explorerService && handlers.length > 0) {
      this.explorerService.claimHandlerTypes(handlers.map(h => h.messageType));
    }
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

  /**
   * Locate the consumer module that imported the feature module produced by
   * VytchesDDDModule.forFeature().
   *
   * Variant A implementation (ADR-0034 VP-009):
   *   Step 1 — find the featureModule: the module in ModulesContainer that
   *             has anchorToken in its own providers.  That is the
   *             VytchesDDDFeatureModule instance (it owns the anchor provider
   *             registered in forFeature()).
   *   Step 2 — find the consumer module M where M.imports.has(featureModule).
   *             NestJS keeps resolved Module instances in Module._imports (Set)
   *             via container.addImport() → module.addImport().  This is an
   *             internal NestJS API (@nestjs/core/injector/module.ts) — not
   *             part of the public contract, but used by @nestjs/cqrs and
   *             the NestJS DevTools.  Stability risk is assessed as low.
   *   Step 3 — return M; its providers contain the consumer's handlers.
   *
   * Edge case: if no module imports the feature module (misconfigured setup),
   * return undefined so the caller logs a graceful warning without crashing.
   */
  private findOwnModule(): Module | undefined {
    // Step 1: locate the VytchesDDDFeatureModule instance by its anchor token.
    let featureModule: Module | undefined;
    for (const [, mod] of this.modulesContainer.entries()) {
      if (mod.providers.has(this.anchorToken as unknown as never)) {
        featureModule = mod;
        break;
      }
    }

    if (!featureModule) {
      return undefined;
    }

    // Step 2: find the consumer module that imported the feature module.
    // Module._imports is a Set<Module> maintained by NestJS core internals.
    for (const [, mod] of this.modulesContainer.entries()) {
      // NestJS stores resolved Module instances in the _imports Set.
      // The public accessor is mod.imports (getter for _imports).
      const imports = (mod as unknown as { imports?: Set<unknown> }).imports;
      if (imports instanceof Set) {
        if (imports.has(featureModule)) {
          return mod;
        }
      } else {
        internalLogger.warn(
          'FeatureHandlerRegistrar: mod.imports is not a Set — NestJS internal Module.imports ' +
            'shape may have changed; falling through to undefined for this module'
        );
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
          // F-M5: same bus-scoped ledger used by VytchesExplorerService — a
          // local bus can be shared across sequentially-created feature
          // modules (e.g. useValue-provided bus, or two forFeature() calls
          // resolving the same underlying instance), so the same
          // idempotent-skip / conflict-throw guard applies here too.
          const claim = BusRegistrationLedger.claimCommandOrQuery(
            bus,
            'command',
            messageType,
            handlerType
          );
          if (claim === 'register') {
            if (typeof bus.registerFactory === 'function') {
              bus.registerFactory(messageType, handlerFactory);
            } else if (typeof bus.register === 'function') {
              bus.register(messageType, handlerFactory());
            }
          }
        } else if (handlerKind === 'query') {
          const bus = this.queryBus as unknown as BusLike;
          const claim = BusRegistrationLedger.claimCommandOrQuery(
            bus,
            'query',
            messageType,
            handlerType
          );
          if (claim === 'register') {
            if (typeof bus.registerFactory === 'function') {
              bus.registerFactory(messageType, handlerFactory);
            } else if (typeof bus.register === 'function') {
              bus.register(messageType, handlerFactory());
            }
          }
        } else {
          const bus = this.localEventBus as unknown as BusLike;
          const eventTypeName =
            typeof messageType === 'function' ? messageType.name : String(messageType);
          // F-M5: events allow legitimate fan-out (multiple distinct handler
          // types per eventType) — claimEvent only dedupes exact
          // (eventType, handlerType) repeats, never conflicts.
          const claim = BusRegistrationLedger.claimEvent(bus, eventTypeName, handlerType);
          if (claim === 'register') {
            const instance = handlerFactory();
            if (typeof bus.registerHandler === 'function') {
              bus.registerHandler(messageType, instance);
            }
          }
        }
      } catch (error) {
        internalLogger.warn('FeatureHandlerRegistrar: Failed to register handler in feature bus', {
          handlerName: (handlerType as { name?: string }).name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
