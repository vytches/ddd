# Foundation Contracts

**Version**: 1.0.0 **Package**: @vytches-ddd/contracts **Complexity**: Basic
**Domain**: Foundation **Patterns**: specifications, actors,
foundation-interfaces **Dependencies**: @vytches-ddd/contracts

## Description

Foundation contracts provide the core interfaces and patterns that form the
architectural foundation of VytchesDDD. This includes specifications for
business rules, actor patterns for audit and security, and essential domain
interfaces that enable consistent patterns across all domain implementations.

## Business Context

Foundation contracts establish consistent patterns for business rule validation,
audit trails, user context tracking, and architectural boundaries. These
contracts ensure that all domain implementations follow the same patterns,
making the codebase maintainable and the architecture predictable.

## Specification Patterns

### Basic Specification Interface

```typescript
// src/domain/specifications/specification-foundation.ts
import { ISpecification, IAsyncSpecification } from '@vytches-ddd/contracts';

// Simple business rule specification
export class EmailValidationSpecification implements ISpecification<string> {
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  isSatisfiedBy(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }

    return this.emailRegex.test(email.toLowerCase());
  }

  // Optional: provide detailed reason for failure
  getFailureReason(email: string): string {
    if (!email) {
      return 'Email is required';
    }
    if (typeof email !== 'string') {
      return 'Email must be a string';
    }
    if (!this.emailRegex.test(email.toLowerCase())) {
      return 'Email format is invalid';
    }
    return '';
  }
}

// Age validation specification
export class MinimumAgeSpecification implements ISpecification<number> {
  constructor(private readonly minimumAge: number) {}

  isSatisfiedBy(age: number): boolean {
    return age >= this.minimumAge;
  }

  getFailureReason(age: number): string {
    if (age < this.minimumAge) {
      return `Age must be at least ${this.minimumAge}, but got ${age}`;
    }
    return '';
  }
}

// Complex business rule specification
export class UserEligibilitySpecification implements ISpecification<User> {
  constructor(
    private readonly minimumAge: number = 18,
    private readonly allowedCountries: string[] = ['US', 'CA', 'UK']
  ) {}

  isSatisfiedBy(user: User): boolean {
    // Check age requirement
    if (user.age < this.minimumAge) {
      return false;
    }

    // Check country restriction
    if (!this.allowedCountries.includes(user.country)) {
      return false;
    }

    // Check email verification
    if (!user.isEmailVerified) {
      return false;
    }

    // Check account status
    if (user.status === 'suspended' || user.status === 'banned') {
      return false;
    }

    return true;
  }

  getFailureReason(user: User): string {
    if (user.age < this.minimumAge) {
      return `User must be at least ${this.minimumAge} years old`;
    }
    if (!this.allowedCountries.includes(user.country)) {
      return `Service not available in ${user.country}`;
    }
    if (!user.isEmailVerified) {
      return 'Email verification required';
    }
    if (user.status === 'suspended') {
      return 'Account is suspended';
    }
    if (user.status === 'banned') {
      return 'Account is banned';
    }
    return '';
  }
}

interface User {
  age: number;
  country: string;
  isEmailVerified: boolean;
  status: 'active' | 'suspended' | 'banned';
}
```

### Async Specification Patterns

