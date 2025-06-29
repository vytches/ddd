/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect } from 'vitest';

import { CompositeSpecification } from './composite-specification';
import { Specification } from './specification-operators';
import type { ISpecification } from '@vytches-ddd/contracts';
import { safeRun } from '@vytches-ddd/utils';

// Enhanced specification that includes name, description and failure explanation
class NamedSpecification<T> extends CompositeSpecification<T> {
  readonly name: string;
  readonly description: string;

  constructor(
    private readonly predicate: (candidate: T) => boolean,
    name: string,
    description: string
  ) {
    super();
    this.name = name;
    this.description = description;
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.predicate(candidate);
  }

  explainFailure(candidate: T): string | null {
    return this.isSatisfiedBy(candidate)
      ? null
      : `Failed to satisfy "${this.name}": ${this.description}`;
  }
}

// Complex specifications with explanations
class ExplainableAndSpecification<T> extends CompositeSpecification<T> {
  readonly name: string;
  readonly description: string;

  constructor(
    private readonly left: ISpecification<T>,
    private readonly right: ISpecification<T>,
    name: string,
    description: string
  ) {
    super();
    this.name = name;
    this.description = description;
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
  }

  explainFailure(candidate: T): string | null {
    if (this.isSatisfiedBy(candidate)) {
      return null;
    }

    const leftFailure = this.left.explainFailure?.(candidate);
    const rightFailure = this.right.explainFailure?.(candidate);

    if (leftFailure && rightFailure) {
      return `${this.name}: Multiple conditions failed:\n- ${leftFailure}\n- ${rightFailure}`;
    } else if (leftFailure) {
      return `${this.name}: ${leftFailure}`;
    } else if (rightFailure) {
      return `${this.name}: ${rightFailure}`;
    } else {
      return `${this.name}: Failed for unknown reason`;
    }
  }
}

