import type { Result } from '@vytches/ddd-utils';

import { TranslationError } from './acl-errors';
import type { IModelTranslator } from './acl.interfaces';

export abstract class BaseModelTranslator<TDomain, TExternal>
  implements IModelTranslator<TDomain, TExternal>
{
  constructor(protected readonly contextName: string) {}

  toExternal(domainModel: TDomain): TExternal {
    try {
      const validationResult = this.validateDomain?.(domainModel);
      if (validationResult?.isFailure) {
        throw new Error(`Domain validation failed: ${validationResult.error.message}`);
      }

      return this.performToExternalTranslation(domainModel);
    } catch (error) {
      const errorMessage = (error as Error).message;
      throw TranslationError.forToExternal(
        errorMessage.includes('validation')
          ? `Domain validation failed: ${errorMessage}`
          : errorMessage.includes('TypeError')
            ? `Unexpected type error: ${errorMessage}`
            : `Conversion to external failed: ${errorMessage}`,
        this.contextName,
        domainModel,
        error as Error
      );
    }
  }

  fromExternal(externalModel: TExternal): TDomain {
    try {
      const validationResult = this.validateExternal?.(externalModel);
      if (validationResult?.isFailure) {
        throw new Error(`External validation failed: ${validationResult.error.message}`);
      }

      return this.performFromExternalTranslation(externalModel);
    } catch (error) {
      const errorMessage = (error as Error).message;
      throw TranslationError.forFromExternal(
        errorMessage.includes('validation')
          ? `External validation failed: ${errorMessage}`
          : `Conversion from external failed: ${errorMessage}`,
        this.contextName,
        externalModel,
        error as Error
      );
    }
  }

  protected abstract performToExternalTranslation(domainModel: TDomain): TExternal;
  protected abstract performFromExternalTranslation(externalModel: TExternal): TDomain;

  public validateDomain?(domainModel: TDomain): Result<void, Error>;
  public validateExternal?(externalModel: TExternal): Result<void, Error>;
}
