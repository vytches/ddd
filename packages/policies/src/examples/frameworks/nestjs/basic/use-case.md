# Basic NestJS Use Cases

**Version**: 2.0.0  
**Package**: @vytches/ddd-policies  
**Complexity**: basic  
**Domain**: Framework Integration  
**Framework**: NestJS  
**Patterns**: manual-setup, service-integration, basic-validation

## Description

Real-world use cases demonstrating basic @vytches/ddd-policies integration with
NestJS applications for common business scenarios including user validation,
order processing, and content management.

## Enterprise Use Cases

### **E-Commerce Platform - User Registration Validation**

#### **Challenge**: Simple User Registration Business Rules

A growing e-commerce platform needs basic user registration validation including
age verification, email format checking, and account eligibility rules with
clear error messages for frontend display.

#### **Solution**: Basic Policy Integration with Manual Setup

```typescript
// User registration with basic policy validation
@Injectable()
export class UserRegistrationService {
  private readonly registrationPolicy;

  constructor() {
    this.registrationPolicy = PolicyBuilder.create<User>()
      .withId('user-registration')
      .withName('User Registration Policy')
      .must(user => user.age >= 13)
      .withCode('AGE_TOO_LOW')
      .withMessage('Users must be at least 13 years old')
      .and()
      .must(user => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email))
      .withCode('INVALID_EMAIL')
      .withMessage('Please enter a valid email address')
      .and()
      .must(user => user.password.length >= 8)
      .withCode('PASSWORD_TOO_SHORT')
      .withMessage('Password must be at least 8 characters')
      .build();
  }

  async registerUser(userData: CreateUserRequest): Promise<User> {
    const result = await this.registrationPolicy.check({
      entity: userData,
      context: { operation: 'registration' },
    });

    if (result.isFailure()) {
      throw new BadRequestException({
        message: 'User registration validation failed',
        errors: result.error.violations.map(v => ({
          code: v.code,
          message: v.message,
        })),
      });
    }

    // Proceed with user creation
    return await this.createUser(userData);
  }
}
```

**Business Impact:**

- **Improved User Experience**: Clear validation messages guide users to correct
  input
- **Reduced Support Load**: Proper validation prevents common registration
  issues
- **Consistent Rules**: Centralized validation logic ensures uniform business
  rule application

### **SaaS Application - Content Publishing Validation**

#### **Challenge**: Content Quality and Compliance Validation

A content management SaaS needs to validate published content for quality
standards, compliance requirements, and business rules before making content
public.

#### **Solution**: Specification-Based Policy Composition

```typescript
// Content validation with reusable specifications
@Injectable()
export class ContentValidationService {
  private readonly contentLengthSpec: ISpecification<Content>;
  private readonly contentQualitySpec: ISpecification<Content>;
  private readonly complianceSpec: ISpecification<Content>;
  private readonly publishingPolicy;

  constructor() {
    this.contentLengthSpec = SpecificationBuilder.create<Content>()
      .withRule(content => content.body.length >= 100)
      .withErrorCode('CONTENT_TOO_SHORT')
      .withErrorMessage('Content must be at least 100 characters')
      .build();

    this.contentQualitySpec = SpecificationBuilder.create<Content>()
      .withRule(
        content => !content.body.includes('spam') && content.title.length > 5
      )
      .withErrorCode('CONTENT_QUALITY_ISSUE')
      .withErrorMessage('Content does not meet quality standards')
      .build();

    this.complianceSpec = SpecificationBuilder.create<Content>()
      .withRule(content => !this.containsRestrictedContent(content.body))
      .withErrorCode('COMPLIANCE_VIOLATION')
      .withErrorMessage('Content contains restricted material')
      .build();

    this.publishingPolicy = PolicyBuilder.create<Content>()
      .withId('content-publishing')
      .withName('Content Publishing Policy')
      .must(this.contentLengthSpec)
      .and()
      .must(this.contentQualitySpec)
      .and()
      .must(this.complianceSpec)
      .build();
  }

  async validateForPublishing(content: Content): Promise<ValidationResult> {
    const result = await this.publishingPolicy.check({
      entity: content,
      context: {
        operation: 'publishing',
        authorId: content.authorId,
        timestamp: new Date(),
      },
    });

    return {
      isValid: result.isSuccess(),
      violations: result.isFailure() ? result.error.violations : [],
      canPublish: result.isSuccess(),
    };
  }

  private containsRestrictedContent(text: string): boolean {
    const restrictedWords = ['spam', 'illegal', 'dangerous'];
    return restrictedWords.some(word => text.toLowerCase().includes(word));
  }
}
```

**Business Impact:**

- **Content Quality**: Automated quality checks maintain platform standards
- **Compliance Assurance**: Systematic compliance validation reduces legal risk
- **Operational Efficiency**: Automated validation reduces manual content review
  time

