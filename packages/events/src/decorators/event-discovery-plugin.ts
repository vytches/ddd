/**
 * Event Handler Discovery Plugin for VytchesDDD DI System
 * 
 * This plugin enables automatic discovery and registration of event handlers
 * that are decorated with the @EventHandler decorator and have DI integration enabled.
 */

// import type { IHandlerDiscoveryPlugin, HandlerInfo } from '@vytches-ddd/di';
// Temporarily mocked for testing
type IHandlerDiscoveryPlugin = any;
type HandlerInfo = any;
import type { DIHandlerMetadata } from './di-types';

/**
 * Discovery plugin for event handlers with DI integration.
 * Scans for @EventHandler decorated classes and prepares them for DI registration.
 */
export class EventDiscoveryPlugin implements IHandlerDiscoveryPlugin {
  readonly name = 'Event';

  /**
   * Check if the events package is available.
   * This method allows the DI system to conditionally load this plugin.
   */
  isAvailable(): boolean {
    try {
      // Check if we can access event handler metadata
      return typeof Reflect !== 'undefined' && typeof Reflect.getMetadata === 'function';
    } catch {
      return false;
    }
  }

  /**
   * Discover all event handlers that are ready for DI registration.
   * 
   * @param assemblies - Optional list of modules/assemblies to scan
   * @returns Promise<HandlerInfo[]> List of discovered event handlers
   */
  async discoverHandlers(assemblies?: any[]): Promise<HandlerInfo[]> {
    const discoveredHandlers: HandlerInfo[] = [];

    // Scan assemblies if provided
    if (assemblies && assemblies.length > 0) {
      for (const assembly of assemblies) {
        const assemblyHandlers = await this.scanAssemblyForEventHandlers(assembly);
        discoveredHandlers.push(...assemblyHandlers);
      }
    }

    // Note: Since events package doesn't have a global registry like domain services,
    // we rely on assembly scanning to find handlers
    // In future versions, we could add a global registry similar to domain services

    return discoveredHandlers;
  }

  /**
   * Scan a specific assembly/module for event handlers.
   * 
   * @param assembly - Module or assembly to scan
   * @returns Promise<HandlerInfo[]> Event handlers found in the assembly
   */
  private async scanAssemblyForEventHandlers(assembly: any): Promise<HandlerInfo[]> {
    const handlers: HandlerInfo[] = [];

    if (!assembly || typeof assembly !== 'object') {
      return handlers;
    }

    // Scan all exports in the assembly
    const exports = Object.values(assembly);
    
    for (const exportedValue of exports) {
      if (this.isEventHandlerClass(exportedValue)) {
        const diMetadata = this.getEventHandlerDIMetadata(exportedValue);
        
        if (diMetadata && diMetadata.options.autoRegister !== false) {
          const handlerInfo: HandlerInfo = {
            type: 'event',
            messageType: diMetadata.eventType,
            handlerType: diMetadata.handlerType,
            metadata: {
              eventType: diMetadata.eventType.name,
              handlerType: diMetadata.handlerType.name,
              lifetime: diMetadata.options.lifetime || 'transient',
              context: diMetadata.options.context,
              tags: diMetadata.options.tags,
              priority: diMetadata.options.priority,
              active: diMetadata.options.active !== false,
              autoRegister: diMetadata.options.autoRegister ?? true,
              registeredAt: diMetadata.registeredAt,
              availableFrom: diMetadata.options.availableFrom
            }
          };

          handlers.push(handlerInfo);
        }
      }
    }

    return handlers;
  }

  /**
   * Check if a value is an event handler class.
   * 
   * @param value - Value to check
   * @returns boolean True if the value is an event handler class
   */
  private isEventHandlerClass(value: unknown): value is new (...args: any[]) => any {
    return (
      typeof value === 'function' &&
      value.prototype &&
      this.isEventHandlerPendingDIRegistration(value)
    );
  }

  /**
   * Check if a class is marked for DI auto-registration.
   * 
   * @param target - The handler class to inspect
   * @returns boolean True if the handler is pending DI registration
   */
  private isEventHandlerPendingDIRegistration(target: unknown): boolean {
    try {
      return Reflect.getMetadata('di:registration-pending', target as object) === true;
    } catch {
      return false;
    }
  }

  /**
   * Get DI metadata from an event handler class.
   * 
   * @param target - The handler class to inspect
   * @returns DIHandlerMetadata | undefined The DI metadata, or undefined if none exists
   */
  private getEventHandlerDIMetadata(target: unknown): DIHandlerMetadata | undefined {
    try {
      return Reflect.getMetadata('di:event-handler', target as object);
    } catch {
      return undefined;
    }
  }
}

/**
 * Singleton instance of the event discovery plugin.
 * Can be imported and registered with the VytchesDDD DI system.
 */
export const eventDiscoveryPlugin = new EventDiscoveryPlugin();