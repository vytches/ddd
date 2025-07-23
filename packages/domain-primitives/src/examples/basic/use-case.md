# Basic Domain Primitives Use Cases

**Version**: 2025-01-21  
**Package**: @vytches-ddd/domain-primitives  
**Complexity**: Basic  
**Category**: Use Cases

## Overview

Real-world use cases demonstrating how domain primitives form the foundation of robust applications across different industries.

## E-Commerce Platform

### Scenario
An online marketplace needs to track all operations for compliance, handle various error scenarios gracefully, and maintain clear domain boundaries.

```typescript
import {
  IDomainError,
  DomainErrorCode,
  IActor,
  DefaultActorType,
  NotFoundError,
  InvalidParameterError
} from '@vytches-ddd/domain-primitives';
import { UserData, AuditEntry } from '../types';

// Domain-specific errors for e-commerce
export class ProductNotAvailableError extends IDomainError {
  constructor(productId: string, reason: string) {
    super(`Product ${productId} is not available: ${reason}`, {
      code: DomainErrorCode.BusinessRule,
      domain: 'ProductCatalog',
      data: { productId, reason }
    });
  }
}

export class PaymentFailedError extends IDomainError {
  constructor(orderId: string, paymentMethod: string, reason: string) {
    super(`Payment failed for order ${orderId}`, {
      code: DomainErrorCode.ExternalService,
      domain: 'PaymentProcessing',
      data: { orderId, paymentMethod, reason }
    });
  }
}

export class ShippingAddressInvalidError extends InvalidParameterError {
  constructor(field: string, issue: string) {
    super(`Invalid shipping address: ${field} - ${issue}`, {
      code: DomainErrorCode.InvalidParameter,
      domain: 'Shipping',
      data: { field, issue }
    });
  }
}

// E-commerce specific actors
export class CustomerActor implements IActor {
  type = DefaultActorType.USER;
  source: string;
  id: string;
  metadata: Record<string, unknown>;

  constructor(customer: {
    id: string;
    email: string;
    tier: 'regular' | 'premium' | 'vip';
    location: string;
  }) {
    this.id = customer.id;
    this.source = 'web-store';
    this.metadata = {
      email: customer.email,
      tier: customer.tier,
      location: customer.location,
      sessionStart: new Date()
    };
  }
}

export class MerchantActor implements IActor {
  type = 'merchant';
  source: string;
  id: string;
  metadata: Record<string, unknown>;

  constructor(merchant: {
    id: string;
    storeName: string;
    category: string;
  }) {
    this.id = merchant.id;
    this.source = 'merchant-portal';
    this.metadata = {
      storeName: merchant.storeName,
      category: merchant.category
    };
  }
}

// E-commerce service with full tracking
export class ECommerceOrderService {
  constructor(
    private auditService: AuditService,
    private inventoryService: InventoryService,
    private paymentService: PaymentService
  ) {}

  async placeOrder(
    items: Array<{ productId: string; quantity: number; price: number }>,
    shippingAddress: ShippingAddress,
    paymentMethod: PaymentMethod,
    actor: CustomerActor
  ): Promise<{ orderId: string; status: string }> {
    const orderId = this.generateOrderId();

    try {
      // Validate shipping address
      this.validateShippingAddress(shippingAddress);

      // Check inventory for all items
      for (const item of items) {
        const available = await this.inventoryService.checkAvailability(
          item.productId,
          item.quantity
        );
        
        if (!available) {
          throw new ProductNotAvailableError(
            item.productId,
            'Insufficient stock'
          );
        }
      }

      // Calculate total
      const total = items.reduce((sum, item) => 
        sum + (item.quantity * item.price), 0
      );

      // Process payment
      const paymentResult = await this.paymentService.processPayment({
        orderId,
        amount: total,
        method: paymentMethod,
        customerId: actor.id
      });

      if (!paymentResult.success) {
        throw new PaymentFailedError(
          orderId,
          paymentMethod.type,
          paymentResult.reason || 'Unknown error'
        );
      }

      // Reserve inventory
      await this.inventoryService.reserveItems(orderId, items);

      // Record successful order
      await this.auditService.recordAction(
        actor,
        'PLACE_ORDER',
        `order:${orderId}`,
        {
          items: items.length,
          total,
          paymentMethod: paymentMethod.type,
          shippingCountry: shippingAddress.country
        }
      );

      return {
        orderId,
        status: 'confirmed'
      };

    } catch (error) {
      // Record failed order attempt
      await this.auditService.recordFailedAction(
        actor,
        'PLACE_ORDER',
        `order:${orderId}`,
        error as Error
      );

      // Rollback any reservations
      await this.inventoryService.releaseReservation(orderId);

      throw error;
    }
  }

  private validateShippingAddress(address: ShippingAddress): void {
    if (!address.street || address.street.length < 5) {
      throw new ShippingAddressInvalidError('street', 'Too short');
    }
    if (!address.city || address.city.length < 2) {
      throw new ShippingAddressInvalidError('city', 'Required');
    }
    if (!address.postalCode || !this.isValidPostalCode(address.postalCode)) {
      throw new ShippingAddressInvalidError('postalCode', 'Invalid format');
    }
    if (!this.isSupportedCountry(address.country)) {
      throw new ShippingAddressInvalidError('country', 'Not supported');
    }
  }

  private isValidPostalCode(code: string): boolean {
    // Simple validation - real implementation would be country-specific
    return /^[A-Z0-9\s-]{3,10}$/i.test(code);
  }

  private isSupportedCountry(country: string): boolean {
    const supported = ['US', 'CA', 'UK', 'DE', 'FR', 'ES', 'IT'];
    return supported.includes(country);
  }

  private generateOrderId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Healthcare System

### Scenario
A healthcare platform needs strict audit trails for compliance, detailed error handling for patient safety, and role-based actor tracking.

```typescript
// Healthcare-specific errors
export class PatientNotFoundError extends NotFoundError {
  constructor(patientId: string) {
    super(`Patient record ${patientId} not found`, {
      code: DomainErrorCode.NotFound,
      domain: 'PatientRecords',
      data: { patientId, timestamp: new Date() }
    });
  }
}

