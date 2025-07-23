# User Profile Composite Value Object - Intermediate Example

**Version**: 2025-01-21
**Package**: @vytches-ddd/value-objects  
**Complexity**: Intermediate
**Domain**: User Management & Identity
**Patterns**: Composite Value Objects, Nested Validation, Profile Aggregation
**Dependencies**: @vytches-ddd/value-objects, @vytches-ddd/domain-primitives

## Description

This example demonstrates creating a **UserProfile** composite value object that aggregates multiple simpler value objects (PersonName, Email, PhoneNumber, Address) with advanced validation, preference management, and privacy controls. Shows intermediate patterns for complex composite structures with intelligent behavior.

## Business Context

UserProfile is essential for user management systems, CRM platforms, and personalization engines. It provides comprehensive user data management with privacy controls, preference handling, and validation across multiple related data types. Critical for user registration, profile management, and personalized experiences.

## Code Example

```typescript
// user-profile.ts
import { ValueObject } from '@vytches-ddd/value-objects';
import { 
  UserProfileData, 
  UserPreferences, 
  NotificationPreferences,
  PrivacySettings,
  ProfileMetadata,
  ValueObjectValidationResult 
} from './types';
import { Email } from '../basic/email';
import { Address } from '../basic/address';
import { 
  validateRequired,
  createSuccessResult,
  createFailureResult,
  combineValidationResults
} from '../shared';

// ✅ Supporting value objects for complex data
export class PersonName extends ValueObject<PersonNameData> {
  private constructor(data: PersonNameData) {
    super(data);
  }

  static create(
    firstName: string,
    lastName: string,
    middleName?: string,
    title?: string,
    suffix?: string,
    preferredName?: string
  ): PersonName {
    const data: PersonNameData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      middleName: middleName?.trim(),
      title: title?.trim(),
      suffix: suffix?.trim(),
      preferredName: preferredName?.trim()
    };

    const validation = PersonName.validate(data);
    if (!validation.isValid) {
      throw new Error(`Invalid person name: ${validation.errors.join(', ')}`);
    }

    return new PersonName(data);
  }

  static validate(data: PersonNameData): ValueObjectValidationResult {
    const results = [
      validateRequired(data.firstName, 'first name'),
      validateRequired(data.lastName, 'last name')
    ];

    // Name length validations
    if (data.firstName && data.firstName.length > 50) {
      results.push(createFailureResult(['First name cannot exceed 50 characters']));
    }
    if (data.lastName && data.lastName.length > 50) {
      results.push(createFailureResult(['Last name cannot exceed 50 characters']));
    }

    return combineValidationResults(...results);
  }

  getDisplayName(format: PersonNameFormatOptions = { 
    includeTitle: false, 
    includeMiddleName: false, 
    includeSuffix: false,
    format: 'first-last' 
  }): string {
    if (this.data.preferredName && format.format === 'first-last') {
      return this.data.preferredName;
    }

    const parts: string[] = [];

    if (format.includeTitle && this.data.title) {
      parts.push(this.data.title);
    }

    switch (format.format) {
      case 'last-first':
        parts.push(`${this.data.lastName},`);
        parts.push(this.data.firstName);
        break;
      case 'initials':
        let initials = this.data.firstName.charAt(0);
        if (format.includeMiddleName && this.data.middleName) {
          initials += this.data.middleName.charAt(0);
        }
        initials += this.data.lastName.charAt(0);
        return initials.toUpperCase();
      case 'full':
      case 'first-last':
      default:
        parts.push(this.data.firstName);
        if (format.includeMiddleName && this.data.middleName) {
          parts.push(this.data.middleName);
        }
        parts.push(this.data.lastName);
        break;
    }

    if (format.includeSuffix && this.data.suffix) {
      parts.push(this.data.suffix);
    }

    return parts.join(' ');
  }

  get firstName(): string { return this.data.firstName; }
  get lastName(): string { return this.data.lastName; }
  get middleName(): string | undefined { return this.data.middleName; }
  get preferredName(): string | undefined { return this.data.preferredName; }

  protected isEqualTo(other: PersonName): boolean {
    return this.data.firstName === other.data.firstName &&
           this.data.lastName === other.data.lastName &&
           this.data.middleName === other.data.middleName &&
           this.data.title === other.data.title &&
           this.data.suffix === other.data.suffix &&
           this.data.preferredName === other.data.preferredName;
  }
}

// ✅ Phone number value object
export class PhoneNumber extends ValueObject<PhoneNumberData> {
  private constructor(data: PhoneNumberData) {
    super(data);
  }

  static create(
    number: string,
    countryCode: string = 'US',
    extension?: string
  ): PhoneNumber {
    const cleanNumber = number.replace(/[\s\-\(\)\.]/g, '');
    const nationalNumber = PhoneNumber.extractNationalNumber(cleanNumber, countryCode);
    const type = PhoneNumber.detectPhoneType(cleanNumber);

    const data: PhoneNumberData = {
      number: cleanNumber,
      countryCode: countryCode.toUpperCase(),
      nationalNumber,
      extension: extension?.trim(),
      type
    };

    const validation = PhoneNumber.validate(data);
    if (!validation.isValid) {
      throw new Error(`Invalid phone number: ${validation.errors.join(', ')}`);
    }

    return new PhoneNumber(data);
  }

  static validate(data: PhoneNumberData): ValueObjectValidationResult {
    const results = [
      validateRequired(data.number, 'phone number'),
      validateRequired(data.countryCode, 'country code')
    ];

    // Phone number format validation
    if (data.number && !/^\+?[\d]+$/.test(data.number)) {
      results.push(createFailureResult(['Phone number must contain only digits and optional + prefix']));
    }

    // Length validation
    if (data.number && (data.number.length < 7 || data.number.length > 15)) {
      results.push(createFailureResult(['Phone number must be between 7 and 15 digits']));
    }

    return combineValidationResults(...results);
  }

  private static extractNationalNumber(number: string, countryCode: string): string {
    // Simplified - in real implementation would use libphonenumber
    if (number.startsWith('+1') && countryCode === 'US') {
      return number.substring(2);
    }
    return number;
  }

  private static detectPhoneType(number: string): PhoneType {
    // Simplified detection logic
    if (number.length === 10) return 'mobile';
    if (number.startsWith('800') || number.startsWith('888')) return 'toll-free';
    return 'unknown';
  }

  getFormattedNumber(format: 'national' | 'international' = 'national'): string {
    if (format === 'international') {
      return `+${this.data.countryCode === 'US' ? '1' : '1'} ${this.formatForDisplay(this.data.nationalNumber)}`;
    }
    return this.formatForDisplay(this.data.nationalNumber);
  }

  private formatForDisplay(number: string): string {
    // US phone number formatting
    if (number.length === 10) {
      return `(${number.substring(0, 3)}) ${number.substring(3, 6)}-${number.substring(6)}`;
    }
    return number;
  }

  get number(): string { return this.data.number; }
  get countryCode(): string { return this.data.countryCode; }
  get type(): PhoneType { return this.data.type; }

  protected isEqualTo(other: PhoneNumber): boolean {
    return this.data.number === other.data.number &&
           this.data.countryCode === other.data.countryCode &&
           this.data.extension === other.data.extension;
  }
}

// ✅ Main UserProfile composite value object
export class UserProfile extends ValueObject<UserProfileData> {
  private constructor(data: UserProfileData) {
    super(data);
  }

  // ✅ FOCUS: Factory method with nested validation
  static create(
    personalInfo: PersonName,
    email: Email,
    phoneNumber?: PhoneNumber,
    address?: Address,
    preferences?: Partial<UserPreferences>
  ): UserProfile {
    const defaultPreferences: UserPreferences = {
      language: 'en-US',
      timezone: 'America/New_York',
      currency: 'USD',
      notifications: {
        email: true,
        sms: false,
        push: true,
        frequency: 'immediate'
      },
      privacy: {
        profileVisibility: 'private',
        dataSharing: false,
        analytics: false,
        marketing: false
      }
    };

    const metadata: ProfileMetadata = {
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      version: 1,
      source: 'user_registration'
    };

    const data: UserProfileData = {
      personalInfo,
      email,
      phoneNumber,
      address,
      preferences: { ...defaultPreferences, ...preferences },
      metadata
    };

    const validation = UserProfile.validate(data);
    if (!validation.isValid) {
      throw new Error(`Invalid user profile: ${validation.errors.join(', ')}`);
    }

    return new UserProfile(data);
  }

  // ✅ FOCUS: Comprehensive nested validation
  static validate(data: UserProfileData): ValueObjectValidationResult {
    const results: ValueObjectValidationResult[] = [];

    // Validate required components
    results.push(validateRequired(data.personalInfo, 'personal information'));
    results.push(validateRequired(data.email, 'email'));
    results.push(validateRequired(data.preferences, 'preferences'));

    // Validate nested value objects (they're already validated in their constructors)
    // But we can add business rules here

    // Email verification requirement for certain privacy settings
    if (data.preferences.privacy.profileVisibility === 'public' && 
        !data.email.isVerified) {
      results.push(createFailureResult(['Public profiles require verified email addresses']));
    }

    // Phone requirement for SMS notifications
    if (data.preferences.notifications.sms && !data.phoneNumber) {
      results.push(createFailureResult(['SMS notifications require a phone number']));
    }

    // Address requirement for certain features
    if (data.preferences.notifications.frequency === 'daily' && !data.address) {
      results.push(createFailureResult(['Daily notifications require an address for timezone calculation']));
    }

    return combineValidationResults(...results);
  }

  // ✅ FOCUS: Profile update methods with validation
  updatePersonalInfo(personalInfo: PersonName): UserProfile {
    return new UserProfile({
      ...this.data,
      personalInfo,
      metadata: this.updateMetadata()
    });
  }

  updateEmail(email: Email): UserProfile {
    const newData = {
      ...this.data,
      email,
      metadata: this.updateMetadata()
    };

    // Re-validate with new email
    const validation = UserProfile.validate(newData);
    if (!validation.isValid) {
      throw new Error(`Profile update failed: ${validation.errors.join(', ')}`);
    }

    return new UserProfile(newData);
  }

  updatePreferences(preferences: Partial<UserPreferences>): UserProfile {
    const updatedPreferences = {
      ...this.data.preferences,
      ...preferences
    };

    const newData = {
      ...this.data,
      preferences: updatedPreferences,
      metadata: this.updateMetadata()
    };

    const validation = UserProfile.validate(newData);
    if (!validation.isValid) {
      throw new Error(`Preferences update failed: ${validation.errors.join(', ')}`);
    }

    return new UserProfile(newData);
  }

  updateNotificationPreferences(notifications: Partial<NotificationPreferences>): UserProfile {
    return this.updatePreferences({
      notifications: {
        ...this.data.preferences.notifications,
        ...notifications
      }
    });
  }

  updatePrivacySettings(privacy: Partial<PrivacySettings>): UserProfile {
    return this.updatePreferences({
      privacy: {
        ...this.data.preferences.privacy,
        ...privacy
      }
    });
  }

  // ✅ FOCUS: Advanced profile queries and analysis
  getCompletionScore(): {
    score: number;
    missingFields: string[];
    recommendations: string[];
  } {
    const fields = [
      { name: 'personalInfo', required: true, weight: 20 },
      { name: 'email', required: true, weight: 20 },
      { name: 'phoneNumber', required: false, weight: 15 },
      { name: 'address', required: false, weight: 15 },
      { name: 'emailVerified', required: false, weight: 15 },
      { name: 'profilePhoto', required: false, weight: 10 },
      { name: 'preferences', required: true, weight: 5 }
    ];

    let totalScore = 0;
    const missingFields: string[] = [];
    const recommendations: string[] = [];

    fields.forEach(field => {
      let hasField = false;

      switch (field.name) {
        case 'personalInfo':
          hasField = !!this.data.personalInfo;
          break;
        case 'email':
          hasField = !!this.data.email;
          break;
        case 'phoneNumber':
          hasField = !!this.data.phoneNumber;
          if (!hasField) recommendations.push('Add phone number for SMS notifications');
          break;
        case 'address':
          hasField = !!this.data.address;
          if (!hasField) recommendations.push('Add address for location-based features');
          break;
        case 'emailVerified':
          hasField = this.data.email.isVerified;
          if (!hasField) recommendations.push('Verify your email address');
          break;
        case 'profilePhoto':
          hasField = false; // Would check for photo data
          if (!hasField) recommendations.push('Upload a profile photo');
          break;
        case 'preferences':
          hasField = !!this.data.preferences;
          break;
      }

      if (hasField) {
        totalScore += field.weight;
      } else if (field.required) {
        missingFields.push(field.name);
      }
    });

    return {
      score: Math.round(totalScore),
      missingFields,
      recommendations
    };
  }

  getPrivacyRiskAssessment(): {
    riskLevel: 'low' | 'medium' | 'high';
    concerns: string[];
    recommendations: string[];
  } {
    const concerns: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    // Public profile increases risk
    if (this.data.preferences.privacy.profileVisibility === 'public') {
      riskScore += 30;
      concerns.push('Profile is publicly visible');
    }

    // Data sharing increases risk
    if (this.data.preferences.privacy.dataSharing) {
      riskScore += 25;
      concerns.push('Data sharing is enabled');
      recommendations.push('Consider disabling data sharing for better privacy');
    }

    // Marketing consent
    if (this.data.preferences.privacy.marketing) {
      riskScore += 15;
      concerns.push('Marketing communications enabled');
    }

    // Analytics tracking
    if (this.data.preferences.privacy.analytics) {
      riskScore += 10;
      concerns.push('Analytics tracking enabled');
    }

    // Unverified email with public profile
    if (!this.data.email.isVerified && 
        this.data.preferences.privacy.profileVisibility === 'public') {
      riskScore += 20;
      concerns.push('Unverified email with public profile');
      recommendations.push('Verify your email address');
    }

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (riskScore >= 50) {
      riskLevel = 'high';
      recommendations.push('Review and tighten privacy settings');
    } else if (riskScore >= 25) {
      riskLevel = 'medium';
      recommendations.push('Consider reviewing privacy settings');
    }

    return { riskLevel, concerns, recommendations };
  }

  // ✅ FOCUS: Communication preferences analysis
  getCommunicationProfile(): {
    channels: string[];
    frequency: string;
    preferences: {
      canEmail: boolean;
      canSMS: boolean;
      canPush: boolean;
    };
    bestTimeToContact?: string;
  } {
    const channels: string[] = [];
    const notifications = this.data.preferences.notifications;

    if (notifications.email && this.data.email.isVerified) {
      channels.push('email');
    }

    if (notifications.sms && this.data.phoneNumber) {
      channels.push('sms');
    }

    if (notifications.push) {
      channels.push('push');
    }

    // Determine best time based on timezone and preferences
    let bestTimeToContact: string | undefined;
    if (this.data.preferences.timezone) {
      const timezone = this.data.preferences.timezone;
      const now = new Date();
      const timeInTimezone = now.toLocaleString('en-US', { timeZone: timezone });
      bestTimeToContact = `Business hours in ${timezone}`;
    }

    return {
      channels,
      frequency: notifications.frequency,
      preferences: {
        canEmail: notifications.email && this.data.email.isVerified,
        canSMS: notifications.sms && !!this.data.phoneNumber,
        canPush: notifications.push
      },
      bestTimeToContact
    };
  }

  // ✅ FOCUS: Profile display methods
  getDisplayName(format: PersonNameFormatOptions = { format: 'first-last', includeTitle: false, includeMiddleName: false, includeSuffix: false }): string {
    return this.data.personalInfo.getDisplayName(format);
  }

  getContactSummary(): string {
    const parts: string[] = [];
    
    parts.push(this.getDisplayName());
    parts.push(this.data.email.toString());
    
    if (this.data.phoneNumber) {
      parts.push(this.data.phoneNumber.getFormattedNumber());
    }

    if (this.data.address) {
      parts.push(`${this.data.address.city}, ${this.data.address.state}`);
    }

    return parts.join(' • ');
  }

  getProfileSummary(): {
    name: string;
    email: string;
    phone?: string;
    location?: string;
    verified: boolean;
    completionScore: number;
    memberSince: Date;
  } {
    const completion = this.getCompletionScore();

    return {
      name: this.getDisplayName(),
      email: this.data.email.toString(),
      phone: this.data.phoneNumber?.getFormattedNumber(),
      location: this.data.address ? `${this.data.address.city}, ${this.data.address.state}` : undefined,
      verified: this.data.email.isVerified,
      completionScore: completion.score,
      memberSince: this.data.metadata.createdAt
    };
  }

  // ✅ FOCUS: Getters
  get personalInfo(): PersonName { return this.data.personalInfo; }
  get email(): Email { return this.data.email; }
  get phoneNumber(): PhoneNumber | undefined { return this.data.phoneNumber; }
  get address(): Address | undefined { return this.data.address; }
  get preferences(): UserPreferences { return this.data.preferences; }
  get metadata(): ProfileMetadata { return this.data.metadata; }

  // Helper methods
  private updateMetadata(): ProfileMetadata {
    return {
      ...this.data.metadata,
      lastUpdatedAt: new Date(),
      version: this.data.metadata.version + 1
    };
  }

  // ✅ FOCUS: Value object equality implementation
  protected isEqualTo(other: UserProfile): boolean {
    return this.data.personalInfo.equals(other.data.personalInfo) &&
           this.data.email.equals(other.data.email) &&
           this.phoneNumberEquals(this.data.phoneNumber, other.data.phoneNumber) &&
           this.addressEquals(this.data.address, other.data.address) &&
           JSON.stringify(this.data.preferences) === JSON.stringify(other.data.preferences);
  }

  private phoneNumberEquals(a?: PhoneNumber, b?: PhoneNumber): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.equals(b);
  }

  private addressEquals(a?: Address, b?: Address): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.equals(b);
  }
}
```