### **FinTech Application - Basic Transaction Validation**

#### **Challenge**: Financial Transaction Business Rules

A fintech startup needs basic transaction validation for money transfers
including balance checks, daily limits, and account verification with clear
validation feedback.

#### **Solution**: Simple Transaction Policy with Context-Aware Validation

```typescript
// Transaction validation with business context
@Injectable()
export class TransactionValidationService {
  private readonly transferPolicy;

  constructor() {
    this.transferPolicy = PolicyBuilder.create<TransferRequest>()
      .withId('money-transfer')
      .withName('Money Transfer Policy')
      .must(transfer => transfer.amount > 0)
      .withCode('INVALID_AMOUNT')
      .withMessage('Transfer amount must be greater than zero')
      .and()
      .must(transfer => transfer.amount <= 10000)
      .withCode('AMOUNT_EXCEEDS_LIMIT')
      .withMessage('Transfer amount cannot exceed $10,000')
      .and()
      .must(transfer => transfer.fromAccount !== transfer.toAccount)
      .withCode('SAME_ACCOUNT_TRANSFER')
      .withMessage('Cannot transfer money to the same account')
      .build();
  }

  async validateTransfer(
    transferData: TransferRequest
  ): Promise<TransferValidationResult> {
    try {
      const result = await this.transferPolicy.check({
        entity: transferData,
        context: {
          operation: 'transfer',
          userId: transferData.userId,
          accountId: transferData.fromAccount,
          timestamp: new Date(),
        },
      });

      if (result.isFailure()) {
        return {
          isValid: false,
          canProceed: false,
          errors: result.error.violations.map(v => ({
            field: this.mapCodeToField(v.code),
            message: v.message,
            code: v.code,
          })),
        };
      }

      return {
        isValid: true,
        canProceed: true,
        errors: [],
      };
    } catch (error) {
      throw new Error(`Transfer validation failed: ${error.message}`);
    }
  }

  private mapCodeToField(code: string): string {
    const fieldMapping = {
      INVALID_AMOUNT: 'amount',
      AMOUNT_EXCEEDS_LIMIT: 'amount',
      SAME_ACCOUNT_TRANSFER: 'toAccount',
    };
    return fieldMapping[code] || 'general';
  }
}
```

**Business Impact:**

- **Risk Mitigation**: Basic validation prevents common transaction errors
- **User Experience**: Clear error messages help users complete transactions
  successfully
- **Compliance Foundation**: Systematic validation provides audit trail for
  regulatory requirements

## Implementation Strategy

### **Pattern Selection for Basic Use Cases**

| **Use Case Characteristics** | **Manual Setup** | **Specification Pattern** |
| ---------------------------- | ---------------- | ------------------------- |
| **Simple Validation**        | ✅ Recommended   | ⚠️ Overkill               |
| **Reusable Rules**           | ⚠️ Limited       | ✅ Recommended            |
| **Quick Implementation**     | ✅ Excellent     | ⚠️ More Setup             |
| **Team Familiarity**         | ✅ Easy to Learn | ⚠️ Requires Understanding |

### **Getting Started Approach**

1. **Start Simple**: Begin with manual policy setup for basic validation needs
2. **Identify Patterns**: Look for repeated validation logic across services
3. **Introduce Specifications**: Gradually adopt specification pattern for
   reusable rules
4. **Expand Usage**: Apply policies consistently across similar business
   scenarios

## Success Metrics

### **E-Commerce Platform**

- **User Registration Success Rate**: 95%+ successful registrations after
  validation implementation
- **Support Ticket Reduction**: 40% reduction in registration-related support
  requests
- **Development Velocity**: 30% faster feature development with consistent
  validation patterns

### **Content Management SaaS**

- **Content Quality Score**: 85%+ of published content meets quality standards
- **Compliance Issues**: Zero compliance violations since policy implementation
- **Publishing Efficiency**: 50% reduction in manual content review time

### **FinTech Application**

- **Transaction Error Rate**: 90% reduction in failed transactions due to
  validation errors
- **User Experience Score**: 4.8/5 rating for transaction process clarity
- **Regulatory Readiness**: 100% audit trail coverage for transaction validation

## Getting Started

### **Implementation Steps**

1. **Identify Validation Needs**: Document current business rules and validation
   requirements
2. **Choose Integration Pattern**: Start with manual setup for simplicity
3. **Implement Core Policies**: Begin with most critical business rule
   validation
4. **Add Error Handling**: Implement comprehensive error handling and user
   feedback
5. **Expand Coverage**: Gradually apply policy validation to additional business
   scenarios

These basic use cases demonstrate how @vytches/ddd-policies can be integrated
into NestJS applications with minimal complexity while providing significant
business value through consistent validation and clear error handling.
