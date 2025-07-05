// Priority exports for better tree-shaking
export { EnhancedACLAdapter } from './enhanced-acl-adapter';

export { SimpleACLAdapter as BaseACLAdapter } from './base-acl-adapter';

export { ACLRegistry } from './acl-registry';

export type {
  IACLAdapter,
  IModelTranslator,
  IEnhancedACLAdapter,
  ACLContextInfo,
  ExecuteOptions,
  ACLMiddleware,
} from './acl.interfaces';

export { ACLError, TranslationError, AdapterNotFoundError } from './acl-errors';

// For advanced usage - full exports removed for better tree-shaking
// Import specific exports from subpaths when needed
