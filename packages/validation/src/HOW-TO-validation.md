# HOW-TO: Validation & Specifications Module

## Przegląd Modułu

Moduł Validation & Specifications w DomainTS zapewnia kompletny system walidacji domenowej i specyfikacji biznesowych. Składa się z dwóch głównych komponentów:

1. **Specifications** - wzorzec do enkapsulacji reguł biznesowych i logiki domenowej
2. **Validators** - system walidacji oparty na regułach biznesowych

## Architektura Modułu

```
validations/
├── specifications/
│   ├── specification-interface.ts
│   ├── composite-specification.ts
│   ├── specification-operators.ts
│   └── specification-validator.ts
├── validators/
│   ├── validator-interface.ts
│   ├── business-rule-validator.ts
│   └── business-rule-validator-extension.ts
├── rules/
│   └── rules-registry.ts
├── errors/
│   └── validation-error.ts
├── facades/
│   └── validation-facade.ts
└── examples/
    └── validation-examples.ts
```

## 1. Core Interfaces & Types

### ISpecification Interface
```typescript
export interface ISpecification<T> {
  isSatisfiedBy(candidate: T): boolean;
  and(other: ISpecification<T>): ISpecification<T>;
  or(other: ISpecification<T>): ISpecification<T>;
  not(): ISpecification<T>;

  readonly name?: string;
  readonly description?: string;

  explainFailure?(candidate: T): string | null;
}
```

### IValidator Interface
```typescript
export interface IValidator<T> {
  validate(value: T): Result<T, ValidationErrors>;
}
```

### ValidationError Classes
```typescript
export class ValidationError {
  constructor(
    public readonly property: string,
    public readonly message: string,
    public readonly context?: Record<string, any>,
  ) {}
}

export class ValidationErrors extends Error {
  constructor(public readonly errors: ValidationError[]) {
    super(`Validation failed with ${errors.length} error(s)`);
  }
}
```

## 2. Implementacja Specyfikacji

### CompositeSpecification Base Class
```typescript
export abstract class CompositeSpecification<T> implements ISpecification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: ISpecification<T>): ISpecification<T> {
    return new AndSpecification<T>(this, other);
  }

  or(other: ISpecification<T>): ISpecification<T> {
    return new OrSpecification<T>(this, other);
  }

  not(): ISpecification<T> {
    return new NotSpecification<T>(this);
  }
}
```

### Composite Operators
```typescript
export class AndSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly left: ISpecification<T>,
    private readonly right: ISpecification<T>,
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
  }
}

export class OrSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly left: ISpecification<T>,
    private readonly right: ISpecification<T>,
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate);
  }
}

export class NotSpecification<T> extends CompositeSpecification<T> {
  constructor(private readonly spec: ISpecification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return !this.spec.isSatisfiedBy(candidate);
  }
}
```

### Specification Helpers & Operators
```typescript
export class PredicateSpecification<T> extends CompositeSpecification<T> {
  constructor(private readonly predicate: (candidate: T) => boolean) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.predicate(candidate);
  }
}

export class PropertyEqualsSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly propertyName: keyof T,
    private readonly expectedValue: any,
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return candidate[this.propertyName] === this.expectedValue;
  }
}

export const Specification = {
  create<T>(predicate: (candidate: T) => boolean): ISpecification<T> {
    return new PredicateSpecification<T>(predicate);
  },

  propertyEquals<T>(propertyName: keyof T, expectedValue: any): ISpecification<T> {
    return new PropertyEqualsSpecification<T>(propertyName, expectedValue);
  },

  and<T>(...specifications: ISpecification<T>[]): ISpecification<T> {
    if (specifications.length === 0) return new AlwaysTrueSpecification<T>();
    
    let result = specifications[0];
    for (let i = 1; i < specifications.length; i++) {
      result = new AndSpecification<T>(result, specifications[i]);
    }
    return result;
  },

  or<T>(...specifications: ISpecification<T>[]): ISpecification<T> {
    if (specifications.length === 0) return new AlwaysFalseSpecification<T>();
    
    let result = specifications[0];
    for (let i = 1; i < specifications.length; i++) {
      result = new OrSpecification<T>(result, specifications[i]);
    }
    return result;
  }
};
```

## 3. Implementacja Walidatorów