describe('Named Specifications with Explanations', () => {
  // Test data
  interface User {
    id: number;
    username: string;
    email: string;
    age: number;
    roles: string[];
  }

  const validUser: User = {
    id: 1,
    username: 'john_doe',
    email: 'john@example.com',
    age: 25,
    roles: ['user'],
  };

  const invalidUser: User = {
    id: 2,
    username: 'a',
    email: 'not-an-email',
    age: 15,
    roles: [],
  };

  describe('Basic named specifications', () => {
    it('should include name and description in specification', () => {
      // Arrange
      const usernameSpec = new NamedSpecification<User>(
        user => user.username.length >= 3,
        'UsernameMinLengthSpec',
        'Username must be at least 3 characters long'
      );

      // Assert
      expect(usernameSpec.name).toBe('UsernameMinLengthSpec');
      expect(usernameSpec.description).toBe('Username must be at least 3 characters long');
    });

    it('should validate correctly', () => {
      // Arrange
      const usernameSpec = new NamedSpecification<User>(
        user => user.username.length >= 3,
        'UsernameMinLengthSpec',
        'Username must be at least 3 characters long'
      );

      // Act - Valid case
      const [, validResult] = safeRun(() => usernameSpec.isSatisfiedBy(validUser));

      // Assert - Valid case
      expect(validResult).toBe(true);

      // Act - Invalid case
      const [, invalidResult] = safeRun(() => usernameSpec.isSatisfiedBy(invalidUser));

      // Assert - Invalid case
      expect(invalidResult).toBe(false);
    });

    it('should explain failures', () => {
      // Arrange
      const usernameSpec = new NamedSpecification<User>(
        user => user.username.length >= 3,
        'UsernameMinLengthSpec',
        'Username must be at least 3 characters long'
      );

      // Act - Valid case
      const [, validExplanation] = safeRun(() => usernameSpec.explainFailure(validUser));

      // Assert - Valid case
      expect(validExplanation).toBeNull(); // No failure to explain

      // Act - Invalid case
      const [, invalidExplanation] = safeRun(() => usernameSpec.explainFailure(invalidUser));

      // Assert - Invalid case
      expect(invalidExplanation).toContain('UsernameMinLengthSpec');
      expect(invalidExplanation).toContain('Username must be at least 3 characters long');
    });
  });

  describe('Complex specifications with explanations', () => {
    const createComplexUserSpecification = (): ISpecification<User> => {
      // Username specification
      const usernameSpec = new NamedSpecification<User>(
        user => user.username.length >= 3,
        'UsernameMinLengthSpec',
        'Username must be at least 3 characters long'
      );

      // Email specification
      const emailSpec = new NamedSpecification<User>(
        user => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email),
        'EmailFormatSpec',
        'Email must be in a valid format'
      );

      // Age specification
      const ageSpec = new NamedSpecification<User>(
        user => user.age >= 18,
        'MinimumAgeSpec',
        'User must be at least 18 years old'
      );

      // Has roles specification
      const hasRolesSpec = new NamedSpecification<User>(
        user => user.roles.length > 0,
        'HasRolesSpec',
        'User must have at least one role assigned'
      );

      // Combine specifications
      const basicInfoSpec = new ExplainableAndSpecification<User>(
        usernameSpec,
        emailSpec,
        'BasicInfoSpec',
        'Basic user information must be valid'
      );

      const accessInfoSpec = new ExplainableAndSpecification<User>(
        ageSpec,
        hasRolesSpec,
        'AccessInfoSpec',
        'User access information must be valid'
      );

      // Final composite specification
      return new ExplainableAndSpecification<User>(
        basicInfoSpec,
        accessInfoSpec,
        'ValidUserSpec',
        'User must satisfy all validation requirements'
      );
    };

    it('should validate complex specifications', () => {
      // Arrange
      const userSpec = createComplexUserSpecification();

      // Act - Valid user
      const [, validResult] = safeRun(() => userSpec.isSatisfiedBy(validUser));

      // Assert - Valid user
      expect(validResult).toBe(true);

      // Act - Invalid user
      const [, invalidResult] = safeRun(() => userSpec.isSatisfiedBy(invalidUser));

      // Assert - Invalid user
      expect(invalidResult).toBe(false);
    });

    it('should provide detailed failure explanations', () => {
      // Arrange
      const userSpec = createComplexUserSpecification();

      // Act - Invalid user (with multiple validation failures)
      const [, invalidExplanation] = safeRun(() => userSpec.explainFailure?.(invalidUser) || null);

      // Assert - Invalid user
      expect(invalidExplanation).toContain('ValidUserSpec');
      expect(invalidExplanation).toContain('UsernameMinLengthSpec');
      expect(invalidExplanation).toContain('EmailFormatSpec');
      expect(invalidExplanation).toContain('MinimumAgeSpec');
      expect(invalidExplanation).toContain('HasRolesSpec');
    });
  });

  describe('Specification factory with named specifications', () => {
    // Extended factory method for creating named specifications
    const NamedSpec = {
      create<T>(
        predicate: (candidate: T) => boolean,
        name: string,
        description: string
      ): ISpecification<T> {
        return new NamedSpecification<T>(predicate, name, description);
      },

      // Build a named AND specification from multiple named specifications
      and<T>(
        specs: Array<ISpecification<T>>,
        name: string,
        description: string
      ): ISpecification<T> {
        if (specs.length === 0) {
          return Specification.alwaysTrue<T>();
        }

        let result = specs[0];
        for (let i = 1; i < specs.length; i++) {
          result = new ExplainableAndSpecification<T>(
            result!,
            specs[i]!,
            `${name}_Part${i}`,
            `Part ${i} of ${description}`
          );
        }

        return new ExplainableAndSpecification<T>(
          result!,
          Specification.alwaysTrue<T>(),
          name,
          description
        );
      },
    };

    it('should create specifications with factory method', () => {
      // Arrange
      const userSpecs = [
        NamedSpec.create<User>(
          user => user.username.length >= 3,
          'UsernameMinLengthSpec',
          'Username must be at least 3 characters long'
        ),
        NamedSpec.create<User>(
          user => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email),
          'EmailFormatSpec',
          'Email must be in a valid format'
        ),
        NamedSpec.create<User>(
          user => user.age >= 18,
          'MinimumAgeSpec',
          'User must be at least 18 years old'
        ),
      ];

      const combinedSpec = NamedSpec.and<User>(
        userSpecs,
        'UserValidationSpec',
        'User must pass all validation rules'
      );

      // Act - Valid user
      const [, validResult] = safeRun(() => combinedSpec.isSatisfiedBy(validUser));

      // Assert - Valid user
      expect(validResult).toBe(true);

      // Act - Invalid user
      const [, invalidResult] = safeRun(() => combinedSpec.isSatisfiedBy(invalidUser));

      // Assert - Invalid user
      expect(invalidResult).toBe(false);

      // Act - Explanation
      const [, explanation] = safeRun(() => combinedSpec.explainFailure?.(invalidUser) || null);

      // Assert - Explanation
      expect(explanation).not.toBeNull();
      expect(explanation).toContain('UserValidationSpec');
    });
  });
});
