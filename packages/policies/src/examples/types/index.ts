// Application types for Policies package examples
// These types represent typical business entities used in policy validation scenarios

/**
 * User entity representing system users with roles and profiles
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'moderator' | 'premium';
  status: 'active' | 'inactive' | 'suspended';
  profile: UserProfile;
  preferences: UserPreferences;
  subscription?: UserSubscription;
  createdAt: Date;
  updatedAt?: Date;
  version: number;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  bio?: string;
  location?: string;
  phoneNumber?: string;
  avatar?: string;
  dateOfBirth?: Date;
  creditScore?: number;
}

export interface UserPreferences {
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  language: string;
  timezone: string;
  theme: 'light' | 'dark' | 'auto';
}

export interface UserSubscription {
  plan: 'free' | 'basic' | 'premium' | 'enterprise';
  status: 'active' | 'canceled' | 'expired';
  startDate: Date;
  endDate?: Date;
  features: string[];
}

/**
 * Order entity for e-commerce policy validation scenarios
 */
export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'canceled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  shippingAddress: Address;
  billingAddress: Address;
  createdAt: Date;
  updatedAt?: Date;
  version: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Financial transaction entities for compliance and risk policies
 */
export interface Transaction {
  id: string;
  accountId: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'payment';
  amount: number;
  currency: string;
  fromAccount?: string;
  toAccount?: string;
  description: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  riskScore?: number;
  metadata: TransactionMetadata;
  createdAt: Date;
  processedAt?: Date;
  version: number;
}

export interface TransactionMetadata {
  ipAddress?: string;
  userAgent?: string;
  geolocation?: {
    country: string;
    region: string;
    city: string;
  };
  deviceFingerprint?: string;
  channel: 'web' | 'mobile' | 'api' | 'atm';
}

export interface Account {
  id: string;
  userId: string;
  type: 'checking' | 'savings' | 'credit' | 'investment';
  balance: number;
  currency: string;
  status: 'active' | 'suspended' | 'closed';
  dailyTransactionLimit: number;
  monthlyTransactionLimit: number;
  createdAt: Date;
  lastActivity?: Date;
  version: number;
}

/**
 * Loan application for complex business rule validation
 */
export interface LoanApplication {
  id: string;
  applicantId: string;
  type: 'personal' | 'mortgage' | 'auto' | 'business';
  amount: number;
  term: number; // months
  purpose: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'funded';
  applicantInfo: LoanApplicant;
  financialInfo: FinancialInfo;
  collateral?: Collateral;
  creditScore: number;
  riskAssessment?: RiskAssessment;
  submittedAt?: Date;
  processedAt?: Date;
  version: number;
}

export interface LoanApplicant {
  name: string;
  email: string;
  phone: string;
  address: Address;
  dateOfBirth: Date;
  ssn: string;
  employment: EmploymentInfo;
}

export interface EmploymentInfo {
  status: 'employed' | 'self-employed' | 'unemployed' | 'retired';
  employer?: string;
  position?: string;
  annualIncome: number;
  yearsAtJob: number;
}

export interface FinancialInfo {
  annualIncome: number;
  monthlyExpenses: number;
  existingDebts: number;
  assets: number;
  bankAccountBalance: number;
}

export interface Collateral {
  type: 'real-estate' | 'vehicle' | 'securities' | 'other';
  value: number;
  description: string;
  appraisalDate?: Date;
}

export interface RiskAssessment {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  recommendations: string[];
}

/**
 * Content entity for content management policies
 */
export interface Content {
  id: string;
  authorId: string;
  title: string;
  body: string;
  type: 'article' | 'video' | 'image' | 'document';
  category: string;
  tags: string[];
  status: 'draft' | 'pending_review' | 'approved' | 'published' | 'rejected' | 'archived';
  visibility: 'public' | 'private' | 'premium' | 'restricted';
  contentRating: 'G' | 'PG' | 'PG-13' | 'R' | 'adult';
  metadata: ContentMetadata;
  moderationInfo?: ModerationInfo;
  createdAt: Date;
  publishedAt?: Date;
  updatedAt?: Date;
  version: number;
}

export interface ContentMetadata {
  wordCount?: number;
  duration?: number; // for video/audio
  fileSize?: number;
  dimensions?: {
    width: number;
    height: number;
  };
  format?: string;
  language: string;
}

export interface ModerationInfo {
  moderatorId: string;
  reviewedAt: Date;
  decision: 'approved' | 'rejected' | 'flagged';
  reason?: string;
  notes?: string;
}

/**
 * Policy validation result types
 */
export interface PolicyViolation {
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  field?: string;
  value?: any;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
  details?: Record<string, any>;
}

export interface PolicyResult<T = any> {
  success: boolean;
  data?: T;
  violations?: PolicyViolation[];
  error?: string;
  metadata?: {
    policyId?: string;
    executionTime?: number;
    correlationId?: string;
    timestamp?: Date;
  };
}

/**
 * Policy context for evaluation
 */
export interface PolicyContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  environment?: 'development' | 'staging' | 'production';
  tenant?: string;
  features?: string[];
  metadata?: Record<string, any>;
}

/**
 * Policy configuration and runtime types
 */
export interface PolicyConfiguration {
  enabled: boolean;
  priority: number;
  tags: string[];
  conditions?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface PolicyExecutionContext {
  entity: any;
  context: PolicyContext;
  configuration?: PolicyConfiguration;
  cache?: PolicyCache;
}

export interface PolicyCache {
  enabled: boolean;
  ttl: number;
  key: string;
  namespace?: string;
}

/**
 * Business rule specifications
 */
export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  condition: string | Function;
  errorMessage: string;
  errorCode: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  enabled: boolean;
  metadata?: Record<string, any>;
}

export interface ComplianceRule extends BusinessRule {
  regulation: string;
  jurisdiction: string;
  effectiveDate: Date;
  expirationDate?: Date;
  documentationUrl?: string;
}

/**
 * Audit and logging types
 */
export interface PolicyAuditLog {
  id: string;
  policyId: string;
  entityId: string;
  entityType: string;
  result: 'success' | 'violation' | 'error';
  violations: PolicyViolation[];
  context: PolicyContext;
  executionTime: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * External service integration types
 */
export interface ExternalValidationRequest {
  entityType: string;
  entityId: string;
  data: any;
  validationType: string;
  context: PolicyContext;
}

export interface ExternalValidationResponse {
  valid: boolean;
  violations: PolicyViolation[];
  metadata?: Record<string, any>;
  externalId?: string;
}

/**
 * Multi-tenant support types
 */
export interface TenantConfiguration {
  tenantId: string;
  policies: string[];
  customRules: BusinessRule[];
  features: string[];
  limits: {
    maxUsers: number;
    maxTransactions: number;
    apiCallsPerHour: number;
  };
  compliance: {
    regulations: string[];
    dataRetention: number; // days
    auditRequired: boolean;
  };
}

/**
 * Integration with other packages
 */
export interface SpecificationResult<T = any> {
  isSatisfied: boolean;
  entity: T;
  reasons?: string[];
  metadata?: Record<string, any>;
}

export interface ValidationResult<T = any> {
  isValid: boolean;
  data: T;
  errors: ValidationError[];
  warnings?: ValidationError[];
  metadata?: Record<string, any>;
}

// All types are already exported above as interfaces