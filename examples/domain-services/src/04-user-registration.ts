/**
 * Example 4 — User registration with transactional coordination.
 *
 * Registration spans multiple aggregates (User profile + Audit trail +
 * NotificationPreferences) — they MUST commit atomically. Extending
 * `UnitOfWorkAwareDomainService` provides `executeInTransaction()` which
 * begins / commits / rolls back automatically based on operation success.
 *
 * Use case: sign-up flow — create user, write welcome audit entry, add
 * default notification prefs. All-or-nothing.
 *
 * Pattern: Unit of Work spanning multiple repositories, with rollback
 * on any failure.
 */

import { DomainService, UnitOfWorkAwareDomainService } from '@vytches/ddd-domain-services';
import { Result } from '@vytches/ddd-utils';

export interface NewUser {
  readonly email: string;
  readonly displayName: string;
}

export interface RegisteredUser {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
}

export class UserRegistrationError extends Error {
  constructor(
    message: string,
    public readonly code: 'EMAIL_TAKEN' | 'INVALID_EMAIL' | 'PERSISTENCE_FAILED'
  ) {
    super(message);
    this.name = 'UserRegistrationError';
  }
}

// Repository contracts — consumer implements these
export interface IUserRepository {
  findByEmail(email: string): Promise<RegisteredUser | null>;
  save(user: RegisteredUser): Promise<void>;
}
export interface IAuditRepository {
  recordEvent(userId: string, event: string, metadata?: Record<string, unknown>): Promise<void>;
}
export interface INotificationPrefsRepository {
  saveDefaults(userId: string): Promise<void>;
}

@DomainService('UserRegistrationService')
export class UserRegistrationService extends UnitOfWorkAwareDomainService {
  constructor() {
    super('UserRegistrationService');
  }

  async register(input: NewUser): Promise<Result<RegisteredUser, UserRegistrationError>> {
    if (!isValidEmail(input.email)) {
      return Result.fail(
        new UserRegistrationError(`Invalid email: ${input.email}`, 'INVALID_EMAIL')
      );
    }

    return this.executeInTransaction(async () => {
      const userRepo = this.getRepository<IUserRepository>('users');
      const auditRepo = this.getRepository<IAuditRepository>('audit');
      const prefsRepo = this.getRepository<INotificationPrefsRepository>('notificationPrefs');

      const existing = await userRepo.findByEmail(input.email);
      if (existing) {
        // Throwing inside the transaction triggers rollback.
        throw new UserRegistrationError(`Email already taken: ${input.email}`, 'EMAIL_TAKEN');
      }

      const user: RegisteredUser = {
        userId: `user-${Date.now()}`,
        email: input.email,
        displayName: input.displayName,
      };

      await userRepo.save(user);
      await auditRepo.recordEvent(user.userId, 'user.registered', { email: user.email });
      await prefsRepo.saveDefaults(user.userId);

      // Returning a value commits the transaction.
      return Result.ok<RegisteredUser, UserRegistrationError>(user);
    }).catch(err => {
      if (err instanceof UserRegistrationError) return Result.fail(err);
      // Unknown failure → wrap as persistence error.
      return Result.fail(
        new UserRegistrationError(
          `Registration failed: ${(err as Error).message}`,
          'PERSISTENCE_FAILED'
        )
      );
    });
  }
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
