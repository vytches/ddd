/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';
import { LibUtils } from '@vytches-ddd/utils';

import type { ProjectionError } from '../projection-errors';
import type {
  ICapabilityContext,
  IDeadLetterStore,
  IProjectionLifecycleCapability,
} from '../projection-interfaces';

export class DeadLetterCapability<TReadModel>
  implements IProjectionLifecycleCapability<TReadModel>
{
  private context?: ICapabilityContext<TReadModel>;

  constructor(
    private readonly deadLetterStore: IDeadLetterStore,
    private readonly shouldDeadLetter: (error: Error, attempts: number) => boolean = (
      error,
      attempts
    ) => attempts >= 3
  ) {}

  readonly name = 'dead-letter';

  attach(context: ICapabilityContext<TReadModel>): void {
    this.context = context;
  }

  async onError(error: ProjectionError, event?: IExtendedDomainEvent): Promise<void> {
    if (!event || !this.context) return;

    const attemptCount = this.getAttemptCount(error);

    if (this.shouldDeadLetter(error, attemptCount)) {
      await this.deadLetterStore.store({
        id: LibUtils.getUUID(),
        projectionName: this.context.getProjectionName(),
        event,
        error,
        attemptCount,
        firstFailedAt: new Date(),
        lastFailedAt: new Date(),
        metadata: {
          errorType: error.constructor.name,
          errorMessage: error.message,
        },
      });
    }
  }

  private getAttemptCount(error: ProjectionError): number {
    if (
      error.data &&
      typeof error.data === 'object' &&
      'attemptCount' in error.data &&
      typeof (error.data as any).attemptCount === 'number'
    ) {
      return (error.data as any).attemptCount;
    }
    return 1;
  }
}
