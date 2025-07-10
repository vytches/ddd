import { describe, it, expect, beforeEach } from 'vitest';
import { BusinessPolicy } from '../src/business-policy';
import { PolicyBuilder, GroupBuilder } from '../src/policy-builder';
import { PolicyRegistry } from '../src/policy-registry';
import { PolicyContextBuilder, PolicyRequestBuilder } from '../src/policy-context';
import type {
  PolicyRequest,
  PolicyContext,
  IAsyncSpecification,
} from '../src/business-policy-interface';
import { AndSpecification, OrSpecification, NotSpecification } from '@vytches-ddd/validation';
import type { ISpecification } from '@vytches-ddd/contracts';
import type { PolicyViolationSeverity } from '../src/policy-violation';

/**
 * Comprehensive E2E tests showcasing the complete V2 Policy System
 * Demonstrates enterprise-grade DDD policy patterns with async-first architecture
 */
describe('Business Policy V2 - E2E Showcase', () => {
  let registry: PolicyRegistry;

  beforeEach(() => {
    registry = new PolicyRegistry();
  });

  // Domain entities for comprehensive testing
  interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    age: number;
    isActive: boolean;
    roles: string[];
    subscriptionTier: 'free' | 'premium' | 'enterprise';
    lastLoginAt?: Date;
    createdAt: Date;
  }

  interface Order {
    id: string;
    userId: string;
    items: OrderItem[];
    totalAmount: number;
    discountAmount: number;
    shippingAddress: Address;
    status: 'draft' | 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
    createdAt: Date;
    paidAt?: Date;
  }

  interface OrderItem {
    productId: string;
    quantity: number;
    unitPrice: number;
    category: 'electronics' | 'books' | 'clothing' | 'other';
  }

  interface Address {
    street: string;
    city: string;
    zipCode: string;
    country: string;
    isValidated: boolean;
  }

  describe('Foundation: PolicyContext & PolicyRequest', () => {
    it('should create rich policy contexts for enterprise features', () => {
      // Showcase PolicyContext builders with enterprise features
      const productionContext = PolicyContextBuilder.forProduction(
        'user-123',
        'session-abc',
        'tenant-xyz'
      );

      expect(productionContext.userId).toBe('user-123');
      expect(productionContext.sessionId).toBe('session-abc');
      expect(productionContext.tenantId).toBe('tenant-xyz');
      expect(productionContext.environment).toBe('production');

      // Enhanced context with features and metadata
      const enhancedContext = PolicyContextBuilder.create()
        .withUserId('user-456')
        .withEnvironment('staging')
        .withFeature('newCheckoutFlow', true)
        .withFeature('enhancedValidation', false)
        .withMetadataEntry('source', 'mobile-app')
        .withMetadataEntry('version', '2.1.0')
        .build();

      expect(enhancedContext.features).toEqual({
        newCheckoutFlow: true,
        enhancedValidation: false,
      });
      expect(enhancedContext.metadata).toEqual({
        source: 'mobile-app',
        version: '2.1.0',
      });
    });

    it('should create type-safe policy requests', () => {
      const user: User = {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        age: 25,
        isActive: true,
        roles: ['user'],
        subscriptionTier: 'premium',
        createdAt: new Date(),
      };

      const request = PolicyRequestBuilder.production(
        user,
        'user-123',
        'session-abc',
        'tenant-xyz'
      );

      expect(request.entity).toBe(user);
      expect(request.context.userId).toBe('user-123');
      expect(request.context.environment).toBe('production');
    });
  });

  describe('Core Policies: BusinessPolicy & AsyncBusinessPolicy', () => {
    it('should create policies from specifications with rich violations', async () => {
      // Create age verification policy with specification
      const ageSpec = {
        isSatisfiedBy: (user: User) => user.age >= 18,
        and: (other: any) => new AndSpecification(ageSpec, other),
        or: (other: any) => new OrSpecification(ageSpec, other),
        not: () => new NotSpecification(ageSpec),
      } as ISpecification<any>;

      const agePolicy = BusinessPolicy.fromSpecification(
        'adult-verification',
        'user-management',
        ageSpec,
        'UNDERAGE_USER',
        'User must be at least 18 years old',
        {
          version: '2.0.0',
          severity: 'ERROR' as PolicyViolationSeverity,
          field: 'age',
          detailsProvider: (user: User, context: PolicyContext) => ({
            providedAge: user.age,
            minimumAge: 18,
            tenantId: context.tenantId,
            timestamp: new Date().toISOString(),
          }),
        }
      );

      // Test with minor user
      const minorUser: User = {
        id: 'user-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        age: 16,
        isActive: true,
        roles: ['user'],
        subscriptionTier: 'free',
        createdAt: new Date(),
      };

      const context = PolicyContextBuilder.forTenantUser('tenant-123', 'admin-456');
      const request = PolicyRequestBuilder.create<User>()
        .withEntity(minorUser)
        .withContext(context)
        .build();

      expect(agePolicy.id).toBe('adult-verification');
      expect(agePolicy.domain).toBe('user-management');
      expect(agePolicy.version).toBe('2.0.0');

      // Test policy evaluation
      const result = await agePolicy.check(request);
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.code).toBe('UNDERAGE_USER');
        expect(result.error.severity).toBe('ERROR');
        expect(result.error.field).toBe('age');
        expect(result.error.details).toEqual({
          providedAge: 16,
          minimumAge: 18,
          tenantId: 'tenant-123',
          timestamp: expect.any(String),
        });
      }
    });

    it('should handle async policies for external service integration', async () => {
      // Mock external email validation service
      const emailValidationService = {
        async validateEmail(email: string): Promise<boolean> {
          // Simulate async validation (e.g., calling external API)
          await new Promise(resolve => setTimeout(resolve, 10));
          return email.includes('@') && !email.includes('invalid');
        },
      };

      // Create async specification
      const asyncEmailSpec: IAsyncSpecification<User> = {
        async isSatisfiedByAsync(user: User, _context: PolicyContext): Promise<boolean> {
          return await emailValidationService.validateEmail(user.email);
        },
      };

      const asyncEmailPolicy = BusinessPolicy.fromAsyncSpecification(
        'email-validation',
        'user-management',
        asyncEmailSpec,
        'INVALID_EMAIL_EXTERNAL',
        'Email validation failed via external service',
        {
          severity: 'WARNING' as PolicyViolationSeverity,
          field: 'email',
        }
      );

      // Test with invalid email
      const userWithInvalidEmail: User = {
        id: 'user-3',
        firstName: 'Bob',
        lastName: 'Wilson',
        email: 'invalid@example.com',
        age: 30,
        isActive: true,
        roles: ['user'],
        subscriptionTier: 'free',
        createdAt: new Date(),
      };

      const request = PolicyRequestBuilder.simple(userWithInvalidEmail, 'admin-123');

      const result = await asyncEmailPolicy.check(request);
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.code).toBe('INVALID_EMAIL_EXTERNAL');
        expect(result.error.severity).toBe('WARNING');
      }
    });
  });

  describe('Advanced Compositions: CompositePolicy & Logic', () => {
    it('should combine multiple policies with AND/OR logic', async () => {
      // Create individual policies
      const agePolicy = BusinessPolicy.fromPredicate(
        'age-check',
        'user',
        (user: User) => user.age >= 18,
        'UNDERAGE',
        'Must be 18 or older'
      );

      const activePolicy = BusinessPolicy.fromPredicate(
        'active-check',
        'user',
        (user: User) => user.isActive,
        'INACTIVE_USER',
        'User must be active'
      );

      const emailPolicy = BusinessPolicy.fromPredicate(
        'email-check',
        'user',
        (user: User) => user.email.includes('@'),
        'INVALID_EMAIL',
        'Email must be valid'
      );

      // Test AND composition - all must pass
      const strictComposer = agePolicy.and(activePolicy).and(emailPolicy);
      const strictPolicy = strictComposer.build();

      // Test OR composition - any can pass
      const lenientComposer = agePolicy.or(activePolicy);
      const lenientPolicy = lenientComposer.build();

      const validUser: User = {
        id: 'user-4',
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@example.com',
        age: 25,
        isActive: true,
        roles: ['user'],
        subscriptionTier: 'premium',
        createdAt: new Date(),
      };

      const problematicUser: User = {
        id: 'user-5',
        firstName: 'Charlie',
        lastName: 'Brown',
        email: 'invalid-email',
        age: 16,
        isActive: false,
        roles: ['user'],
        subscriptionTier: 'free',
        createdAt: new Date(),
      };

      const context = PolicyContextBuilder.forUser('admin-123');

      const validRequest = PolicyRequestBuilder.create<User>()
        .withEntity(validUser)
        .withContext(context)
        .build();

      const problematicRequest = PolicyRequestBuilder.create<User>()
        .withEntity(problematicUser)
        .withContext(context)
        .build();

      // AND policy - should pass for valid user, fail for problematic
      const strictValidResult = await strictPolicy.check(validRequest);
      const strictProblematicResult = await strictPolicy.check(problematicRequest);

      expect(strictValidResult.isSuccess).toBe(true);
      expect(strictProblematicResult.isFailure).toBe(true);

      // OR policy - should pass for valid user, fail for problematic (all policies fail)
      const lenientValidResult = await lenientPolicy.check(validRequest);
      const lenientProblematicResult = await lenientPolicy.check(problematicRequest);

      expect(lenientValidResult.isSuccess).toBe(true);
      expect(lenientProblematicResult.isFailure).toBe(true);
    });

    it('should handle NOT logic and complex combinations', async () => {
      const premiumPolicy = BusinessPolicy.fromPredicate(
        'premium-check',
        'user',
        (user: User) => user.subscriptionTier === 'premium',
        'NOT_PREMIUM',
        'User must have premium subscription'
      );

      // NOT premium = free or enterprise users only
      const notPremiumPolicy = premiumPolicy.not();

      const freeUser: User = {
        id: 'user-6',
        firstName: 'David',
        lastName: 'Miller',
        email: 'david@example.com',
        age: 22,
        isActive: true,
        roles: ['user'],
        subscriptionTier: 'free',
        createdAt: new Date(),
      };

      const premiumUser: User = {
        id: 'user-7',
        firstName: 'Emma',
        lastName: 'Davis',
        email: 'emma@example.com',
        age: 28,
        isActive: true,
        roles: ['user'],
        subscriptionTier: 'premium',
        createdAt: new Date(),
      };

      const context = PolicyContextBuilder.forUser('admin-123');

      const freeRequest = PolicyRequestBuilder.create<User>()
        .withEntity(freeUser)
        .withContext(context)
        .build();

      const premiumRequest = PolicyRequestBuilder.create<User>()
        .withEntity(premiumUser)
        .withContext(context)
        .build();

      // Premium policy should pass for premium user, fail for free user
      expect((await premiumPolicy.check(premiumRequest)).isSuccess).toBe(true);
      expect((await premiumPolicy.check(freeRequest)).isFailure).toBe(true);

      // NOT premium policy should fail for premium user, pass for free user
      expect((await notPremiumPolicy.check(premiumRequest)).isFailure).toBe(true);
      expect((await notPremiumPolicy.check(freeRequest)).isSuccess).toBe(true);
    });
  });

  describe('Fluent API: PolicyBuilder Pattern', () => {
    it('should build complex policies with fluent syntax', async () => {
      const ageSpec = {
        isSatisfiedBy: (user: User) => user.age >= 18,
        and: (other: any) => new AndSpecification(ageSpec, other),
        or: (other: any) => new OrSpecification(ageSpec, other),
        not: () => new NotSpecification(ageSpec),
      } as ISpecification<any>;

      const emailSpec = {
        isSatisfiedBy: (user: User) => user.email.includes('@') && user.email.includes('.'),
        and: (other: any) => new AndSpecification(emailSpec, other),
        or: (other: any) => new OrSpecification(emailSpec, other),
        not: () => new NotSpecification(emailSpec),
      } as ISpecification<any>;

      const userValidationPolicy = PolicyBuilder.create<User>()
        .withId('comprehensive-user-validation')
        .withDomain('user-management')
        .withVersion('3.0.0')
        .must(ageSpec)
        .withCode('AGE_REQUIREMENT')
        .withMessage('User must be at least 18 years old')
        .withSeverity('ERROR' as PolicyViolationSeverity)
        .withField('age')
        .and()
        .must(emailSpec)
        .withCode('EMAIL_FORMAT')
        .withMessage('Email must be in valid format')
        .withSeverity('ERROR' as PolicyViolationSeverity)
        .withField('email')
        .and()
        .mustSatisfy(
          (user: User) => user.firstName.trim().length > 0 && user.lastName.trim().length > 0,
          'NAME_REQUIRED',
          'First and last name are required'
        )
        .build();

      const invalidUser: User = {
        id: 'user-8',
        firstName: '',
        lastName: 'Empty',
        email: 'invalid-email',
        age: 16,
        isActive: true,
        roles: ['user'],
        subscriptionTier: 'free',
        createdAt: new Date(),
      };

      const context = PolicyContextBuilder.forUser('admin-123');
      const request = PolicyRequestBuilder.create<User>()
        .withEntity(invalidUser)
        .withContext(context)
        .build();

      const result = await userValidationPolicy.check(request);
      expect(result.isFailure).toBe(true);

      expect(userValidationPolicy.id).toBe('comprehensive-user-validation');
      expect(userValidationPolicy.domain).toBe('user-management');
      expect(userValidationPolicy.version).toBe('3.0.0');
    });

    it('should support group builders for complex logic', async () => {
      // Business scenario: Premium features require either premium subscription OR admin role
      const premiumSpec = {
        isSatisfiedBy: (user: User) => user.subscriptionTier === 'premium',
        and: (other: any) => new AndSpecification(premiumSpec, other),
        or: (other: any) => new OrSpecification(premiumSpec, other),
        not: () => new NotSpecification(premiumSpec),
      } as ISpecification<any>;

      const adminSpec = {
        isSatisfiedBy: (user: User) => user.roles.includes('admin'),
        and: (other: any) => new AndSpecification(adminSpec, other),
        or: (other: any) => new OrSpecification(adminSpec, other),
        not: () => new NotSpecification(adminSpec),
      } as ISpecification<any>;

      const premiumPolicy = BusinessPolicy.fromSpecification(
        'premium-subscription',
        'user',
        premiumSpec,
        'PREMIUM_SUBSCRIPTION',
        'User must have premium subscription'
      );

      const adminPolicy = BusinessPolicy.fromSpecification(
        'admin-role',
        'user',
        adminSpec,
        'ADMIN_ROLE',
        'User must have admin role'
      );

      const premiumGroup = GroupBuilder.create<User>('premium-access').mustSatisfy(premiumPolicy);

      const adminGroup = GroupBuilder.create<User>('admin-access').mustSatisfy(adminPolicy);

      const accessPolicy = PolicyBuilder.create<User>()
        .withId('premium-feature-access')
        .withDomain('access-control')
        .shouldSatisfyAny(premiumGroup, adminGroup)
        .build();

      // Test scenarios
      const freeUser: User = {
        id: 'user-9',
        firstName: 'Regular',
        lastName: 'User',
        email: 'regular@example.com',
        age: 25,
        isActive: true,
        roles: ['user'],
        subscriptionTier: 'free',
        createdAt: new Date(),
      };

      const premiumUser: User = {
        ...freeUser,
        id: 'user-10',
        subscriptionTier: 'premium',
      };

      const adminUser: User = {
        ...freeUser,
        id: 'user-11',
        roles: ['user', 'admin'],
      };

      const context = PolicyContextBuilder.forUser('system');

      // Free user should fail
      const freeResult = await accessPolicy.check(
        PolicyRequestBuilder.create<User>().withEntity(freeUser).withContext(context).build()
      );
      expect(freeResult.isFailure).toBe(true);

      // Premium user should pass
      const premiumResult = await accessPolicy.check(
        PolicyRequestBuilder.create<User>().withEntity(premiumUser).withContext(context).build()
      );
      expect(premiumResult.isSuccess).toBe(true);

      // Admin user should pass
      const adminResult = await accessPolicy.check(
        PolicyRequestBuilder.create<User>().withEntity(adminUser).withContext(context).build()
      );
      expect(adminResult.isSuccess).toBe(true);
    });
  });

  describe('Advanced Features: Conditional Logic', () => {
    it('should handle conditional policy logic with when().then().otherwise()', async () => {
      // Business rule: Enterprise users get enhanced validation, others get basic
      const basePolicy = BusinessPolicy.fromPredicate(
        'base-validation',
        'user',
        (user: User) => user.isActive,
        'INACTIVE_USER',
        'User must be active'
      );

      const enhancedValidation = BusinessPolicy.fromPredicate(
        'enhanced-validation',
        'user',
        (user: User) => user.age >= 21 && user.email.endsWith('.com'),
        'ENHANCED_VALIDATION_FAILED',
        'Enhanced validation failed for enterprise user'
      );

      const basicValidation = BusinessPolicy.fromPredicate(
        'basic-validation',
        'user',
        (user: User) => user.age >= 18,
        'BASIC_VALIDATION_FAILED',
        'Basic validation failed'
      );

      const conditionalPolicy = basePolicy
        .when((request: PolicyRequest<User>) => request.entity.subscriptionTier === 'enterprise')
        .then(enhancedValidation)
        .otherwise(basicValidation)
        .build();

      // Test enterprise user
      const enterpriseUser: User = {
        id: 'user-12',
        firstName: 'Enterprise',
        lastName: 'User',
        email: 'enterprise@business.com',
        age: 30,
        isActive: true,
        roles: ['user'],
        subscriptionTier: 'enterprise',
        createdAt: new Date(),
      };

      // Test regular user
      const regularUser: User = {
        id: 'user-13',
        firstName: 'Regular',
        lastName: 'User',
        email: 'regular@business.org',
        age: 19,
        isActive: true,
        roles: ['user'],
        subscriptionTier: 'free',
        createdAt: new Date(),
      };

      const context = PolicyContextBuilder.forUser('system');

      // Enterprise user should pass enhanced validation
      const enterpriseResult = await conditionalPolicy.check(
        PolicyRequestBuilder.create<User>().withEntity(enterpriseUser).withContext(context).build()
      );
      expect(enterpriseResult.isSuccess).toBe(true);

      // Regular user should pass basic validation
      const regularResult = await conditionalPolicy.check(
        PolicyRequestBuilder.create<User>().withEntity(regularUser).withContext(context).build()
      );
      expect(regularResult.isSuccess).toBe(true);
    });
  });

  describe('Enterprise Features: Registry & Management', () => {
    it('should manage policies in registry with metadata and search', () => {
      const userPolicy = BusinessPolicy.fromPredicate(
        'user-validation',
        'user-management',
        (user: User) => user.isActive && user.age >= 18,
        'USER_VALIDATION_FAILED',
        'User validation failed'
      );

      const adminPolicy = BusinessPolicy.fromPredicate(
        'admin-validation',
        'admin-management',
        (user: User) => user.roles.includes('admin'),
        'ADMIN_VALIDATION_FAILED',
        'Admin validation failed'
      );

      // Register policies with metadata
      registry.register('user-management', 'user-validation', userPolicy, {
        description: 'Standard user validation policy',
        tags: ['user', 'validation', 'age'],
        registeredBy: 'system',
      });

      registry.register('admin-management', 'admin-validation', adminPolicy, {
        description: 'Admin role validation policy',
        tags: ['admin', 'validation', 'role'],
        registeredBy: 'admin-system',
      });

      // Test registry functionality
      expect(registry.hasDomain('user-management')).toBe(true);
      expect(registry.hasPolicy('user-management', 'user-validation')).toBe(true);
      expect(registry.getDomains()).toContain('user-management');
      expect(registry.getDomains()).toContain('admin-management');

      // Search policies
      const userPolicies = registry.search({
        domain: 'user-management',
      });
      expect(userPolicies).toHaveLength(1);
      expect(userPolicies[0]?.policy.id).toBe('user-validation');

      const validationPolicies = registry.search({
        tags: ['validation'],
      });
      expect(validationPolicies).toHaveLength(2);

      // Get registry statistics
      const stats = registry.getStats();
      expect(stats.totalDomains).toBe(2);
      expect(stats.totalPolicies).toBe(2);
      expect(stats.deprecatedPolicies).toBe(0);
    });

    it('should handle policy deprecation and replacement', () => {
      const oldPolicy = BusinessPolicy.fromPredicate(
        'old-validation',
        'user',
        (user: User) => user.age >= 16,
        'OLD_VALIDATION',
        'Old validation'
      );

      const newPolicy = BusinessPolicy.fromPredicate(
        'new-validation',
        'user',
        (user: User) => user.age >= 18,
        'NEW_VALIDATION',
        'New validation'
      );

      // Register old policy
      registry.register('user', 'validation', oldPolicy, {
        description: 'Old validation policy',
      });

      // Register new policy as replacement
      registry.register('user', 'new-validation', newPolicy, {
        description: 'New validation policy',
      });

      // Mark old policy as deprecated
      registry.register('user', 'validation', oldPolicy, {
        description: 'Old validation policy',
        deprecated: true,
        replacedBy: 'new-validation',
      });

      // Resolving deprecated policy should return replacement
      const resolvedPolicy = registry.resolve('user', 'validation');
      expect(resolvedPolicy?.id).toBe('new-validation');

      // Search without deprecated should not include old policy
      const activePolicies = registry.search({
        domain: 'user',
        includeDeprecated: false,
      });
      expect(activePolicies).toHaveLength(1);
      expect(activePolicies[0]?.policy.id).toBe('new-validation');
    });
  });

  describe('Real-World Scenario: Order Processing System', () => {
    it('should validate complex order processing with all features', async () => {
      // Create comprehensive order validation using all features

      // 1. Basic order validation
      const itemsSpec = {
        isSatisfiedBy: (order: Order) => order.items.length > 0,
        and: (other: any) => new AndSpecification(itemsSpec, other),
        or: (other: any) => new OrSpecification(itemsSpec, other),
        not: () => new NotSpecification(itemsSpec),
      } as ISpecification<any>;

      const totalSpec = {
        isSatisfiedBy: (order: Order) => order.totalAmount > 0,
        and: (other: any) => new AndSpecification(totalSpec, other),
        or: (other: any) => new OrSpecification(totalSpec, other),
        not: () => new NotSpecification(totalSpec),
      } as ISpecification<any>;

      const basicOrderValidation = PolicyBuilder.create<Order>()
        .withId('basic-order-validation')
        .withDomain('order-processing')
        .must(itemsSpec)
        .withCode('EMPTY_ORDER')
        .withMessage('Order must contain at least one item')
        .withSeverity('ERROR' as PolicyViolationSeverity)
        .and()
        .must(totalSpec)
        .withCode('INVALID_TOTAL')
        .withMessage('Order total must be positive')
        .withSeverity('ERROR' as PolicyViolationSeverity)
        .build();

      // 2. Address validation group
      const addressSpec = {
        isSatisfiedBy: (order: Order) => {
          const addr = order.shippingAddress;
          return !!(addr.street && addr.city && addr.zipCode && addr.country);
        },
        and: (other: any) => new AndSpecification(addressSpec, other),
        or: (other: any) => new OrSpecification(addressSpec, other),
        not: () => new NotSpecification(addressSpec),
      } as ISpecification<any>;

      const addressPolicy = BusinessPolicy.fromSpecification(
        'address-validation',
        'order',
        addressSpec,
        'INCOMPLETE_ADDRESS',
        'Shipping address must be complete'
      );

      const addressValidation =
        GroupBuilder.create<Order>('address-validation').mustSatisfy(addressPolicy);

      // 3. Premium order features
      const premiumOrderSpec = {
        isSatisfiedBy: (order: Order) => order.totalAmount >= 100,
        and: (other: any) => new AndSpecification(premiumOrderSpec, other),
        or: (other: any) => new OrSpecification(premiumOrderSpec, other),
        not: () => new NotSpecification(premiumOrderSpec),
      } as ISpecification<any>;

      const premiumPolicy = BusinessPolicy.fromSpecification(
        'premium-minimum',
        'order',
        premiumOrderSpec,
        'PREMIUM_MINIMUM',
        'Premium orders require minimum $100'
      );

      const premiumValidation =
        GroupBuilder.create<Order>('premium-validation').mustSatisfy(premiumPolicy);

      // 4. Express shipping validation
      const expressSpec = {
        isSatisfiedBy: (order: Order) => order.shippingAddress.isValidated,
        and: (other: any) => new AndSpecification(expressSpec, other),
        or: (other: any) => new OrSpecification(expressSpec, other),
        not: () => new NotSpecification(expressSpec),
      } as ISpecification<any>;

      const expressPolicy = BusinessPolicy.fromSpecification(
        'express-shipping',
        'order',
        expressSpec,
        'ADDRESS_NOT_VALIDATED',
        'Express shipping requires validated address'
      );

      const expressShipping =
        GroupBuilder.create<Order>('express-shipping').mustSatisfy(expressPolicy);

      // 5. Comprehensive policy with conditional logic
      const comprehensiveOrderPolicy = PolicyBuilder.create<Order>()
        .withId('comprehensive-order-policy')
        .withDomain('order-processing')
        .withVersion('2.1.0')
        .mustSatisfyPolicy(basicOrderValidation)
        .and()
        .mustSatisfyPolicy(addressValidation.build())
        .when((request: PolicyRequest<Order>) => {
          return request.context.features?.expressShipping === true;
        })
        .then(b => b.mustSatisfyPolicy(expressShipping.build()))
        .otherwise(b => b.mustSatisfyPolicy(premiumValidation.build()))
        .build();

      // Register the policy
      registry.register('order-processing', 'comprehensive-validation', comprehensiveOrderPolicy, {
        description: 'Comprehensive order validation with conditional features',
        tags: ['order', 'validation', 'conditional'],
        registeredBy: 'order-system',
      });

      // Test scenarios
      const validOrder: Order = {
        id: 'order-1',
        userId: 'user-1',
        items: [
          { productId: 'prod-1', quantity: 2, unitPrice: 25.99, category: 'electronics' },
          { productId: 'prod-2', quantity: 1, unitPrice: 49.99, category: 'books' },
        ],
        totalAmount: 101.97,
        discountAmount: 0,
        shippingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          zipCode: '12345',
          country: 'USA',
          isValidated: true,
        },
        status: 'pending',
        createdAt: new Date(),
      };

      const invalidOrder: Order = {
        id: 'order-2',
        userId: 'user-2',
        items: [],
        totalAmount: 0,
        discountAmount: 0,
        shippingAddress: {
          street: '',
          city: 'Anytown',
          zipCode: '12345',
          country: 'USA',
          isValidated: false,
        },
        status: 'draft',
        createdAt: new Date(),
      };

      // Test with express shipping feature enabled
      const expressContext = PolicyContextBuilder.create()
        .withUserId('system')
        .withEnvironment('production')
        .withFeature('expressShipping', true)
        .build();

      const standardContext = PolicyContextBuilder.create()
        .withUserId('system')
        .withEnvironment('production')
        .withFeature('expressShipping', false)
        .build();

      // Valid order with express shipping should pass
      const validExpressResult = await comprehensiveOrderPolicy.check(
        PolicyRequestBuilder.create<Order>()
          .withEntity(validOrder)
          .withContext(expressContext)
          .build()
      );
      expect(validExpressResult.isSuccess).toBe(true);

      // Invalid order should fail with multiple violations
      const invalidResult = await comprehensiveOrderPolicy.check(
        PolicyRequestBuilder.create<Order>()
          .withEntity(invalidOrder)
          .withContext(standardContext)
          .build()
      );
      expect(invalidResult.isFailure).toBe(true);

      // Verify we can retrieve the policy from registry
      const retrievedPolicy = registry.resolve<Order>(
        'order-processing',
        'comprehensive-validation'
      );
      expect(retrievedPolicy?.id).toBe('comprehensive-order-policy');
      expect(retrievedPolicy?.version).toBe('2.1.0');
    });
  });

  describe('Performance & Error Handling', () => {
    it('should handle policy evaluation errors gracefully', async () => {
      // Create a policy that throws an error during evaluation
      const faultyPolicy = BusinessPolicy.fromPredicate(
        'faulty-policy',
        'test',
        (_user: User) => {
          throw new Error('Simulated evaluation error');
        },
        'EVALUATION_ERROR',
        'Policy evaluation failed'
      );

      const user: User = {
        id: 'user-test',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        age: 25,
        isActive: true,
        roles: ['user'],
        subscriptionTier: 'free',
        createdAt: new Date(),
      };

      const context = PolicyContextBuilder.forUser('system');
      const request = PolicyRequestBuilder.create<User>()
        .withEntity(user)
        .withContext(context)
        .build();

      const result = await faultyPolicy.check(request);
      expect(result.isFailure).toBe(true);

      if (result.isFailure) {
        expect(result.error.code).toBe('EVALUATION_ERROR_EVALUATION_ERROR');
        expect(result.error.message).toContain('Policy evaluation failed');
        expect(result.error.details?.originalError).toBeInstanceOf(Error);
      }
    });

    it('should demonstrate performance optimizations with early exit', async () => {
      let evaluationCount = 0;

      const policy1 = BusinessPolicy.fromPredicate(
        'policy-1',
        'test',
        (_user: User) => {
          evaluationCount++;
          return false; // Always fails
        },
        'POLICY_1_FAILED',
        'Policy 1 failed'
      );

      const policy2 = BusinessPolicy.fromPredicate(
        'policy-2',
        'test',
        (_user: User) => {
          evaluationCount++;
          return true; // Always passes
        },
        'POLICY_2_FAILED',
        'Policy 2 failed'
      );

      const policy3 = BusinessPolicy.fromPredicate(
        'policy-3',
        'test',
        (_user: User) => {
          evaluationCount++;
          return true; // Always passes
        },
        'POLICY_3_FAILED',
        'Policy 3 failed'
      );

      // AND composition should stop at first failure
      const andComposer = policy1.and(policy2).and(policy3);
      const andPolicy = andComposer.build();

      const user: User = {
        id: 'user-perf',
        firstName: 'Performance',
        lastName: 'Test',
        email: 'perf@example.com',
        age: 25,
        isActive: true,
        roles: ['user'],
        subscriptionTier: 'free',
        createdAt: new Date(),
      };

      const context = PolicyContextBuilder.forUser('system');
      const request = PolicyRequestBuilder.create<User>()
        .withEntity(user)
        .withContext(context)
        .build();

      evaluationCount = 0;
      const result = await andPolicy.check(request);

      expect(result.isFailure).toBe(true);
      // With early exit optimization, should only evaluate policy1
      expect(evaluationCount).toBe(1);
    });
  });
});
