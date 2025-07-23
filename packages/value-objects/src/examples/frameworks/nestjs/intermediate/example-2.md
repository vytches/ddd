# Intermediate Value Objects - NestJS DI Integration

**Version**: 2025-01-21
**Package**: @vytches-ddd/value-objects  
**Complexity**: Intermediate
**Framework**: NestJS
**Focus**: @vytches-ddd/di integration with enhanced composite value object capabilities
**Base Example**: [User Profile Composite](../../../intermediate/example-2.md)

## Service Implementation

```typescript
// user-profile.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { 
  CreateUserProfileDto, 
  UpdateProfileDto,
  UserProfileResponse,
  ProfileSearchCriteria,
  ProfileAnalyticsDto
} from './types'; // From your application

@Injectable()
export class UserProfileService {
  private readonly userProfileFactory: UserProfileFactory;
  private readonly profileValidationService: ProfileValidationService;
  private readonly profileAnalyticsService: ProfileAnalyticsService;
  private readonly geocodingService: GeocodingService;

  constructor() {
    // ⭐ FOCUS: @vytches-ddd/di integration for enhanced composite operations
    this.userProfileFactory = VytchesDDD.resolve<UserProfileFactory>('userProfileFactory');
    this.profileValidationService = VytchesDDD.resolve<ProfileValidationService>('profileValidationService');
    this.profileAnalyticsService = VytchesDDD.resolve<ProfileAnalyticsService>('profileAnalyticsService');
    this.geocodingService = VytchesDDD.resolve<GeocodingService>('geocodingService');
  }

  // ✅ FOCUS: Enhanced composite profile creation with DI services
  async createUserProfile(dto: CreateUserProfileDto): Promise<UserProfileResponse> {
    try {
      // Pre-validation through specialized services
      const validation = await this.profileValidationService.validateComprehensive(dto);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Profile validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Enhanced address processing with geocoding
      let processedAddress = dto.address;
      if (dto.address && !dto.address.coordinates) {
        const geocodingResult = await this.geocodingService.geocodeAddress(dto.address);
        processedAddress = {
          ...dto.address,
          coordinates: geocodingResult.coordinates,
          timezone: geocodingResult.detectedTimezone
        };
      }

      // Create composite profile using factory
      const userProfile = this.userProfileFactory.createComplete({
        personalInfo: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          middleName: dto.middleName,
          title: dto.title,
          suffix: dto.suffix,
          preferredName: dto.preferredName
        },
        email: {
          address: dto.email,
          config: dto.emailConfig
        },
        phoneNumber: dto.phoneNumber ? {
          number: dto.phoneNumber,
          countryCode: dto.countryCode,
          extension: dto.extension
        } : undefined,
        address: processedAddress,
        preferences: dto.preferences
      });

      // Enhanced analysis through DI service
      const analytics = await this.profileAnalyticsService.analyzeProfile(userProfile);

      return {
        success: true,
        data: {
          personalInfo: {
            displayName: userProfile.getDisplayName(),
            firstName: userProfile.personalInfo.firstName,
            lastName: userProfile.personalInfo.lastName,
            preferredName: userProfile.personalInfo.preferredName
          },
          email: {
            address: userProfile.email.address,
            isVerified: userProfile.email.isVerified,
            domain: userProfile.email.domain,
            deliverabilityScore: analytics.emailDeliverabilityScore
          },
          phoneNumber: userProfile.phoneNumber ? {
            formatted: userProfile.phoneNumber.getFormattedNumber(),
            countryCode: userProfile.phoneNumber.countryCode,
            type: userProfile.phoneNumber.type,
            validationScore: analytics.phoneValidationScore
          } : undefined,
          address: userProfile.address ? {
            formatted: userProfile.address.getFormattedAddress(),
            city: userProfile.address.city,
            state: userProfile.address.state,
            country: userProfile.address.country,
            coordinates: userProfile.address.coordinates,
            deliverabilityScore: analytics.addressDeliverabilityScore
          } : undefined,
          completionScore: userProfile.getCompletionScore(),
          contactSummary: userProfile.getContactSummary(),
          riskAssessment: analytics.riskAssessment,
          qualityScore: analytics.qualityScore
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user profile'
      };
    }
  }

  // ✅ FOCUS: Advanced profile operations with machine learning insights
  async analyzeProfileWithML(profileId: string, options?: ProfileAnalyticsDto): Promise<{
    insights: ProfileInsights;
    recommendations: ProfileRecommendation[];
    riskFactors: RiskFactor[];
    marketingSegments: MarketingSegment[];
  }> {
    try {
      const profile = await this.getExistingProfile(profileId);
      
      // Use ML service for advanced analytics
      const mlAnalyticsService = VytchesDDD.resolve<MLAnalyticsService>('mlAnalyticsService');
      const insights = await mlAnalyticsService.analyzeProfilePatterns(profile, options);

      // Risk assessment through DI service
      const riskService = VytchesDDD.resolve<RiskAssessmentService>('riskAssessmentService');
      const riskFactors = await riskService.assessProfile(profile);

      // Marketing segmentation
      const segmentationService = VytchesDDD.resolve<SegmentationService>('segmentationService');
      const marketingSegments = await segmentationService.categorizeProfile(profile);

      // Generate actionable recommendations
      const recommendationService = VytchesDDD.resolve<RecommendationService>('recommendationService');
      const recommendations = await recommendationService.generateProfileRecommendations(
        profile,
        insights,
        riskFactors
      );

      return {
        insights,
        recommendations,
        riskFactors,
        marketingSegments
      };
    } catch (error) {
      throw new Error(`Failed to analyze profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ✅ FOCUS: Bulk profile processing with advanced analytics
  async processBulkProfilesWithAnalytics(
    profiles: CreateUserProfileDto[],
    enableAnalytics: boolean = true
  ): Promise<{
    successful: UserProfileResponse[];
    failed: Array<{ index: number; error: string; dto: CreateUserProfileDto }>;
    analytics?: BulkProcessingAnalytics;
  }> {
    const bulkProcessor = VytchesDDD.resolve<BulkProfileProcessor>('bulkProfileProcessor');
    
    const results = await bulkProcessor.processBatch(profiles, {
      enableValidation: true,
      enableGeocoding: true,
      enableAnalytics,
      batchSize: 50,
      concurrency: 10
    });

    let analytics: BulkProcessingAnalytics | undefined;
    
    if (enableAnalytics && results.successful.length > 0) {
      const analyticsService = VytchesDDD.resolve<BulkAnalyticsService>('bulkAnalyticsService');
      analytics = await analyticsService.analyzeBatch(results.successful);
    }

    return {
      successful: results.successful,
      failed: results.failed,
      analytics
    };
  }

  // ✅ FOCUS: Smart profile matching and deduplication
  async findSimilarProfiles(
    profileId: string,
    similarityThreshold: number = 0.8
  ): Promise<Array<{
    profile: UserProfileResponse;
    similarityScore: number;
    matchingFields: string[];
    confidence: number;
  }>> {
    try {
      const targetProfile = await this.getExistingProfile(profileId);
      const matchingService = VytchesDDD.resolve<ProfileMatchingService>('profileMatchingService');
      
      return await matchingService.findSimilarProfiles(targetProfile, {
        threshold: similarityThreshold,
        includePhoneMatching: true,
        includeEmailMatching: true,
        includeAddressMatching: true,
        includeNameMatching: true,
        maxResults: 10
      });
    } catch (error) {
      throw new Error(`Failed to find similar profiles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ✅ FOCUS: Profile quality enhancement suggestions
  async enhanceProfileQuality(profileId: string): Promise<{
    currentQualityScore: number;
    enhancementSuggestions: EnhancementSuggestion[];
    potentialQualityScore: number;
    estimatedImpact: QualityImpact;
  }> {
    try {
      const profile = await this.getExistingProfile(profileId);
      const qualityService = VytchesDDD.resolve<ProfileQualityService>('profileQualityService');
      
      const currentScore = await qualityService.calculateQualityScore(profile);
      const suggestions = await qualityService.generateEnhancementSuggestions(profile);
      const potentialScore = await qualityService.calculatePotentialScore(profile, suggestions);
      const impact = await qualityService.estimateImpact(suggestions);

      return {
        currentQualityScore: currentScore,
        enhancementSuggestions: suggestions,
        potentialQualityScore: potentialScore,
        estimatedImpact: impact
      };
    } catch (error) {
      throw new Error(`Failed to enhance profile quality: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ✅ FOCUS: Advanced search with fuzzy matching
  async advancedProfileSearch(criteria: AdvancedSearchCriteria): Promise<{
    profiles: UserProfileResponse[];
    totalCount: number;
    facets: SearchFacet[];
    suggestions: string[];
  }> {
    try {
      const searchService = VytchesDDD.resolve<AdvancedSearchService>('advancedSearchService');
      
      return await searchService.search(criteria, {
        enableFuzzyMatching: true,
        enablePhoneticMatching: true,
        enableSemanticSearch: true,
        includeFacets: true,
        includeSuggestions: true
      });
    } catch (error) {
      throw new Error(`Failed to perform advanced search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getExistingProfile(profileId: string): Promise<UserProfile> {
    // Mock implementation - in real app would fetch from database
    throw new Error('Profile not found');
  }
}
```

## Date Range Service with Enhanced Analytics

```typescript
// date-range.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { 
  CreateDateRangeDto, 
  DateRangeResponse,
  BusinessDayCalculationDto,
  DateRangeAnalyticsDto
} from './types'; // From your application

@Injectable()
export class DateRangeService {
  private readonly dateRangeFactory: DateRangeFactory;
  private readonly businessCalendarService: BusinessCalendarService;
  private readonly dateAnalyticsService: DateAnalyticsService;
  private readonly workforceOptimizationService: WorkforceOptimizationService;

  constructor() {
    // ⭐ FOCUS: Enhanced date range capabilities through DI
    this.dateRangeFactory = VytchesDDD.resolve<DateRangeFactory>('dateRangeFactory');
    this.businessCalendarService = VytchesDDD.resolve<BusinessCalendarService>('businessCalendarService');
    this.dateAnalyticsService = VytchesDDD.resolve<DateAnalyticsService>('dateAnalyticsService');
    this.workforceOptimizationService = VytchesDDD.resolve<WorkforceOptimizationService>('workforceOptimizationService');
  }

  // ✅ FOCUS: Enhanced date range creation with business intelligence
  async createDateRangeWithAnalytics(dto: CreateDateRangeDto): Promise<{
    dateRange: DateRangeResponse;
    analytics: DateRangeAnalytics;
    businessInsights: BusinessInsights;
  }> {
    try {
      const dateRange = this.dateRangeFactory.create({
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        timezone: dto.timezone,
        inclusive: dto.inclusive
      });

      // Get business calendar context
      const businessContext = await this.businessCalendarService.getCalendarContext(
        dateRange.startDate,
        dateRange.endDate,
        dto.businessCalendarId
      );

      // Generate analytics
      const analytics = await this.dateAnalyticsService.analyzeRange(dateRange, businessContext);

      // Business insights
      const businessInsights = await this.generateBusinessInsights(dateRange, businessContext);

      return {
        dateRange: {
          success: true,
          data: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            duration: dateRange.durationInDays,
            timezone: dateRange.timezone,
            humanReadable: dateRange.toHumanReadable(),
            isCurrent: dateRange.isCurrent(),
            businessDays: analytics.businessDaysCount,
            holidays: businessContext.holidays.length,
            weekends: analytics.weekendDaysCount
          }
        },
        analytics,
        businessInsights
      };
    } catch (error) {
      return {
        dateRange: {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create date range'
        },
        analytics: {} as DateRangeAnalytics,
        businessInsights: {} as BusinessInsights
      };
    }
  }

  // ✅ FOCUS: Workforce optimization using date ranges
  async optimizeWorkforceScheduling(
    planningPeriod: CreateDateRangeDto,
    workforceRequirements: WorkforceRequirement[]
  ): Promise<{
    optimalSchedule: WorkSchedule[];
    utilizationRate: number;
    costAnalysis: CostAnalysis;
    recommendations: SchedulingRecommendation[];
  }> {
    try {
      const planningRange = this.dateRangeFactory.create({
        startDate: new Date(planningPeriod.startDate),
        endDate: new Date(planningPeriod.endDate),
        timezone: planningPeriod.timezone
      });

      return await this.workforceOptimizationService.optimizeSchedule(
        planningRange,
        workforceRequirements,
        {
          considerHolidays: true,
          respectBusinessHours: true,
          minimizeCosts: true,
          maximizeUtilization: true
        }
      );
    } catch (error) {
      throw new Error(`Failed to optimize workforce scheduling: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ✅ FOCUS: Resource capacity planning
  async planResourceCapacity(
    planningHorizon: CreateDateRangeDto,
    historicalData: HistoricalDemand[],
    capacityConstraints: CapacityConstraint[]
  ): Promise<{
    capacityPlan: CapacityPlan;
    demandForecast: DemandForecast[];
    bottlenecks: CapacityBottleneck[];
    scalingRecommendations: ScalingRecommendation[];
  }> {
    try {
      const horizon = this.dateRangeFactory.create({
        startDate: new Date(planningHorizon.startDate),
        endDate: new Date(planningHorizon.endDate),
        timezone: planningHorizon.timezone
      });

      const capacityPlanningService = VytchesDDD.resolve<CapacityPlanningService>('capacityPlanningService');
      
      return await capacityPlanningService.createCapacityPlan(
        horizon,
        historicalData,
        capacityConstraints,
        {
          includeMachineLearningForecast: true,
          considerSeasonality: true,
          includeSensitivityAnalysis: true,
          generateScenarios: true
        }
      );
    } catch (error) {
      throw new Error(`Failed to plan resource capacity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateBusinessInsights(
    dateRange: DateRange,
    businessContext: BusinessCalendarContext
  ): Promise<BusinessInsights> {
    // Generate business insights based on date range and context
    return {
      productivityScore: 0.85,
      seasonalityFactors: [],
      marketingWindows: [],
      competitiveAdvantages: []
    };
  }
}
```

## Module Configuration with Advanced DI Setup

```typescript
// app.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { UserProfileModule } from './user-profile/user-profile.module';
import { DateRangeModule } from './date-range/date-range.module';

@Module({
  imports: [
    UserProfileModule,
    DateRangeModule,
  ],
})
export class AppModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD DI with advanced services
    const container = new SimpleContainer();
    
    // Register enhanced user profile services
    this.registerUserProfileServices(container);
    this.registerDateRangeServices(container);
    this.registerAnalyticsServices(container);
    this.registerMachineLearningServices(container);
    
    await VytchesDDD.configure(container);
  }

  private registerUserProfileServices(container: SimpleContainer) {
    // Enhanced user profile services
    container.registerInstance('userProfileFactory', new EnhancedUserProfileFactory());
    container.registerInstance('profileValidationService', new ComprehensiveProfileValidationService());
    container.registerInstance('profileAnalyticsService', new AdvancedProfileAnalyticsService());
    container.registerInstance('geocodingService', new SmartGeocodingService());
    container.registerInstance('bulkProfileProcessor', new OptimizedBulkProfileProcessor());
    container.registerInstance('profileMatchingService', new MLProfileMatchingService());
    container.registerInstance('profileQualityService', new AIProfileQualityService());
    container.registerInstance('advancedSearchService', new SemanticProfileSearchService());
  }

  private registerDateRangeServices(container: SimpleContainer) {
    // Enhanced date range services
    container.registerInstance('dateRangeFactory', new SmartDateRangeFactory());
    container.registerInstance('businessCalendarService', new GlobalBusinessCalendarService());
    container.registerInstance('dateAnalyticsService', new PredictiveDateAnalyticsService());
    container.registerInstance('workforceOptimizationService', new AIWorkforceOptimizer());
    container.registerInstance('capacityPlanningService', new MLCapacityPlanningService());
    container.registerInstance('timelineOptimizer', new AdvancedTimelineOptimizer());
    container.registerInstance('smartHolidayService', new IntelligentHolidayService());
  }

  private registerAnalyticsServices(container: SimpleContainer) {
    // Analytics and ML services
    container.registerInstance('mlAnalyticsService', new MachineLearningAnalyticsService());
    container.registerInstance('riskAssessmentService', new AIRiskAssessmentService());
    container.registerInstance('segmentationService', new MLSegmentationService());
    container.registerInstance('recommendationService', new AIRecommendationEngine());
    container.registerInstance('bulkAnalyticsService', new ScalableBulkAnalyticsService());
  }

  private registerMachineLearningServices(container: SimpleContainer) {
    // ML and AI services
    container.registerInstance('mlModelService', new ProfileMLModelService());
    container.registerInstance('predictionService', new BehaviorPredictionService());
    container.registerInstance('anomalyDetectionService', new ProfileAnomalyDetectionService());
    container.registerInstance('optimizationService', new GeneticOptimizationService());
  }
}
```

## Usage Example

```typescript
// order.service.ts
@Injectable()
export class OrderService {
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly dateRangeService: DateRangeService
  ) {}

  async processAdvancedOrder(orderDto: CreateOrderDto) {
    // Enhanced profile analytics for fraud detection
    const profileAnalysis = await this.userProfileService.analyzeProfileWithML(
      orderDto.customerId,
      { includeFraudDetection: true, includeRiskAssessment: true }
    );

    if (profileAnalysis.riskFactors.some(risk => risk.severity === 'high')) {
      throw new Error('Order flagged for manual review due to high risk profile');
    }

    // Optimize delivery scheduling using workforce optimization
    const deliveryWindow = await this.dateRangeService.optimizeWorkforceScheduling(
      {
        startDate: orderDto.requestedDeliveryDate,
        endDate: orderDto.latestDeliveryDate,
        timezone: orderDto.timezone
      },
      [{
        skillSet: 'delivery',
        minWorkers: 1,
        preferredTimeWindows: ['09:00-17:00']
      }]
    );

    // Find similar profiles for personalization
    const similarProfiles = await this.userProfileService.findSimilarProfiles(
      orderDto.customerId,
      0.85
    );

    return {
      orderId: 'order-123',
      customerRiskScore: profileAnalysis.insights.riskScore,
      recommendedDeliverySlots: deliveryWindow.optimalSchedule,
      personalizationSegment: profileAnalysis.marketingSegments[0]?.name,
      similarCustomersCount: similarProfiles.length
    };
  }
}
```

## Key Points

- **@vytches-ddd/di Integration**: Advanced service composition with machine learning capabilities
- **Composite Value Objects**: Enhanced creation and management of complex nested structures
- **Analytics Integration**: Deep insights through ML-powered analytics services
- **Bulk Processing**: Scalable operations with concurrent processing and optimization
- **Advanced Search**: Semantic search with fuzzy matching and faceted results
- **Business Intelligence**: Data-driven insights for decision making

## Benefits

- **AI-Enhanced Capabilities**: Machine learning integration for intelligent operations
- **Enterprise Scalability**: Bulk processing and optimization for high-volume scenarios
- **Advanced Analytics**: Deep insights into data quality, risk assessment, and patterns
- **Smart Automation**: Automated enhancement suggestions and quality improvements
- **Flexible Architecture**: Service composition enables complex business requirements