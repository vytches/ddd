/**
 * @file Enterprise package - Meta-package for enterprise features
 * @module @vytches-ddd/enterprise
 */

// This is a placeholder enterprise package
// TODO: Implement enterprise features like health checks, monitoring, etc.

export * from '@vytches-ddd/core';
export * from '@vytches-ddd/events';
export * from '@vytches-ddd/cqrs';
export * from '@vytches-ddd/acl';
export * from '@vytches-ddd/messaging';
export * from '@vytches-ddd/resilience';
export * from '@vytches-ddd/policies';
export * from '@vytches-ddd/validation';
export * from '@vytches-ddd/projections';
export * from '@vytches-ddd/di';

export const ENTERPRISE_VERSION = '0.1.0';
