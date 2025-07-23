/**
 * @fileoverview Application-specific types for Aggregate examples
 * @version 1.0.0
 * @package @vytches-ddd/aggregates
 * @description Type definitions used in aggregate examples to maintain standalone functionality
 */

// ============================================
// BASIC TYPES
// ============================================

/**
 * Basic user aggregate types
 */
export interface UserData {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
}

export interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

// ============================================
// ORDER AGGREGATE TYPES
// ============================================

export interface OrderData {
  id: string;
  customerId: string;
  orderNumber: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  shippingAddress: Address;
  billingAddress?: Address;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}

export type OrderStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CreateOrderData {
  customerId: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
  shippingAddress: Address;
  billingAddress?: Address;
}

// ============================================
// PRODUCT AGGREGATE TYPES
// ============================================

export interface ProductData {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  inventory: number;
  isAvailable: boolean;
  images: string[];
  specifications: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductData {
  sku: string;
  name: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  inventory: number;
  images?: string[];
  specifications?: Record<string, any>;
}

// ============================================
// BANKING AGGREGATE TYPES
// ============================================

export interface BankAccountData {
  id: string;
  accountNumber: string;
  customerId: string;
  accountType: AccountType;
  balance: number;
  currency: string;
  status: AccountStatus;
  dailyWithdrawalLimit: number;
  overdraftLimit: number;
  transactions: Transaction[];
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

export type AccountType = 'checking' | 'savings' | 'business' | 'investment';
export type AccountStatus = 'active' | 'frozen' | 'closed' | 'suspended';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string;
  timestamp: Date;
  balance: number;
  metadata?: Record<string, any>;
}

export type TransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'fee' | 'interest';

export interface CreateBankAccountData {
  customerId: string;
  accountType: AccountType;
  currency: string;
  initialDeposit?: number;
  dailyWithdrawalLimit?: number;
  overdraftLimit?: number;
}

// ============================================
// LOAN AGGREGATE TYPES (ADVANCED)
// ============================================

export interface LoanApplicationData {
  id: string;
  applicationNumber: string;
  applicantId: string;
  loanType: LoanType;
  requestedAmount: number;
  currency: string;
  term: number; // months
  interestRate: number;
  status: LoanStatus;
  creditScore?: number;
  monthlyIncome?: number;
  existingDebts?: number;
  collateral?: Collateral[];
  approvalHistory: ApprovalStep[];
  disbursements: Disbursement[];
  repaymentSchedule?: RepaymentSchedule;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  closedAt?: Date;
}

export type LoanType = 'personal' | 'mortgage' | 'auto' | 'business' | 'student';
export type LoanStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'active'
  | 'defaulted'
  | 'closed';

export interface Collateral {
  type: string;
  description: string;
  estimatedValue: number;
  verificationStatus: 'pending' | 'verified' | 'rejected';
}

export interface ApprovalStep {
  step: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer?: string;
  comments?: string;
  timestamp: Date;
}

export interface Disbursement {
  amount: number;
  date: Date;
  method: string;
  reference: string;
}

export interface RepaymentSchedule {
  installments: RepaymentInstallment[];
  totalAmount: number;
  totalInterest: number;
}

export interface RepaymentInstallment {
  installmentNumber: number;
  dueDate: Date;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  status: 'pending' | 'paid' | 'overdue' | 'waived';
  paidDate?: Date;
  paidAmount?: number;
}

// ============================================
// EVENT SOURCED AGGREGATE TYPES
// ============================================

export interface ShoppingCartData {
  id: string;
  customerId: string;
  items: CartItem[];
  appliedCoupons: string[];
  totalAmount: number;
  currency: string;
  expiresAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  addedAt: Date;
}

// ============================================
// CAPABILITY TYPES
// ============================================

export interface AuditEntry {
  userId: string;
  action: string;
  timestamp: Date;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface Snapshot {
  aggregateId: string;
  version: number;
  state: any;
  timestamp: Date;
}

export interface VersionInfo {
  currentVersion: number;
  lastModifiedBy: string;
  lastModifiedAt: Date;
  versionHistory: Array<{
    version: number;
    modifiedBy: string;
    modifiedAt: Date;
    changes: string;
  }>;
}

// ============================================
// ADVANCED PATTERN TYPES
// ============================================

export interface ProcessInstance {
  id: string;
  processDefinitionId: string;
  state: ProcessState;
  currentStep: string;
  variables: Record<string, any>;
  history: ProcessHistoryEntry[];
  startedAt: Date;
  completedAt?: Date;
  error?: ProcessError;
}

export interface ProcessState {
  status: 'running' | 'completed' | 'failed' | 'suspended';
  currentActivity: string;
  completedActivities: string[];
  pendingActivities: string[];
}

export interface ProcessHistoryEntry {
  activity: string;
  status: 'started' | 'completed' | 'failed';
  timestamp: Date;
  actor?: string;
  data?: Record<string, any>;
}

export interface ProcessError {
  code: string;
  message: string;
  activity: string;
  timestamp: Date;
  stackTrace?: string;
}

// ============================================
// FRAMEWORK-SPECIFIC TYPES
// ============================================

export interface ServiceContext {
  userId: string;
  tenantId?: string;
  correlationId: string;
  requestId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  aggregateId?: string;
  version?: number;
  events?: any[];
}

export interface QueryResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// ============================================
// PERFORMANCE AND MONITORING TYPES
// ============================================

export interface AggregateMetrics {
  aggregateType: string;
  aggregateId: string;
  operationsCount: number;
  eventsCount: number;
  lastOperationTime: number;
  averageOperationTime: number;
  errorRate: number;
  lastError?: Error;
  lastSnapshot?: Date;
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  aggregateType: string;
  aggregateId: string;
  eventCount?: number;
  error?: string;
}

// ============================================
// TESTING SUPPORT TYPES
// ============================================

export interface TestScenario {
  name: string;
  description: string;
  given: any; // Initial state
  when: any; // Command/operation
  then: any; // Expected outcome
  events?: any[]; // Expected events
}

export interface AggregateTestContext {
  aggregateId: string;
  userId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}
