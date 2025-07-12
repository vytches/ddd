/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Result } from '@vytches-ddd/utils';
import { TypedOperation, type ITypedOperationRegistry } from '../src/typed-operations';

// Test input/output types for operations
interface CreateUserInput {
  username: string;
  email: string;
  profile: {
    firstName: string;
    lastName: string;
    age: number;
  };
}

interface CreateUserOutput {
  userId: string;
  createdAt: Date;
  status: 'active' | 'pending';
}

interface UpdateUserInput {
  userId: string;
  updates: Partial<{
    email: string;
    profile: {
      firstName: string;
      lastName: string;
      age: number;
    };
  }>;
}

interface UpdateUserOutput {
  userId: string;
  updatedAt: Date;
  version: number;
}

interface DeleteUserInput {
  userId: string;
  reason?: string;
}

interface DeleteUserOutput {
  userId: string;
  deletedAt: Date;
  success: boolean;
}

// Concrete typed operation implementations for testing
class CreateUserOperation extends TypedOperation<CreateUserInput, CreateUserOutput> {
  readonly name = 'CREATE_USER';
  override readonly description = 'Creates a new user in the system';

  override validateBusinessRules = vi.fn((input: CreateUserInput): Result<void, Error> => {
    if (!input.username) {
      return Result.fail(new Error('Username is required'));
    }
    if (!input.email || !input.email.includes('@')) {
      return Result.fail(new Error('Valid email is required'));
    }
    if (input.profile.age < 13) {
      return Result.fail(new Error('User must be at least 13 years old'));
    }
    if (input.username.length < 3) {
      return Result.fail(new Error('Username must be at least 3 characters'));
    }
    return Result.ok(undefined);
  });
}

class UpdateUserOperation extends TypedOperation<UpdateUserInput, UpdateUserOutput> {
  readonly name = 'UPDATE_USER';
  override readonly description = 'Updates an existing user';

  override validateBusinessRules = vi.fn((input: UpdateUserInput): Result<void, Error> => {
    if (!input.userId) {
      return Result.fail(new Error('User ID is required for updates'));
    }
    if (input.updates.profile?.age !== undefined && input.updates.profile.age < 13) {
      return Result.fail(new Error('Age cannot be updated to less than 13'));
    }
    if (input.updates.email && !input.updates.email.includes('@')) {
      return Result.fail(new Error('Email update must be valid'));
    }
    return Result.ok(undefined);
  });
}

class DeleteUserOperation extends TypedOperation<DeleteUserInput, DeleteUserOutput> {
  readonly name = 'DELETE_USER';
  override readonly description = 'Deletes a user from the system';
  // No validation rules - demonstrating optional validation
}

class SimpleOperation extends TypedOperation<string, number> {
  readonly name = 'SIMPLE_OP';
  // No description or validation - minimal implementation
}

// Mock registry implementation for testing
class MockTypedOperationRegistry implements ITypedOperationRegistry {
  private operations = new Map<string, TypedOperation<any, any>>();

  register<TInput, TOutput>(operation: TypedOperation<TInput, TOutput>): void {
    this.operations.set(operation.name, operation);
  }

  get<TInput, TOutput>(operationName: string): TypedOperation<TInput, TOutput> | undefined {
    return this.operations.get(operationName) as TypedOperation<TInput, TOutput> | undefined;
  }

  // Additional methods for testing
  clear(): void {
    this.operations.clear();
  }

  getAllOperations(): TypedOperation<any, any>[] {
    return Array.from(this.operations.values());
  }

  hasOperation(name: string): boolean {
    return this.operations.has(name);
  }
}

