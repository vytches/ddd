import type { ISpecification } from '@vytches-ddd/contracts';

import type { BusinessRuleValidator } from './business-rules/business-rule-validator';

/**
 * Basic validator rule function type
 */
export interface RuleFunction<T> {
  (validator: BusinessRuleValidator<T>): BusinessRuleValidator<T>;
}

/**
 * Base interface for all rule providers
 */
export interface IRulesProvider {
  readonly name: string;
}

/**
 * Core validation rules available across all domains
 */
export interface ICoreRules {
  // Basic validation rules
  required: <T>(property: keyof T, message?: string) => RuleFunction<T>;
  minLength: <T>(
    property: keyof T,
    length: number,
    message?: string,
  ) => RuleFunction<T>;
  maxLength: <T>(
    property: keyof T,
    length: number,
    message?: string,
  ) => RuleFunction<T>;
  pattern: <T>(
    property: keyof T,
    regex: RegExp,
    message?: string,
  ) => RuleFunction<T>;
  range: <T>(
    property: keyof T,
    min: number,
    max: number,
    message?: string,
  ) => RuleFunction<T>;
  email: <T>(property: keyof T, message?: string) => RuleFunction<T>;

  // Specification-based rules
  satisfies: <T>(
    specification: ISpecification<T>,
    message: string,
  ) => RuleFunction<T>;
  propertySatisfies: <T, P>(
    property: keyof T & string,
    specification: ISpecification<P>,
    message: string,
    getValue: (obj: T) => P,
  ) => RuleFunction<T>;

  // Conditional rules
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

/**
 * Base implementation of core rules
 */
export class CoreRules implements ICoreRules, IRulesProvider {
  readonly name = 'core';

  required =
    <T>(property: keyof T, message = 'Field is required') =>
    (validator: BusinessRuleValidator<T>) =>
      validator.addRule(
        property as string,
        (value) => value[property] !== undefined && value[property] !== null,
        message,
      );

  minLength =
    <T>(property: keyof T, length: number, message?: string) =>
    (validator: BusinessRuleValidator<T>) =>
      validator.addRule(
        property as string,
        (value) => String(value[property]).length >= length,
        message || `Minimum length is ${length}`,
      );

  maxLength =
    <T>(property: keyof T, length: number, message?: string) =>
    (validator: BusinessRuleValidator<T>) =>
      validator.addRule(
        property as string,
        (value) => String(value[property]).length <= length,
        message || `Maximum length is ${length}`,
      );

  pattern =
    <T>(property: keyof T, regex: RegExp, message = 'Invalid format') =>
    (validator: BusinessRuleValidator<T>) =>
      validator.addRule(
        property as string,
        (value) => regex.test(String(value[property])),
        message,
      );

  range =
    <T>(property: keyof T, min: number, max: number, message?: string) =>
    (validator: BusinessRuleValidator<T>) =>
      validator.addRule(
        property as string,
        (value) => {
          const num = Number(value[property]);
          return !isNaN(num) && num >= min && num <= max;
        },
        message || `Value must be between ${min} and ${max}`,
      );

  email =
    <T>(property: keyof T, message = 'Invalid email address') =>
    (validator: BusinessRuleValidator<T>) =>
      validator.addRule(
        property as string,
        (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value[property])),
        message,
      );

  satisfies =
    <T>(specification: ISpecification<T>, message: string) =>
    (validator: BusinessRuleValidator<T>) =>
      validator.mustSatisfy(specification, message);

  propertySatisfies =
    <T, P>(
      property: keyof T & string,
      specification: ISpecification<P>,
      message: string,
      getValue: (obj: T) => P,
    ) =>
    (validator: BusinessRuleValidator<T>) =>
      validator.propertyMustSatisfy(property, specification, message, getValue);

  whenSatisfies =
    <T>(
      specification: ISpecification<T>,
      thenRules: (validator: BusinessRuleValidator<T>) => void,
    ) =>
    (validator: BusinessRuleValidator<T>) =>
      validator.whenSatisfies(specification, thenRules);

  otherwise =
    <T>(elseRules: (validator: BusinessRuleValidator<T>) => void) =>
    (validator: BusinessRuleValidator<T>) =>
      validator.otherwise(elseRules);

  when =
    <T>(
      condition: (value: T) => boolean,
      thenRules: (validator: BusinessRuleValidator<T>) => void,
    ) =>
    (validator: BusinessRuleValidator<T>) =>
      validator.when(condition, thenRules);
}

/**
 * Registry for domain-specific rule providers
 */
export class RulesRegistry {
  private static providers: Map<string, IRulesProvider> = new Map();
  private static core: CoreRules = new CoreRules();

  /**
   * Register a domain-specific rule provider
   */
  static register(provider: IRulesProvider): void {
    if (this.providers.has(provider.name)) {
      throw new Error(
        `Rule provider with name "${provider.name}" is already registered`,
      );
    }
    this.providers.set(provider.name, provider);
  }

  /**
   * Get a specific rule provider by name
   */
  static getProvider<T extends IRulesProvider>(name: string): T {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Rule provider "${name}" not found`);
    }
    return provider as T;
  }

  /**
   * Get core rules
   */
  static get Rules(): ICoreRules {
    return this.core;
  }

  /**
   * Access domain-specific rules
   */
  static forDomain<T extends IRulesProvider>(domain: string): T {
    return this.getProvider<T>(domain);
  }
}
