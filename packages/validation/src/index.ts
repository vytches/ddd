// Priority exports for better tree-shaking
export {
  Specification,
  CompositeSpecification,
  NotSpecification,
  AndSpecification,
  OrSpecification
} from './specifications';

export {
  BusinessRuleValidator
} from './business-rules';

export {
  ValidationError,
  ValidationErrors
} from './validation-error';

export {
  Validation as ValidationFacade
} from './validation-facade';

export {
  RulesRegistry
} from './rules-registry';

// For advanced usage - full exports removed for better tree-shaking
// Import specific exports from subpaths when needed