describe('TypedOperation', () => {
  describe('abstract class behavior', () => {
    it('should require implementation of name property', () => {
      const createOp = new CreateUserOperation();
      expect(createOp.name).toBe('CREATE_USER');

      const updateOp = new UpdateUserOperation();
      expect(updateOp.name).toBe('UPDATE_USER');

      const deleteOp = new DeleteUserOperation();
      expect(deleteOp.name).toBe('DELETE_USER');
    });

    it('should allow optional description property', () => {
      const createOp = new CreateUserOperation();
      expect(createOp.description).toBe('Creates a new user in the system');

      const simpleOp = new SimpleOperation();
      expect(simpleOp.description).toBeUndefined();
    });

    it('should allow optional validateBusinessRules method', () => {
      const createOp = new CreateUserOperation();
      expect(typeof createOp.validateBusinessRules).toBe('function');

      const deleteOp = new DeleteUserOperation();
      expect(deleteOp.validateBusinessRules).toBeUndefined();
    });
  });

  describe('business rule validation', () => {
    let createOperation: CreateUserOperation;
    let updateOperation: UpdateUserOperation;

    beforeEach(() => {
      createOperation = new CreateUserOperation();
      updateOperation = new UpdateUserOperation();
    });

    describe('CreateUserOperation validation', () => {
      it('should validate valid user input successfully', () => {
        const validInput: CreateUserInput = {
          username: 'johndoe',
          email: 'john@example.com',
          profile: {
            firstName: 'John',
            lastName: 'Doe',
            age: 25,
          },
        };

        const result = createOperation.validateBusinessRules!(validInput);

        expect(result.isSuccess).toBe(true);
        expect(createOperation.validateBusinessRules).toHaveBeenCalledWith(validInput);
      });

      it('should reject input with missing username', () => {
        const invalidInput: CreateUserInput = {
          username: '',
          email: 'john@example.com',
          profile: {
            firstName: 'John',
            lastName: 'Doe',
            age: 25,
          },
        };

        const result = createOperation.validateBusinessRules!(invalidInput);

        expect(result.isFailure).toBe(true);
        expect(result.error.message).toBe('Username is required');
      });

      it('should reject input with invalid email', () => {
        const invalidInput: CreateUserInput = {
          username: 'johndoe',
          email: 'invalid-email',
          profile: {
            firstName: 'John',
            lastName: 'Doe',
            age: 25,
          },
        };

        const result = createOperation.validateBusinessRules!(invalidInput);

        expect(result.isFailure).toBe(true);
        expect(result.error.message).toBe('Valid email is required');
      });

      it('should reject input with age below minimum', () => {
        const invalidInput: CreateUserInput = {
          username: 'younguser',
          email: 'young@example.com',
          profile: {
            firstName: 'Young',
            lastName: 'User',
            age: 12,
          },
        };

        const result = createOperation.validateBusinessRules!(invalidInput);

        expect(result.isFailure).toBe(true);
        expect(result.error.message).toBe('User must be at least 13 years old');
      });

      it('should reject input with short username', () => {
        const invalidInput: CreateUserInput = {
          username: 'ab',
          email: 'user@example.com',
          profile: {
            firstName: 'A',
            lastName: 'B',
            age: 20,
          },
        };

        const result = createOperation.validateBusinessRules!(invalidInput);

        expect(result.isFailure).toBe(true);
        expect(result.error.message).toBe('Username must be at least 3 characters');
      });

      it('should validate multiple fields and return first error', () => {
        const invalidInput: CreateUserInput = {
          username: '', // Invalid
          email: 'invalid-email', // Also invalid
          profile: {
            firstName: 'Test',
            lastName: 'User',
            age: 10, // Also invalid
          },
        };

        const result = createOperation.validateBusinessRules!(invalidInput);

        expect(result.isFailure).toBe(true);
        expect(result.error.message).toBe('Username is required'); // First validation error
      });
    });

    describe('UpdateUserOperation validation', () => {
      it('should validate valid update input successfully', () => {
        const validInput: UpdateUserInput = {
          userId: 'user-123',
          updates: {
            email: 'newemail@example.com',
            profile: {
              firstName: 'John',
              lastName: 'Smith',
              age: 30,
            },
          },
        };

        const result = updateOperation.validateBusinessRules!(validInput);

        expect(result.isSuccess).toBe(true);
      });

      it('should reject input without user ID', () => {
        const invalidInput: UpdateUserInput = {
          userId: '',
          updates: {
            email: 'test@example.com',
          },
        };

        const result = updateOperation.validateBusinessRules!(invalidInput);

        expect(result.isFailure).toBe(true);
        expect(result.error.message).toBe('User ID is required for updates');
      });

      it('should reject age update below minimum', () => {
        const invalidInput: UpdateUserInput = {
          userId: 'user-123',
          updates: {
            profile: {
              firstName: 'John',
              lastName: 'Doe',
              age: 10,
            },
          },
        };

        const result = updateOperation.validateBusinessRules!(invalidInput);

        expect(result.isFailure).toBe(true);
        expect(result.error.message).toBe('Age cannot be updated to less than 13');
      });

      it('should reject invalid email update', () => {
        const invalidInput: UpdateUserInput = {
          userId: 'user-123',
          updates: {
            email: 'invalid-email',
          },
        };

        const result = updateOperation.validateBusinessRules!(invalidInput);

        expect(result.isFailure).toBe(true);
        expect(result.error.message).toBe('Email update must be valid');
      });

      it('should handle partial updates correctly', () => {
        const partialInput: UpdateUserInput = {
          userId: 'user-123',
          updates: {
            profile: {
              firstName: 'UpdatedName',
              lastName: 'UpdatedLastName',
              age: 25,
            },
          },
        };

        const result = updateOperation.validateBusinessRules!(partialInput);

        expect(result.isSuccess).toBe(true);
      });
    });

    describe('DeleteUserOperation (no validation)', () => {
      it('should not have validation method', () => {
        const deleteOperation = new DeleteUserOperation();
        expect(deleteOperation.validateBusinessRules).toBeUndefined();
      });
    });
  });

  describe('type safety and generics', () => {
    it('should maintain type safety for input and output types', () => {
      const createOp: TypedOperation<CreateUserInput, CreateUserOutput> = new CreateUserOperation();
      const updateOp: TypedOperation<UpdateUserInput, UpdateUserOutput> = new UpdateUserOperation();
      const deleteOp: TypedOperation<DeleteUserInput, DeleteUserOutput> = new DeleteUserOperation();

      // TypeScript compilation ensures type safety
      expect(createOp.name).toBe('CREATE_USER');
      expect(updateOp.name).toBe('UPDATE_USER');
      expect(deleteOp.name).toBe('DELETE_USER');
    });

    it('should work with simple types', () => {
      const simpleOp: TypedOperation<string, number> = new SimpleOperation();
      expect(simpleOp.name).toBe('SIMPLE_OP');
    });

    it('should support complex nested types', () => {
      // This test verifies that complex types can be used without issues
      const createOp = new CreateUserOperation();

      const complexInput: CreateUserInput = {
        username: 'complexuser',
        email: 'complex@example.com',
        profile: {
          firstName: 'Complex',
          lastName: 'User',
          age: 30,
        },
      };

      if (createOp.validateBusinessRules) {
        const result = createOp.validateBusinessRules(complexInput);
        expect(result.isSuccess).toBe(true);
      }
    });
  });
});

