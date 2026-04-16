/**
 * Constants for VytchesDDD NestJS adapter
 */

/**
 * Injection token for VytchesDDD options
 */
export const VYTCHES_DDD_OPTIONS = Symbol('VYTCHES_DDD_OPTIONS');

/**
 * Injection token for VytchesDDD container adapter
 */
export const VYTCHES_DDD_ADAPTER = Symbol('VYTCHES_DDD_ADAPTER');

/**
 * Metadata key for domain service decorator
 */
export const DOMAIN_SERVICE_METADATA = 'vytches:domain-service';

/**
 * Metadata key for command handler decorator
 */
export const COMMAND_HANDLER_METADATA = 'vytches:command-handler';

/**
 * Metadata key for query handler decorator
 */
export const QUERY_HANDLER_METADATA = 'vytches:query-handler';

/**
 * Metadata key for event handler decorator
 */
export const EVENT_HANDLER_METADATA = 'vytches:event-handler';

/**
 * Metadata key for saga decorator
 */
export const SAGA_METADATA = 'vytches:saga';

/**
 * Metadata key for ACL adapter decorator
 */
export const ACL_ADAPTER_METADATA = 'vytches:acl-adapter';

/**
 * Injection token for ACLRegistry — provide in module to enable ACL auto-discovery
 */
export const ACL_REGISTRY = Symbol('ACL_REGISTRY');

/**
 * Default auto-discovery patterns
 */
export const DEFAULT_DISCOVERY_PATTERNS = [
  '**/*.service.ts',
  '**/*.handler.ts',
  '**/*.saga.ts',
  '**/*.policy.ts',
];

/**
 * Default exclude patterns for auto-discovery
 */
export const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/tests/**',
  '**/*.test.ts',
  '**/*.spec.ts',
];
