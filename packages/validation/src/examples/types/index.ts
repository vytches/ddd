// Application-specific types for Validation examples
// These types represent your application's domain entities and validation contexts

// Core domain entities
export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  age: number;
  dateOfBirth: Date;
  phoneNumber: string;
  address: Address;
  preferences: UserPreferences;
  accountStatus: AccountStatus;
  registrationDate: Date;
  lastLoginDate?: Date;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface UserPreferences {
  language: string;
  timezone: string;
  currency: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  marketingConsent: boolean;
}

export type AccountStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  sku: string;
  weight: number;
  dimensions: ProductDimensions;
  availability: ProductAvailability;
  tags: string[];
  attributes: ProductAttribute[];
  createdDate: Date;
  updatedDate: Date;
}

export interface ProductDimensions {
  length: number;
  width: number;
  height: number;
  unit: 'cm' | 'in';
}

export interface ProductAvailability {
  inStock: boolean;
  quantity: number;
  minStockLevel: number;
  maxStockLevel: number;
  reservedQuantity: number;
}

export interface ProductAttribute {
  name: string;
  value: string;
  type: 'text' | 'number' | 'boolean' | 'color' | 'size';
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  shippingAddress: Address;
  billingAddress: Address;
  orderDate: Date;
  requiredDate?: Date;
  shippedDate?: Date;
  deliveredDate?: Date;
  notes?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
  specifications?: Record<string, string>;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export interface PaymentMethod {
  type: 'credit_card' | 'debit_card' | 'bank_transfer' | 'digital_wallet' | 'cash_on_delivery';
  details: PaymentDetails;
}

export interface PaymentDetails {
  cardNumber?: string;
  cardholderName?: string;
  expiryDate?: string;
  cvv?: string;
  bankAccount?: string;
  routingNumber?: string;
  walletId?: string;
}

// Validation-specific types
export interface ValidationContext {
  userId?: string;
  tenantId?: string;
  operationType: 'create' | 'update' | 'delete' | 'bulk_import';
  environment: 'development' | 'staging' | 'production';
  businessRules?: Record<string, any>;
  validationLevel: 'basic' | 'standard' | 'strict' | 'enterprise';
  locale?: string;
  timezone?: string;
}

export interface ValidationRequest<T> {
  entity: T;
  context: ValidationContext;
  additionalData?: Record<string, any>;
  skipRules?: string[];
  includeWarnings?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata: ValidationMetadata;
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'critical';
  details?: Record<string, any>;
  context?: string;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  suggestion?: string;
  context?: string;
}

export interface ValidationMetadata {
  validatedAt: Date;
  validationDuration: number;
  rulesApplied: string[];
  skippedRules: string[];
  validatorVersion: string;
  context: ValidationContext;
}

// Business rule types
export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  category: string;
  priority: number;
  isActive: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  effectiveDate?: Date;
  expirationDate?: Date;
}

export interface RuleCondition {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'greater_than'
    | 'less_than'
    | 'contains'
    | 'regex'
    | 'in'
    | 'not_in';
  value: any;
  logicalOperator?: 'and' | 'or';
}

export interface RuleAction {
  type: 'validate' | 'transform' | 'enrich' | 'reject' | 'warn';
  parameters: Record<string, any>;
}

// Specification types
export interface SpecificationResult {
  isSatisfied: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface CompositeSpecificationResult {
  isSatisfied: boolean;
  results: Map<string, SpecificationResult>;
  aggregatedReason?: string;
}

// Data quality types
export interface DataQualityMetrics {
  completeness: number;
  accuracy: number;
  consistency: number;
  validity: number;
  uniqueness: number;
  timeliness: number;
  overallScore: number;
}

export interface DataQualityReport {
  entityType: string;
  entityId: string;
  metrics: DataQualityMetrics;
  issues: DataQualityIssue[];
  recommendations: string[];
  assessedAt: Date;
}

export interface DataQualityIssue {
  field: string;
  issueType: 'missing' | 'invalid' | 'inconsistent' | 'duplicate' | 'outdated';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestedFix?: string;
}

// Validation configuration types
export interface ValidationConfig {
  strictMode: boolean;
  asyncValidation: boolean;
  cacheResults: boolean;
  cacheTtl: number;
  maxValidationTime: number;
  enableMetrics: boolean;
  customRules: Record<string, CustomRuleDefinition>;
  localization: LocalizationConfig;
}

export interface CustomRuleDefinition {
  name: string;
  description: string;
  implementation: string;
  parameters: Record<string, any>;
  priority: number;
}

export interface LocalizationConfig {
  defaultLocale: string;
  supportedLocales: string[];
  messageTemplates: Record<string, Record<string, string>>;
}

// Integration types
export interface ExternalValidationRequest {
  entity: any;
  validationType: string;
  provider: string;
  configuration: Record<string, any>;
  timeout?: number;
}

export interface ExternalValidationResponse {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score?: number;
  provider: string;
  processedAt: Date;
  responseTime: number;
}

// Batch validation types
export interface BatchValidationRequest<T> {
  entities: T[];
  context: ValidationContext;
  batchSize?: number;
  parallelProcessing?: boolean;
  continueOnError?: boolean;
}

export interface BatchValidationResult<T> {
  totalProcessed: number;
  validEntities: T[];
  invalidEntities: Array<{ entity: T; errors: ValidationError[] }>;
  processingTime: number;
  batchMetadata: BatchMetadata;
}

export interface BatchMetadata {
  batchId: string;
  startTime: Date;
  endTime: Date;
  batchSize: number;
  successRate: number;
  averageValidationTime: number;
}

// Policy integration types
export interface ValidationPolicy {
  id: string;
  name: string;
  description: string;
  entityType: string;
  rules: PolicyRule[];
  conditions: PolicyCondition[];
  isActive: boolean;
  priority: number;
  effectiveDate?: Date;
  expirationDate?: Date;
}

export interface PolicyRule {
  field: string;
  validationType: string;
  parameters: Record<string, any>;
  errorMessage: string;
  warningMessage?: string;
}

export interface PolicyCondition {
  field: string;
  operator: string;
  value: any;
  context?: string;
}

// Event types for validation
export interface ValidationEvent {
  eventType:
    | 'validation_started'
    | 'validation_completed'
    | 'validation_failed'
    | 'rule_applied'
    | 'policy_evaluated';
  entityType: string;
  entityId: string;
  validationId: string;
  timestamp: Date;
  details: Record<string, any>;
}

// Performance monitoring types
export interface ValidationMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  averageValidationTime: number;
  slowestValidations: Array<{ entityId: string; duration: number }>;
  mostFailedRules: Array<{ ruleName: string; failureCount: number }>;
  periodStart: Date;
  periodEnd: Date;
}

// Import/export types
export interface ValidationRulesExport {
  version: string;
  exportedAt: Date;
  rules: BusinessRule[];
  policies: ValidationPolicy[];
  customRules: CustomRuleDefinition[];
  configuration: ValidationConfig;
}

export interface ValidationRulesImport {
  source: ValidationRulesExport;
  importOptions: {
    overwriteExisting: boolean;
    validateBeforeImport: boolean;
    backupCurrent: boolean;
    dryRun: boolean;
  };
}
