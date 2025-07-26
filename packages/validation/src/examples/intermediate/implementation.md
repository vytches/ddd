# Composite Validation with Integration Implementation

**Focus**: Advanced composite validation patterns integrated with policies and
events  
**Domain**: Financial Services KYC (Know Your Customer)  
**Complexity**: Intermediate  
**Dependencies**: @vytches/ddd-validation, @vytches/ddd-policies,
@vytches/ddd-events, @vytches/ddd-di

## Business Context

This example demonstrates advanced composite validation for a financial services
KYC system that requires:

- Complex business rule validation with policy integration
- Event-driven validation workflows with audit trails
- Composite validation patterns for regulatory compliance
- Integration with external validation services
- Real-time validation with comprehensive error reporting

## Implementation

```typescript
// kyc-specifications.ts
import {
  ISpecification,
  IAsyncSpecification,
  CompositeSpecification,
} from '@vytches/ddd-validation';
import {
  PolicyBuilder,
  PolicyContext,
  ISpecification as IPolicySpecification,
} from '@vytches/ddd-policies';
import { DomainEvent } from '@vytches/ddd-events';
import { Customer, KYCDocument, RiskProfile, ComplianceCheck } from '../types'; // ALWAYS import from app

// KYC domain events
export class KYCValidationStartedEvent extends DomainEvent {
  constructor(
    public readonly customerId: string,
    public readonly validationType: string,
    public readonly startedAt: Date
  ) {
    super('KYCValidationStarted', {
      customerId,
      validationType,
      startedAt,
    });
  }
}

export class KYCValidationCompletedEvent extends DomainEvent {
  constructor(
    public readonly customerId: string,
    public readonly validationType: string,
    public readonly isValid: boolean,
    public readonly errors: any[],
    public readonly completedAt: Date
  ) {
    super('KYCValidationCompleted', {
      customerId,
      validationType,
      isValid,
      errors,
      completedAt,
    });
  }
}

export class KYCValidationFailedEvent extends DomainEvent {
  constructor(
    public readonly customerId: string,
    public readonly validationType: string,
    public readonly errors: any[],
    public readonly failedAt: Date
  ) {
    super('KYCValidationFailed', {
      customerId,
      validationType,
      errors,
      failedAt,
    });
  }
}

// Customer validation specifications
export class CustomerAgeSpecification implements ISpecification<Customer> {
  constructor(private minAge: number = 18) {}

  isSatisfiedBy(customer: Customer): boolean {
    if (!customer.dateOfBirth) return false;

    const today = new Date();
    const birthDate = new Date(customer.dateOfBirth);
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
    return `Customer must be at least ${this.minAge} years old`;
  }
}

export class CustomerIdentitySpecification implements ISpecification<Customer> {
  isSatisfiedBy(customer: Customer): boolean {
    return !!(
      customer.firstName &&
      customer.lastName &&
      customer.dateOfBirth &&
      customer.nationalId &&
      customer.firstName.trim().length > 0 &&
      customer.lastName.trim().length > 0 &&
      customer.nationalId.trim().length > 0
    );
  }

  getErrorMessage(): string {
    return 'Customer identity information is incomplete';
  }
}

export class CustomerAddressSpecification implements ISpecification<Customer> {
  isSatisfiedBy(customer: Customer): boolean {
    return !!(
      customer.address &&
      customer.address.street &&
      customer.address.city &&
      customer.address.postalCode &&
      customer.address.country &&
      customer.address.street.trim().length > 0 &&
      customer.address.city.trim().length > 0 &&
      customer.address.postalCode.trim().length > 0 &&
      customer.address.country.trim().length > 0
    );
  }

  getErrorMessage(): string {
    return 'Customer address information is incomplete';
  }
}

// Document validation specifications
export class DocumentValiditySpecification
  implements ISpecification<KYCDocument>
{
  isSatisfiedBy(document: KYCDocument): boolean {
    if (!document.expiryDate) return true; // Some documents don't expire

    const today = new Date();
    const expiryDate = new Date(document.expiryDate);

    return expiryDate > today;
  }

  getErrorMessage(): string {
    return 'Document has expired';
  }
}

export class DocumentTypeSpecification implements ISpecification<KYCDocument> {
  private validTypes = [
    'passport',
    'driver-license',
    'national-id',
    'utility-bill',
    'bank-statement',
  ];

  isSatisfiedBy(document: KYCDocument): boolean {
    return this.validTypes.includes(document.type);
  }

  getErrorMessage(): string {
    return `Document type must be one of: ${this.validTypes.join(', ')}`;
  }
}

export class DocumentCompletenessSpecification
  implements ISpecification<KYCDocument>
{
  isSatisfiedBy(document: KYCDocument): boolean {
    return !!(
      document.id &&
      document.type &&
      document.number &&
      document.issueDate &&
      document.issuingAuthority &&
      document.customerName &&
      document.id.trim().length > 0 &&
      document.type.trim().length > 0 &&
      document.number.trim().length > 0 &&
      document.issuingAuthority.trim().length > 0 &&
      document.customerName.trim().length > 0
    );
  }

  getErrorMessage(): string {
    return 'Document information is incomplete';
  }
}

// Async validation specifications
export class SanctionsCheckSpecification
  implements IAsyncSpecification<Customer>
{
  constructor(private sanctionsService: SanctionsService) {}

  async isSatisfiedByAsync(customer: Customer): Promise<boolean> {
    try {
      const sanctionsResult = await this.sanctionsService.checkSanctions({
        firstName: customer.firstName,
        lastName: customer.lastName,
        dateOfBirth: customer.dateOfBirth,
        nationalId: customer.nationalId,
        country: customer.address?.country,
      });

      return !sanctionsResult.isMatch;
    } catch (error) {
      // If sanctions check fails, assume customer is sanctioned to be safe
      return false;
    }
  }

  getErrorMessage(): string {
    return 'Customer appears on sanctions list';
  }
}

export class PEPCheckSpecification implements IAsyncSpecification<Customer> {
  constructor(private pepService: PEPService) {}

  async isSatisfiedByAsync(customer: Customer): Promise<boolean> {
    try {
      const pepResult = await this.pepService.checkPEP({
        firstName: customer.firstName,
        lastName: customer.lastName,
        dateOfBirth: customer.dateOfBirth,
        country: customer.address?.country,
      });

      // PEP status doesn't disqualify, but requires enhanced due diligence
      return !pepResult.isHighRisk;
    } catch (error) {
      // If PEP check fails, assume high risk
      return false;
    }
  }

  getErrorMessage(): string {
    return 'Customer requires enhanced due diligence (PEP)';
  }
}

export class DocumentVerificationSpecification
  implements IAsyncSpecification<KYCDocument>
{
  constructor(
    private documentVerificationService: DocumentVerificationService
  ) {}

  async isSatisfiedByAsync(document: KYCDocument): Promise<boolean> {
    try {
      const verificationResult =
        await this.documentVerificationService.verifyDocument({
          documentId: document.id,
          documentType: document.type,
          documentNumber: document.number,
          issuingAuthority: document.issuingAuthority,
          customerName: document.customerName,
        });

      return verificationResult.isValid && verificationResult.isAuthentic;
    } catch (error) {
      // If verification fails, assume document is invalid
      return false;
    }
  }

  getErrorMessage(): string {
    return 'Document verification failed';
  }
}

// composite-kyc-validator.ts
import {
  CompositeSpecification,
  BusinessRuleValidator,
  ValidationFacade,
} from '@vytches/ddd-validation';
import { UnifiedEventBus } from '@vytches/ddd-events';
import { DomainService, ServiceLifetime } from '@vytches/ddd-di';
import { Logger } from '@vytches/ddd-logging';
import { Result } from '@vytches/ddd-utils';

// ⭐ Composite KYC Validator with Policy Integration
@DomainService('compositeKYCValidator', {
  lifetime: ServiceLifetime.Singleton,
  context: 'KYCValidation',
})
export class CompositeKYCValidator {
  private logger = Logger.forContext('CompositeKYCValidator');
  private businessRuleValidator: BusinessRuleValidator;
  private validationFacade: ValidationFacade;

  constructor(
    private eventBus: UnifiedEventBus,
    private sanctionsService: SanctionsService,
    private pepService: PEPService,
    private documentVerificationService: DocumentVerificationService
  ) {
    this.businessRuleValidator = new BusinessRuleValidator();
    this.validationFacade = new ValidationFacade();
    this.initializeValidationRules();
  }

  private initializeValidationRules(): void {
    // Register customer validation rules
    this.businessRuleValidator.registerRule(
      'customer-age',
      new CustomerAgeSpecification(18)
    );

    this.businessRuleValidator.registerRule(
      'customer-identity',
      new CustomerIdentitySpecification()
    );

    this.businessRuleValidator.registerRule(
      'customer-address',
      new CustomerAddressSpecification()
    );

    // Register document validation rules
    this.businessRuleValidator.registerRule(
      'document-validity',
      new DocumentValiditySpecification()
    );

    this.businessRuleValidator.registerRule(
      'document-type',
      new DocumentTypeSpecification()
    );

    this.businessRuleValidator.registerRule(
      'document-completeness',
      new DocumentCompletenessSpecification()
    );

    // Register async validation rules
    this.businessRuleValidator.registerAsyncRule(
      'sanctions-check',
      new SanctionsCheckSpecification(this.sanctionsService)
    );

    this.businessRuleValidator.registerAsyncRule(
      'pep-check',
      new PEPCheckSpecification(this.pepService)
    );

    this.businessRuleValidator.registerAsyncRule(
      'document-verification',
      new DocumentVerificationSpecification(this.documentVerificationService)
    );
  }

  // Basic KYC validation using composite specifications
  async validateBasicKYC(
    customer: Customer
  ): Promise<Result<void, ValidationError[]>> {
    try {
      this.logger.info('Starting basic KYC validation', {
        customerId: customer.id,
        customerName: `${customer.firstName} ${customer.lastName}`,
      });

      // Publish validation started event
      await this.eventBus.publish(
        new KYCValidationStartedEvent(customer.id, 'basic-kyc', new Date())
      );

      const validationResults = [];

      // Create composite specification for basic KYC
      const basicKYCSpec = CompositeSpecification.and([
        new CustomerAgeSpecification(18),
        new CustomerIdentitySpecification(),
        new CustomerAddressSpecification(),
      ]);

      // Apply composite specification
      if (!basicKYCSpec.isSatisfiedBy(customer)) {
        const errors = basicKYCSpec.getValidationErrors(customer);
        validationResults.push(...errors);
      }

      // Determine result
      const isValid = validationResults.length === 0;

      // Publish validation completed event
      await this.eventBus.publish(
        new KYCValidationCompletedEvent(
          customer.id,
          'basic-kyc',
          isValid,
          validationResults,
          new Date()
        )
      );

      if (!isValid) {
        this.logger.warn('Basic KYC validation failed', {
          customerId: customer.id,
          errors: validationResults,
        });

        return Result.failure(validationResults);
      }

      this.logger.info('Basic KYC validation completed successfully', {
        customerId: customer.id,
      });

      return Result.success(undefined);
    } catch (error) {
      this.logger.error('Basic KYC validation error', {
        customerId: customer.id,
        error: error.message,
      });

      await this.eventBus.publish(
        new KYCValidationFailedEvent(
          customer.id,
          'basic-kyc',
          [{ message: error.message, code: 'VALIDATION_ERROR' }],
          new Date()
        )
      );

      return Result.failure([
        {
          field: 'general',
          message: `Basic KYC validation failed: ${error.message}`,
          code: 'BASIC_KYC_ERROR',
        },
      ]);
    }
  }

  // Enhanced KYC validation with sanctions and PEP checks
  async validateEnhancedKYC(
    customer: Customer
  ): Promise<Result<void, ValidationError[]>> {
    try {
      this.logger.info('Starting enhanced KYC validation', {
        customerId: customer.id,
        customerName: `${customer.firstName} ${customer.lastName}`,
      });

      // Publish validation started event
      await this.eventBus.publish(
        new KYCValidationStartedEvent(customer.id, 'enhanced-kyc', new Date())
      );

      const validationResults = [];

      // First, validate basic KYC requirements
      const basicKYCResult = await this.validateBasicKYC(customer);
      if (basicKYCResult.isFailure()) {
        validationResults.push(...basicKYCResult.error);
      }

      // Enhanced checks (async)
      const sanctionsValidation =
        await this.businessRuleValidator.validateAsync(
          'sanctions-check',
          customer
        );
      if (sanctionsValidation.isFailure()) {
        validationResults.push(...sanctionsValidation.error);
      }

      const pepValidation = await this.businessRuleValidator.validateAsync(
        'pep-check',
        customer
      );
      if (pepValidation.isFailure()) {
        validationResults.push(...pepValidation.error);
      }

      // Determine result
      const isValid = validationResults.length === 0;

      // Publish validation completed event
      await this.eventBus.publish(
        new KYCValidationCompletedEvent(
          customer.id,
          'enhanced-kyc',
          isValid,
          validationResults,
          new Date()
        )
      );

      if (!isValid) {
        this.logger.warn('Enhanced KYC validation failed', {
          customerId: customer.id,
          errors: validationResults,
        });

        return Result.failure(validationResults);
      }

      this.logger.info('Enhanced KYC validation completed successfully', {
        customerId: customer.id,
      });

      return Result.success(undefined);
    } catch (error) {
      this.logger.error('Enhanced KYC validation error', {
        customerId: customer.id,
        error: error.message,
      });

      await this.eventBus.publish(
        new KYCValidationFailedEvent(
          customer.id,
          'enhanced-kyc',
          [{ message: error.message, code: 'VALIDATION_ERROR' }],
          new Date()
        )
      );

      return Result.failure([
        {
          field: 'general',
          message: `Enhanced KYC validation failed: ${error.message}`,
          code: 'ENHANCED_KYC_ERROR',
        },
      ]);
    }
  }

  // Document validation with verification
  async validateDocuments(
    customerId: string,
    documents: KYCDocument[]
  ): Promise<Result<void, ValidationError[]>> {
    try {
      this.logger.info('Starting document validation', {
        customerId,
        documentCount: documents.length,
      });

      // Publish validation started event
      await this.eventBus.publish(
        new KYCValidationStartedEvent(
          customerId,
          'document-validation',
          new Date()
        )
      );

      const validationResults = [];

      for (let i = 0; i < documents.length; i++) {
        const document = documents[i];

        // Basic document validation
        const completenessValidation = this.businessRuleValidator.validate(
          'document-completeness',
          document
        );
        if (completenessValidation.isFailure()) {
          const documentErrors = completenessValidation.error.map(error => ({
            ...error,
            field: `documents[${i}].${error.field}`,
            message: `Document ${i}: ${error.message}`,
          }));
          validationResults.push(...documentErrors);
        }

        const typeValidation = this.businessRuleValidator.validate(
          'document-type',
          document
        );
        if (typeValidation.isFailure()) {
          const documentErrors = typeValidation.error.map(error => ({
            ...error,
            field: `documents[${i}].${error.field}`,
            message: `Document ${i}: ${error.message}`,
          }));
          validationResults.push(...documentErrors);
        }

        const validityValidation = this.businessRuleValidator.validate(
          'document-validity',
          document
        );
        if (validityValidation.isFailure()) {
          const documentErrors = validityValidation.error.map(error => ({
            ...error,
            field: `documents[${i}].${error.field}`,
            message: `Document ${i}: ${error.message}`,
          }));
          validationResults.push(...documentErrors);
        }

        // Document verification (async)
        const verificationValidation =
          await this.businessRuleValidator.validateAsync(
            'document-verification',
            document
          );
        if (verificationValidation.isFailure()) {
          const documentErrors = verificationValidation.error.map(error => ({
            ...error,
            field: `documents[${i}].${error.field}`,
            message: `Document ${i}: ${error.message}`,
          }));
          validationResults.push(...documentErrors);
        }
      }

      // Determine result
      const isValid = validationResults.length === 0;

      // Publish validation completed event
      await this.eventBus.publish(
        new KYCValidationCompletedEvent(
          customerId,
          'document-validation',
          isValid,
          validationResults,
          new Date()
        )
      );

      if (!isValid) {
        this.logger.warn('Document validation failed', {
          customerId,
          errors: validationResults,
        });

        return Result.failure(validationResults);
      }

      this.logger.info('Document validation completed successfully', {
        customerId,
        documentCount: documents.length,
      });

      return Result.success(undefined);
    } catch (error) {
      this.logger.error('Document validation error', {
        customerId,
        error: error.message,
      });

      await this.eventBus.publish(
        new KYCValidationFailedEvent(
          customerId,
          'document-validation',
          [{ message: error.message, code: 'VALIDATION_ERROR' }],
          new Date()
        )
      );

      return Result.failure([
        {
          field: 'general',
          message: `Document validation failed: ${error.message}`,
          code: 'DOCUMENT_VALIDATION_ERROR',
        },
      ]);
    }
  }

  // Comprehensive KYC validation combining all checks
  async validateCompleteKYC(
    customer: Customer,
    documents: KYCDocument[]
  ): Promise<Result<ComplianceCheck, ValidationError[]>> {
    try {
      this.logger.info('Starting complete KYC validation', {
        customerId: customer.id,
        customerName: `${customer.firstName} ${customer.lastName}`,
        documentCount: documents.length,
      });

      // Publish validation started event
      await this.eventBus.publish(
        new KYCValidationStartedEvent(customer.id, 'complete-kyc', new Date())
      );

      const allValidationResults = [];

      // Enhanced customer validation
      const customerValidation = await this.validateEnhancedKYC(customer);
      if (customerValidation.isFailure()) {
        allValidationResults.push(...customerValidation.error);
      }

      // Document validation
      const documentValidation = await this.validateDocuments(
        customer.id,
        documents
      );
      if (documentValidation.isFailure()) {
        allValidationResults.push(...documentValidation.error);
      }

      // Create compliance check result
      const complianceCheck: ComplianceCheck = {
        customerId: customer.id,
        checkType: 'complete-kyc',
        isCompliant: allValidationResults.length === 0,
        validationErrors: allValidationResults,
        completedAt: new Date(),
        riskLevel: this.calculateRiskLevel(allValidationResults),
        requiresManualReview: this.requiresManualReview(allValidationResults),
      };

      // Publish validation completed event
      await this.eventBus.publish(
        new KYCValidationCompletedEvent(
          customer.id,
          'complete-kyc',
          complianceCheck.isCompliant,
          allValidationResults,
          new Date()
        )
      );

      if (!complianceCheck.isCompliant) {
        this.logger.warn('Complete KYC validation failed', {
          customerId: customer.id,
          errors: allValidationResults,
          riskLevel: complianceCheck.riskLevel,
        });

        return Result.failure(allValidationResults);
      }

      this.logger.info('Complete KYC validation completed successfully', {
        customerId: customer.id,
        riskLevel: complianceCheck.riskLevel,
      });

      return Result.success(complianceCheck);
    } catch (error) {
      this.logger.error('Complete KYC validation error', {
        customerId: customer.id,
        error: error.message,
      });

      await this.eventBus.publish(
        new KYCValidationFailedEvent(
          customer.id,
          'complete-kyc',
          [{ message: error.message, code: 'VALIDATION_ERROR' }],
          new Date()
        )
      );

      return Result.failure([
        {
          field: 'general',
          message: `Complete KYC validation failed: ${error.message}`,
          code: 'COMPLETE_KYC_ERROR',
        },
      ]);
    }
  }

  // Batch KYC validation
  async validateBatchKYC(
    customersWithDocuments: Array<{
      customer: Customer;
      documents: KYCDocument[];
    }>
  ): Promise<Result<ComplianceCheck[], ValidationError[]>> {
    try {
      this.logger.info('Starting batch KYC validation', {
        customerCount: customersWithDocuments.length,
      });

      const validComplianceChecks: ComplianceCheck[] = [];
      const allValidationErrors: ValidationError[] = [];

      for (let i = 0; i < customersWithDocuments.length; i++) {
        const { customer, documents } = customersWithDocuments[i];

        const kycValidation = await this.validateCompleteKYC(
          customer,
          documents
        );

        if (kycValidation.isSuccess()) {
          validComplianceChecks.push(kycValidation.value);
        } else {
          // Add customer index to error context
          const customerErrors = kycValidation.error.map(error => ({
            ...error,
            field: `customers[${i}].${error.field}`,
            message: `Customer ${i}: ${error.message}`,
          }));
          allValidationErrors.push(...customerErrors);
        }
      }

      if (allValidationErrors.length > 0) {
        return Result.failure(allValidationErrors);
      }

      return Result.success(validComplianceChecks);
    } catch (error) {
      this.logger.error('Batch KYC validation error', {
        error: error.message,
      });

      return Result.failure([
        {
          field: 'general',
          message: `Batch KYC validation failed: ${error.message}`,
          code: 'BATCH_KYC_ERROR',
        },
      ]);
    }
  }

  private calculateRiskLevel(
    validationErrors: ValidationError[]
  ): 'low' | 'medium' | 'high' {
    if (validationErrors.length === 0) return 'low';

    const highRiskCodes = [
      'SANCTIONS_MATCH',
      'PEP_HIGH_RISK',
      'DOCUMENT_VERIFICATION_FAILED',
    ];
    const hasHighRiskError = validationErrors.some(error =>
      highRiskCodes.includes(error.code)
    );

    if (hasHighRiskError) return 'high';
    if (validationErrors.length > 3) return 'medium';

    return 'low';
  }

  private requiresManualReview(validationErrors: ValidationError[]): boolean {
    const manualReviewCodes = [
      'SANCTIONS_MATCH',
      'PEP_HIGH_RISK',
      'DOCUMENT_VERIFICATION_FAILED',
    ];
    return validationErrors.some(error =>
      manualReviewCodes.includes(error.code)
    );
  }

  // Get validation statistics
  getValidationStatistics(): {
    totalValidations: number;
    successfulValidations: number;
    failedValidations: number;
    averageValidationTime: number;
  } {
    // This would typically come from a metrics service
    return {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageValidationTime: 0,
    };
  }
}

// Mock external services
export class MockSanctionsService implements SanctionsService {
  async checkSanctions(
    data: any
  ): Promise<{ isMatch: boolean; matchDetails?: any }> {
    // Simulate sanctions check
    await this.delay(500);

    // Simulate 5% sanctions match rate
    const isMatch = Math.random() < 0.05;

    return {
      isMatch,
      matchDetails: isMatch ? { reason: 'Name match found' } : undefined,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class MockPEPService implements PEPService {
  async checkPEP(data: any): Promise<{ isHighRisk: boolean; details?: any }> {
    // Simulate PEP check
    await this.delay(300);

    // Simulate 10% PEP match rate
    const isHighRisk = Math.random() < 0.1;

    return {
      isHighRisk,
      details: isHighRisk ? { reason: 'PEP match found' } : undefined,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class MockDocumentVerificationService
  implements DocumentVerificationService
{
  async verifyDocument(
    data: any
  ): Promise<{ isValid: boolean; isAuthentic: boolean; details?: any }> {
    // Simulate document verification
    await this.delay(1000);

    // Simulate 95% success rate
    const isValid = Math.random() < 0.95;
    const isAuthentic = isValid ? Math.random() < 0.98 : false;

    return {
      isValid,
      isAuthentic,
      details: {
        verificationMethod: 'automated',
        confidence: isValid ? 0.95 : 0.3,
      },
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Key Features

- **Composite Validation**: Complex validation patterns using specification
  combinations
- **Event-Driven Workflow**: Comprehensive audit trail with domain events
- **Policy Integration**: Business rules driving validation behavior
- **Async External Services**: Integration with sanctions, PEP, and document
  verification services
- **Risk Assessment**: Dynamic risk level calculation based on validation
  results
- **Batch Processing**: Efficient validation of multiple customers
  simultaneously
- **Comprehensive Error Handling**: Detailed error reporting with context and
  codes

## Usage Example

```typescript
// Usage in KYC application
export class KYCController {
  constructor(
    private kycValidator: CompositeKYCValidator,
    private eventBus: UnifiedEventBus
  ) {}

