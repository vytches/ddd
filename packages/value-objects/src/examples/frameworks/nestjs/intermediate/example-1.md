# Intermediate Value Objects - NestJS Manual Setup

**Version**: 2025-01-21
**Package**: @vytches-ddd/value-objects  
**Complexity**: Intermediate
**Framework**: NestJS
**Focus**: Manual setup for complex composite value objects
**Base Example**: [User Profile Composite](../../../intermediate/example-2.md)

## Service Implementation

```typescript
// user-profile.service.ts
import { Injectable } from '@nestjs/common';
import { UserProfile, PersonName, PhoneNumber } from '@vytches-ddd/value-objects';
import { Email } from '@vytches-ddd/value-objects';
import { Address } from '@vytches-ddd/value-objects';
import { 
  CreateUserProfileDto, 
  UpdateProfileDto,
  UserProfileResponse 
} from './types'; // From your application

@Injectable()
export class UserProfileService {
  // ✅ FOCUS: Create comprehensive user profile
  createUserProfile(dto: CreateUserProfileDto): UserProfileResponse {
    try {
      // Create nested value objects
      const personalInfo = PersonName.create(
        dto.firstName,
        dto.lastName,
        dto.middleName,
        dto.title,
        dto.suffix,
        dto.preferredName
      );

      const email = Email.create(dto.email, dto.emailConfig);
      
      const phoneNumber = dto.phoneNumber 
        ? PhoneNumber.create(dto.phoneNumber, dto.countryCode, dto.extension)
        : undefined;

      const address = dto.address ? Address.create(
        dto.address.street,
        dto.address.city,
        dto.address.state,
        dto.address.postalCode,
        dto.address.country,
        dto.address.coordinates
      ) : undefined;

      const userProfile = UserProfile.create(
        personalInfo,
        email,
        phoneNumber,
        address,
        dto.preferences
      );

      return {
        success: true,
        data: {
          personalInfo: {
            displayName: userProfile.getDisplayName(),
            firstName: personalInfo.firstName,
            lastName: personalInfo.lastName,
            preferredName: personalInfo.preferredName
          },
          email: {
            address: email.address,
            isVerified: email.isVerified,
            domain: email.domain
          },
          phoneNumber: phoneNumber ? {
            formatted: phoneNumber.getFormattedNumber(),
            countryCode: phoneNumber.countryCode,
            type: phoneNumber.type
          } : undefined,
          address: address ? {
            formatted: address.getFormattedAddress(),
            city: address.city,
            state: address.state,
            country: address.country
          } : undefined,
          completionScore: userProfile.getCompletionScore(),
          contactSummary: userProfile.getContactSummary()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user profile'
      };
    }
  }

  // ✅ FOCUS: Update profile with validation
  updateUserProfile(profileId: string, dto: UpdateProfileDto): UserProfileResponse {
    try {
      // In real implementation, would fetch existing profile
      const existingProfile = this.getExistingProfile(profileId);
      
      let updatedProfile = existingProfile;

      // Update personal information if provided
      if (dto.personalInfo) {
        const newPersonalInfo = PersonName.create(
          dto.personalInfo.firstName || existingProfile.personalInfo.firstName,
          dto.personalInfo.lastName || existingProfile.personalInfo.lastName,
          dto.personalInfo.middleName || existingProfile.personalInfo.middleName,
          dto.personalInfo.title,
          dto.personalInfo.suffix,
          dto.personalInfo.preferredName
        );
        updatedProfile = updatedProfile.updatePersonalInfo(newPersonalInfo);
      }

      // Update email if provided
      if (dto.email) {
        const newEmail = Email.create(dto.email);
        updatedProfile = updatedProfile.updateEmail(newEmail);
      }

      // Update preferences if provided
      if (dto.preferences) {
        updatedProfile = updatedProfile.updatePreferences(dto.preferences);
      }

      return {
        success: true,
        data: this.mapProfileToResponse(updatedProfile)
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user profile'
      };
    }
  }

  // ✅ FOCUS: Profile analysis and insights
  analyzeProfile(profileId: string): {
    completionAnalysis: ReturnType<UserProfile['getCompletionScore']>;
    privacyRisk: ReturnType<UserProfile['getPrivacyRiskAssessment']>;
    communicationProfile: ReturnType<UserProfile['getCommunicationProfile']>;
    recommendations: string[];
  } {
    const profile = this.getExistingProfile(profileId);
    
    const completion = profile.getCompletionScore();
    const privacy = profile.getPrivacyRiskAssessment();
    const communication = profile.getCommunicationProfile();

    const recommendations: string[] = [];
    
    // Generate recommendations based on analysis
    if (completion.score < 70) {
      recommendations.push(...completion.recommendations);
    }
    
    if (privacy.riskLevel === 'high') {
      recommendations.push(...privacy.recommendations);
    }
    
    if (communication.channels.length < 2) {
      recommendations.push('Consider adding additional communication methods');
    }

    return {
      completionAnalysis: completion,
      privacyRisk: privacy,
      communicationProfile: communication,
      recommendations
    };
  }

  // ✅ FOCUS: Bulk profile operations
  processBulkProfiles(profiles: CreateUserProfileDto[]): {
    successful: UserProfileResponse[];
    failed: Array<{ index: number; error: string; dto: CreateUserProfileDto }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
      successRate: number;
    };
  } {
    const successful: UserProfileResponse[] = [];
    const failed: Array<{ index: number; error: string; dto: CreateUserProfileDto }> = [];

    profiles.forEach((dto, index) => {
      const result = this.createUserProfile(dto);
      
      if (result.success) {
        successful.push(result);
      } else {
        failed.push({
          index,
          error: result.error || 'Unknown error',
          dto
        });
      }
    });

    return {
      successful,
      failed,
      summary: {
        total: profiles.length,
        successful: successful.length,
        failed: failed.length,
        successRate: successful.length / profiles.length
      }
    };
  }

  // ✅ FOCUS: Profile search and filtering
  searchProfiles(criteria: ProfileSearchCriteria): UserProfileResponse[] {
    // In real implementation, would query database
    const allProfiles = this.getAllProfiles();
    
    return allProfiles.filter(profile => {
      if (criteria.completionScoreMin && profile.data?.completionScore.score < criteria.completionScoreMin) {
        return false;
      }
      
      if (criteria.hasPhoneNumber !== undefined) {
        const hasPhone = !!profile.data?.phoneNumber;
        if (criteria.hasPhoneNumber !== hasPhone) {
          return false;
        }
      }
      
      if (criteria.preferredLanguage && 
          profile.data?.preferences?.language !== criteria.preferredLanguage) {
        return false;
      }
      
      if (criteria.emailDomain) {
        const emailDomain = profile.data?.email.domain;
        if (!emailDomain?.includes(criteria.emailDomain)) {
          return false;
        }
      }

      return true;
    });
  }

  // ✅ FOCUS: Profile validation
  validateProfile(dto: CreateUserProfileDto): {
    isValid: boolean;
    errors: Array<{ field: string; message: string }>;
    warnings: Array<{ field: string; message: string }>;
  } {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    // Validate required fields
    if (!dto.firstName || dto.firstName.trim().length === 0) {
      errors.push({ field: 'firstName', message: 'First name is required' });
    }

    if (!dto.lastName || dto.lastName.trim().length === 0) {
      errors.push({ field: 'lastName', message: 'Last name is required' });
    }

    if (!dto.email || dto.email.trim().length === 0) {
      errors.push({ field: 'email', message: 'Email is required' });
    }

    // Validate email format
    if (dto.email) {
      try {
        Email.create(dto.email);
      } catch (error) {
        errors.push({ 
          field: 'email', 
          message: error instanceof Error ? error.message : 'Invalid email format'
        });
      }
    }

    // Validate phone number format
    if (dto.phoneNumber) {
      try {
        PhoneNumber.create(dto.phoneNumber, dto.countryCode);
      } catch (error) {
        errors.push({ 
          field: 'phoneNumber', 
          message: error instanceof Error ? error.message : 'Invalid phone number format'
        });
      }
    }

    // Business rule validations
    if (dto.preferences?.notifications?.sms && !dto.phoneNumber) {
      warnings.push({
        field: 'preferences.notifications.sms',
        message: 'SMS notifications enabled but no phone number provided'
      });
    }

    if (dto.preferences?.privacy?.profileVisibility === 'public' && dto.emailConfig?.requireVerification === false) {
      warnings.push({
        field: 'preferences.privacy.profileVisibility',
        message: 'Public profile recommended with verified email'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private getExistingProfile(profileId: string): UserProfile {
    // Mock implementation - in real app would fetch from database
    throw new Error('Profile not found');
  }

  private getAllProfiles(): UserProfileResponse[] {
    // Mock implementation - in real app would query database
    return [];
  }

  private mapProfileToResponse(profile: UserProfile): any {
    return {
      personalInfo: {
        displayName: profile.getDisplayName(),
        firstName: profile.personalInfo.firstName,
        lastName: profile.personalInfo.lastName
      },
      email: {
        address: profile.email.address,
        isVerified: profile.email.isVerified
      },
      completionScore: profile.getCompletionScore(),
      contactSummary: profile.getContactSummary()
    };
  }
}
```

