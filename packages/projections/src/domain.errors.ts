/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DomainErrorOptions } from '@vytches-ddd/core';
import { DomainErrorCode, IDomainError } from '@vytches-ddd/core';

export class VersionError extends IDomainError {
  static withEntityIdAndVersions(
    id: any,
    dbVersion: any,
    newVersion: any,
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
