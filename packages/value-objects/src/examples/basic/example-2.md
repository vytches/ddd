# Email Value Object - Basic Example

**Version**: 2025-01-21 **Package**: @vytches-ddd/value-objects  
**Complexity**: Basic **Domain**: Identity & Communication **Patterns**: Value
Object, String Validation, Domain Parsing **Dependencies**:
@vytches-ddd/value-objects, @vytches-ddd/domain-primitives

## Description

This example demonstrates creating an **Email** value object that encapsulates
email addresses with comprehensive validation, domain parsing, and
normalization. Shows string-based value object patterns including format
validation, case normalization, and domain extraction.

## Business Context

Email is a critical value object in user management, communication, and identity
systems. It ensures valid email formats, provides consistent normalization, and
enables domain-based business rules. Essential for user registration,
communication systems, and email marketing platforms.

## Code Example

```typescript
// email.ts
import { ValueObject } from '@vytches-ddd/value-objects';
import {
  EmailData,
  EmailValidationConfig,
  ValueObjectValidationResult,
} from './types';
import {
  validateRequired,
  validateEmailFormat,
  validateStringLength,
  createSuccessResult,
  createFailureResult,
  combineValidationResults,
} from '../shared';

export class Email extends ValueObject<EmailData> {
  private static readonly DEFAULT_CONFIG: EmailValidationConfig = {
    allowInternational: true,
    maxLength: 254,
    blockedDomains: ['tempmail.com', '10minutemail.com'],
    requireTLD: true,
    allowSubdomains: true,
  };

  private constructor(data: EmailData) {
    super(data);
  }

  // ✅ FOCUS: Factory method with normalization and validation
  static create(
    address: string,
    config: Partial<EmailValidationConfig> = {}
  ): Email {
    const fullConfig = { ...Email.DEFAULT_CONFIG, ...config };

    // Normalize email address
    const normalizedAddress = address.trim().toLowerCase();

    // Parse email components
    const [localPart, domain] = normalizedAddress.split('@');

    if (!localPart || !domain) {
      throw new Error('Invalid email format');
    }

    const data: EmailData = {
      address: normalizedAddress,
      domain: domain,
      localPart: localPart,
      isVerified: false,
    };

    const validation = Email.validate(data, fullConfig);
    if (!validation.isValid) {
      throw new Error(`Invalid email: ${validation.errors.join(', ')}`);
    }

    return new Email(data);
  }

  // ✅ FOCUS: Factory for verified emails
  static createVerified(
    address: string,
    config: Partial<EmailValidationConfig> = {}
  ): Email {
    const email = Email.create(address, config);
    return new Email({
      ...email.data,
      isVerified: true,
    });
  }

  // ✅ FOCUS: Comprehensive validation
  static validate(
    data: EmailData,
    config: EmailValidationConfig = Email.DEFAULT_CONFIG
  ): ValueObjectValidationResult {
    const results: ValueObjectValidationResult[] = [];

    // Required field validation
    results.push(validateRequired(data.address, 'email address'));
    results.push(validateRequired(data.domain, 'domain'));
    results.push(validateRequired(data.localPart, 'local part'));

    // Length validation
    results.push(
      validateStringLength(data.address, 1, config.maxLength, 'email address')
    );

    // Format validation
    results.push(validateEmailFormat(data.address, 'email address'));

    // Domain validation
    if (config.requireTLD && !Email.hasTLD(data.domain)) {
      results.push(createFailureResult(['Email domain must have a valid TLD']));
    }

    // Blocked domains check
    if (config.blockedDomains.includes(data.domain)) {
      results.push(
        createFailureResult([`Email domain '${data.domain}' is not allowed`])
      );
    }

    // International domain validation
    if (!config.allowInternational && Email.hasNonASCII(data.address)) {
      results.push(
        createFailureResult(['International email addresses are not allowed'])
      );
    }

    // Subdomain validation
    if (!config.allowSubdomains && Email.hasSubdomain(data.domain)) {
      results.push(
        createFailureResult(['Subdomain email addresses are not allowed'])
      );
    }

    return combineValidationResults(...results);
  }

  // ✅ FOCUS: Business logic methods
  markAsVerified(): Email {
    if (this.data.isVerified) {
      return this; // Already verified
    }

    return new Email({
      ...this.data,
      isVerified: true,
    });
  }

  markAsUnverified(): Email {
    if (!this.data.isVerified) {
      return this; // Already unverified
    }

    return new Email({
      ...this.data,
      isVerified: false,
    });
  }

  // ✅ FOCUS: Domain analysis
  getDomainInfo(): {
    domain: string;
    topLevelDomain: string;
    hasSubdomain: boolean;
    subdomains: string[];
  } {
    const parts = this.data.domain.split('.');
    const tld = parts[parts.length - 1];
    const hasSubdomain = parts.length > 2;
    const subdomains = hasSubdomain ? parts.slice(0, -2) : [];

    return {
      domain: this.data.domain,
      topLevelDomain: tld,
      hasSubdomain,
      subdomains,
    };
  }

  isPersonalDomain(): boolean {
    const personalDomains = [
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'aol.com',
      'icloud.com',
      'live.com',
      'msn.com',
    ];

    return personalDomains.includes(this.data.domain);
  }

  isCorporateDomain(): boolean {
    return (
      !this.isPersonalDomain() &&
      !this.data.domain.includes('tempmail') &&
      !this.data.domain.includes('disposable')
    );
  }

  // ✅ FOCUS: String representations
  toString(): string {
    return this.data.address;
  }

  toDisplayString(): string {
    return this.data.isVerified ? `${this.data.address} ✓` : this.data.address;
  }

  toObfuscatedString(): string {
    const [local, domain] = this.data.address.split('@');
    const obfuscatedLocal =
      local.length > 2
        ? `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}`
        : local;

    return `${obfuscatedLocal}@${domain}`;
  }

  // ✅ FOCUS: Getters
  get address(): string {
    return this.data.address;
  }

  get domain(): string {
    return this.data.domain;
  }

  get localPart(): string {
    return this.data.localPart;
  }

  get isVerified(): boolean {
    return this.data.isVerified || false;
  }

  // Private static helper methods
  private static hasTLD(domain: string): boolean {
    const parts = domain.split('.');
    return parts.length >= 2 && parts[parts.length - 1].length >= 2;
  }

  private static hasNonASCII(email: string): boolean {
    return /[^\x00-\x7F]/.test(email);
  }

  private static hasSubdomain(domain: string): boolean {
    return domain.split('.').length > 2;
  }

  // ✅ FOCUS: Value object equality implementation
  protected isEqualTo(other: Email): boolean {
    return this.data.address === other.data.address;
  }
}
```

