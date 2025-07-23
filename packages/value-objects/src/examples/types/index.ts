/**
 * @fileoverview Type definitions for Value Objects examples
 *
 * This module provides comprehensive type definitions for all value object
 * examples, ensuring type safety and preventing circular dependencies.
 * All examples import types from this central location.
 */

import type { EntityId } from '@vytches-ddd/contracts';

// ===== BASE VALUE OBJECT TYPES =====

export interface BaseValueObjectData {
  readonly [key: string]: unknown;
}

export interface ValueObjectValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface SerializationOptions {
  includeTypeInfo?: boolean;
  format?: 'json' | 'binary' | 'xml';
  compression?: boolean;
}

// ===== MONEY VALUE OBJECT =====

export interface MoneyData {
  readonly amount: number;
  readonly currency: string;
  readonly precision?: number;
}

export interface Currency {
  readonly code: string;
  readonly symbol: string;
  readonly name: string;
  readonly decimalPlaces: number;
  readonly isActive: boolean;
}

export interface ExchangeRate {
  readonly fromCurrency: string;
  readonly toCurrency: string;
  readonly rate: number;
  readonly timestamp: Date;
  readonly source: string;
}

export interface MoneyCalculationResult {
  readonly result: MoneyData;
  readonly operations: string[];
  readonly exchangeRatesUsed?: ExchangeRate[];
}

// ===== EMAIL VALUE OBJECT =====

export interface EmailData {
  readonly address: string;
  readonly domain: string;
  readonly localPart: string;
  readonly isVerified?: boolean;
}

export interface EmailValidationConfig {
  allowInternational: boolean;
  maxLength: number;
  blockedDomains: string[];
  requireTLD: boolean;
  allowSubdomains: boolean;
}

// ===== ADDRESS VALUE OBJECT =====

export interface AddressData {
  readonly street: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
  readonly apartment?: string;
  readonly coordinates?: GeographicCoordinates;
}

export interface GeographicCoordinates {
  readonly latitude: number;
  readonly longitude: number;
  readonly altitude?: number;
  readonly accuracy?: number;
}

export interface AddressValidationResult extends ValueObjectValidationResult {
  standardizedAddress?: AddressData;
  confidence: number;
  validationSource: string;
}

// ===== DATE RANGE VALUE OBJECT =====

export interface DateRangeData {
  readonly startDate: Date;
  readonly endDate: Date;
  readonly timezone?: string;
  readonly inclusive?: boolean;
}

export interface DateRangeCalculation {
  readonly durationDays: number;
  readonly durationHours: number;
  readonly includesWeekends: boolean;
  readonly businessDays: number;
  readonly holidays?: Date[];
}

// ===== PHONE NUMBER VALUE OBJECT =====

export interface PhoneNumberData {
  readonly number: string;
  readonly countryCode: string;
  readonly nationalNumber: string;
  readonly extension?: string;
  readonly type: PhoneType;
}

export type PhoneType = 'mobile' | 'landline' | 'toll-free' | 'premium' | 'voip' | 'unknown';

export interface PhoneNumberValidationConfig {
  defaultCountry: string;
  allowedRegions: string[];
  enableLengthValidation: boolean;
  enableFormatValidation: boolean;
}

// ===== COMPLEX VALUE OBJECTS =====

export interface PersonNameData {
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName?: string;
  readonly title?: string;
  readonly suffix?: string;
  readonly preferredName?: string;
}

export interface PersonNameFormatOptions {
  includeTitle: boolean;
  includeMiddleName: boolean;
  includeSuffix: boolean;
  format: 'full' | 'last-first' | 'first-last' | 'initials';
  locale?: string;
}

// ===== MEASUREMENT VALUE OBJECTS =====

export interface MeasurementData {
  readonly value: number;
  readonly unit: string;
  readonly precision?: number;
  readonly metadata?: MeasurementMetadata;
}

export interface MeasurementMetadata {
  readonly measurementDate: Date;
  readonly instrument?: string;
  readonly operator?: string;
  readonly environment?: EnvironmentData;
  readonly uncertainty?: number;
}

export interface EnvironmentData {
  readonly temperature: number;
  readonly humidity: number;
  readonly pressure?: number;
}

export interface UnitConversionResult {
  readonly originalValue: MeasurementData;
  readonly convertedValue: MeasurementData;
  readonly conversionFactor: number;
  readonly accuracy: number;
}

// ===== ADVANCED VALUE OBJECTS =====

export interface CryptographicHashData {
  readonly value: string;
  readonly algorithm: HashAlgorithm;
  readonly salt?: string;
  readonly iterations?: number;
  readonly keyLength?: number;
}

export type HashAlgorithm = 'SHA256' | 'SHA512' | 'BCRYPT' | 'SCRYPT' | 'ARGON2';

export interface VersionData {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly preRelease?: string;
  readonly build?: string;
}

export interface VersionComparison {
  readonly result: ComparisonResult;
  readonly difference: VersionDifference;
}

export type ComparisonResult = 'equal' | 'greater' | 'less';

export interface VersionDifference {
  readonly majorDiff: number;
  readonly minorDiff: number;
  readonly patchDiff: number;
  readonly isBreakingChange: boolean;
}

// ===== COMPOSITE VALUE OBJECTS =====

export interface UserProfileData {
  readonly personalInfo: PersonNameData;
  readonly email: EmailData;
  readonly phoneNumber?: PhoneNumberData;
  readonly address?: AddressData;
  readonly preferences: UserPreferences;
  readonly metadata: ProfileMetadata;
}

