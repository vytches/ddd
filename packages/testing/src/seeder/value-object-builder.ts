/**
 * Specialized builder for creating DDD value objects with proper validation,
 * business rule compliance, and realistic data generation. Integrates with
 * @vytches/ddd-value-objects and provides intelligent constraint handling.
 */

import { Result } from '@vytches/ddd-utils';
import { faker } from '@faker-js/faker';

/**
 * Business rule validator function type
 */
export type BusinessRuleValidator<T> = (value: T) => boolean | Promise<boolean>;

/**
 * Value object generator strategy
 */
export type ValueObjectStrategy<T> =
  | 'random'
  | 'sequential'
  | 'template'
  | 'custom'
  | ((index?: number) => T | Promise<T>);

/**
 * Constraint specification for value object generation
 */
export interface ValueObjectConstraints {
  /** Minimum value (for numeric types) */
  min?: number;

  /** Maximum value (for numeric types) */
  max?: number;

  /** Minimum length (for string types) */
  minLength?: number;

  /** Maximum length (for string types) */
  maxLength?: number;

  /** Regular expression pattern (for string types) */
  pattern?: RegExp;

  /** Allowed values (enum-like constraints) */
  allowedValues?: unknown[];

  /** Forbidden values */
  forbiddenValues?: unknown[];

  /** Custom constraint validator */
  customValidator?: (value: unknown) => boolean;

  /** Geographic constraints */
  geographic?: {
    country?: string;
    region?: string;
    city?: string;
    coordinates?: { lat: number; lng: number; radius?: number };
  };

  /** Temporal constraints */
  temporal?: {
    after?: Date;
    before?: Date;
    timezone?: string;
    businessHours?: boolean;
  };

  /** Additional arbitrary constraints */
  [key: string]: unknown;
}

/**
 * Configuration for value object generation
 */
export interface ValueObjectBuilderConfig<T> {
  /** Generation strategy to use */
  strategy?: ValueObjectStrategy<T>;

  /** Enable business rule validation */
  enableValidation?: boolean;

  /** Maximum retry attempts for constraint violations */
  maxRetryAttempts?: number;

  /** Custom data generator function */
  customGenerator?: (constraints?: ValueObjectConstraints) => T | Promise<T>;

  /** Locale for localized data generation */
  locale?: string;

  /** Seed for reproducible random generation */
  seed?: number;
}

/**
 * Template for creating predefined value object patterns
 */
export interface ValueObjectTemplate<T> {
  name: string;
  description?: string;
  generator: (index?: number) => T | Promise<T>;
  constraints?: ValueObjectConstraints;
  businessRules?: string[];
}

/**
 * Result of value object validation
 */
export interface ValidationResult {
  isValid: boolean;
  violations: string[];
  warnings: string[];
}

/**
 * Builder class for creating DDD value objects with business rule compliance.
 *
 * This builder provides intelligent value object generation that:
 * - Respects business rules and domain constraints
 * - Generates realistic data appropriate for the value object type
 * - Handles constraint violations through retry mechanisms
 * - Supports custom validation and business rule checking
 * - Integrates with geographic and temporal constraint systems
 */
export class ValueObjectBuilder<T> {
  private readonly ValueObjectClass: new (...args: any[]) => T;
  private readonly config: ValueObjectBuilderConfig<T>;
  private constraints: ValueObjectConstraints = {};
  private businessRules: Map<string, BusinessRuleValidator<T>> = new Map();
  private templates: Map<string, ValueObjectTemplate<T>> = new Map();
  private customValidators: Array<(value: T) => ValidationResult | Promise<ValidationResult>> = [];

  /**
   * Creates a new ValueObjectBuilder for the specified value object type.
   *
   * @param ValueObjectClass Constructor for the value object
   * @param config Optional configuration for generation behavior
   */
  constructor(
    ValueObjectClass: new (...args: any[]) => T,
    config: ValueObjectBuilderConfig<T> = {}
  ) {
    this.ValueObjectClass = ValueObjectClass;
    this.config = {
      strategy: 'random',
      enableValidation: true,
      maxRetryAttempts: 5,
      locale: 'en',
      ...config,
    };

    // Note: faker locale configuration available for future use
    // if (this.config.locale) {
    //   faker.setLocale(this.config.locale);
    // }

    // Set faker seed for reproducible generation
    if (this.config.seed) {
      faker.seed(this.config.seed);
    }

    // Initialize built-in business rule validators
    this.initializeBuiltInValidators();
  }

  /**
   * Sets constraints for value object generation.
   *
   * @param constraints Constraint specification
   * @returns Builder instance for method chaining
   *
   * @example
   * ```typescript
   * const ageBuilder = new ValueObjectBuilder(AgeVO)
   *   .withConstraints({
   *     min: 18,
   *     max: 120,
   *     forbiddenValues: [0, -1]
   *   });
   * ```
   */
  withConstraints(constraints: ValueObjectConstraints): this {
    this.constraints = { ...this.constraints, ...constraints };
    return this;
  }