## Usage Examples

```typescript
// basic-email-usage.ts
import { Email } from './email';

// ✅ Creating email instances
const userEmail = Email.create('john.doe@example.com');
const adminEmail = Email.create('ADMIN@COMPANY.COM'); // Auto-normalized to lowercase

console.log(userEmail.toString()); // "john.doe@example.com"
console.log(adminEmail.toString()); // "admin@company.com"

// ✅ Verified emails
const verifiedEmail = Email.createVerified('verified@example.com');
console.log(verifiedEmail.toDisplayString()); // "verified@example.com ✓"

// ✅ Domain analysis
const corporateEmail = Email.create('jane@acmecorp.com');
const domainInfo = corporateEmail.getDomainInfo();

console.log(domainInfo.domain); // "acmecorp.com"
console.log(domainInfo.topLevelDomain); // "com"
console.log(domainInfo.hasSubdomain); // false

console.log(corporateEmail.isPersonalDomain()); // false
console.log(corporateEmail.isCorporateDomain()); // true

// ✅ Personal email example
const personalEmail = Email.create('user@gmail.com');
console.log(personalEmail.isPersonalDomain()); // true
console.log(personalEmail.isCorporateDomain()); // false

// ✅ Subdomain email
const subdomainEmail = Email.create('support@help.company.com');
const subdomainInfo = subdomainEmail.getDomainInfo();

console.log(subdomainInfo.hasSubdomain); // true
console.log(subdomainInfo.subdomains); // ["help"]

// ✅ Verification workflow
let customerEmail = Email.create('customer@example.com');
console.log(customerEmail.isVerified); // false

customerEmail = customerEmail.markAsVerified();
console.log(customerEmail.isVerified); // true
console.log(customerEmail.toDisplayString()); // "customer@example.com ✓"

// ✅ Privacy/obfuscation
const sensitiveEmail = Email.create('sensitive.user@company.com');
console.log(sensitiveEmail.toObfuscatedString()); // "s***********r@company.com"
```

## Advanced Usage

