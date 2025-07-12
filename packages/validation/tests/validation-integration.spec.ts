import { describe, it, expect, beforeAll } from 'vitest';

import type { ISpecification } from '@vytches-ddd/contracts';
import { CoreRules, RulesRegistry } from '../src/rules-registry';
import { BusinessRuleValidator } from '../src/business-rules';

// Create a test specification
class TestSpecification<T> implements ISpecification<T> {
  constructor(private readonly predicate: (candidate: T) => boolean) {}

  isSatisfiedBy(candidate: T): boolean {
    return this.predicate(candidate);
  }

  and(other: ISpecification<T>): ISpecification<T> {
    return new TestSpecification<T>(
      candidate => this.isSatisfiedBy(candidate) && other.isSatisfiedBy(candidate)
    );
  }

  or(other: ISpecification<T>): ISpecification<T> {
    return new TestSpecification<T>(
      candidate => this.isSatisfiedBy(candidate) || other.isSatisfiedBy(candidate)
    );
  }

  not(): ISpecification<T> {
    return new TestSpecification<T>(candidate => !this.isSatisfiedBy(candidate));
  }
}

describe('Validation Integration Tests', () => {
  // Setup example domain models for integration tests
  interface User {
    id: string;
    name: string;
    email: string;
    age: number;
    premium?: boolean;
    address?: Address;
  }

  interface Address {
    street: string;
    city: string;
    zip: string;
    country: string;
  }

  interface Order {
    id: string;
    userId: string;
    items: OrderItem[];
    totalAmount: number;
    status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
    createdAt: Date;
  }

  interface OrderItem {
    productId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }

  // Test data
  const validUser: User = {
    id: '123',
    name: 'John Doe',
    email: 'john@example.com',
    age: 25,
    address: {
      street: '123 Main St',
      city: 'New York',
      zip: '12345',
      country: 'US',
    },
  };

  const invalidUser: User = {
    id: '456',
    name: 'J', // Too short
    email: 'invalid-email',
    age: 16, // Too young
    premium: true, // Premium requires longer name
    address: {
      street: '',
      city: 'Chicago',
      zip: 'invalid',
      country: 'US',
    },
  };

  // Register core rules for testing
  beforeAll(() => {
    if (!RulesRegistry.Rules) {
      RulesRegistry.register(new CoreRules());
    }
  });

  describe('Complex User Validation', () => {
    it('should validate user with nested address and conditional rules', () => {
      // Arrange
      // 1. Create specifications
      const isAdult = new TestSpecification<User>(user => user.age >= 18);
      const isPremium = new TestSpecification<User>(user => user.premium === true);

      // 2. Create address validator
      const addressValidator = BusinessRuleValidator.create<Address>()
        .addRule('street', addr => addr.street.length > 0, 'Street is required')
        .addRule('city', addr => addr.city.length > 0, 'City is required')
        .addRule('zip', addr => /^\d{5}(-\d{4})?$/.test(addr.zip), 'Invalid ZIP code format')
        .addRule('country', addr => addr.country.length > 0, 'Country is required');

      // 3. Create complex user validator
      const userValidator = BusinessRuleValidator.create<User>()
        // Basic rules
        .apply(RulesRegistry.Rules.required('name', 'Name is required'))
        .apply(RulesRegistry.Rules.minLength('name', 2, 'Name must have at least 2 characters'))
        .apply(RulesRegistry.Rules.email('email', 'Invalid email format'))
        .mustSatisfy(isAdult, 'User must be 18 or older')

        // Conditional validation for premium users
        .whenSatisfies(isPremium, validator => {
          validator.apply(
            RulesRegistry.Rules.minLength(
              'name',
              3,
              'Premium users must have at least 3 characters in name'
            )
          );
        })

        // Nested validation for address when present
        .when(
          user => user.address !== undefined,
          validator => validator.addNested('address', addressValidator, user => user.address)
        );

      // Act
      const validResult = userValidator.validate(validUser);
      const invalidResult = userValidator.validate(invalidUser);

      // Assert
      expect(validResult.isSuccess).toBe(true);
      expect(invalidResult.isFailure).toBe(true);

      // Check specific errors - should have name, age, email, and address errors
      const errors = invalidResult.error.errors;
      expect(errors.length).toBeGreaterThanOrEqual(4);

      // Find the premium name error
      const nameError = errors.find(e => e.property === 'name' && e.message.includes('Premium'));
      expect(nameError).toBeDefined();
    });
  });

  describe('Order Validation with Business Rules', () => {
    it('should validate orders with complex business rules', () => {
      // Arrange
      // Setup test data
      const validOrder: Order = {
        id: '1234',
        userId: 'user123',
        items: [{ productId: 'p1', quantity: 2, unitPrice: 10.0, totalPrice: 20.0 }],
        totalAmount: 20.0,
        status: 'pending',
        createdAt: new Date(),
      };

      const invalidOrder: Order = {
        id: '5678',
        userId: 'user456',
        items: [
          // Invalid: quantity zero
          { productId: 'p1', quantity: 0, unitPrice: 10.0, totalPrice: 0.0 },
          // Invalid: totalPrice doesn't match calculation
          { productId: 'p2', quantity: 2, unitPrice: 15.0, totalPrice: 25.0 },
        ],
        // Invalid: totalAmount doesn't match sum of items
        totalAmount: 30.0,
        status: 'pending',
        // Use an old date to trigger validation rule for pending orders
        createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      };

      // 1. Define item validator
      const orderItemValidator = BusinessRuleValidator.create<OrderItem>()
        .addRule('quantity', item => item.quantity > 0, 'Quantity must be greater than zero')
        .addRule('productId', item => item.productId.length > 0, 'Product ID is required')
        .addRule(
          'totalPrice',
          item => Math.abs(item.totalPrice - item.quantity * item.unitPrice) < 0.01,
          'Total price must equal quantity × unit price'
        );

      // 2. Define order validator with nested item validation
      const orderValidator = BusinessRuleValidator.create<Order>()
        .addRule('userId', order => order.userId.length > 0, 'User ID is required')
        .addRule('items', order => order.items.length > 0, 'Order must have at least one item')
        .addRule(
          'items',
          order => {
            // Validate each item individually
            for (const item of order.items) {
              const result = orderItemValidator.validate(item);
              if (result.isFailure) return false;
            }
            return true;
          },
          'One or more order items are invalid'
        )

        // Validate total amount matches sum of item totals
        .addRule(
          'totalAmount',
          order => {
            const calculatedTotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
            return Math.abs(calculatedTotal - order.totalAmount) < 0.01;
          },
          'Order total amount does not match sum of item totals'
        )

        // Additional validation for pending orders
        .when(
          order => order.status === 'pending',
          validator => {
            validator.addRule(
              'createdAt',
              order => {
                const now = new Date();
                const diffTime = Math.abs(now.getTime() - order.createdAt.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays <= 30;
              },
              'Pending orders cannot be older than 30 days'
            );
          }
        );

      // Act
      const validResult = orderValidator.validate(validOrder);
      const invalidResult = orderValidator.validate(invalidOrder);

      // Assert
      expect(validResult.isSuccess).toBe(true);
      expect(invalidResult.isFailure).toBe(true);

      // Should have at least errors for:
      // - item quantity,
      // - price calculation,
      // - total amount,
      // - pending order date
      expect(invalidResult.error.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Loan Application with Complex Business Rules', () => {
    // Setup domain model
    interface LoanApplication {
      applicantId: string;
      amount: number;
      term: number; // months
      income: number;
      creditScore: number;
      hasExistingLoan: boolean;
    }

    it('should validate loan applications with conditional business rules', () => {
      // Arrange
      const validLoanApp: LoanApplication = {
        applicantId: '123',
        amount: 25000,
        term: 36,
        income: 60000,
        creditScore: 720,
        hasExistingLoan: false,
      };

      const invalidLoanApp: LoanApplication = {
        applicantId: '456',
        amount: 35000, // Too high for income
        term: 72, // Too long
        income: 50000,
        creditScore: 650, // Moderate score with existing loan (not allowed)
        hasExistingLoan: true,
      };

      // Create specifications for loan rules
      const hasMinimumIncome = new TestSpecification<LoanApplication>(app => app.income >= 30000);
      const hasGoodCredit = new TestSpecification<LoanApplication>(app => app.creditScore >= 700);
      const hasModerateCredit = new TestSpecification<LoanApplication>(
        app => app.creditScore >= 600 && app.creditScore < 700
      );
      const hasReasonableAmount = new TestSpecification<LoanApplication>(
        app => app.amount <= app.income * 0.5
      );
      const hasNoExistingLoan = new TestSpecification<LoanApplication>(app => !app.hasExistingLoan);
      const hasReasonableTerm = new TestSpecification<LoanApplication>(
        app => app.term >= 6 && app.term <= 60
      );

      // Define complex validator with conditional paths
      const loanValidator = BusinessRuleValidator.create<LoanApplication>()
        // Basic requirements for all loans
        .mustSatisfy(hasMinimumIncome, 'Minimum annual income of $30,000 required')
        .mustSatisfy(hasReasonableAmount, 'Loan amount cannot exceed 50% of annual income')
        .mustSatisfy(hasReasonableTerm, 'Loan term must be between 6 and 60 months')

        // Different rules based on credit score
        .whenSatisfies(hasGoodCredit, validator => {
          // With good credit, can have larger loans and existing loans
          validator.addRule(
            'amount',
            app => app.amount <= app.income * 0.6,
            'With good credit, loan amount can be up to 60% of income'
          );
        })
        .whenSatisfies(hasModerateCredit, validator => {
          // With moderate credit, more restrictions
          validator.mustSatisfy(
            hasNoExistingLoan,
            'Applicants with moderate credit cannot have existing loans'
          );
          validator.addRule(
            'term',
            app => app.term <= 36,
            'With moderate credit, maximum term is 36 months'
          );
        });

      // Act
      const validResult = loanValidator.validate(validLoanApp);
      const invalidResult = loanValidator.validate(invalidLoanApp);

      // Assert
      expect(validResult.isSuccess).toBe(true);
      expect(invalidResult.isFailure).toBe(true);

      // Should have errors for:
      // - Term too long (over 60 months)
      // - Moderate credit with existing loan
      // - Possibly amount too high for income
      const errors = invalidResult.error.errors;

      // Check for specific errors
      const termError = errors.find(e => e.message.includes('term'));
      const existingLoanError = errors.find(e => e.message.includes('existing loans'));

      expect(termError).toBeDefined();
      expect(existingLoanError).toBeDefined();
    });
  });
});
