# Basic Validation with Specifications Implementation

**Focus**: Basic validation using specifications and business rules for domain
validation  
**Domain**: E-commerce User Registration  
**Complexity**: Basic  
**Dependencies**: @vytches/ddd-validation, @vytches/ddd-utils

## Business Context

This example demonstrates basic validation patterns for an e-commerce user
registration system that requires:

- Specification-based validation for complex business rules
- Composite validation for combining multiple validation rules
- Domain-driven validation that reflects business requirements
- Clear separation between validation logic and business logic
- Reusable validation components across different contexts

## Implementation

```typescript
// user-specifications.ts
import {
  ISpecification,
  IAsyncSpecification,
  CompositeSpecification,
} from '@vytches/ddd-validation';
import { User, UserProfile, Address } from '../types'; // ALWAYS import from app

// Basic user validation specifications
export class EmailFormatSpecification implements ISpecification<User> {
  isSatisfiedBy(user: User): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(user.email);
  }

  getErrorMessage(): string {
    return 'Email must be in valid format';
  }
}

export class PasswordStrengthSpecification implements ISpecification<User> {
  isSatisfiedBy(user: User): boolean {
    // Password must be at least 8 characters with uppercase, lowercase, and number
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(user.password);
  }

  getErrorMessage(): string {
    return 'Password must be at least 8 characters with uppercase, lowercase, and number';
  }
}

export class AgeRequirementSpecification implements ISpecification<User> {
  constructor(private minAge: number = 18) {}

  isSatisfiedBy(user: User): boolean {
    if (!user.dateOfBirth) return false;

    const today = new Date();
    const birthDate = new Date(user.dateOfBirth);
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      return age - 1 >= this.minAge;
    }

    return age >= this.minAge;
  }

  getErrorMessage(): string {
    return `User must be at least ${this.minAge} years old`;
  }
}

export class UniqueUsernameSpecification implements IAsyncSpecification<User> {
  constructor(private userRepository: UserRepository) {}

  async isSatisfiedByAsync(user: User): Promise<boolean> {
    try {
      const existingUser = await this.userRepository.findByUsername(
        user.username
      );
      return !existingUser;
    } catch (error) {
      // If repository fails, assume username is not unique to be safe
      return false;
    }
  }

  getErrorMessage(): string {
    return 'Username must be unique';
  }
}

export class UniqueEmailSpecification implements IAsyncSpecification<User> {
  constructor(private userRepository: UserRepository) {}

  async isSatisfiedByAsync(user: User): Promise<boolean> {
    try {
      const existingUser = await this.userRepository.findByEmail(user.email);
      return !existingUser;
    } catch (error) {
      // If repository fails, assume email is not unique to be safe
      return false;
    }
  }

  getErrorMessage(): string {
    return 'Email address must be unique';
  }
}

// Address validation specifications
export class AddressValidationSpecification implements ISpecification<Address> {
  isSatisfiedBy(address: Address): boolean {
    return !!(
      address.street &&
      address.city &&
      address.postalCode &&
      address.country &&
      address.street.trim().length > 0 &&
      address.city.trim().length > 0 &&
      address.postalCode.trim().length > 0 &&
      address.country.trim().length > 0
    );
  }

  getErrorMessage(): string {
    return 'Address must include street, city, postal code, and country';
  }
}

export class PostalCodeFormatSpecification implements ISpecification<Address> {
  private postalCodePatterns: { [country: string]: RegExp } = {
    US: /^\d{5}(-\d{4})?$/,
    UK: /^[A-Z]{1,2}[0-9]{1,2}[A-Z]?\s?[0-9][A-Z]{2}$/i,
    CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
    DE: /^\d{5}$/,
    FR: /^\d{5}$/,
  };

  isSatisfiedBy(address: Address): boolean {
    const pattern = this.postalCodePatterns[address.country];
    if (!pattern) {
      // If no pattern for country, accept any non-empty postal code
      return address.postalCode.trim().length > 0;
    }

    return pattern.test(address.postalCode);
  }

  getErrorMessage(): string {
    return 'Postal code format is invalid for the specified country';
  }
}

// user-validation-service.ts
import {
  BusinessRuleValidator,
  ValidationFacade,
  CompositeSpecification,
  SpecificationOperators,
} from '@vytches/ddd-validation';
import { Result } from '@vytches/ddd-utils';

// ⭐ Basic User Validation Service
export class UserValidationService {
  private businessRuleValidator: BusinessRuleValidator;
  private validationFacade: ValidationFacade;

  constructor(private userRepository: UserRepository) {
    this.businessRuleValidator = new BusinessRuleValidator();
    this.validationFacade = new ValidationFacade();
    this.initializeValidationRules();
  }

  private initializeValidationRules(): void {
    // Register basic validation specifications
    this.businessRuleValidator.registerRule(
      'email-format',
      new EmailFormatSpecification()
    );

    this.businessRuleValidator.registerRule(
      'password-strength',
      new PasswordStrengthSpecification()
    );

    this.businessRuleValidator.registerRule(
      'age-requirement',
      new AgeRequirementSpecification(18)
    );

    this.businessRuleValidator.registerAsyncRule(
      'unique-username',
      new UniqueUsernameSpecification(this.userRepository)
    );

    this.businessRuleValidator.registerAsyncRule(
      'unique-email',
      new UniqueEmailSpecification(this.userRepository)
    );
  }

  // Validate basic user information
  async validateBasicUserInfo(
    user: User
  ): Promise<Result<void, ValidationError[]>> {
    try {
      const validationResults = [];

      // Validate email format
      const emailValidation = this.businessRuleValidator.validate(
        'email-format',
        user
      );
      if (emailValidation.isFailure()) {
        validationResults.push(...emailValidation.error);
      }

      // Validate password strength
      const passwordValidation = this.businessRuleValidator.validate(
        'password-strength',
        user
      );
      if (passwordValidation.isFailure()) {
        validationResults.push(...passwordValidation.error);
      }

      // Validate age requirement
      const ageValidation = this.businessRuleValidator.validate(
        'age-requirement',
        user
      );
      if (ageValidation.isFailure()) {
        validationResults.push(...ageValidation.error);
      }

      if (validationResults.length > 0) {
        return Result.failure(validationResults);
      }

      return Result.success(undefined);
    } catch (error) {
      return Result.failure([
        {
          field: 'general',
          message: `Validation failed: ${error.message}`,
          code: 'VALIDATION_ERROR',
        },
      ]);
    }
  }

  // Validate user uniqueness (async validation)
  async validateUserUniqueness(
    user: User
  ): Promise<Result<void, ValidationError[]>> {
    try {
      const validationResults = [];

      // Validate unique username
      const usernameValidation = await this.businessRuleValidator.validateAsync(
        'unique-username',
        user
      );
      if (usernameValidation.isFailure()) {
        validationResults.push(...usernameValidation.error);
      }

      // Validate unique email
      const emailValidation = await this.businessRuleValidator.validateAsync(
        'unique-email',
        user
      );
      if (emailValidation.isFailure()) {
        validationResults.push(...emailValidation.error);
      }

      if (validationResults.length > 0) {
        return Result.failure(validationResults);
      }

      return Result.success(undefined);
    } catch (error) {
      return Result.failure([
        {
          field: 'general',
          message: `Async validation failed: ${error.message}`,
          code: 'ASYNC_VALIDATION_ERROR',
        },
      ]);
    }
  }

  // Validate user address
  validateAddress(address: Address): Result<void, ValidationError[]> {
    try {
      const validationResults = [];

      // Basic address validation
      const addressSpec = new AddressValidationSpecification();
      if (!addressSpec.isSatisfiedBy(address)) {
        validationResults.push({
          field: 'address',
          message: addressSpec.getErrorMessage(),
          code: 'INVALID_ADDRESS',
        });
      }

      // Postal code format validation
      const postalCodeSpec = new PostalCodeFormatSpecification();
      if (!postalCodeSpec.isSatisfiedBy(address)) {
        validationResults.push({
          field: 'address.postalCode',
          message: postalCodeSpec.getErrorMessage(),
          code: 'INVALID_POSTAL_CODE',
        });
      }

      if (validationResults.length > 0) {
        return Result.failure(validationResults);
      }

      return Result.success(undefined);
    } catch (error) {
      return Result.failure([
        {
          field: 'address',
          message: `Address validation failed: ${error.message}`,
          code: 'ADDRESS_VALIDATION_ERROR',
        },
      ]);
    }
  }

  // Comprehensive user validation using composite specifications
  async validateCompleteUser(
    user: User
  ): Promise<Result<void, ValidationError[]>> {
    try {
      const allValidationResults = [];

      // Basic information validation
      const basicValidation = await this.validateBasicUserInfo(user);
      if (basicValidation.isFailure()) {
        allValidationResults.push(...basicValidation.error);
      }

      // Uniqueness validation
      const uniquenessValidation = await this.validateUserUniqueness(user);
      if (uniquenessValidation.isFailure()) {
        allValidationResults.push(...uniquenessValidation.error);
      }

      // Address validation if provided
      if (user.address) {
        const addressValidation = this.validateAddress(user.address);
        if (addressValidation.isFailure()) {
          allValidationResults.push(...addressValidation.error);
        }
      }

      if (allValidationResults.length > 0) {
        return Result.failure(allValidationResults);
      }

      return Result.success(undefined);
    } catch (error) {
      return Result.failure([
        {
          field: 'general',
          message: `Complete validation failed: ${error.message}`,
          code: 'COMPLETE_VALIDATION_ERROR',
        },
      ]);
    }
  }

  // Validate user using composite specifications
  validateUserWithCompositeSpec(user: User): Result<void, ValidationError[]> {
    try {
      // Create composite specification using AND operator
      const userValidationSpec = CompositeSpecification.and([
        new EmailFormatSpecification(),
        new PasswordStrengthSpecification(),
        new AgeRequirementSpecification(18),
      ]);

      // Apply composite specification
      if (!userValidationSpec.isSatisfiedBy(user)) {
        const errors = userValidationSpec.getValidationErrors(user);
        return Result.failure(errors);
      }

      return Result.success(undefined);
    } catch (error) {
      return Result.failure([
        {
          field: 'general',
          message: `Composite validation failed: ${error.message}`,
          code: 'COMPOSITE_VALIDATION_ERROR',
        },
      ]);
    }
  }

  // Validate user profile updates (less strict than registration)
  async validateUserProfileUpdate(
    user: User,
    updates: Partial<UserProfile>
  ): Promise<Result<void, ValidationError[]>> {
    try {
      const validationResults = [];

      // Only validate fields that are being updated
      if (updates.email && updates.email !== user.email) {
        const emailValidation = this.businessRuleValidator.validate(
          'email-format',
          { ...user, email: updates.email }
        );
        if (emailValidation.isFailure()) {
          validationResults.push(...emailValidation.error);
        }

        // Check email uniqueness
        const emailUniquenessValidation =
          await this.businessRuleValidator.validateAsync('unique-email', {
            ...user,
            email: updates.email,
          });
        if (emailUniquenessValidation.isFailure()) {
          validationResults.push(...emailUniquenessValidation.error);
        }
      }

      if (updates.dateOfBirth && updates.dateOfBirth !== user.dateOfBirth) {
        const ageValidation = this.businessRuleValidator.validate(
          'age-requirement',
          { ...user, dateOfBirth: updates.dateOfBirth }
        );
        if (ageValidation.isFailure()) {
          validationResults.push(...ageValidation.error);
        }
      }

      if (updates.address) {
        const addressValidation = this.validateAddress(updates.address);
        if (addressValidation.isFailure()) {
          validationResults.push(...addressValidation.error);
        }
      }

      if (validationResults.length > 0) {
        return Result.failure(validationResults);
      }

      return Result.success(undefined);
    } catch (error) {
      return Result.failure([
        {
          field: 'general',
          message: `Profile update validation failed: ${error.message}`,
          code: 'PROFILE_UPDATE_VALIDATION_ERROR',
        },
      ]);
    }
  }

  // Validate batch user creation
  async validateBatchUsers(
    users: User[]
  ): Promise<Result<User[], ValidationError[]>> {
    try {
      const validUsers: User[] = [];
      const allValidationErrors: ValidationError[] = [];

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const userValidation = await this.validateCompleteUser(user);

        if (userValidation.isSuccess()) {
          validUsers.push(user);
        } else {
          // Add user index to error context
          const userErrors = userValidation.error.map(error => ({
            ...error,
            field: `users[${i}].${error.field}`,
            message: `User ${i}: ${error.message}`,
          }));
          allValidationErrors.push(...userErrors);
        }
      }

      if (allValidationErrors.length > 0) {
        return Result.failure(allValidationErrors);
      }

      return Result.success(validUsers);
    } catch (error) {
      return Result.failure([
        {
          field: 'general',
          message: `Batch validation failed: ${error.message}`,
          code: 'BATCH_VALIDATION_ERROR',
        },
      ]);
    }
  }

  // Get validation rules summary
  getValidationRulesSummary(): {
    syncRules: string[];
    asyncRules: string[];
    specifications: string[];
  } {
    return {
      syncRules: ['email-format', 'password-strength', 'age-requirement'],
      asyncRules: ['unique-username', 'unique-email'],
      specifications: [
        'EmailFormatSpecification',
        'PasswordStrengthSpecification',
        'AgeRequirementSpecification',
        'AddressValidationSpecification',
        'PostalCodeFormatSpecification',
      ],
    };
  }
}

// validation-error.ts
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

// user-repository.ts (Mock implementation for demonstration)
export class MockUserRepository implements UserRepository {
  private users: User[] = [];

  async findByUsername(username: string): Promise<User | null> {
    return this.users.find(user => user.username === username) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find(user => user.email === email) || null;
  }

  async save(user: User): Promise<User> {
    const existingIndex = this.users.findIndex(u => u.id === user.id);
    if (existingIndex >= 0) {
      this.users[existingIndex] = user;
    } else {
      this.users.push(user);
    }
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find(user => user.id === id) || null;
  }

  getUsers(): User[] {
    return [...this.users];
  }
}

// user-registration-service.ts
export class UserRegistrationService {
  constructor(
    private userValidationService: UserValidationService,
    private userRepository: UserRepository
  ) {}

  async registerUser(
    userData: CreateUserData
  ): Promise<Result<User, ValidationError[]>> {
    try {
      // Create user object for validation
      const user: User = {
        id: this.generateId(),
        username: userData.username,
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        dateOfBirth: userData.dateOfBirth,
        address: userData.address,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate complete user
      const validationResult =
        await this.userValidationService.validateCompleteUser(user);

      if (validationResult.isFailure()) {
        return Result.failure(validationResult.error);
      }

      // Save user to repository
      const savedUser = await this.userRepository.save(user);

      return Result.success(savedUser);
    } catch (error) {
      return Result.failure([
        {
          field: 'general',
          message: `User registration failed: ${error.message}`,
          code: 'REGISTRATION_ERROR',
        },
      ]);
    }
  }

  async updateUserProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<Result<User, ValidationError[]>> {
    try {
      // Get existing user
      const existingUser = await this.userRepository.findById(userId);
      if (!existingUser) {
        return Result.failure([
          {
            field: 'userId',
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          },
        ]);
      }

      // Validate profile updates
      const validationResult =
        await this.userValidationService.validateUserProfileUpdate(
          existingUser,
          updates
        );

      if (validationResult.isFailure()) {
        return Result.failure(validationResult.error);
      }

      // Apply updates
      const updatedUser = {
        ...existingUser,
        ...updates,
        updatedAt: new Date(),
      };

      // Save updated user
      const savedUser = await this.userRepository.save(updatedUser);

      return Result.success(savedUser);
    } catch (error) {
      return Result.failure([
        {
          field: 'general',
          message: `Profile update failed: ${error.message}`,
          code: 'PROFILE_UPDATE_ERROR',
        },
      ]);
    }
  }

  private generateId(): string {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Key Features

- **Specification Pattern**: Clean, reusable validation rules using
  specifications
- **Async Validation**: Support for database-dependent validation like
  uniqueness checks
- **Composite Validation**: Combine multiple specifications using AND/OR
  operators
- **Business Rules**: Domain-specific validation logic separated from framework
  concerns
- **Comprehensive Error Handling**: Detailed validation errors with
  field-specific messages
- **Batch Validation**: Efficient validation of multiple entities

## Usage Example

```typescript
// Usage in application
export class UserController {
  constructor(
    private userRegistrationService: UserRegistrationService,
    private userValidationService: UserValidationService
  ) {}