```typescript
// src/domain/specifications/async-specifications.ts
import { IAsyncSpecification } from '@vytches-ddd/contracts';

// Async specification for external validation
export class UniqueEmailSpecification implements IAsyncSpecification<string> {
  constructor(private readonly userRepository: IUserRepository) {}

  async isSatisfiedByAsync(email: string): Promise<boolean> {
    const existingUser = await this.userRepository.findByEmail(email);
    return existingUser === null;
  }

  async getFailureReasonAsync(email: string): Promise<string> {
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      return `Email ${email} is already registered`;
    }
    return '';
  }
}

// Credit check specification
export class CreditWorthinessSpecification
  implements IAsyncSpecification<CreditApplication>
{
  constructor(
    private readonly creditService: ICreditService,
    private readonly minimumScore: number = 650
  ) {}

  async isSatisfiedByAsync(application: CreditApplication): Promise<boolean> {
    const creditScore = await this.creditService.getCreditScore(
      application.ssn
    );
    const debtToIncomeRatio = await this.creditService.getDebtToIncomeRatio(
      application.ssn
    );

    // Multiple criteria
    return (
      creditScore >= this.minimumScore &&
      debtToIncomeRatio <= 0.4 &&
      application.annualIncome >= 30000
    );
  }

  async getFailureReasonAsync(application: CreditApplication): Promise<string> {
    const creditScore = await this.creditService.getCreditScore(
      application.ssn
    );
    const debtToIncomeRatio = await this.creditService.getDebtToIncomeRatio(
      application.ssn
    );

    if (creditScore < this.minimumScore) {
      return `Credit score ${creditScore} is below minimum ${this.minimumScore}`;
    }
    if (debtToIncomeRatio > 0.4) {
      return `Debt-to-income ratio ${debtToIncomeRatio} exceeds maximum 0.4`;
    }
    if (application.annualIncome < 30000) {
      return `Annual income ${application.annualIncome} is below minimum $30,000`;
    }
    return '';
  }
}

interface CreditApplication {
  ssn: string;
  annualIncome: number;
  requestedAmount: number;
}
```

### Composite Specification Patterns

```typescript
// src/domain/specifications/composite-specifications.ts
export class CompositeSpecification<T> implements ISpecification<T> {
  protected constructor(
    protected readonly specifications: ISpecification<T>[],
    protected readonly operator: 'AND' | 'OR'
  ) {}

  static and<T>(
    ...specifications: ISpecification<T>[]
  ): CompositeSpecification<T> {
    return new CompositeSpecification(specifications, 'AND');
  }

  static or<T>(
    ...specifications: ISpecification<T>[]
  ): CompositeSpecification<T> {
    return new CompositeSpecification(specifications, 'OR');
  }

  isSatisfiedBy(candidate: T): boolean {
    if (this.operator === 'AND') {
      return this.specifications.every(spec => spec.isSatisfiedBy(candidate));
    } else {
      return this.specifications.some(spec => spec.isSatisfiedBy(candidate));
    }
  }

  getFailureReason(candidate: T): string {
    const failedReasons: string[] = [];

    for (const spec of this.specifications) {
      const satisfied = spec.isSatisfiedBy(candidate);

      if (this.operator === 'AND' && !satisfied) {
        const reason = this.getSpecFailureReason(spec, candidate);
        if (reason) failedReasons.push(reason);
      } else if (this.operator === 'OR' && satisfied) {
        return ''; // At least one satisfied for OR
      }
    }

    if (
      this.operator === 'OR' &&
      failedReasons.length === this.specifications.length
    ) {
      return `None of the conditions met: ${failedReasons.join(', ')}`;
    }

    return failedReasons.join('; ');
  }

  private getSpecFailureReason(spec: ISpecification<T>, candidate: T): string {
    if (typeof (spec as any).getFailureReason === 'function') {
      return (spec as any).getFailureReason(candidate);
    }
    return `Specification ${spec.constructor.name} not satisfied`;
  }
}

// Usage example
export class UserRegistrationValidator {
  private readonly specification: ISpecification<User>;

  constructor() {
    this.specification = CompositeSpecification.and(
      new MinimumAgeSpecification(18),
      new UserEligibilitySpecification(),
      new EmailValidationSpecification()
    );
  }

  validate(user: User & { email: string }): {
    valid: boolean;
    errors: string[];
  } {
    const isValid = this.specification.isSatisfiedBy(user);
    const errors = isValid ? [] : [this.specification.getFailureReason(user)];

    return { valid: isValid, errors };
  }
}
```

## Actor Patterns

### Basic Actor Interface

