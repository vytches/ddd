import type { Result } from '@vytches-ddd/utils';

export abstract class TypedOperation<TInput, _TOutput> {
  abstract readonly name: string;
  readonly description?: string;

  validateBusinessRules?(input: TInput): Result<void, Error>;
}

export interface ITypedOperationRegistry {
  register<TInput, TOutput>(operation: TypedOperation<TInput, TOutput>): void;
  get<TInput, TOutput>(
    operationName: string,
  ): TypedOperation<TInput, TOutput> | undefined;
}