export interface UserPreferences {
  readonly language: string;
  readonly timezone: string;
  readonly currency: string;
  readonly notifications: NotificationPreferences;
  readonly privacy: PrivacySettings;
}

export interface NotificationPreferences {
  readonly email: boolean;
  readonly sms: boolean;
  readonly push: boolean;
  readonly frequency: 'immediate' | 'daily' | 'weekly' | 'never';
}

export interface PrivacySettings {
  readonly profileVisibility: 'public' | 'private' | 'friends';
  readonly dataSharing: boolean;
  readonly analytics: boolean;
  readonly marketing: boolean;
}

export interface ProfileMetadata {
  readonly createdAt: Date;
  readonly lastUpdatedAt: Date;
  readonly version: number;
  readonly source: string;
}

// ===== FINANCIAL VALUE OBJECTS =====

export interface AccountNumberData {
  readonly number: string;
  readonly bankCode: string;
  readonly branchCode?: string;
  readonly checkDigit?: string;
  readonly type: AccountType;
}

export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'loan';

export interface CreditCardData {
  readonly number: string;
  readonly expiryMonth: number;
  readonly expiryYear: number;
  readonly cvv: string;
  readonly brand: CardBrand;
  readonly holderName: string;
}

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';

export interface PaymentMethodData {
  readonly type: PaymentType;
  readonly accountNumber?: AccountNumberData;
  readonly creditCard?: CreditCardData;
  readonly digitalWallet?: DigitalWalletData;
}

export type PaymentType = 'bank_account' | 'credit_card' | 'digital_wallet' | 'cash';

export interface DigitalWalletData {
  readonly provider: string;
  readonly accountId: string;
  readonly metadata?: Record<string, unknown>;
}

// ===== BUSINESS VALUE OBJECTS =====

export interface BusinessIdentifierData {
  readonly type: BusinessIdType;
  readonly value: string;
  readonly issuingAuthority: string;
  readonly country: string;
  readonly validFrom: Date;
  readonly validUntil?: Date;
}

export type BusinessIdType = 'tax_id' | 'vat_number' | 'registration_number' | 'duns' | 'lei';

export interface ProductSkuData {
  readonly sku: string;
  readonly category: string;
  readonly subcategory?: string;
  readonly version?: string;
  readonly variant?: string;
  readonly metadata?: SkuMetadata;
}

export interface SkuMetadata {
  readonly brand: string;
  readonly model?: string;
  readonly color?: string;
  readonly size?: string;
  readonly weight?: MeasurementData;
  readonly dimensions?: DimensionsData;
}

export interface DimensionsData {
  readonly length: number;
  readonly width: number;
  readonly height: number;
  readonly unit: string;
}

// ===== DOMAIN EVENT VALUE OBJECTS =====

export interface EventMetadataData {
  readonly eventId: EntityId;
  readonly eventType: string;
  readonly aggregateId: EntityId;
  readonly aggregateType: string;
  readonly version: number;
  readonly timestamp: Date;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly userId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface EventPayloadData {
  readonly data: Record<string, unknown>;
  readonly schema: SchemaInfo;
  readonly serialization: SerializationInfo;
}

export interface SchemaInfo {
  readonly name: string;
  readonly version: string;
  readonly checksum: string;
}

export interface SerializationInfo {
  readonly format: 'json' | 'avro' | 'protobuf';
  readonly compression?: string;
  readonly encoding: string;
}

// ===== ERROR AND VALIDATION TYPES =====

export interface ValueObjectError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
  readonly value?: unknown;
  readonly metadata?: Record<string, unknown>;
}

export interface ValidationContext {
  readonly locale?: string;
  readonly strict?: boolean;
  readonly customRules?: ValidationRule[];
  readonly metadata?: Record<string, unknown>;
}

export interface ValidationRule {
  readonly name: string;
  readonly validator: (value: unknown) => boolean | Promise<boolean>;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

// ===== CONFIGURATION AND OPTIONS =====

export interface ValueObjectConfig {
  readonly enableValidation: boolean;
  readonly enableSerialization: boolean;
  readonly enableCaching: boolean;
  readonly enableMetrics: boolean;
  readonly validationConfig?: ValidationContext;
  readonly serializationOptions?: SerializationOptions;
  readonly cacheConfig?: CacheConfig;
}

export interface CacheConfig {
  readonly enabled: boolean;
  readonly ttl: number;
  readonly maxSize: number;
  readonly keyGenerator?: (data: unknown) => string;
}

// ===== UTILITY TYPES =====

export type ValueObjectFactory<T extends BaseValueObjectData> = (data: T) => unknown;

export type ValueObjectComparator<T> = (a: T, b: T) => ComparisonResult;

export type ValueObjectSerializer<T> = (
  value: T,
  options?: SerializationOptions
) => string | Buffer;

export type ValueObjectDeserializer<T> = (
  data: string | Buffer,
  options?: SerializationOptions
) => T;

// ===== EXPORT UTILITIES =====

export function createValueObjectError(
  code: string,
  message: string,
  field?: string,
  value?: unknown
): ValueObjectError {
  return { code, message, field: field || '', value };
}

export function isValidationResult(obj: unknown): obj is ValueObjectValidationResult {
  return typeof obj === 'object' && obj !== null && 'isValid' in obj && 'errors' in obj;
}

export function createValidationContext(
  options: Partial<ValidationContext> = {}
): ValidationContext {
  return {
    locale: options.locale || 'en-US',
    strict: options.strict ?? true,
    customRules: options.customRules || [],
    metadata: options.metadata || {},
  };
}