```typescript
// src/domain/actors/actor-foundation.ts
import { IActor } from '@vytches-ddd/contracts';

// System actor for automated processes
export class SystemActor implements IActor {
  public readonly id: string = 'system';
  public readonly type: string = 'system';
  public readonly name: string = 'System';

  constructor(public readonly context: Record<string, any> = {}) {
    this.context = {
      timestamp: new Date(),
      source: 'internal-system',
      ...context,
    };
  }

  isSystem(): boolean {
    return true;
  }

  hasPermission(permission: string): boolean {
    // System actor has all permissions
    return true;
  }

  getDisplayName(): string {
    return this.name;
  }
}

// User actor for human users
export class UserActor implements IActor {
  constructor(
    public readonly id: string,
    public readonly type: string = 'user',
    public readonly name: string,
    public readonly context: Record<string, any> = {}
  ) {
    this.context = {
      timestamp: new Date(),
      source: 'user-action',
      ...context,
    };
  }

  isSystem(): boolean {
    return false;
  }

  hasPermission(permission: string): boolean {
    const permissions = this.context.permissions || [];
    return permissions.includes(permission) || permissions.includes('*');
  }

  getDisplayName(): string {
    return this.name;
  }

  getTenantId(): string | undefined {
    return this.context.tenantId;
  }

  getRole(): string | undefined {
    return this.context.role;
  }
}

// Service actor for external services
export class ServiceActor implements IActor {
  constructor(
    public readonly id: string,
    public readonly type: string = 'service',
    public readonly name: string,
    public readonly context: Record<string, any> = {}
  ) {
    this.context = {
      timestamp: new Date(),
      source: 'external-service',
      serviceVersion: context.serviceVersion || '1.0.0',
      ...context,
    };
  }

  isSystem(): boolean {
    return false;
  }

  hasPermission(permission: string): boolean {
    const permissions = this.context.servicePermissions || [];
    return permissions.includes(permission);
  }

  getDisplayName(): string {
    return `${this.name} Service`;
  }

  getServiceType(): string {
    return this.context.serviceType || 'external';
  }
}
```

### Actor Context and Security

```typescript
// src/domain/actors/actor-context.ts
export class ActorContextManager {
  private static currentActor: IActor | null = null;

  // Set current actor for request context
  static setCurrentActor(actor: IActor): void {
    this.currentActor = actor;
  }

  // Get current actor
  static getCurrentActor(): IActor | null {
    return this.currentActor;
  }

  // Require actor with specific permission
  static requirePermission(permission: string): IActor {
    const actor = this.getCurrentActor();
    if (!actor) {
      throw new Error('No actor in current context');
    }

    if (!actor.hasPermission(permission)) {
      throw new Error(
        `Actor ${actor.getDisplayName()} lacks permission: ${permission}`
      );
    }

    return actor;
  }

  // Execute with actor context
  static async withActor<T>(
    actor: IActor,
    operation: () => Promise<T>
  ): Promise<T> {
    const previousActor = this.currentActor;
    this.setCurrentActor(actor);

    try {
      return await operation();
    } finally {
      this.currentActor = previousActor;
    }
  }

  // Create audit trail entry
  static createAuditEntry(
    action: string,
    details?: Record<string, any>
  ): AuditEntry {
    const actor = this.getCurrentActor();
    if (!actor) {
      throw new Error('No actor for audit trail');
    }

    return {
      actorId: actor.id,
      actorType: actor.type,
      actorName: actor.name,
      action,
      timestamp: new Date(),
      details: details || {},
      context: actor.context,
    };
  }
}

interface AuditEntry {
  actorId: string;
  actorType: string;
  actorName: string;
  action: string;
  timestamp: Date;
  details: Record<string, any>;
  context: Record<string, any>;
}
```

### Actor-Based Domain Operations

