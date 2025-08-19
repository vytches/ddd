import type { IAsyncSpecification, ISpecification } from '@vytches/ddd-contracts';
import type { PolicyViolationSeverity } from '../core/models/policy-violation';
import type { IPolicyGroup } from './policy-builder.interface';

export interface PolicyBuildStep<T> {
  type:
    | 'specification'
    | 'async-specification'
    | 'predicate'
    | 'async-predicate'
    | 'rules'
    | 'group-or'
    | 'conditional';
  specification?: ISpecification<T>;
  asyncSpecification?: IAsyncSpecification<T>;
  predicate?: (entity: T, context?: unknown) => boolean;
  asyncPredicate?: (entity: T, context?: unknown) => Promise<boolean>;
  rulesBuilder?: (entity: T) => boolean;
  groups?: IPolicyGroup<T>[];
  isRequired: boolean;
  errorCode: string;
  errorMessage: string;
  severity: PolicyViolationSeverity;
  field?: string;
  details?: Record<string, unknown>;
  logicOperator?: 'AND' | 'OR';
}