describe('ITypedOperationRegistry', () => {
  let registry: MockTypedOperationRegistry;

  beforeEach(() => {
    registry = new MockTypedOperationRegistry();
  });

  describe('register method', () => {
    it('should register a typed operation', () => {
      const createOp = new CreateUserOperation();

      registry.register(createOp);

      expect(registry.hasOperation('CREATE_USER')).toBe(true);
    });

    it('should register multiple operations', () => {
      const createOp = new CreateUserOperation();
      const updateOp = new UpdateUserOperation();
      const deleteOp = new DeleteUserOperation();

      registry.register(createOp);
      registry.register(updateOp);
      registry.register(deleteOp);

      expect(registry.hasOperation('CREATE_USER')).toBe(true);
      expect(registry.hasOperation('UPDATE_USER')).toBe(true);
      expect(registry.hasOperation('DELETE_USER')).toBe(true);
      expect(registry.getAllOperations()).toHaveLength(3);
    });

    it('should overwrite operation with same name', () => {
      const createOp1 = new CreateUserOperation();
      const createOp2 = new CreateUserOperation();

      registry.register(createOp1);
      expect(registry.get('CREATE_USER')).toBe(createOp1);

      registry.register(createOp2);
      expect(registry.get('CREATE_USER')).toBe(createOp2);
      expect(registry.getAllOperations()).toHaveLength(1); // Should not duplicate
    });
  });

  describe('get method', () => {
    beforeEach(() => {
      registry.register(new CreateUserOperation());
      registry.register(new UpdateUserOperation());
      registry.register(new DeleteUserOperation());
    });

    it('should retrieve registered operation by name', () => {
      const createOp = registry.get<CreateUserInput, CreateUserOutput>('CREATE_USER');

      expect(createOp).toBeDefined();
      expect(createOp!.name).toBe('CREATE_USER');
      expect(createOp!.description).toBe('Creates a new user in the system');
    });

    it('should return undefined for non-existent operation', () => {
      const nonExistentOp = registry.get('NON_EXISTENT');

      expect(nonExistentOp).toBeUndefined();
    });

    it('should maintain type safety when retrieving operations', () => {
      const updateOp = registry.get<UpdateUserInput, UpdateUserOutput>('UPDATE_USER');

      expect(updateOp).toBeDefined();
      expect(updateOp!.name).toBe('UPDATE_USER');

      // TypeScript should enforce correct types
      if (updateOp && updateOp.validateBusinessRules) {
        const validInput: UpdateUserInput = {
          userId: 'test-123',
          updates: { email: 'test@example.com' },
        };

        const result = updateOp.validateBusinessRules(validInput);
        expect(result.isSuccess).toBe(true);
      }
    });

    it('should handle operations without validation', () => {
      const deleteOp = registry.get<DeleteUserInput, DeleteUserOutput>('DELETE_USER');

      expect(deleteOp).toBeDefined();
      expect(deleteOp!.name).toBe('DELETE_USER');
      expect(deleteOp!.validateBusinessRules).toBeUndefined();
    });
  });

  describe('registry operations', () => {
    it('should start empty', () => {
      expect(registry.getAllOperations()).toHaveLength(0);
      expect(registry.hasOperation('ANY_OPERATION')).toBe(false);
    });

    it('should support clearing all operations', () => {
      registry.register(new CreateUserOperation());
      registry.register(new UpdateUserOperation());

      expect(registry.getAllOperations()).toHaveLength(2);

      registry.clear();

      expect(registry.getAllOperations()).toHaveLength(0);
      expect(registry.hasOperation('CREATE_USER')).toBe(false);
    });

    it('should provide operation existence check', () => {
      expect(registry.hasOperation('CREATE_USER')).toBe(false);

      registry.register(new CreateUserOperation());

      expect(registry.hasOperation('CREATE_USER')).toBe(true);
      expect(registry.hasOperation('UPDATE_USER')).toBe(false);
    });

    it('should list all registered operations', () => {
      const createOp = new CreateUserOperation();
      const updateOp = new UpdateUserOperation();
      const deleteOp = new DeleteUserOperation();

      registry.register(createOp);
      registry.register(updateOp);
      registry.register(deleteOp);

      const allOps = registry.getAllOperations();

      expect(allOps).toHaveLength(3);
      expect(allOps).toContain(createOp);
      expect(allOps).toContain(updateOp);
      expect(allOps).toContain(deleteOp);
    });
  });

  describe('integration scenarios', () => {
    it('should support operations with different input/output types', () => {
      registry.register(new CreateUserOperation()); // CreateUserInput -> CreateUserOutput
      registry.register(new SimpleOperation()); // string -> number

      const createOp = registry.get<CreateUserInput, CreateUserOutput>('CREATE_USER');
      const simpleOp = registry.get<string, number>('SIMPLE_OP');

      expect(createOp).toBeDefined();
      expect(simpleOp).toBeDefined();
      expect(createOp!.description).toBeDefined();
      expect(simpleOp!.description).toBeUndefined();
    });

    it('should handle operations with and without validation', () => {
      const validatingOp = new CreateUserOperation();
      const nonValidatingOp = new DeleteUserOperation();

      registry.register(validatingOp);
      registry.register(nonValidatingOp);

      const retrievedValidating = registry.get('CREATE_USER');
      const retrievedNonValidating = registry.get('DELETE_USER');

      expect(retrievedValidating!.validateBusinessRules).toBeDefined();
      expect(retrievedNonValidating!.validateBusinessRules).toBeUndefined();
    });

    it('should support dynamic operation registration and retrieval', () => {
      // Start with empty registry
      expect(registry.getAllOperations()).toHaveLength(0);

      // Dynamically register operations
      const operations = [
        new CreateUserOperation(),
        new UpdateUserOperation(),
        new DeleteUserOperation(),
      ];

      operations.forEach(op => registry.register(op as any));

      // Verify all operations are retrievable
      operations.forEach(op => {
        const retrieved = registry.get(op.name);
        expect(retrieved).toBe(op);
      });
    });
  });
});
