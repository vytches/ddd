/**
 * DI Integration exports for domain services package
 * 
 * This module provides integration components for the VytchesDDD dependency injection system.
 */

export { DomainServiceDiscoveryPlugin, domainServiceDiscoveryPlugin } from './domain-service-discovery-plugin';
export type { DIDecoratorOptions, EnhancedDomainServiceOptions, DIServiceMetadata, ContextResolutionStrategy } from '../di-types';
export { DIDomainServiceMetadataRegistry } from '../di-types';
export { getDIDomainServiceMetadata, isDomainServicePendingDIRegistration } from '../domain-service.decorator';