import { internalLogger } from '@vytches/ddd-contracts/internal';
import { MessageStatus } from './outbox-interfaces';
import type { OutcomeClaim, OutcomeStore } from './outbox-outcome-recorder';
import type {
  FencedOutboxRepository,
  IOutboxRepository,
  OutboxFencedReleaseOutcome,
} from './outbox-repository.interface';

const FENCED_METHODS = ['completeFenced', 'recordFailureFenced', 'releaseFenced'] as const;

/** Names of the fenced writes the repository does not implement (empty = fully fenced). */
export function missingFencedMethods(repository: IOutboxRepository): string[] {
  return FENCED_METHODS.filter(name => typeof repository[name] !== 'function');
}

export function isFencedRepository(
  repository: IOutboxRepository
): repository is FencedOutboxRepository {
  return missingFencedMethods(repository).length === 0;
}

/** Unfenced writes through `updateStatus` / `incrementAttempt` / `scheduleRetry` (the default). */
export class LegacyOutcomeStore implements OutcomeStore {
  constructor(private readonly repository: IOutboxRepository) {}

  recordFailure({ message }: OutcomeClaim): Promise<number | null> {
    return this.repository.incrementAttempt(message.id);
  }

  async release({ message }: OutcomeClaim, outcome: OutboxFencedReleaseOutcome): Promise<boolean> {
    if (outcome.status === MessageStatus.FAILED) {
      await this.repository.updateStatus(message.id, MessageStatus.FAILED, outcome.error);
      return true;
    }
    // Reset to PENDING first so the message is never stuck in PROCESSING if the
    // repository's scheduleRetry is the inherited no-op.
    await this.repository.updateStatus(message.id, MessageStatus.PENDING);
    if (outcome.processAfter) {
      await this.repository.scheduleRetry(message.id, outcome.processAfter);
    }
    return true;
  }

  async complete({ message }: OutcomeClaim): Promise<boolean> {
    await this.repository.updateStatus(message.id, MessageStatus.PROCESSED);
    return true;
  }

  /**
   * An unfenced release after a failed completion write could overwrite a row
   * whose PROCESSED write DID commit. Read the row back first (best effort).
   */
  async alreadyProcessed({ message }: OutcomeClaim): Promise<boolean> {
    try {
      const row = await this.repository.getById(message.id);
      return row?.status === MessageStatus.PROCESSED;
    } catch (readError) {
      internalLogger.warn('OutboxProcessor: could not read the message back after a failed write', {
        messageId: message.id,
        reason: readError instanceof Error ? readError.message : String(readError),
      });
      return false;
    }
  }
}

/** Fenced writes: each applies only while the claim token is still the current one. */
export class FencedOutcomeStore implements OutcomeStore {
  constructor(private readonly repository: FencedOutboxRepository) {}

  async recordFailure(claim: OutcomeClaim, error: Error): Promise<number | null> {
    const attempts = await this.repository.recordFailureFenced(
      claim.message.id,
      this.token(claim),
      error
    );
    if (attempts !== null && (typeof attempts !== 'number' || !Number.isFinite(attempts))) {
      throw new TypeError(
        `recordFailureFenced returned '${String(attempts)}' as the new attempts count; expected a finite number (or null when the claim is lost)`
      );
    }
    return attempts;
  }

  release(claim: OutcomeClaim, outcome: OutboxFencedReleaseOutcome): Promise<boolean> {
    return this.repository.releaseFenced(claim.message.id, this.token(claim), outcome);
  }

  complete(claim: OutcomeClaim): Promise<boolean> {
    return this.repository.completeFenced(claim.message.id, this.token(claim));
  }

  /** The fence rejects a release of a committed row by itself — no read-back needed. */
  async alreadyProcessed(): Promise<boolean> {
    return false;
  }

  private token(claim: OutcomeClaim): string {
    if (!claim.claimToken) {
      throw new TypeError('OutboxProcessor: fenced outcome without a claim token');
    }
    return claim.claimToken;
  }
}