## Usage Examples

```typescript
// basic-user-profile-usage.ts
import { UserProfile, PersonName, PhoneNumber } from './user-profile';
import { Email } from '../basic/email';
import { Address } from '../basic/address';

// ✅ Creating a user profile
const name = PersonName.create(
  'John',
  'Doe',
  'William',
  'Mr.',
  'Jr.',
  'Johnny'
);

const email = Email.create('john.doe@example.com');
const phone = PhoneNumber.create('5551234567', 'US');
const address = Address.create(
  '123 Main Street',
  'Springfield',
  'IL',
  '62701',
  'US'
);

let userProfile = UserProfile.create(
  name,
  email,
  phone,
  address,
  {
    language: 'en-US',
    timezone: 'America/Chicago',
    notifications: {
      email: true,
      sms: true,
      push: false,
      frequency: 'daily'
    },
    privacy: {
      profileVisibility: 'private',
      dataSharing: false,
      analytics: true,
      marketing: false
    }
  }
);

console.log(userProfile.getDisplayName()); // "Johnny" (preferred name)
console.log(userProfile.getContactSummary());
// "Johnny • john.doe@example.com • (555) 123-4567 • Springfield, IL"

// ✅ Profile analysis
const completion = userProfile.getCompletionScore();
console.log(`Profile completion: ${completion.score}%`);
console.log('Recommendations:', completion.recommendations);

const privacyRisk = userProfile.getPrivacyRiskAssessment();
console.log(`Privacy risk: ${privacyRisk.riskLevel}`);
console.log('Privacy concerns:', privacyRisk.concerns);

const communication = userProfile.getCommunicationProfile();
console.log('Available channels:', communication.channels); // ['email', 'sms']
console.log('Can send SMS:', communication.preferences.canSMS); // true

// ✅ Profile updates
const verifiedEmail = email.markAsVerified();
userProfile = userProfile.updateEmail(verifiedEmail);

const newPreferences = {
  notifications: {
    email: true,
    sms: false,
    push: true,
    frequency: 'immediate' as const
  }
};

userProfile = userProfile.updateNotificationPreferences(newPreferences.notifications);

console.log('Updated communication:', userProfile.getCommunicationProfile());
```