## Date Range Service

```typescript
// date-range.service.ts
import { Injectable } from '@nestjs/common';
import { DateRange } from '@vytches-ddd/value-objects';
import { 
  CreateDateRangeDto, 
  DateRangeResponse,
  BusinessDayCalculationDto 
} from './types'; // From your application

@Injectable()
export class DateRangeService {
  // ✅ FOCUS: Create and validate date ranges
  createDateRange(dto: CreateDateRangeDto): DateRangeResponse {
    try {
      const dateRange = DateRange.create(
        new Date(dto.startDate),
        new Date(dto.endDate),
        dto.timezone,
        dto.inclusive
      );

      return {
        success: true,
        data: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          duration: dateRange.durationInDays,
          timezone: dateRange.timezone,
          humanReadable: dateRange.toHumanReadable(),
          isoCurrent: dateRange.isCurrent(),
          businessDays: dateRange.getBusinessDaysCount()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create date range'
      };
    }
  }

  // ✅ FOCUS: Business day calculations
  calculateBusinessDays(dto: BusinessDayCalculationDto): {
    businessDays: number;
    weekendDays: number;
    holidays: number;
    breakdown: {
      totalDays: number;
      workingDays: number;
      nonWorkingDays: number;
    };
  } {
    const dateRange = DateRange.create(
      new Date(dto.startDate),
      new Date(dto.endDate),
      dto.timezone
    );

    const holidays = dto.holidays?.map(h => new Date(h)) || [];
    const calculation = dateRange.getDurationCalculation(holidays);

    return {
      businessDays: calculation.businessDays,
      weekendDays: dateRange.getWeekendDaysCount(),
      holidays: dateRange.getHolidaysCount(holidays),
      breakdown: {
        totalDays: calculation.durationDays,
        workingDays: calculation.businessDays,
        nonWorkingDays: calculation.durationDays - calculation.businessDays
      }
    };
  }

  // ✅ FOCUS: Range operations
  analyzeRangeOverlap(range1Dto: CreateDateRangeDto, range2Dto: CreateDateRangeDto): {
    hasOverlap: boolean;
    overlapRange?: DateRangeResponse['data'];
    gap?: DateRangeResponse['data'];
    relationship: 'overlaps' | 'adjacent' | 'separate' | 'contains' | 'contained';
  } {
    const range1 = DateRange.create(
      new Date(range1Dto.startDate),
      new Date(range1Dto.endDate)
    );
    
    const range2 = DateRange.create(
      new Date(range2Dto.startDate),
      new Date(range2Dto.endDate)
    );

    const hasOverlap = range1.overlaps(range2);
    const overlap = range1.intersect(range2);
    const gap = range1.gap(range2);

    // Determine relationship
    let relationship: 'overlaps' | 'adjacent' | 'separate' | 'contains' | 'contained' = 'separate';
    
    if (hasOverlap) {
      if (range1.startDate <= range2.startDate && range1.endDate >= range2.endDate) {
        relationship = 'contains';
      } else if (range2.startDate <= range1.startDate && range2.endDate >= range1.endDate) {
        relationship = 'contained';
      } else {
        relationship = 'overlaps';
      }
    } else if (gap && gap.durationInDays <= 1) {
      relationship = 'adjacent';
    }

    return {
      hasOverlap,
      overlapRange: overlap ? {
        startDate: overlap.startDate,
        endDate: overlap.endDate,
        duration: overlap.durationInDays,
        humanReadable: overlap.toHumanReadable()
      } : undefined,
      gap: gap ? {
        startDate: gap.startDate,
        endDate: gap.endDate,
        duration: gap.durationInDays,
        humanReadable: gap.toHumanReadable()
      } : undefined,
      relationship
    };
  }

  // ✅ FOCUS: Range chunking and iteration
  chunkDateRange(dto: CreateDateRangeDto, chunkType: 'days' | 'weeks' | 'months', chunkSize?: number): {
    chunks: Array<{
      startDate: Date;
      endDate: Date;
      duration: number;
      chunkIndex: number;
    }>;
    totalChunks: number;
    coverage: {
      totalDays: number;
      chunkedDays: number;
      coveragePercentage: number;
    };
  } {
    const dateRange = DateRange.create(
      new Date(dto.startDate),
      new Date(dto.endDate)
    );

    let chunks: DateRange[];
    
    switch (chunkType) {
      case 'days':
        chunks = dateRange.chunkByDays(chunkSize || 1);
        break;
      case 'weeks':
        chunks = dateRange.chunkByWeeks();
        break;
      case 'months':
        chunks = dateRange.chunkByMonths();
        break;
    }

    const chunkData = chunks.map((chunk, index) => ({
      startDate: chunk.startDate,
      endDate: chunk.endDate,
      duration: chunk.durationInDays,
      chunkIndex: index
    }));

    const totalDays = dateRange.durationInDays;
    const chunkedDays = chunks.reduce((sum, chunk) => sum + chunk.durationInDays, 0);

    return {
      chunks: chunkData,
      totalChunks: chunks.length,
      coverage: {
        totalDays,
        chunkedDays,
        coveragePercentage: (chunkedDays / totalDays) * 100
      }
    };
  }

  // ✅ FOCUS: Schedule optimization
  findOptimalTimeSlots(
    availableRange: CreateDateRangeDto,
    requiredDuration: number, // in days
    preferredStartDates: string[],
    excludeRanges?: CreateDateRangeDto[]
  ): Array<{
    startDate: Date;
    endDate: Date;
    score: number;
    reason: string;
  }> {
    const available = DateRange.create(
      new Date(availableRange.startDate),
      new Date(availableRange.endDate)
    );

    const excluded = excludeRanges?.map(range => 
      DateRange.create(new Date(range.startDate), new Date(range.endDate))
    ) || [];

    const preferred = preferredStartDates.map(date => new Date(date));
    const slots: Array<{ startDate: Date; endDate: Date; score: number; reason: string }> = [];

    // Simple slot finding algorithm
    const currentDate = new Date(available.startDate);
    
    while (currentDate <= new Date(available.endDate.getTime() - (requiredDuration * 24 * 60 * 60 * 1000))) {
      const slotEnd = new Date(currentDate.getTime() + (requiredDuration * 24 * 60 * 60 * 1000));
      const candidateSlot = DateRange.create(currentDate, slotEnd);

      // Check for conflicts with excluded ranges
      const hasConflict = excluded.some(excludedRange => 
        candidateSlot.overlaps(excludedRange)
      );

      if (!hasConflict) {
        // Calculate score based on preference
        let score = 50; // Base score
        let reason = 'Available slot';

        // Boost score if near preferred dates
        const nearPreferred = preferred.some(prefDate => 
          Math.abs(currentDate.getTime() - prefDate.getTime()) < (7 * 24 * 60 * 60 * 1000)
        );

        if (nearPreferred) {
          score += 30;
          reason = 'Near preferred date';
        }

        // Boost score for business days
        if (candidateSlot.getBusinessDaysCount() === requiredDuration) {
          score += 20;
          reason = 'All business days';
        }

        slots.push({
          startDate: new Date(currentDate),
          endDate: slotEnd,
          score,
          reason
        });
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sort by score and return top options
    return slots
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Top 10 options
  }
}
```

