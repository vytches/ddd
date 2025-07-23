// Standard Import Pattern for Domain Services

// Core imports from @vytches-ddd packages import { BaseDomainService } from
'@vytches-ddd/domain-services'; import { Result } from '@vytches-ddd/utils';
import { DomainError, EntityId, AggregateRoot } from
'@vytches-ddd/domain-primitives'; import { IEventBus, DomainEvent } from
'@vytches-ddd/events';

// Domain-specific imports (always import from your application) import { User,
Order, CreateUserCommand, UpdateOrderCommand, UserRepository, OrderRepository }
from '../domain'; // Your domain models

// Type imports (prefer type imports for better tree-shaking) import type {
IUnitOfWork, IRepository } from '@vytches-ddd/repositories'; import type {
IDomainService, ServiceContext } from '@vytches-ddd/domain-services';

// Framework-specific imports (when needed) import { Injectable } from
'@nestjs/common'; // Only for framework integration import { VytchesDDD } from
'@vytches-ddd/di'; // For DI integration
