// Testing Pattern for Domain Services import { describe, it, expect, beforeEach
} from 'vitest'; import { safeRun } from '@vytches/ddd-utils'; import {
UserManagementService } from './user-management.service'; import {
CreateUserCommand } from '../types';

describe('UserManagementService', () => { let service: UserManagementService;
let mockRepository: MockUserRepository; let mockEventBus: MockEventBus;

beforeEach(() => { mockRepository = new MockUserRepository(); mockEventBus = new
MockEventBus(); service = new UserManagementService(mockRepository,
mockEventBus); });

describe('createUser', () => { it('should create user successfully with all
steps', async () => { // Arrange const command: CreateUserCommand = { email:
'test@example.com', name: 'Test User' };

      // Act
      const [error, result] = await safeRun(
        async () => await service.createUser(command)
      );

      // Assert
      expect(error).toBeNull();
      expect(result?.isSuccess()).toBe(true);
      expect(result?.value).toMatchObject({
        email: 'test@example.com',
        name: 'Test User'
      });

      // Verify side effects
      expect(mockRepository.saved).toHaveLength(1);
      expect(mockEventBus.published).toHaveLength(1);
      expect(mockEventBus.published[0].eventType).toBe('UserCreatedEvent');
    });

    it('should handle validation errors', async () => {
      // Arrange
      const command: CreateUserCommand = {
        email: 'invalid-email',
        name: 'Test User'
      };

      // Act
      const [error, result] = await safeRun(
        async () => await service.createUser(command)
      );

      // Assert
      expect(error).toBeNull();
      expect(result?.isFailure()).toBe(true);
      expect(result?.error?.message).toContain('Valid email is required');

      // Verify no side effects on validation failure
      expect(mockRepository.saved).toHaveLength(0);
      expect(mockEventBus.published).toHaveLength(0);
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      const command: CreateUserCommand = {
        email: 'test@example.com',
        name: 'Test User'
      };
      mockRepository.shouldFail = true;

      // Act
      const [error, result] = await safeRun(
        async () => await service.createUser(command)
      );

      // Assert
      expect(error).toBeNull();
      expect(result?.isFailure()).toBe(true);
      expect(result?.error?.message).toContain('User creation failed');
    });

});

describe('orchestration testing', () => { it('should execute steps in correct
order', async () => { // Arrange const executionOrder: string[] = [];
service.onStep = (step: string) => executionOrder.push(step);

      // Act
      await service.createUser({
        email: 'test@example.com',
        name: 'Test User'
      });

      // Assert
      expect(executionOrder).toEqual([
        'validateUser',
        'buildUser',
        'saveUser',
        'publishEvent',
        'sendNotification'
      ]);
    });

    it('should stop execution on first failure', async () => {
      // Arrange
      const executionOrder: string[] = [];
      service.onStep = (step: string) => executionOrder.push(step);
      mockRepository.shouldFail = true;

      // Act
      await service.createUser({
        email: 'test@example.com',
        name: 'Test User'
      });

      // Assert - should stop at saveUser
      expect(executionOrder).toEqual([
        'validateUser',
        'buildUser',
        'saveUser'
      ]);
    });

}); });

// Mock implementations for testing class MockUserRepository { saved: any[] =
[]; shouldFail = false;

async save(user: any): Promise<any> { if (this.shouldFail) { throw new
Error('Repository error'); } this.saved.push(user); return user; } }

class MockEventBus { published: any[] = [];

async publish(event: any): Promise<void> { this.published.push(event); } }