```typescript
// src/domain/services/actor-aware-operations.ts
export class ActorAwareDomainService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly auditLogger: IAuditLogger
  ) {}

  async createUser(userData: CreateUserData): Promise<User> {
    // Require permission
    const actor = ActorContextManager.requirePermission('user:create');

    // Create user
    const user = User.create(userData);

    // Save user
    await this.userRepository.save(user);

    // Create audit entry
    const auditEntry = ActorContextManager.createAuditEntry('user:created', {
      userId: user.id.getValue(),
      email: userData.email,
      creationMethod: 'domain-service',
    });

    await this.auditLogger.log(auditEntry);

    return user;
  }

  async updateUserProfile(
    userId: string,
    updates: Partial<UserData>
  ): Promise<User> {
    const actor = ActorContextManager.getCurrentActor();
    if (!actor) {
      throw new Error('Actor required for profile updates');
    }

    // Business rule: users can only update their own profile unless admin
    const isAdmin = actor.hasPermission('user:admin');
    const isOwner = actor.id === userId;

    if (!isAdmin && !isOwner) {
      throw new Error('Insufficient permissions to update profile');
    }

    const user = await this.userRepository.findById(
      EntityId.createText(userId)
    );
    if (!user) {
      throw new Error('User not found');
    }

    // Apply updates
    user.updateProfile(updates);
    await this.userRepository.save(user);

    // Audit trail
    const auditEntry = ActorContextManager.createAuditEntry(
      'user:profile-updated',
      {
        userId,
        updates,
        updateMethod: isAdmin ? 'admin-update' : 'self-update',
      }
    );

    await this.auditLogger.log(auditEntry);

    return user;
  }
}
```

## Foundation Interfaces

### Repository Base Contracts

```typescript
// src/domain/repositories/repository-contracts.ts
import { EntityId } from '@vytches-ddd/contracts';

// Base repository interface
export interface IBaseRepository<T> {
  findById(id: EntityId<string>): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: EntityId<string>): Promise<void>;
}

// Query repository interface
export interface IQueryRepository<T> {
  findAll(): Promise<T[]>;
  findBySpecification(specification: ISpecification<T>): Promise<T[]>;
  count(): Promise<number>;
  exists(id: EntityId<string>): Promise<boolean>;
}

// Full repository interface
export interface IRepository<T>
  extends IBaseRepository<T>,
    IQueryRepository<T> {
  findByIds(ids: EntityId<string>[]): Promise<T[]>;
  saveMany(entities: T[]): Promise<void>;
  deleteMany(ids: EntityId<string>[]): Promise<void>;
}
```

### Domain Service Contracts

```typescript
// src/domain/services/service-contracts.ts
export interface IDomainService {
  readonly serviceName: string;
  readonly version: string;
}

export interface IApplicationService extends IDomainService {
  readonly context: Record<string, any>;
}

export interface IInfrastructureService extends IDomainService {
  readonly dependencies: string[];
  healthCheck(): Promise<boolean>;
}

// Domain event service interface
export interface IDomainEventService extends IDomainService {
  publishEvents(events: IDomainEvent[]): Promise<void>;
  subscribeToEvents(eventTypes: string[], handler: IEventHandler<any>): void;
}
```

## Key Features

- **Specification Pattern**: Flexible business rule validation
- **Actor Pattern**: Comprehensive audit and security context
- **Foundation Interfaces**: Consistent architectural patterns
- **Composite Specifications**: Complex business rule composition
- **Async Support**: Full support for asynchronous operations
- **Context Management**: Actor context propagation
- **Audit Trails**: Comprehensive audit logging

## Common Pitfalls

- **Specification Complexity**: Keep specifications focused and testable
- **Actor Context**: Always ensure actor context is properly set
- **Permission Checking**: Don't bypass permission checks for convenience
- **Audit Logging**: Don't forget to audit sensitive operations

## Related Examples

- EntityId Usage - Using EntityId in specifications and repositories
- Event Interfaces - Using actors in domain events
- Advanced Event Architecture - Specifications in event processing

## Best Practices

- Keep specifications small and focused on single business rules
- Use composite specifications for complex validation logic
- Always validate actor permissions before operations
- Include rich context information in actor instances
- Use meaningful specification names that express business intent
- Implement async specifications for external validation
- Create audit trails for all significant business operations