export class MedicationConflictError extends IDomainError {
  constructor(
    patientId: string,
    newMedication: string,
    conflictingMedication: string
  ) {
    super(`Medication conflict detected for patient ${patientId}`, {
      code: DomainErrorCode.BusinessRule,
      domain: 'Prescriptions',
      data: {
        patientId,
        newMedication,
        conflictingMedication,
        severity: 'high'
      }
    });
  }
}

export class UnauthorizedAccessError extends IDomainError {
  constructor(actorId: string, resource: string, action: string) {
    super(`Unauthorized access attempt`, {
      code: DomainErrorCode.Unauthorized,
      domain: 'Security',
      data: { actorId, resource, action }
    });
  }
}

// Healthcare actors
export class HealthcareProviderActor implements IActor {
  type = 'healthcare_provider';
  source: string;
  id: string;
  metadata: Record<string, unknown>;

  constructor(provider: {
    id: string;
    name: string;
    license: string;
    specialization: string;
    facility: string;
  }) {
    this.id = provider.id;
    this.source = 'ehr-system';
    this.metadata = {
      name: provider.name,
      license: provider.license,
      specialization: provider.specialization,
      facility: provider.facility,
      accessTime: new Date()
    };
  }
}

export class PatientActor implements IActor {
  type = 'patient';
  source: string;
  id: string;
  metadata: Record<string, unknown>;

  constructor(patient: {
    id: string;
    consentGiven: boolean;
  }) {
    this.id = patient.id;
    this.source = 'patient-portal';
    this.metadata = {
      consentGiven: patient.consentGiven,
      accessTime: new Date()
    };
  }
}

// Healthcare service with compliance tracking
export class PatientRecordService {
  constructor(
    private auditService: HealthcareAuditService,
    private authorizationService: AuthorizationService
  ) {}

  async updatePatientRecord(
    patientId: string,
    updates: PatientRecordUpdate,
    actor: IActor
  ): Promise<void> {
    try {
      // Check authorization
      const authorized = await this.authorizationService.canAccess(
        actor,
        'patient_record',
        'update'
      );

      if (!authorized) {
        throw new UnauthorizedAccessError(
          actor.id,
          `patient_record:${patientId}`,
          'update'
        );
      }

      // Validate patient exists
      const patient = await this.findPatient(patientId);
      if (!patient) {
        throw new PatientNotFoundError(patientId);
      }

      // Check for medication conflicts if updating prescriptions
      if (updates.prescriptions) {
        await this.checkMedicationConflicts(
          patientId,
          updates.prescriptions
        );
      }

      // Apply updates (simplified)
      await this.applyUpdates(patientId, updates);

      // Record successful update with HIPAA compliance
      await this.auditService.recordHealthcareAction(
        actor,
        'UPDATE_PATIENT_RECORD',
        `patient:${patientId}`,
        {
          fieldsUpdated: Object.keys(updates),
          // Don't log actual values for privacy
          updateType: this.categorizeUpdate(updates)
        },
        'HIPAA_COMPLIANT'
      );

    } catch (error) {
      // Record failed attempt
      await this.auditService.recordHealthcareAction(
        actor,
        'UPDATE_PATIENT_RECORD_FAILED',
        `patient:${patientId}`,
        { error: (error as Error).message },
        'SECURITY_ALERT'
      );
      throw error;
    }
  }

