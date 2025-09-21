import type { DomainErrorOptions } from '@vytches/ddd-domain-primitives';
import { DomainErrorCode, IDomainError } from '@vytches/ddd-domain-primitives';

export class VersionError extends IDomainError {
  static withEntityIdAndVersions(
    id: unknown,
    dbVersion: unknown,
    newVersion: unknown,
    data?: DomainErrorOptions
  ): VersionError {
    const message = `Version mismatch for entity with id ${id}: expected [${dbVersion}], got [${newVersion}]`;
    const options = {
      code: DomainErrorCode.ValidationFailed,
      data,
    };
    return new VersionError(message, options);
  }
}