```typescript
// advanced-email-operations.ts
import { Email } from './email';

// ✅ Custom validation configuration
const restrictiveConfig = {
  allowInternational: false,
  maxLength: 100,
  blockedDomains: ['tempmail.com', 'guerrillamail.com', 'spam.com'],
  requireTLD: true,
  allowSubdomains: false,
};

try {
  // This will fail due to subdomain restriction
  const restrictedEmail = Email.create(
    'user@mail.company.com',
    restrictiveConfig
  );
} catch (error) {
  console.error(error.message); // "Invalid email: Subdomain email addresses are not allowed"
}

// ✅ Email domain categorization
function categorizeEmailDomain(email: Email): string {
  if (email.isPersonalDomain()) {
    return 'personal';
  }

  const domainInfo = email.getDomainInfo();
  if (domainInfo.hasSubdomain) {
    return 'corporate-subdomain';
  }

  if (email.isCorporateDomain()) {
    return 'corporate';
  }

  return 'other';
}

// ✅ Email collection management
class EmailCollection {
  private emails: Set<string> = new Set();

  add(email: Email): boolean {
    const emailStr = email.toString();
    if (this.emails.has(emailStr)) {
      return false; // Already exists
    }

    this.emails.add(emailStr);
    return true;
  }

  has(email: Email): boolean {
    return this.emails.has(email.toString());
  }

  getUniqueEmails(): Email[] {
    return Array.from(this.emails).map(emailStr => Email.create(emailStr));
  }

  getDomains(): string[] {
    const domains = new Set<string>();
    this.emails.forEach(emailStr => {
      const email = Email.create(emailStr);
      domains.add(email.domain);
    });
    return Array.from(domains);
  }
}

// Usage examples
const emails = [
  'user1@company.com',
  'user2@company.com',
  'admin@company.com',
  'support@help.company.com',
  'customer@gmail.com',
].map(addr => Email.create(addr));

const collection = new EmailCollection();
emails.forEach(email => collection.add(email));

console.log('Unique domains:', collection.getDomains());
// ["company.com", "help.company.com", "gmail.com"]

emails.forEach(email => {
  console.log(`${email}: ${categorizeEmailDomain(email)}`);
});
// user1@company.com: corporate
// user2@company.com: corporate
// admin@company.com: corporate
// support@help.company.com: corporate-subdomain
// customer@gmail.com: personal
```

## Validation Examples

```typescript
// email-validation-examples.ts
import { Email } from './email';

// ✅ Valid emails
const validEmails = [
  'simple@example.com',
  'user.name@company.co.uk',
  'admin+test@subdomain.example.org',
  'user123@test-domain.com',
];

validEmails.forEach(addr => {
  try {
    const email = Email.create(addr);
    console.log(`✓ Valid: ${email}`);
  } catch (error) {
    console.error(`✗ Invalid: ${addr} - ${error.message}`);
  }
});

// ✅ Invalid emails that will throw errors
const invalidEmails = [
  'notanemail', // No @ symbol
  '@missinglocal.com', // Missing local part
  'missingdomain@', // Missing domain
  'spaces in@email.com', // Spaces in local part
  'toolong' + 'x'.repeat(250) + '@example.com', // Too long
];

invalidEmails.forEach(addr => {
  try {
    const email = Email.create(addr);
    console.log(`✓ Valid: ${email}`);
  } catch (error) {
    console.error(`✗ Invalid: ${addr} - ${error.message}`);
  }
});

// ✅ Domain restrictions
const blockedDomainConfig = {
  blockedDomains: ['spam.com', 'tempmail.org'],
};

try {
  const blockedEmail = Email.create('user@spam.com', blockedDomainConfig);
} catch (error) {
  console.error(error.message); // "Invalid email: Email domain 'spam.com' is not allowed"
}
```

## Key Features

- **Normalization**: Automatic lowercase conversion and whitespace trimming
- **Domain Parsing**: Extracts and analyzes domain components
- **Verification State**: Tracks and manages email verification status
- **Privacy Features**: Obfuscation for displaying sensitive emails
- **Domain Classification**: Identifies personal vs corporate domains
- **Flexible Validation**: Configurable validation rules
- **Immutability**: All operations return new Email instances

## Common Pitfalls

- **Case Sensitivity**: Remember emails are case-insensitive (auto-normalized)
- **Plus Addressing**: Handle '+' symbols in local parts correctly
- **International Domains**: Consider unicode domain support
- **Temporary Emails**: Block known disposable email domains
- **Validation Config**: Match validation rules to business requirements

## Related Examples

- [Money Value Object](./example-1.md) - Numeric value object with currency
- [Phone Number Value Object](./example-3.md) - Complex string validation with
  formatting