  async processKYC(
    customer: Customer,
    documents: KYCDocument[]
  ): Promise<Result<ComplianceCheck, ValidationError[]>> {
    try {
      // Subscribe to KYC events for monitoring
      this.eventBus.subscribe('KYCValidationCompleted', event => {
        console.log(
          `KYC validation completed for customer ${event.customerId}: ${event.isValid}`
        );
      });

      // Perform complete KYC validation
      const result = await this.kycValidator.validateCompleteKYC(
        customer,
        documents
      );

      if (result.isFailure()) {
        console.log('KYC validation failed:', result.error);
        return Result.failure(result.error);
      }

      const complianceCheck = result.value;
      console.log('KYC validation successful:', {
        customerId: customer.id,
        riskLevel: complianceCheck.riskLevel,
        requiresManualReview: complianceCheck.requiresManualReview,
      });

      return Result.success(complianceCheck);
    } catch (error) {
      return Result.failure([
        {
          field: 'general',
          message: `KYC processing failed: ${error.message}`,
          code: 'KYC_PROCESSING_ERROR',
        },
      ]);
    }
  }

  async processBatchKYC(
    customersWithDocuments: Array<{
      customer: Customer;
      documents: KYCDocument[];
    }>
  ): Promise<Result<ComplianceCheck[], ValidationError[]>> {
    try {
      const result = await this.kycValidator.validateBatchKYC(
        customersWithDocuments
      );

      if (result.isFailure()) {
        console.log('Batch KYC validation failed:', result.error);
        return Result.failure(result.error);
      }

      console.log(
        `Batch KYC validation successful: ${result.value.length} customers processed`
      );
      return Result.success(result.value);
    } catch (error) {
      return Result.failure([
        {
          field: 'general',
          message: `Batch KYC processing failed: ${error.message}`,
          code: 'BATCH_KYC_ERROR',
        },
      ]);
    }
  }

  async getValidationStatistics(): Promise<any> {
    return this.kycValidator.getValidationStatistics();
  }
}
```

## Common Pitfalls

- **Event Ordering**: Consider event ordering for complex validation workflows
- **External Service Timeouts**: Implement proper timeout handling for external
  services
- **Validation State**: Maintain validation state consistently across async
  operations
- **Error Aggregation**: Properly aggregate errors from multiple validation
  sources
- **Performance**: Monitor performance impact of comprehensive validation
  workflows
- **Risk Calculation**: Ensure risk level calculations align with business
  requirements
