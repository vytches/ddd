// Priority exports for better tree-shaking
export {
  Specification,
  CompositeSpecification,
  NotSpecification,
  AndSpecification,
  OrSpecification,
  AlwaysFalseSpecification,
  AlwaysTrueSpecification,
  SpecificationValidator,
  PredicateSpecification,
  PropertyBetweenSpecification,
  PropertyInSpecification,
  PropertyEqualsSpecification,
} from './specifications';

export { BusinessRuleValidator } from './business-rules';

export { ValidationError, ValidationErrors } from './validation-error';

export { Validation as ValidationFacade } from './validation-facade';

export { RulesRegistry } from './rules-registry';

export { BaseValidationAdapter, AdapterUtils } from './adapters';