  /**
   * Enables specific business rules for validation.
   *
   * @param rules Array of business rule names or custom validators
   * @returns Builder instance for method chaining
   *
   * @example
   * ```typescript
   * const emailBuilder = new ValueObjectBuilder(EmailVO)
   *   .withBusinessRules([
   *     'valid-format',
   *     'no-disposable-emails',
   *     'domain-whitelist'
   *   ]);
   * ```
   */
  withBusinessRules(rules: Array<string | BusinessRuleValidator<T>>): this {
    for (const rule of rules) {
      if (typeof rule === 'string') {
        // Use built-in rule
        const validator = this.businessRules.get(rule);
        if (validator) {
          this.businessRules.set(rule, validator);
        }
      } else {
        // Custom validator function
        const customRuleName = `custom_${Date.now()}_${Math.random()}`;
        this.businessRules.set(customRuleName, rule);
      }
    }
    return this;
  }

  /**
   * Adds a custom validation function.
   *
   * @param validator Function that validates value objects
   * @returns Builder instance for method chaining
   *
   * @example
   * ```typescript
   * const priceBuilder = new ValueObjectBuilder(PriceVO)
   *   .withCustomValidator(async (price) => ({
   *     isValid: price.amount > 0 && price.currency !== 'INVALID',
   *     violations: price.amount <= 0 ? ['Amount must be positive'] : [],
   *     warnings: []
   *   }));
   * ```
   */
  withCustomValidator(validator: (value: T) => ValidationResult | Promise<ValidationResult>): this {
    this.customValidators.push(validator);
    return this;
  }

  /**
   * Registers a template for reusable value object patterns.
   *
   * @param template Template configuration
   * @returns Builder instance for method chaining
   *
   * @example
   * ```typescript
   * const polishAddressTemplate: ValueObjectTemplate<AddressVO> = {
   *   name: 'polish-urban-address',
   *   description: 'Realistic Polish urban address',
   *   generator: () => AddressVO.create({
   *     street: faker.location.streetAddress(),
   *     city: faker.helpers.arrayElement(['Warsaw', 'Krakow', 'Gdansk']),
   *     postalCode: faker.location.zipCode('##-###'),
   *     country: 'Poland'
   *   }),
   *   constraints: { geographic: { country: 'Poland' } }
   * };
   *
   * const addressBuilder = new ValueObjectBuilder(AddressVO)
   *   .withTemplate(polishAddressTemplate);
   * ```
   */
  withTemplate(template: ValueObjectTemplate<T>): this {
    this.templates.set(template.name, template);
    return this;
  }

  /**
   * Sets the generation strategy.
   *
   * @param strategy Strategy to use for value object generation
   * @returns Builder instance for method chaining
   */
  withStrategy(strategy: ValueObjectStrategy<T>): this {
    this.config.strategy = strategy;
    return this;
  }