  async prescribeMedication(
    patientId: string,
    medication: MedicationPrescription,
    actor: HealthcareProviderActor
  ): Promise<string> {
    const prescriptionId = this.generatePrescriptionId();

    try {
      // Verify provider can prescribe
      if (!this.canPrescribe(actor)) {
        throw new UnauthorizedAccessError(
          actor.id,
          'prescriptions',
          'create'
        );
      }

      // Check patient allergies and interactions
      const conflicts = await this.checkMedicationSafety(
        patientId,
        medication
      );

      if (conflicts.length > 0) {
        throw new MedicationConflictError(
          patientId,
          medication.name,
          conflicts[0].conflictingMedication
        );
      }

      // Create prescription
      await this.createPrescription(prescriptionId, patientId, medication);

      // Detailed audit for controlled substances
      const auditLevel = this.isControlledSubstance(medication.name) 
        ? 'DEA_REPORTING' 
        : 'STANDARD';

      await this.auditService.recordHealthcareAction(
        actor,
        'PRESCRIBE_MEDICATION',
        `prescription:${prescriptionId}`,
        {
          patientId,
          medication: medication.name,
          dosage: medication.dosage,
          duration: medication.duration
        },
        auditLevel
      );

      return prescriptionId;

    } catch (error) {
      await this.auditService.recordHealthcareAction(
        actor,
        'PRESCRIBE_MEDICATION_FAILED',
        `patient:${patientId}`,
        { 
          medication: medication.name,
          error: (error as Error).message 
        },
        'CLINICAL_ALERT'
      );
      throw error;
    }
  }

  private canPrescribe(actor: HealthcareProviderActor): boolean {
    const metadata = actor.metadata as any;
    return metadata.license && 
           ['MD', 'DO', 'NP', 'PA'].includes(metadata.license.substring(0, 2));
  }

  private isControlledSubstance(medicationName: string): boolean {
    // Simplified check - real implementation would use drug database
    const controlled = ['oxycodone', 'morphine', 'fentanyl', 'adderall'];
    return controlled.some(drug => 
      medicationName.toLowerCase().includes(drug)
    );
  }

  private async checkMedicationSafety(
    patientId: string,
    medication: MedicationPrescription
  ): Promise<Array<{ conflictingMedication: string; severity: string }>> {
    // Simplified - real implementation would check drug interactions
    return [];
  }

  private categorizeUpdate(updates: PatientRecordUpdate): string {
    if (updates.diagnoses) return 'clinical';
    if (updates.prescriptions) return 'medication';
    if (updates.demographics) return 'administrative';
    return 'general';
  }

  private async findPatient(patientId: string): Promise<any> {
    // Database lookup
    return { id: patientId };
  }

  private async applyUpdates(patientId: string, updates: any): Promise<void> {
    // Apply updates to database
  }

  private async checkMedicationConflicts(patientId: string, prescriptions: any): Promise<void> {
    // Check for conflicts
  }

  private async createPrescription(id: string, patientId: string, medication: any): Promise<void> {
    // Create prescription record
  }