## Advanced Profile Management

```typescript
// advanced-profile-management.ts
import { UserProfile, PersonName } from './user-profile';
import { Email } from '../basic/email';

// ✅ Profile management system
class ProfileManager {
  private profiles: Map<string, UserProfile> = new Map();
  
  createProfile(profileData: {
    name: { first: string; last: string; middle?: string; preferred?: string };
    email: string;
    phone?: string;
    preferences?: any;
  }): { profileId: string; profile: UserProfile; warnings: string[] } {
    const warnings: string[] = [];
    
    // Create name
    const name = PersonName.create(
      profileData.name.first,
      profileData.name.last,
      profileData.name.middle,
      undefined,
      undefined,
      profileData.name.preferred
    );

    // Create email
    let email: Email;
    try {
      email = Email.create(profileData.email);
    } catch (error) {
      throw new Error(`Invalid email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check for existing profile with same email
    const existingProfile = this.findByEmail(email);
    if (existingProfile) {
      warnings.push('Profile with this email already exists');
    }

    // Create phone if provided
    let phone;
    if (profileData.phone) {
      try {
        phone = PhoneNumber.create(profileData.phone);
      } catch (error) {
        warnings.push(`Invalid phone number: ${profileData.phone}`);
      }
    }

    const profile = UserProfile.create(name, email, phone, undefined, profileData.preferences);
    const profileId = this.generateProfileId();
    
    this.profiles.set(profileId, profile);

    return { profileId, profile, warnings };
  }

  updateProfile(
    profileId: string, 
    updates: {
      name?: Partial<{ first: string; last: string; middle?: string; preferred?: string }>;
      email?: string;
      phone?: string;
      preferences?: any;
    }
  ): { profile: UserProfile; warnings: string[] } {
    let profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const warnings: string[] = [];

    try {
      // Update name if provided
      if (updates.name) {
        const currentName = profile.personalInfo;
        const newName = PersonName.create(
          updates.name.first ?? currentName.firstName,
          updates.name.last ?? currentName.lastName,
          updates.name.middle ?? currentName.middleName,
          undefined,
          undefined,
          updates.name.preferred ?? currentName.preferredName
        );
        profile = profile.updatePersonalInfo(newName);
      }

      // Update email if provided
      if (updates.email) {
        const newEmail = Email.create(updates.email);
        profile = profile.updateEmail(newEmail);
      }

      // Update preferences if provided
      if (updates.preferences) {
        profile = profile.updatePreferences(updates.preferences);
      }

      this.profiles.set(profileId, profile);
      return { profile, warnings };

    } catch (error) {
      throw new Error(`Profile update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  analyzeProfile(profileId: string): {
    completion: ReturnType<UserProfile['getCompletionScore']>;
    privacy: ReturnType<UserProfile['getPrivacyRiskAssessment']>;
    communication: ReturnType<UserProfile['getCommunicationProfile']>;
    summary: ReturnType<UserProfile['getProfileSummary']>;
  } {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    return {
      completion: profile.getCompletionScore(),
      privacy: profile.getPrivacyRiskAssessment(),
      communication: profile.getCommunicationProfile(),
      summary: profile.getProfileSummary()
    };
  }

  findByEmail(email: Email): string | null {
    for (const [id, profile] of this.profiles) {
      if (profile.email.equals(email)) {
        return id;
      }
    }
    return null;
  }

  getProfilesByCompletionScore(minScore: number): Array<{ id: string; profile: UserProfile; score: number }> {
    const results: Array<{ id: string; profile: UserProfile; score: number }> = [];
    
    for (const [id, profile] of this.profiles) {
      const completion = profile.getCompletionScore();
      if (completion.score >= minScore) {
        results.push({ id, profile, score: completion.score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private generateProfileId(): string {
    return `profile-${Math.random().toString(36).substring(2, 15)}`;
  }
}

// ✅ Profile validation service
class ProfileValidationService {
  static validateBulkProfiles(profiles: UserProfile[]): {
    valid: UserProfile[];
    invalid: Array<{ profile: UserProfile; errors: string[] }>;
    duplicateEmails: Array<{ email: string; profiles: UserProfile[] }>;
  } {
    const valid: UserProfile[] = [];
    const invalid: Array<{ profile: UserProfile; errors: string[] }> = [];
    const emailMap = new Map<string, UserProfile[]>();

    // Check for duplicate emails and validation
    profiles.forEach(profile => {
      const emailStr = profile.email.toString();
      
      if (!emailMap.has(emailStr)) {
        emailMap.set(emailStr, []);
      }
      emailMap.get(emailStr)!.push(profile);

      // Validate individual profile
      try {
        const completion = profile.getCompletionScore();
        if (completion.score < 50) {
          invalid.push({
            profile,
            errors: [`Low completion score: ${completion.score}%`, ...completion.missingFields]
          });
        } else {
          valid.push(profile);
        }
      } catch (error) {
        invalid.push({
          profile,
          errors: [error instanceof Error ? error.message : 'Validation failed']
        });
      }
    });

    // Find duplicate emails
    const duplicateEmails: Array<{ email: string; profiles: UserProfile[] }> = [];
    emailMap.forEach((profileList, email) => {
      if (profileList.length > 1) {
        duplicateEmails.push({ email, profiles: profileList });
      }
    });

    return { valid, invalid, duplicateEmails };
  }
}

// Usage examples
const manager = new ProfileManager();

const { profileId, profile, warnings } = manager.createProfile({
  name: { first: 'Jane', last: 'Smith', preferred: 'Janie' },
  email: 'jane.smith@example.com',
  phone: '5559876543',
  preferences: {
    notifications: { email: true, sms: false, push: true, frequency: 'daily' },
    privacy: { profileVisibility: 'private', dataSharing: false }
  }
});

console.log(`Created profile: ${profileId}`);
console.log('Warnings:', warnings);

const analysis = manager.analyzeProfile(profileId);
console.log('Profile Analysis:');
console.log(`- Completion: ${analysis.completion.score}%`);
console.log(`- Privacy Risk: ${analysis.privacy.riskLevel}`);
console.log(`- Communication Channels: ${analysis.communication.channels.join(', ')}`);

// Update profile
const { profile: updatedProfile } = manager.updateProfile(profileId, {
  preferences: {
    privacy: { profileVisibility: 'public', dataSharing: true }
  }
});

console.log('Updated privacy risk:', updatedProfile.getPrivacyRiskAssessment().riskLevel);
```

## Key Features

- **Composite Structure**: Aggregates multiple value objects with intelligent coordination
- **Nested Validation**: Validates both individual components and their relationships
- **Profile Analysis**: Completion scoring, privacy risk assessment, and communication profiling
- **Smart Updates**: Update methods with re-validation and business rule enforcement
- **Privacy Controls**: Advanced privacy settings with risk assessment
- **Communication Intelligence**: Channel availability and preference analysis
- **Immutable Updates**: All modifications return new profile instances

## Common Pitfalls

- **Circular Validation**: Be careful when validating relationships between nested objects
- **Update Complexity**: Large composite objects can become expensive to update
- **Deep Equality**: Complex equality comparisons can be performance-intensive
- **Privacy Compliance**: Ensure privacy settings are consistently enforced
- **Data Consistency**: Maintain consistency across related profile components

## Related Examples

- [Date Range Value Object](./example-1.md) - Complex range operations and calculations
- [Basic Email Value Object](../basic/example-2.md) - Foundation component used in composition