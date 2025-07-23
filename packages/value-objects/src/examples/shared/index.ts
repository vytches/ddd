/**
 * @fileoverview Shared utilities for Value Objects examples
 * 
 * This module provides common utilities and helpers used across all value object
 * examples, ensuring consistency and reducing code duplication.
 */

import { 
  ValueObjectError, 
  ValueObjectValidationResult, 
  ValidationContext,
  SerializationOptions,
  BaseValueObjectData,
  Currency
} from '../types';

// ===== VALIDATION UTILITIES =====

/**
 * Creates a standardized validation error
 */
export function createValidationError(
  code: string,
  message: string,
  field?: string,
  value?: unknown
): ValueObjectError {
  return { code, message, field: field || '', value };
}

/**
 * Creates a successful validation result
 */
export function createSuccessResult(): ValueObjectValidationResult {
  return { isValid: true, errors: [] };
}

/**
 * Creates a failed validation result with errors
 */
export function createFailureResult(
  errors: string[] | ValueObjectError[]
): ValueObjectValidationResult {
  const errorStrings = errors.map(error => 
    typeof error === 'string' ? error : error.message
  );
  return { isValid: false, errors: errorStrings };
}

/**
 * Combines multiple validation results
 */
export function combineValidationResults(
  ...results: ValueObjectValidationResult[]
): ValueObjectValidationResult {
  const allErrors: string[] = [];
  let hasErrors = false;

  for (const result of results) {
    if (!result.isValid) {
      hasErrors = true;
      allErrors.push(...result.errors);
    }
  }

  return hasErrors 
    ? { isValid: false, errors: allErrors }
    : { isValid: true, errors: [] };
}

// ===== SERIALIZATION UTILITIES =====

/**
 * Default serialization options
 */
export const DEFAULT_SERIALIZATION_OPTIONS: SerializationOptions = {
  includeTypeInfo: false,
  format: 'json',
  compression: false
};

/**
 * Serializes a value object to string
 */
export function serializeValueObject<T extends BaseValueObjectData>(
  data: T,
  options: SerializationOptions = DEFAULT_SERIALIZATION_OPTIONS
): string {
  const opts = { ...DEFAULT_SERIALIZATION_OPTIONS, ...options };
  
  if (opts.format === 'json') {
    const payload = opts.includeTypeInfo 
      ? { ...data, __type: data.constructor.name }
      : data;
    return JSON.stringify(payload);
  }
  
  throw new Error(`Unsupported serialization format: ${opts.format}`);
}

/**
 * Deserializes a string to value object data
 */
export function deserializeValueObject<T extends BaseValueObjectData>(
  serialized: string,
  options: SerializationOptions = DEFAULT_SERIALIZATION_OPTIONS
): T {
  const opts = { ...DEFAULT_SERIALIZATION_OPTIONS, ...options };
  
  if (opts.format === 'json') {
    const parsed = JSON.parse(serialized);
    
    if (opts.includeTypeInfo && parsed.__type) {
      delete parsed.__type;
    }
    
    return parsed as T;
  }
  
  throw new Error(`Unsupported deserialization format: ${opts.format}`);
}

// ===== EQUALITY UTILITIES =====

/**
 * Deep equality comparison for value objects
 */
export function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  
  if (typeof a === 'object') {
    const aProps = Object.getOwnPropertyNames(a);
    const bProps = Object.getOwnPropertyNames(b);
    
    if (aProps.length !== bProps.length) return false;
    
    for (const prop of aProps) {
      if (!bProps.includes(prop)) return false;
      if (!deepEquals((a as any)[prop], (b as any)[prop])) return false;
    }
    
    return true;
  }
  
  return false;
}

/**
 * Creates a hash code for value object data
 */
export function createHashCode(data: BaseValueObjectData): number {
  const str = JSON.stringify(data, Object.keys(data).sort());
  let hash = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash);
}

// ===== COMMON VALIDATORS =====

/**
 * Validates that a value is not null or undefined
 */
export function validateRequired(
  value: unknown, 
  fieldName: string
): ValueObjectValidationResult {
  if (value == null || value === '') {
    return createFailureResult([`${fieldName} is required`]);
  }
  return createSuccessResult();
}

/**
 * Validates string length
 */
export function validateStringLength(
  value: string,
  minLength: number,
  maxLength: number,
  fieldName: string
): ValueObjectValidationResult {
  const errors: string[] = [];
  
  if (value.length < minLength) {
    errors.push(`${fieldName} must be at least ${minLength} characters`);
  }
  
  if (value.length > maxLength) {
    errors.push(`${fieldName} must not exceed ${maxLength} characters`);
  }
  
  return errors.length > 0 
    ? createFailureResult(errors)
    : createSuccessResult();
}

/**
 * Validates numeric range
 */
export function validateNumericRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): ValueObjectValidationResult {
  const errors: string[] = [];
  
  if (value < min) {
    errors.push(`${fieldName} must be at least ${min}`);
  }
  
  if (value > max) {
    errors.push(`${fieldName} must not exceed ${max}`);
  }
  
  return errors.length > 0 
    ? createFailureResult(errors)
    : createSuccessResult();
}

/**
 * Validates email format
 */
