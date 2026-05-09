import { Injectable } from '@nestjs/common';
import type {
  CommandBus,
  ICommand,
  ICommandHandler,
  IQuery,
  IQueryHandler,
  QueryBus,
} from '@vytches/ddd-cqrs';
import type { UnifiedEventBus, UnifiedEventHandler } from '@vytches/ddd-events';
import type { NestJSContainerAdapter } from '../adapters/nestjs-container.adapter';
import {
  COMMAND_HANDLER_METADATA,
  DEFAULT_DISCOVERY_PATTERNS,
  DEFAULT_EXCLUDE_PATTERNS,
  DOMAIN_SERVICE_METADATA,
  EVENT_HANDLER_METADATA,
  QUERY_HANDLER_METADATA,
  SAGA_METADATA,
} from '../constants';
import type { AutoDiscoveryOptions } from '../types/index';

/**
 * Represents a class constructor with metadata
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClassConstructor = new (...args: any[]) => any;

/**
 * Represents module metadata structure
 */
interface ModuleMetadata {
  providers?: unknown[];
  controllers?: unknown[];
}

/**
 * Represents decorator metadata
 */
interface DecoratorMetadata {
  serviceId?: string;
  lifetime?: import('@vytches/ddd-di').ServiceLifetime;
  context?: string;
  tags?: string[];
  commandType?: string;
  queryType?: string;
  eventTypes?: string[];
}

/**
 * Represents an event handler with a handle method
 */
interface EventHandler {
  handle: UnifiedEventHandler;
}

/**
 * Service for auto-discovering and registering DDD decorators
 */
@Injectable()
export class AutoDiscoveryService {
  private readonly options: Required<AutoDiscoveryOptions>;

  /**
   * VP-006 (2026-05-09): track classes already processed in this discovery
   * cycle. Multi-context apps (juz-ide-api: 10+ bounded contexts) call
   * `discover()` per context — without memoization, the same shared base
   * class gets processed N times, each pass redoing the metadata scan.
   *
   * WeakSet so unloaded modules are GC'd. Reset only when explicitly
   * requested via `reset()`.
   *
   * **Assumption**: one `AutoDiscoveryService` instance has ONE configured
   * `options.contexts` for its entire lifetime. If you need to discover
   * the same module under different context filters, instantiate a fresh
   * `AutoDiscoveryService` per filter — do NOT mutate `options` and call
   * `discover()` again, because the WeakSet will silently skip classes
   * that the prior filter already saw.
   */
  private processedTargets = new WeakSet<ClassConstructor>();

  constructor(
    private readonly adapter: NestJSContainerAdapter,
    options: Partial<AutoDiscoveryOptions> = {}
  ) {
    this.options = {
      enabled: true,
      patterns: options.patterns || DEFAULT_DISCOVERY_PATTERNS,
      contexts: options.contexts || [],
      exclude: options.exclude || DEFAULT_EXCLUDE_PATTERNS,
    };
  }

  /**
   * Reset the processed-targets memoization cache. Call between independent
   * discovery cycles (e.g. test isolation, hot-reload), not in production.
   */
  reset(): void {
    // WeakSet has no .clear() — replace via fresh instance.
    this.processedTargets = new WeakSet();
  }

  /**
   * Discover and register all decorated classes
   */
  async discover(): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    // Get all modules from the application
    const modules = this.getAllModules();

