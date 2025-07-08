/**
 * Domain Service Discovery Plugin for VytchesDDD DI System
 *
 * This plugin enables automatic discovery and registration of domain services
 * that are decorated with the @DomainService decorator and have DI integration enabled.
 */

import type { IHandlerDiscoveryPlugin, HandlerInfo } from '@vytches-ddd/di';
import { DIDomainServiceMetadataRegistry } from '../di-types';
import { isDomainServicePendingDIRegistration, getDIDomainServiceMetadata } from '../domain-service.decorator';

/**
 * Discovery plugin for domain services with DI integration.
 * Scans for @DomainService decorated classes and prepares them for DI registration.
 */
export class DomainServiceDiscoveryPlugin implements IHandlerDiscoveryPlugin {
  readonly name = 'DomainService';

  /**
   * Check if the domain services package is available.
   * This method allows the DI system to conditionally load this plugin.
   */
  isAvailable(): boolean {
    try {
      // Check if we can access the domain service metadata registry
      return typeof DIDomainServiceMetadataRegistry !== 'undefined';
    } catch {
      return false;
    }
  }

  /**
   * Discover all domain services that are ready for DI registration.
   *
   * @param assemblies - Optional list of modules/assemblies to scan
   * @returns Promise<HandlerInfo[]> List of discovered domain services
   */
  async discoverHandlers(assemblies?: any[]): Promise<HandlerInfo[]> {
    const discoveredServices: HandlerInfo[] = [];

    // Get all registered domain services from metadata registry
    const allServices = DIDomainServiceMetadataRegistry.getAllServices();

    for (const serviceMetadata of allServices) {
      // Check if this service is pending DI registration
      if (serviceMetadata.autoRegister && isDomainServicePendingDIRegistration(serviceMetadata.serviceType)) {
        const handlerInfo: HandlerInfo = {
          type: 'domain-service' as any, // Extend HandlerInfo type for domain services
          messageType: serviceMetadata.serviceType, // Use service class as "message type"
          handlerType: serviceMetadata.serviceType,
          metadata: {
            serviceId: serviceMetadata.serviceId,
            lifetime: serviceMetadata.lifetime,
            context: serviceMetadata.context,
            tags: serviceMetadata.tags,
            dependencies: serviceMetadata.dependencies,
            transactional: serviceMetadata.transactional,
            async: serviceMetadata.async,
            publishesEvents: serviceMetadata.publishesEvents,
            caching: serviceMetadata.caching,
            contextResolver: serviceMetadata.contextResolver,
            fallbackToGlobal: serviceMetadata.fallbackToGlobal,
            autoRegister: serviceMetadata.autoRegister,
            createdAt: serviceMetadata.createdAt
          }
        };

        discoveredServices.push(handlerInfo);
      }
    }

    // Also scan assemblies if provided
    if (assemblies && assemblies.length > 0) {
      for (const assembly of assemblies) {
        const assemblyServices = await this.scanAssemblyForDomainServices(assembly);
        discoveredServices.push(...assemblyServices);
      }
    }

    return discoveredServices;
  }

  /**
   * Scan a specific assembly/module for domain services.
   *
   * @param assembly - Module or assembly to scan
   * @returns Promise<HandlerInfo[]> Domain services found in the assembly
   */
  private async scanAssemblyForDomainServices(assembly: any): Promise<HandlerInfo[]> {
    const services: HandlerInfo[] = [];

    if (!assembly || typeof assembly !== 'object') {
      return services;
    }

    // Scan all exports in the assembly
    const exports = Object.values(assembly);

    for (const exportedValue of exports) {
      if (this.isDomainServiceClass(exportedValue)) {
        const diMetadata = getDIDomainServiceMetadata(exportedValue);

        if (diMetadata && diMetadata.autoRegister) {
          const handlerInfo: HandlerInfo = {
            type: 'domain-service' as any,
            messageType: exportedValue as any,
            handlerType: exportedValue as any,
            metadata: {
              serviceId: diMetadata.serviceId,
              lifetime: diMetadata.lifetime,
              context: diMetadata.context,
              tags: diMetadata.tags,
              dependencies: diMetadata.dependencies,
              transactional: diMetadata.transactional,
              async: diMetadata.async,
              publishesEvents: diMetadata.publishesEvents,
              caching: diMetadata.caching,
              contextResolver: diMetadata.contextResolver,
              fallbackToGlobal: diMetadata.fallbackToGlobal,
              autoRegister: diMetadata.autoRegister,
              createdAt: diMetadata.createdAt
            }
          };

          services.push(handlerInfo);
        }
      }
    }

    return services;
  }

  /**
   * Check if a value is a domain service class.
   *
   * @param value - Value to check
   * @returns boolean True if the value is a domain service class
   */
  private isDomainServiceClass(value: unknown): value is new (...args: any[]) => any {
    return (
      typeof value === 'function' &&
      value.prototype &&
      isDomainServicePendingDIRegistration(value)
    );
  }
}

/**
 * Singleton instance of the domain service discovery plugin.
 * Can be imported and registered with the VytchesDDD DI system.
 */
export const domainServiceDiscoveryPlugin = new DomainServiceDiscoveryPlugin();