### BusinessRuleValidator
```typescript
export class BusinessRuleValidator<T> implements IValidator<T> {
  private rules: ValidationRule<T>[] = [];
  private stopOnFirstFailure = false;
  private lastCondition: ((value: T) => boolean) | null = null;

  addRule(
    property: string,
    validationFn: (value: T) => boolean,
    message: string,
    context?: Record<string, any>,
  ): BusinessRuleValidator<T> {
    this.rules.push({
      property,
      validate: (value: T) => {
        return validationFn(value)
          ? Result.ok(true)
          : Result.fail(new ValidationError(property, message, context));
      },
    });
    return this;
  }

  mustSatisfy(
    specification: ISpecification<T>,
    message: string,
    context?: Record<string, any>,
  ): BusinessRuleValidator<T> {
    return this.addRule(
      '',
      (value) => specification.isSatisfiedBy(value),
      message,
      context,
    );
  }

  propertyMustSatisfy<P>(
    property: keyof T & string,
    specification: ISpecification<P>,
    message: string,
    getValue: (obj: T) => P,
    context?: Record<string, any>,
  ): BusinessRuleValidator<T> {
    return this.addRule(
      property,
      (value) => specification.isSatisfiedBy(getValue(value)),
      message,
      context,
    );
  }

  when(
    condition: (value: T) => boolean,
    thenValidator: (validator: BusinessRuleValidator<T>) => void,
  ): BusinessRuleValidator<T> {
    this.lastCondition = condition;

    const conditionalValidator = new BusinessRuleValidator<T>();
    thenValidator(conditionalValidator);

    for (const rule of conditionalValidator.rules) {
      this.rules.push({
        ...rule,
        condition,
      });
    }

    return this;
  }

  otherwise(
    elseValidator: (validator: BusinessRuleValidator<T>) => void,
  ): BusinessRuleValidator<T> {
    if (!this.lastCondition) {
      throw new Error('Cannot call otherwise() without a preceding when()');
    }

    const lastConditionFn = this.lastCondition;
    const negatedCondition = (value: T) => !lastConditionFn(value);

    const elseConditionalValidator = new BusinessRuleValidator<T>();
    elseValidator(elseConditionalValidator);

    for (const rule of elseConditionalValidator.rules) {
      this.rules.push({
        ...rule,
        condition: negatedCondition,
      });
    }

    this.lastCondition = null;
    return this;
  }

  whenSatisfies(
    specification: ISpecification<T>,
    thenValidator: (validator: BusinessRuleValidator<T>) => void,
  ): BusinessRuleValidator<T> {
    return this.when(
      (value) => specification.isSatisfiedBy(value),
      thenValidator,
    );
  }

  addNested<P>(
    property: string,
    validator: IValidator<P>,
    getValue: (obj: T) => P | undefined | null,
  ): BusinessRuleValidator<T> {
    this.rules.push({
      property,
      validate: (value: T) => {
        const propertyValue = getValue(value);

        if (propertyValue === undefined || propertyValue === null) {
          return Result.fail(
            new ValidationError(
              property,
              'Cannot validate undefined or null nested object',
              { path: property },
            ),
          );
        }

        const result = validator.validate(propertyValue);

        if (result.isFailure) {
          const prefixedErrors = result.error.errors.map((err) => {
            return new ValidationError(
              `${property}${err.property ? `.${err.property}` : ''}`,
              err.message,
              {
                ...(err.context || {}),
                path: property + (err.property ? `.${err.property}` : ''),
              },
            );
          });

          return Result.fail(
            new ValidationError(property, 'Nested validation failed', {
              errors: prefixedErrors,
              path: property,
            }),
          );
        }

        return Result.ok(true);
      },
    });
    return this;
  }

  validate(value: T): Result<T, ValidationErrors> {
    const errors: ValidationError[] = [];

    for (const rule of this.rules) {
      if (rule.condition && !rule.condition(value)) {
        continue;
      }

      const result = rule.validate(value);
      if (result.isFailure) {
        errors.push(result.error);

        if (this.stopOnFirstFailure) {
          break;
        }
      }
    }

    if (errors.length > 0) {
      return Result.fail(new ValidationErrors(errors));
    }

    return Result.ok(value);
  }

  static create<T>(): BusinessRuleValidator<T> {
    return new BusinessRuleValidator<T>();
  }
}
```

