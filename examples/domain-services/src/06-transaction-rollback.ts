/**
 * Example 6 — Transaction handling with explicit rollback.
 *
 * `executeInTransaction(operation)` from `UnitOfWorkAwareDomainService`
 * automatically commits on success and rolls back on thrown error.
 * This example shows three explicit failure modes:
 *   - business invariant violation → rollback
 *   - infrastructure error (DB down) → rollback
 *   - normal success → commit
 *
 * Use case: money transfer between accounts — must atomically debit one
 * and credit another, or neither.
 *
 * Pattern: throw to rollback, return to commit. The thrown error
 * propagates after rollback so the caller can handle it.
 */

import { DomainService, UnitOfWorkAwareDomainService } from '@vytches/ddd-domain-services';
import { Result } from '@vytches/ddd-utils';

export interface Account {
  readonly id: string;
  balance: number;
}

export class InsufficientFundsError extends Error {
  constructor(
    public readonly accountId: string,
    public readonly available: number,
    public readonly requested: number
  ) {
    super(
      `Account ${accountId} has insufficient funds: available ${available}, requested ${requested}`
    );
    this.name = 'InsufficientFundsError';
  }
}

export interface IAccountRepository {
  findById(id: string): Promise<Account | null>;
  save(account: Account): Promise<void>;
}

@DomainService('TransferService')
export class TransferService extends UnitOfWorkAwareDomainService {
  constructor() {
    super('TransferService');
  }

  /**
   * Transfer `amount` from `fromId` to `toId`. Atomic: either both
   * accounts update, or neither does.
   *
   * `executeInTransaction` semantics:
   *   - returned value → commit
   *   - thrown error → rollback + re-throw
   * We catch the rollback's re-throw and convert to `Result` for the
   * caller's convenience (errors-as-values at the domain boundary).
   */
  async transfer(fromId: string, toId: string, amount: number): Promise<Result<void, Error>> {
    if (amount <= 0) {
      return Result.fail(new Error('Transfer amount must be positive'));
    }
    if (fromId === toId) {
      return Result.fail(new Error('Cannot transfer to the same account'));
    }

    try {
      await this.executeInTransaction(async () => {
        const repo = this.getRepository<IAccountRepository>('accounts');
        const from = await repo.findById(fromId);
        const to = await repo.findById(toId);
        if (!from) throw new Error(`Account not found: ${fromId}`);
        if (!to) throw new Error(`Account not found: ${toId}`);

        if (from.balance < amount) {
          // Throwing inside the txn triggers rollback automatically.
          throw new InsufficientFundsError(fromId, from.balance, amount);
        }

        from.balance -= amount;
        to.balance += amount;
        await repo.save(from);
        await repo.save(to);
      });
      return Result.empty();
    } catch (err) {
      return Result.fail(err as Error);
    }
  }
}