export function validateEmailFormat(
  email: string,
  fieldName: string = 'email'
): ValueObjectValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return createFailureResult([`${fieldName} must be a valid email address`]);
  }
  
  return createSuccessResult();
}

/**
 * Validates phone number format (basic)
 */
export function validatePhoneFormat(
  phone: string,
  fieldName: string = 'phone'
): ValueObjectValidationResult {
  // Basic international phone format validation
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  
  if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
    return createFailureResult([`${fieldName} must be a valid phone number`]);
  }
  
  return createSuccessResult();
}

// ===== FORMATTING UTILITIES =====

/**
 * Formats a currency amount with proper precision
 */
export function formatCurrency(
  amount: number,
  currency: Currency,
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: currency.decimalPlaces,
    maximumFractionDigits: currency.decimalPlaces
  }).format(amount);
}

/**
 * Formats a phone number for display
 */
export function formatPhoneNumber(
  phoneNumber: string,
  countryCode: string,
  format: 'national' | 'international' = 'national'
): string {
  // Simplified phone formatting - in real implementation would use a library
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  if (format === 'international') {
    return `+${countryCode} ${cleaned.substring(countryCode.length)}`;
  }
  
  // Basic US phone formatting as example
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
  }
  
  return phoneNumber;
}

/**
 * Formats an address for display
 */
export function formatAddress(
  street: string,
  city: string,
  state: string,
  postalCode: string,
  country: string,
  apartment?: string
): string {
  const parts: string[] = [];
  
  if (apartment) {
    parts.push(`${street}, ${apartment}`);
  } else {
    parts.push(street);
  }
  
  parts.push(`${city}, ${state} ${postalCode}`);
  
  if (country !== 'US') {
    parts.push(country);
  }
  
  return parts.join('\n');
}

// ===== GENERATION UTILITIES =====

/**
 * Generates a unique identifier
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Generates a timestamp
 */
export function generateTimestamp(): Date {
  return new Date();
}

/**
 * Creates a validation context with defaults
 */
export function createValidationContext(
  overrides: Partial<ValidationContext> = {}
): ValidationContext {
  return {
    locale: 'en-US',
    strict: true,
    customRules: [],
    metadata: {},
    ...overrides
  };
}

// ===== COMMON CURRENCIES =====

/**
 * Pre-defined common currencies
 */
export const COMMON_CURRENCIES: Map<string, Currency> = new Map([
  ['USD', { code: 'USD', symbol: '$', name: 'US Dollar', decimalPlaces: 2, isActive: true }],
  ['EUR', { code: 'EUR', symbol: '€', name: 'Euro', decimalPlaces: 2, isActive: true }],
  ['GBP', { code: 'GBP', symbol: '£', name: 'British Pound', decimalPlaces: 2, isActive: true }],
  ['JPY', { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimalPlaces: 0, isActive: true }],
  ['CAD', { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', decimalPlaces: 2, isActive: true }],
  ['AUD', { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimalPlaces: 2, isActive: true }],
  ['CHF', { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', decimalPlaces: 2, isActive: true }],
  ['CNY', { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', decimalPlaces: 2, isActive: true }]
]);

/**
 * Gets a currency by code
 */
export function getCurrency(code: string): Currency | undefined {
  return COMMON_CURRENCIES.get(code.toUpperCase());
}

/**
 * Validates currency code
 */
export function validateCurrencyCode(
  code: string,
  fieldName: string = 'currency'
): ValueObjectValidationResult {
  if (!getCurrency(code)) {
    return createFailureResult([`${fieldName} '${code}' is not a supported currency`]);
  }
  
  return createSuccessResult();
}

// ===== ERROR HANDLING UTILITIES =====

/**
 * Wraps value object creation with error handling
 */
export function safeCreate<T>(
  factory: () => T,
  errorMessage?: string
): T | Error {
  try {
    return factory();
  } catch (error) {
    if (error instanceof Error) {
      return new Error(errorMessage || error.message);
    }
    return new Error(errorMessage || 'Unknown error occurred');
  }
}

/**
 * Validates and throws if invalid
 */
export function validateOrThrow(
  result: ValueObjectValidationResult,
  errorMessage?: string
): void {
  if (!result.isValid) {
    const message = errorMessage || result.errors.join('; ');
    throw new Error(message);
  }
}

// ===== TYPE GUARDS =====

/**
 * Type guard for value object validation result
 */
export function isValidationResult(obj: unknown): obj is ValueObjectValidationResult {
  return typeof obj === 'object' 
    && obj !== null 
    && 'isValid' in obj 
    && 'errors' in obj
    && typeof (obj as any).isValid === 'boolean'
    && Array.isArray((obj as any).errors);
}

/**
 * Type guard for value object error
 */
export function isValueObjectError(obj: unknown): obj is ValueObjectError {
  return typeof obj === 'object'
    && obj !== null
    && 'code' in obj
    && 'message' in obj
    && typeof (obj as any).code === 'string'
    && typeof (obj as any).message === 'string';
}

/**
 * Type guard for base value object data
 */
export function isBaseValueObjectData(obj: unknown): obj is BaseValueObjectData {
  return typeof obj === 'object' && obj !== null;
}

// ===== EXPORT ALL UTILITIES =====

export * from '../types';