  async registerUser(
    userData: CreateUserData
  ): Promise<Result<User, ValidationError[]>> {
    try {
      // Register user with full validation
      const result = await this.userRegistrationService.registerUser(userData);

      if (result.isFailure()) {
        console.log('Validation errors:', result.error);
        return Result.failure(result.error);
      }

      console.log('User registered successfully:', result.value);
      return Result.success(result.value);
    } catch (error) {
      return Result.failure([
        {
          field: 'general',
          message: `Registration failed: ${error.message}`,
          code: 'REGISTRATION_ERROR',
        },
      ]);
    }
  }

  async updateProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<Result<User, ValidationError[]>> {
    try {
      const result = await this.userRegistrationService.updateUserProfile(
        userId,
        updates
      );

      if (result.isFailure()) {
        console.log('Profile update validation errors:', result.error);
        return Result.failure(result.error);
      }

      return Result.success(result.value);
    } catch (error) {
      return Result.failure([
        {
          field: 'general',
          message: `Profile update failed: ${error.message}`,
          code: 'PROFILE_UPDATE_ERROR',
        },
      ]);
    }
  }

  async validateUserData(userData: User): Promise<{
    isValid: boolean;
    errors: ValidationError[];
  }> {
    const result =
      await this.userValidationService.validateCompleteUser(userData);

    return {
      isValid: result.isSuccess(),
      errors: result.isFailure() ? result.error : [],
    };
  }

  getValidationRules(): any {
    return this.userValidationService.getValidationRulesSummary();
  }
}
```

## Common Pitfalls

- **Async Validation**: Remember to await async validation methods
- **Composite Specifications**: Be careful with operator precedence in complex
  compositions
- **Error Context**: Include sufficient context in validation errors for
  debugging
- **Performance**: Consider caching for expensive validation operations
- **Validation Order**: Validate cheap operations before expensive ones
- **Repository Dependencies**: Mock repositories properly in tests to avoid
  database calls