### SpecificationValidator
```typescript
export class SpecificationValidator<T> implements IValidator<T> {
  private validationRules: Array<{
    specification: ISpecification<T>;
    message: string;
    property?: string;
    context?: Record<string, any>;
  }> = [];

  addRule(
    specification: ISpecification<T>,
    message: string,
    property?: string,
    context?: Record<string, any>,
  ): SpecificationValidator<T> {
    this.validationRules.push({
      specification,
      message,
      property,
      context,
    });
    return this;
  }

  addPropertyRule<P>(
    property: keyof T & string,
    specification: ISpecification<P>,
    message: string,
    getValue: (obj: T) => P,
    context?: Record<string, any>,
  ): SpecificationValidator<T> {
    const propertySpec: ISpecification<T> = {
      isSatisfiedBy: (candidate: T) =>
        specification.isSatisfiedBy(getValue(candidate)),
      and: () => { throw new Error('Operation not supported'); },
      or: () => { throw new Error('Operation not supported'); },
      not: () => { throw new Error('Operation not supported'); },
    };

    return this.addRule(propertySpec, message, property, context);
  }

  validate(value: T): Result<T, ValidationErrors> {
    const errors: ValidationError[] = [];

    for (const rule of this.validationRules) {
      if (!rule.specification.isSatisfiedBy(value)) {
        errors.push(
          new ValidationError(rule.property || '', rule.message, rule.context),
        );
      }
    }

    if (errors.length > 0) {
      return Result.fail(new ValidationErrors(errors));
    }

    return Result.ok(value);
  }

  static create<T>(): SpecificationValidator<T> {
    return new SpecificationValidator<T>();
  }

  static fromSpecification<T>(
    specification: ISpecification<T>,
    message: string,
    property?: string,
    context?: Record<string, any>,
  ): SpecificationValidator<T> {
    return new SpecificationValidator<T>().addRule(
      specification,
      message,
      property,
      context,
    );
  }
}
```

## 4. Rules Registry System

### IRulesProvider & ICoreRules Interfaces
```typescript
export interface IRulesProvider {
  readonly name: string;
}

export interface RuleFunction<T> {
  (validator: BusinessRuleValidator<T>): BusinessRuleValidator<T>;
}

export interface ICoreRules {
  required: <T>(property: keyof T, message?: string) => RuleFunction<T>;
  minLength: <T>(property: keyof T, length: number, message?: string) => RuleFunction<T>;
  maxLength: <T>(property: keyof T, length: number, message?: string) => RuleFunction<T>;
  pattern: <T>(property: keyof T, regex: RegExp, message?: string) => RuleFunction<T>;
  range: <T>(property: keyof T, min: number, max: number, message?: string) => RuleFunction<T>;
  email: <T>(property: keyof T, message?: string) => RuleFunction<T>;
  
  satisfies: <T>(specification: ISpecification<T>, message: string) => RuleFunction<T>;
  propertySatisfies: <T, P>(
    property: keyof T & string,
    specification: ISpecification<P>,
    message: string,
    getValue: (obj: T) => P,
  ) => RuleFunction<T>;
  
  when: <T>(
    condition: (value: T) => boolean,
    thenRules: (validator: BusinessRuleValidator<T>) => void,
  ) => RuleFunction<T>;
  whenSatisfies: <T>(
    specification: ISpecification<T>,
    thenRules: (validator: BusinessRuleValidator<T>) => void,
  ) => RuleFunction<T>;
  otherwise: <T>(
    elseRules: (validator: BusinessRuleValidator<T>) => void,
  ) => RuleFunction<T>;
}
```

### CoreRules Implementation
```typescript
export class CoreRules implements ICoreRules, IRulesProvider {
  readonly name = 'core';

  required = <T>(property: keyof T, message = 'Field is required') =>
    (validator: BusinessRuleValidator<T>) =>
      validator.addRule(
        property as string,
        (value) => value[property] !== undefined && value[property] !== null,
        message,
      );

  minLength = <T>(property: keyof T, length: number, message?: string) =>
    (validator: BusinessRuleValidator<T>) =>
      validator.addRule(
        property as string,
        (value) => String(value[property]).length >= length,
        message || `Minimum length is ${length}`,
      );

  email = <T>(property: keyof T, message = 'Invalid email address') =>
    (validator: BusinessRuleValidator<T>) =>
      validator.addRule(
        property as string,
        (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value[property])),
        message,
      );

  satisfies = <T>(specification: ISpecification<T>, message: string) =>
    (validator: BusinessRuleValidator<T>) =>
      validator.mustSatisfy(specification, message);

  when = <T>(
    condition: (value: T) => boolean,
    thenRules: (validator: BusinessRuleValidator<T>) => void,
  ) =>
    (validator: BusinessRuleValidator<T>) =>
      validator.when(condition, thenRules);

  // ... other implementations
}
```