  /**
   * Builds a single value object instance.
   *
   * @param templateName Optional template to use for generation
   * @param overrides Optional property overrides
   * @returns Promise resolving to created value object or error
   *
   * @example
   * ```typescript
   * // Build with random generation
   * const email = await emailBuilder.build();
   *
   * // Build with template
   * const polishAddress = await addressBuilder.build('polish-urban-address');
   *
   * // Build with overrides
   * const customEmail = await emailBuilder.build(undefined, { domain: 'company.com' });
   * ```
   */
  async build(templateName?: string, overrides?: Partial<T>): Promise<Result<T, Error>> {
    try {
      let attempts = 0;
      const maxAttempts = this.config.maxRetryAttempts!;

      while (attempts < maxAttempts) {
        attempts++;

        // Generate value object data
        const data = await this.generateValueObjectData(templateName, overrides);

        // Create value object instance
        let valueObject: T;
        try {
          valueObject = new this.ValueObjectClass(data);
        } catch (constructionError) {
          if (attempts === maxAttempts) {
            throw new Error(`Failed to construct value object: ${constructionError}`);
          }
          continue; // Retry with different data
        }

        // Validate if enabled
        if (this.config.enableValidation) {
          const validationResult = await this.validateValueObject(valueObject);
          if (!validationResult.isValid) {
            if (attempts === maxAttempts) {
              throw new Error(
                `Value object validation failed: ${validationResult.violations.join(', ')}`
              );
            }
            continue; // Retry with different data
          }
        }

        return Result.ok(valueObject);
      }

      throw new Error(`Failed to create valid value object after ${maxAttempts} attempts`);
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Builds multiple value object instances.
   *
   * @param count Number of value objects to create
   * @param templateName Optional template to use for all instances
   * @param overrideGenerator Optional function to generate per-instance overrides
   * @returns Promise resolving to array of value objects or error
   *
   * @example
   * ```typescript
   * // Create 100 random emails
   * const emails = await emailBuilder.buildMany(100);
   *
   * // Create varied emails with different domains
   * const corporateEmails = await emailBuilder.buildMany(50, undefined, (index) => ({
   *   domain: index < 25 ? 'company.com' : 'partner.com'
   * }));
   * ```
   */
  async buildMany(
    count: number,
    templateName?: string,
    overrideGenerator?: (index: number) => Partial<T>
  ): Promise<Result<T[], Error>> {
    try {
      const valueObjects: T[] = [];
      const errors: Error[] = [];

      for (let i = 0; i < count; i++) {
        const overrides = overrideGenerator ? overrideGenerator(i) : undefined;
        const result = await this.build(templateName, overrides);

        if (result.isSuccess) {
          valueObjects.push(result.value);
        } else {
          errors.push(result.error);
        }
      }

      if (errors.length > 0 && valueObjects.length === 0) {
        return Result.fail(
          new Error(
            `Failed to create any value objects. Errors: ${errors.map(e => e.message).join(', ')}`
          )
        );
      }

      if (errors.length > 0) {
        console.warn(
          `Created ${valueObjects.length}/${count} value objects. ${errors.length} failures.`
        );
      }

      return Result.ok(valueObjects);
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Gets available templates.
   *
   * @returns Array of template names and descriptions
   */
  getTemplates(): Array<{ name: string; description?: string }> {
    return Array.from(this.templates.values()).map(template => ({
      name: template.name,
      ...(template.description ? { description: template.description } : {}),
    }));
  }

  /**
   * Gets current constraints.
   *
   * @returns Current constraint specification
   */
  getConstraints(): Readonly<ValueObjectConstraints> {
    return { ...this.constraints };
  }

  /**
   * Gets registered business rules.
   *
   * @returns Array of business rule names
   */
  getBusinessRules(): string[] {
    return Array.from(this.businessRules.keys());
  }

  /**
   * Generates value object data based on strategy and constraints.
   */
  private async generateValueObjectData(
    templateName?: string,
    overrides?: Partial<T>
  ): Promise<any> {
    let data: any;

    // Use template if specified
    if (templateName && this.templates.has(templateName)) {
      const template = this.templates.get(templateName)!;
      data = await template.generator();

      // Apply template constraints
      if (template.constraints) {
        this.constraints = { ...this.constraints, ...template.constraints };
      }
    } else {
      // Generate based on strategy
      data = await this.generateByStrategy();
    }

    // Apply overrides
    if (overrides) {
      data = { ...data, ...overrides };
    }

    // Apply constraint adjustments
    data = this.applyConstraints(data);

    return data;
  }

  /**
   * Generates data based on the configured strategy.
   */
  private async generateByStrategy(): Promise<any> {
    const strategy = this.config.strategy;

    if (typeof strategy === 'function') {
      return await strategy();
    }

    switch (strategy) {
      case 'random':
        return this.generateRandomData();

      case 'sequential':
        return this.generateSequentialData();

      case 'template': {
        // Use first available template
        const firstTemplate = this.templates.values().next().value;
        return firstTemplate ? await firstTemplate.generator() : this.generateRandomData();
      }

      case 'custom':
        return this.config.customGenerator
          ? await this.config.customGenerator(this.constraints)
          : this.generateRandomData();

      default:
        return this.generateRandomData();
    }
  }

  /**
   * Generates random data appropriate for the value object type.
   */
  private generateRandomData(): any {
    const className = this.ValueObjectClass.name.toLowerCase();

    // Generate based on common value object patterns
    if (className.includes('email')) {
      return { value: faker.internet.email() };
    } else if (className.includes('age')) {
      return {
        value: faker.number.int({
          min: this.constraints.min ?? 18,
          max: this.constraints.max ?? 100,
        }),
      };
    } else if (className.includes('name')) {
      return { value: faker.person.fullName() };
    } else if (className.includes('address')) {
      return {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        postalCode: faker.location.zipCode(),
        country: this.constraints.geographic?.country ?? faker.location.country(),
      };
    } else if (className.includes('phone')) {
      return { value: faker.phone.number() };
    } else if (className.includes('url')) {
      return { value: faker.internet.url() };
    } else if (className.includes('money') || className.includes('price')) {
      return {
        amount: faker.number.float({
          min: this.constraints.min ?? 0,
          max: this.constraints.max ?? 10000,
          fractionDigits: 2,
        }),
        currency: 'USD',
      };
    } else {
      // Generic fallback
      return { value: faker.lorem.word() };
    }
  }

  /**
   * Generates sequential data for predictable patterns.
   */
  private generateSequentialData(): any {
    const className = this.ValueObjectClass.name.toLowerCase();
    const timestamp = Date.now();

    if (className.includes('email')) {
      return { value: `user${timestamp}@example.com` };
    } else if (className.includes('name')) {
      return { value: `Test User ${timestamp}` };
    } else {
      return { value: `test_value_${timestamp}` };
    }
  }

  /**
   * Applies constraints to generated data.
   */
  private applyConstraints(data: any): any {
    // Apply string constraints
    if (typeof data.value === 'string') {
      if (this.constraints.minLength && data.value.length < this.constraints.minLength) {
        data.value = data.value.padEnd(this.constraints.minLength, 'x');
      }
      if (this.constraints.maxLength && data.value.length > this.constraints.maxLength) {
        data.value = data.value.substring(0, this.constraints.maxLength);
      }
      if (this.constraints.pattern && !this.constraints.pattern.test(data.value)) {
        // Try to generate pattern-compliant value
        data.value = this.generatePatternCompliantValue(this.constraints.pattern);
      }
    }

    // Apply numeric constraints
    if (typeof data.value === 'number') {
      if (this.constraints.min !== undefined && data.value < this.constraints.min) {
        data.value = this.constraints.min;
      }
      if (this.constraints.max !== undefined && data.value > this.constraints.max) {
        data.value = this.constraints.max;
      }
    }

    // Apply allowed/forbidden values
    if (this.constraints.allowedValues && !this.constraints.allowedValues.includes(data.value)) {
      data.value = faker.helpers.arrayElement(this.constraints.allowedValues);
    }
    if (this.constraints.forbiddenValues && this.constraints.forbiddenValues.includes(data.value)) {
      // Generate alternative value
      data.value = this.generateRandomData().value;
    }

    return data;
  }

  /**
   * Generates a value that complies with the given regex pattern.
   */
  private generatePatternCompliantValue(pattern: RegExp): string {
    // This is a simplified implementation - in practice, you might want to use
    // a library like 'regexp-to-string' or implement more sophisticated pattern matching
    const patternStr = pattern.toString();

    if (patternStr.includes('\\d{2}-\\d{3}')) {
      // Polish postal code pattern
      return `${faker.string.numeric(2)}-${faker.string.numeric(3)}`;
    }

    // Fallback to faker pattern generation
    return faker.helpers.fromRegExp(pattern);
  }

  /**
   * Validates a value object against business rules and constraints.
   */
  private async validateValueObject(valueObject: T): Promise<ValidationResult> {
    const violations: string[] = [];
    const warnings: string[] = [];

    // Validate business rules
    for (const [ruleName, validator] of this.businessRules) {
      try {
        const isValid = await validator(valueObject);
        if (!isValid) {
          violations.push(`Business rule violation: ${ruleName}`);
        }
      } catch (error) {
        violations.push(`Business rule error (${ruleName}): ${error}`);
      }
    }

    // Run custom validators
    for (const validator of this.customValidators) {
      try {
        const result = await validator(valueObject);
        violations.push(...result.violations);
        warnings.push(...result.warnings);
      } catch (error) {
        violations.push(`Custom validation error: ${error}`);
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Initializes built-in business rule validators.
   */
  private initializeBuiltInValidators(): void {
    // Email-specific validators
    this.businessRules.set('valid-email-format', (value: any) => {
      const email = value.value || value.email || value;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
    });

    this.businessRules.set('no-disposable-emails', (value: any) => {
      const email = String(value.value || value.email || value);
      const disposableDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
      return !disposableDomains.some(domain => email.includes(domain));
    });

    // Age-specific validators
    this.businessRules.set('adult-age', (value: any) => {
      const age = value.value || value.age || value;
      return Number(age) >= 18;
    });

    this.businessRules.set('reasonable-age', (value: any) => {
      const age = value.value || value.age || value;
      return Number(age) >= 0 && Number(age) <= 150;
    });

    // Phone-specific validators
    this.businessRules.set('valid-phone-format', (value: any) => {
      const phone = String(value.value || value.phone || value);
      return /^\+?[\d\s\-()]{7,}$/.test(phone);
    });

    // URL-specific validators
    this.businessRules.set('valid-url-format', (value: any) => {
      const url = String(value.value || value.url || value);
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });

    // Money/Price-specific validators
    this.businessRules.set('positive-amount', (value: any) => {
      const amount = value.amount || value.value || value;
      return Number(amount) > 0;
    });

    this.businessRules.set('valid-currency', (value: any) => {
      const currency = value.currency || 'USD';
      const validCurrencies = ['USD', 'EUR', 'GBP', 'PLN', 'CAD', 'AUD'];
      return validCurrencies.includes(currency);
    });
  }
}