## Controller Implementation

```typescript
// user-profile.controller.ts
import { Controller, Post, Body, Get, Param, Put, Query } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { DateRangeService } from './date-range.service';
import { 
  CreateUserProfileDto, 
  UpdateProfileDto, 
  ProfileSearchCriteria,
  CreateDateRangeDto 
} from './types'; // From your application

@Controller('profiles')
export class UserProfileController {
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly dateRangeService: DateRangeService
  ) {}

  @Post()
  createProfile(@Body() dto: CreateUserProfileDto) {
    return this.userProfileService.createUserProfile(dto);
  }

  @Put(':id')
  updateProfile(@Param('id') id: string, @Body() dto: UpdateProfileDto) {
    return this.userProfileService.updateUserProfile(id, dto);
  }

  @Get(':id/analysis')
  analyzeProfile(@Param('id') id: string) {
    return this.userProfileService.analyzeProfile(id);
  }

  @Post('validate')
  validateProfile(@Body() dto: CreateUserProfileDto) {
    return this.userProfileService.validateProfile(dto);
  }

  @Post('bulk')
  processBulkProfiles(@Body() profiles: CreateUserProfileDto[]) {
    return this.userProfileService.processBulkProfiles(profiles);
  }

  @Get('search')
  searchProfiles(@Query() criteria: ProfileSearchCriteria) {
    return this.userProfileService.searchProfiles(criteria);
  }

  @Post('date-ranges')
  createDateRange(@Body() dto: CreateDateRangeDto) {
    return this.dateRangeService.createDateRange(dto);
  }

  @Post('date-ranges/business-days')
  calculateBusinessDays(@Body() dto: any) {
    return this.dateRangeService.calculateBusinessDays(dto);
  }
}
```

## Key Points

- **Composite Value Objects**: Handles complex nested value object creation
- **Business Logic**: Advanced operations like profile analysis and optimization
- **Validation**: Multi-layer validation with business rules
- **Batch Operations**: Efficient processing of multiple profiles
- **Search & Filtering**: Profile search with complex criteria
- **Date Range Operations**: Advanced temporal calculations and chunking

## Benefits

- **Rich Domain Logic**: Complex business operations encapsulated in services
- **Type Safety**: Full TypeScript support with proper error handling
- **Scalability**: Bulk operations for high-throughput scenarios
- **Business Intelligence**: Profile scoring and recommendation systems
- **Flexibility**: Configurable operations and search criteria