### RulesRegistry
```typescript
export class RulesRegistry {
  private static providers: Map<string, IRulesProvider> = new Map();
  private static core: CoreRules = new CoreRules();

  static register(provider: IRulesProvider): void {
    if (this.providers.has(provider.name)) {
      throw new Error(`Rule provider with name "${provider.name}" is already registered`);
    }
    this.providers.set(provider.name, provider);
  }

  static getProvider<T extends IRulesProvider>(name: string): T {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Rule provider "${name}" not found`);
    }
    return provider as T;
  }

  static get Rules(): ICoreRules {
    return this.core;
  }

  static forDomain<T extends IRulesProvider>(domain: string): T {
    return this.getProvider<T>(domain);
  }
}
```

## 5. Extensions & Advanced Features

### BusinessRuleValidator Extensions
```typescript
// Extension methods dodawane do prototypu
BusinessRuleValidator.prototype.apply = function <T>(
  this: BusinessRuleValidator<T>,
  rule: (validator: BusinessRuleValidator<T>) => BusinessRuleValidator<T>,
): BusinessRuleValidator<T> {
  return rule(this);
};

BusinessRuleValidator.prototype.toSpecification = function <T>(
  this: BusinessRuleValidator<T>,
  errorMessage: string = 'Validation failed',
): ISpecification<T> {
  return Specification.create<T>(
    (candidate) => this.validate(candidate).isSuccess,
  );
};
```

### Validation Facade
```typescript
export const Validation = {
  create<T>(): BusinessRuleValidator<T> {
    return BusinessRuleValidator.create<T>();
  },

  fromSpecification<T>(
    specification: ISpecification<T>,
    message: string,
    property?: string,
  ): IValidator<T> {
    return SpecificationValidator.fromSpecification(specification, message, property);
  },

  combine<T>(...validators: IValidator<T>[]): IValidator<T> {
    return {
      validate: (value: T): Result<T, ValidationErrors> => {
        const errors: ValidationErrors[] = [];

        for (const validator of validators) {
          const result = validator.validate(value);
          if (result.isFailure) {
            errors.push(result.error);
          }
        }

        if (errors.length > 0) {
          const allErrors = errors.flatMap((e) => e.errors);
          return Result.fail(new ValidationErrors(allErrors));
        }

        return Result.ok(value);
      },
    };
  },

  validatePath<T, P>(
    object: T,
    path: (string | number)[],
    valueValidator: IValidator<P>,
  ): Result<T, ValidationErrors> {
    // Implementation for deep path validation
  }
};
```

## 6. Praktyczne Przykłady Implementacji

### Podstawowy Walidator Użytkownika
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  age: number;
  premium?: boolean;
  address?: Address;
}

const basicUserValidator = BusinessRuleValidator.create<User>()
  .addRule(
    'name',
    (user) => user.name.length >= 2,
    'Name must have at least 2 characters',
  )
  .addRule(
    'email',
    (user) => /^\S+@\S+\.\S+$/.test(user.email),
    'Invalid email format',
  )
  .addRule('age', (user) => user.age >= 18, 'User must be 18 or older')
  .when(
    (user) => user.premium === true,
    (validator) =>
      validator.addRule(
        'name',
        (user) => user.name.length >= 3,
        'Premium users must have longer names',
      ),
  );
```

### Walidator Oparty na Specyfikacjach
```typescript
const isAdult = Specification.create<User>((user) => user.age >= 18);
const hasValidEmail = Specification.create<User>((user) =>
  /^\S+@\S+\.\S+$/.test(user.email),
);

const specBasedUserValidator = BusinessRuleValidator.create<User>()
  .mustSatisfy(isAdult, 'User must be 18 or older')
  .mustSatisfy(hasValidEmail, 'Invalid email format')
  .whenSatisfies(
    Specification.create<User>((user) => user.premium === true),
    (validator) =>
      validator.mustSatisfy(
        Specification.create<User>((user) => user.name.length >= 3),
        'Premium users must have longer names',
      ),
  );
```

### Walidacja Zagnieżdżonych Obiektów
```typescript
const addressValidator = BusinessRuleValidator.create<Address>()
  .addRule('street', (addr) => addr.street.length > 0, 'Street cannot be empty')
  .addRule('city', (addr) => addr.city.length > 0, 'City cannot be empty');

const complexUserValidator = BusinessRuleValidator.create<User>()
  .apply(RulesRegistry.Rules.required('name', 'Name is required'))
  .apply(RulesRegistry.Rules.email('email', 'Invalid email format'))
  .when(
    (user) => user.address !== undefined,
    (validator) =>
      validator.addNested('address', addressValidator, (user) => user.address),
  );
```