    // Process each module
    for (const module of modules) {
      await this.processModule(module);
    }
  }

  /**
   * Process a single module for decorated classes
   */
  private async processModule(module: ModuleMetadata): Promise<void> {
    // Get module metadata
    const providers = Reflect.getMetadata('providers', module) || [];
    const controllers = Reflect.getMetadata('controllers', module) || [];

    // Process providers
    for (const provider of providers) {
      await this.processClass(provider);
    }

    // Process controllers
    for (const controller of controllers) {
      await this.processClass(controller);
    }
  }

  /**
   * Process a single class for DDD decorators (VP-006: single-pass scan).
   *
   * Old flow: 5 `Reflect.getMetadata` calls per provider. With 200+
   * handlers in a typical bounded-context app, that's 1000+ prototype-
   * chain lookups during cold start, even when most classes carry no
   * DDD metadata at all.
   *
   * New flow:
   * 1. Memoization: WeakSet short-circuits if class already processed.
   * 2. Single-pass: read all metadata keys once via `Reflect.getMetadataKeys`.
   *    Skip the entire class if no DDD keys are present (the common case).
   * 3. Targeted lookups: only fetch metadata for keys we know exist.
   */
  private async processClass(target: ClassConstructor): Promise<void> {
    if (!target || typeof target !== 'function') {
      return;
    }

    // Memoization — skip already-processed classes (multi-context discovery).
    if (this.processedTargets.has(target)) {
      return;
    }

    // Single-pass key scan. `Reflect.getMetadataKeys` walks the prototype
    // chain ONCE and returns all defined keys; we then filter to the 5 we
    // care about. For classes without DDD decorators (most), this is the
    // entire cost.
    const keys = Reflect.getMetadataKeys(target);
    if (!keys || keys.length === 0) {
      this.processedTargets.add(target);
      return;
    }

    // Bitmap of which DDD decorators are present — avoids 5 hasMetadata
    // calls and gives us a fast exit when none are present.
    let hasDomain = false;
    let hasCommand = false;
    let hasQuery = false;
    let hasEvent = false;
    let hasSaga = false;

    for (const key of keys) {
      if (key === DOMAIN_SERVICE_METADATA) hasDomain = true;
      else if (key === COMMAND_HANDLER_METADATA) hasCommand = true;
      else if (key === QUERY_HANDLER_METADATA) hasQuery = true;
      else if (key === EVENT_HANDLER_METADATA) hasEvent = true;
      else if (key === SAGA_METADATA) hasSaga = true;
    }

    // Mark processed even if no DDD metadata, so future discoveries skip
    // the keys scan entirely.
    this.processedTargets.add(target);

    if (!hasDomain && !hasCommand && !hasQuery && !hasEvent && !hasSaga) {
      return;
    }

    // Fetch + register only for keys we know exist. Maintains exact same
    // execution order as the original 5-call sequence for behavior parity.
    if (hasDomain) {
      const md = Reflect.getMetadata(DOMAIN_SERVICE_METADATA, target);
      if (md) await this.registerDomainService(target, md);
    }
    if (hasCommand) {
      const md = Reflect.getMetadata(COMMAND_HANDLER_METADATA, target);
      if (md) await this.registerCommandHandler(target, md);
    }
    if (hasQuery) {
      const md = Reflect.getMetadata(QUERY_HANDLER_METADATA, target);
      if (md) await this.registerQueryHandler(target, md);
    }
    if (hasEvent) {
      const md = Reflect.getMetadata(EVENT_HANDLER_METADATA, target);
      if (md) await this.registerEventHandler(target, md);
    }
    if (hasSaga) {
      const md = Reflect.getMetadata(SAGA_METADATA, target);
      if (md) await this.registerSaga(target, md);
    }
  }

  /**
   * Register a domain service
   */
  private async registerDomainService(
    target: ClassConstructor,
    metadata: DecoratorMetadata
  ): Promise<void> {
    // Check if context matches filter
    if (!this.matchesContext(metadata.context)) {
      return;
    }

    const serviceId = metadata.serviceId || target.name;

    // Register in the adapter
    this.adapter.register(serviceId, target, {
      lifetime: metadata.lifetime,
      context: metadata.context,
      tags: [...(metadata.tags || []), 'domain-service', 'auto-discovered'],
    });
  }

  /**
   * Register a command handler
   */
  private async registerCommandHandler(
    target: ClassConstructor,
    metadata: DecoratorMetadata
  ): Promise<void> {
    // Check if context matches filter
    if (!this.matchesContext(metadata.context)) {
      return;
    }

    // Get command bus from container
    const commandBus = this.adapter.resolve<CommandBus>('commandBus');
    if (commandBus && 'register' in commandBus) {
      // Create handler instance
      const handler = this.adapter.resolve<ICommandHandler<ICommand, void>>(target);

      // Register with command bus
      commandBus.register(metadata.commandType, handler);
    }

    // Also register the handler itself in the container
    this.adapter.register(target.name, target, {
      context: metadata.context,
      tags: ['command-handler', 'auto-discovered'],
    });
  }

  /**
   * Register a query handler
   */
  private async registerQueryHandler(
    target: ClassConstructor,
    metadata: DecoratorMetadata
  ): Promise<void> {
    // Check if context matches filter
    if (!this.matchesContext(metadata.context)) {
      return;
    }

    // Get query bus from container
    const queryBus = this.adapter.resolve<QueryBus>('queryBus');
    if (queryBus && 'register' in queryBus) {
      // Create handler instance
      const handler = this.adapter.resolve<IQueryHandler<IQuery<unknown>, unknown>>(target);

      // Register with query bus
      queryBus.register(metadata.queryType, handler);
    }

    // Also register the handler itself in the container
    this.adapter.register(target.name, target, {
      context: metadata.context,
      tags: ['query-handler', 'auto-discovered'],
    });
  }

  /**
   * Register an event handler
   */
  private async registerEventHandler(
    target: ClassConstructor,
    metadata: DecoratorMetadata
  ): Promise<void> {
    // Check if context matches filter
    if (!this.matchesContext(metadata.context)) {
      return;
    }

    // Get event bus from container
    const eventBus = this.adapter.resolve<UnifiedEventBus>('eventBus');
    if (eventBus && 'subscribe' in eventBus) {
      // Create handler instance
      const handler = this.adapter.resolve<EventHandler>(target);

      // Subscribe to events
      if (metadata.eventTypes && Array.isArray(metadata.eventTypes)) {
        metadata.eventTypes.forEach((eventType: string) => {
          if (handler && handler.handle) {
            eventBus.subscribe(eventType, handler.handle);
          }
        });
      }
    }

    // Also register the handler itself in the container
    this.adapter.register(target.name, target, {
      context: metadata.context,
      tags: ['event-handler', 'auto-discovered'],
    });
  }

  /**
   * Register a saga
   */
  private async registerSaga(target: ClassConstructor, metadata: DecoratorMetadata): Promise<void> {
    // Check if context matches filter
    if (!this.matchesContext(metadata.context)) {
      return;
    }

    // Register the saga in the container
    this.adapter.register(target.name, target, {
      context: metadata.context,
      tags: ['saga', 'auto-discovered'],
    });
  }

  /**
   * Check if a context matches the filter
   */
  private matchesContext(context?: string): boolean {
    // If no contexts specified, match all
    if (!this.options.contexts || this.options.contexts.length === 0) {
      return true;
    }

    // If no context specified on the class, don't match
    if (!context) {
      return false;
    }

    // Check if context is in the filter list
    return this.options.contexts.includes(context);
  }

  /**
   * Get all modules from the application
   * This is a simplified version - actual implementation would need
   * to traverse the module tree from the root module
   */
  private getAllModules(): ModuleMetadata[] {
    // This would need to be implemented based on NestJS internals
    // For now, return empty array - modules will be processed
    // as they are loaded
    return [];
  }
}