  private generatePrescriptionId(): string {
    return `rx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Enhanced audit service for healthcare
class HealthcareAuditService extends AuditService {
  async recordHealthcareAction(
    actor: IActor,
    action: string,
    resource: string,
    details: Record<string, unknown>,
    complianceLevel: string
  ): Promise<AuditEntry> {
    const entry = await this.recordAction(actor, action, resource, {
      ...details,
      complianceLevel,
      timestamp: new Date(),
      serverTime: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });

    // Additional compliance logging
    if (complianceLevel === 'HIPAA_COMPLIANT' || 
        complianceLevel === 'DEA_REPORTING') {
      await this.sendToComplianceSystem(entry);
    }

    return entry;
  }

  private async sendToComplianceSystem(entry: AuditEntry): Promise<void> {
    // Send to external compliance system
    console.log('Compliance reporting:', entry.id);
  }
}
```

## Banking System

### Scenario
A financial institution needs detailed error tracking for transactions, comprehensive audit trails for regulatory compliance, and strict actor verification.

```typescript
// Banking-specific errors
export class InsufficientFundsError extends IDomainError {
  constructor(accountId: string, available: number, requested: number) {
    super(`Insufficient funds in account ${accountId}`, {
      code: DomainErrorCode.BusinessRule,
      domain: 'AccountManagement',
      data: {
        accountId,
        availableBalance: available,
        requestedAmount: requested,
        shortfall: requested - available
      }
    });
  }
}

export class AccountFrozenError extends IDomainError {
  constructor(accountId: string, reason: string) {
    super(`Account ${accountId} is frozen`, {
      code: DomainErrorCode.InvalidState,
      domain: 'AccountManagement',
      data: { accountId, reason, frozenDate: new Date() }
    });
  }
}

export class TransactionLimitExceededError extends IDomainError {
  constructor(
    accountId: string,
    limitType: 'daily' | 'single',
    limit: number,
    attempted: number
  ) {
    super(`Transaction limit exceeded for account ${accountId}`, {
      code: DomainErrorCode.BusinessRule,
      domain: 'TransactionProcessing',
      data: { accountId, limitType, limit, attempted }
    });
  }
}

// Banking actors
export class BankCustomerActor implements IActor {
  type = 'bank_customer';
  source: string;
  id: string;
  metadata: Record<string, unknown>;

  constructor(customer: {
    id: string;
    accountNumbers: string[];
    verificationMethod: string;
    ipAddress: string;
  }) {
    this.id = customer.id;
    this.source = 'online-banking';
    this.metadata = {
      accountNumbers: customer.accountNumbers,
      verificationMethod: customer.verificationMethod,
      ipAddress: customer.ipAddress,
      sessionStart: new Date()
    };
  }
}

export class BankTellerActor implements IActor {
  type = 'bank_teller';
  source: string;
  id: string;
  metadata: Record<string, unknown>;

  constructor(teller: {
    employeeId: string;
    branchId: string;
    terminalId: string;
  }) {
    this.id = teller.employeeId;
    this.source = 'branch-system';
    this.metadata = {
      branchId: teller.branchId,
      terminalId: teller.terminalId,
      shiftStart: new Date()
    };
  }
}

// Banking transaction service
export class BankingTransactionService {
  constructor(
    private auditService: FinancialAuditService,
    private accountService: AccountService,
    private fraudDetectionService: FraudDetectionService
  ) {}

  async transferFunds(
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    reference: string,
    actor: IActor
  ): Promise<{ transactionId: string; status: string }> {
    const transactionId = this.generateTransactionId();

    try {
      // Verify actor can access account
      if (!await this.canAccessAccount(actor, fromAccountId)) {
        throw new UnauthorizedAccessError(
          actor.id,
          `account:${fromAccountId}`,
          'transfer'
        );
      }

      // Get account details
      const fromAccount = await this.accountService.getAccount(fromAccountId);
      const toAccount = await this.accountService.getAccount(toAccountId);

      // Check account status
      if (fromAccount.status === 'frozen') {
        throw new AccountFrozenError(fromAccountId, fromAccount.freezeReason);
      }

      // Check balance
      if (fromAccount.availableBalance < amount) {
        throw new InsufficientFundsError(
          fromAccountId,
          fromAccount.availableBalance,
          amount
        );
      }

      // Check transaction limits
      await this.checkTransactionLimits(fromAccountId, amount);

      // Fraud detection
      const fraudCheck = await this.fraudDetectionService.analyzeTransaction({
        actor,
        fromAccount: fromAccountId,
        toAccount: toAccountId,
        amount,
        timestamp: new Date()
      });

      if (fraudCheck.riskScore > 0.8) {
        throw new IDomainError('Transaction flagged for review', {
          code: DomainErrorCode.BusinessRule,
          domain: 'FraudDetection',
          data: { transactionId, riskScore: fraudCheck.riskScore }
        });
      }

      // Execute transfer
      await this.accountService.debit(fromAccountId, amount);
      await this.accountService.credit(toAccountId, amount);

      // Record successful transaction
      await this.auditService.recordFinancialTransaction(
        actor,
        'TRANSFER_FUNDS',
        transactionId,
        {
          fromAccount: fromAccountId,
          toAccount: toAccountId,
          amount,
          currency: 'USD',
          reference,
          fraudScore: fraudCheck.riskScore
        },
        'SUCCESS'
      );

      return {
        transactionId,
        status: 'completed'
      };

    } catch (error) {
      // Record failed transaction
      await this.auditService.recordFinancialTransaction(
        actor,
        'TRANSFER_FUNDS_FAILED',
        transactionId,
        {
          fromAccount: fromAccountId,
          toAccount: toAccountId,
          amount,
          error: (error as Error).message
        },
        'FAILED'
      );

      // Notify fraud system if suspicious
      if (error instanceof UnauthorizedAccessError) {
        await this.fraudDetectionService.reportSuspiciousActivity(
          actor,
          'unauthorized_transfer_attempt'
        );
      }

      throw error;
    }
  }

  private async canAccessAccount(actor: IActor, accountId: string): boolean {
    if (actor.type === 'bank_customer') {
      const customerAccounts = (actor.metadata as any).accountNumbers || [];
      return customerAccounts.includes(accountId);
    }
    return actor.type === 'bank_teller' || actor.type === 'system';
  }

  private async checkTransactionLimits(
    accountId: string,
    amount: number
  ): Promise<void> {
    const limits = await this.accountService.getTransactionLimits(accountId);
    
    if (amount > limits.singleTransaction) {
      throw new TransactionLimitExceededError(
        accountId,
        'single',
        limits.singleTransaction,
        amount
      );
    }

    const dailyTotal = await this.accountService.getDailyTransactionTotal(accountId);
    if (dailyTotal + amount > limits.dailyLimit) {
      throw new TransactionLimitExceededError(
        accountId,
        'daily',
        limits.dailyLimit,
        dailyTotal + amount
      );
    }
  }

  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Financial audit service with regulatory compliance
class FinancialAuditService extends AuditService {
  async recordFinancialTransaction(
    actor: IActor,
    action: string,
    transactionId: string,
    details: Record<string, unknown>,
    status: 'SUCCESS' | 'FAILED' | 'PENDING'
  ): Promise<AuditEntry> {
    const entry = await this.recordAction(
      actor,
      action,
      `transaction:${transactionId}`,
      {
        ...details,
        status,
        regulatoryReporting: this.requiresRegulatorReport(details)
      }
    );

    // Regulatory reporting
    if (this.requiresRegulatorReport(details)) {
      await this.submitRegulatoryReport(entry);
    }

    return entry;
  }

  private requiresRegulatorReport(details: Record<string, unknown>): boolean {
    const amount = details.amount as number;
    // Report transactions over $10,000 (simplified CTR requirement)
    return amount >= 10000;
  }

  private async submitRegulatoryReport(entry: AuditEntry): Promise<void> {
    // Submit to regulatory system
    console.log('Regulatory report submitted:', entry.id);
  }
}
```

## Key Takeaways

1. **Domain-Specific Errors**: Each industry has unique error scenarios that need specific handling
2. **Rich Actor Context**: Capture relevant metadata for compliance and debugging
3. **Comprehensive Audit Trails**: Essential for regulatory compliance and security
4. **Business Rule Enforcement**: Use domain primitives to enforce industry-specific rules
5. **Integration Points**: Domain primitives provide clean integration with external systems

## Common Patterns Across Industries

```typescript
// ✅ Pattern: Industry-specific error hierarchies
class FinancialError extends IDomainError { }
class ComplianceError extends FinancialError { }
class TransactionError extends FinancialError { }

// ✅ Pattern: Rich actor metadata
const actor = {
  type: 'authenticated_user',
  id: userId,
  source: 'mobile_app',
  metadata: {
    deviceId,
    location,
    sessionDuration,
    permissions
  }
};

// ✅ Pattern: Audit with compliance levels
await auditService.recordAction(actor, action, resource, {
  ...details,
  complianceLevel: 'SOC2',
  retentionPeriod: '7_years'
});
```

## Next Steps

- Implement intermediate patterns for complex scenarios
- Add event sourcing for complete history
- Build monitoring dashboards from audit data
- Create compliance reports from domain primitives