## 7. Zaawansowane Wzorce Użycia

### Kombinowanie Specyfikacji
```typescript
const hasMinimumIncome = Specification.create<LoanApplication>(
  (app) => app.income >= 30000,
);
const hasGoodCreditScore = Specification.create<LoanApplication>(
  (app) => app.creditScore >= 700,
);

const isEligibleForPremiumLoan = Specification.and(
  hasMinimumIncome,
  hasGoodCreditScore,
  Specification.create<LoanApplication>((app) => app.amount <= app.income * 0.5),
);
```

### Walidacja z Registry Rules
```typescript
const orderValidator = BusinessRuleValidator.create<Order>()
  .apply(RulesRegistry.Rules.required('userId', 'User ID is required'))
  .apply(RulesRegistry.Rules.satisfies(
    Specification.create<Order>((order) => order.items.length > 0),
    'Order must contain at least one item'
  ))
  .whenSatisfies(
    Specification.create<Order>((order) => ['pending', 'confirmed'].includes(order.status)),
    (validator) => validator.addRule(
      'createdAt',
      (order) => {
        const now = new Date();
        const diffDays = Math.ceil(
          Math.abs(now.getTime() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        return diffDays <= 30;
      },
      'Orders cannot be older than 30 days',
    ),
  );
```

## 8. Najlepsze Praktyki

### 1. Struktura Projektu
```
src/domain/
├── specifications/
│   ├── user-specifications.ts
│   ├── order-specifications.ts
│   └── loan-specifications.ts
├── validators/
│   ├── user-validators.ts
│   ├── order-validators.ts
│   └── loan-validators.ts
└── rules/
    ├── business-rules.ts
    └── domain-rules-provider.ts
```

### 2. Naming Conventions
- Specyfikacje: `isEligible`, `hasValidStatus`, `canPerformAction`
- Walidatory: `userValidator`, `orderValidator`, `applicationValidator`
- Reguły: `required`, `minLength`, `mustSatisfy`

### 3. Error Handling
```typescript
const result = validator.validate(userData);
if (result.isFailure) {
  const errors = result.error.errors.map(err => ({
    field: err.property,
    message: err.message,
    context: err.context
  }));
  // Handle errors
}
```

### 4. Testowanie
```typescript
describe('UserValidator', () => {
  it('should validate adult users', () => {
    const user = { name: 'John', email: 'john@example.com', age: 25 };
    const result = userValidator.validate(user);
    expect(result.isSuccess).toBe(true);
  });

  it('should fail for underage users', () => {
    const user = { name: 'John', email: 'john@example.com', age: 16 };
    const result = userValidator.validate(user);
    expect(result.isFailure).toBe(true);
    expect(result.error.errors[0].message).toBe('User must be 18 or older');
  });
});
```

## 9. Integracja z Result Pattern

Wszystkie walidatory zwracają `Result<T, ValidationErrors>`:

```typescript
// Sukces
const successResult = Result.ok(validatedObject);

// Niepowodzenie
const failureResult = Result.fail(new ValidationErrors([
  new ValidationError('email', 'Invalid email format'),
  new ValidationError('age', 'Must be 18 or older')
]));
```

## 10. Rozszerzenia Domeny

### Tworzenie Domain-Specific Rules
```typescript
export class ECommerceRules implements IRulesProvider {
  readonly name = 'ecommerce';

  validPrice = <T>(property: keyof T, message?: string) =>
    (validator: BusinessRuleValidator<T>) =>
      validator.addRule(
        property as string,
        (value) => {
          const price = Number(value[property]);
          return !isNaN(price) && price > 0;
        },
        message || 'Price must be a positive number',
      );

  inStock = <T>(getQuantity: (obj: T) => number, message?: string) =>
    (validator: BusinessRuleValidator<T>) =>
      validator.addRule(
        'stock',
        (value) => getQuantity(value) > 0,
        message || 'Item must be in stock',
      );
}

// Rejestracja
RulesRegistry.register(new ECommerceRules());

// Użycie
const productValidator = BusinessRuleValidator.create<Product>()
  .apply(RulesRegistry.forDomain<ECommerceRules>('ecommerce').validPrice('price'))
  .apply(RulesRegistry.forDomain<ECommerceRules>('ecommerce').inStock(p => p.quantity));
```
