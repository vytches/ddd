import { Result } from '@vytches-ddd/utils';
import type {
  IBusinessPolicy,
  PolicyRequest,
  PolicyContext,
  IPolicyComposer,
  IPolicyConditionalBuilder,
  PolicyCondition,
} from '../core/interfaces/business-policy.interface';
import { PolicyViolation } from '../core/models/policy-violation';

/**
 * Business calendar configuration for temporal policies
 */
export interface BusinessCalendar {
  /**
   * Business hours definition
   */
  businessHours?: {
    start: string; // 'HH:MM' format
    end: string; // 'HH:MM' format
  };

  /**
   * Working days (0 = Sunday, 6 = Saturday)
   */
  workingDays?: number[];

  /**
   * Holiday dates
   */
  holidays?: Date[];

  /**
   * Timezone for temporal calculations
   */
  timezone?: string;
}

/**
 * Temporal condition function type
 */
export type TemporalCondition<T> = (
  entity: T,
  context: PolicyContext,
  temporal: TemporalInfo
) => boolean | Promise<boolean>;

/**
 * Temporal information provided to conditions and policies
 */
export interface TemporalInfo {
  timestamp: Date;
  timezone: string;
  isBusinessHours: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  dayOfWeek: number; // 0 = Sunday
  timeOfDay: string; // 'HH:MM' format
}

/**
 * Configuration for temporal policy decorator
 */
export interface TemporalPolicyConfig {
  /**
   * Business calendar for time-based decisions
   */
  businessCalendar: BusinessCalendar;

  /**
   * Policy to use during business hours
   */
  businessHoursPolicy?: IBusinessPolicy<unknown>;

  /**
   * Policy to use during weekends
   */
  weekendPolicy?: IBusinessPolicy<unknown>;

  /**
   * Policy to use during holidays
   */
  holidayPolicy?: IBusinessPolicy<unknown>;

  /**
   * Policy to use during after hours
   */
  afterHoursPolicy?: IBusinessPolicy<unknown>;

  /**
   * Custom temporal conditions with associated policies
   */
  customConditions?: Array<{
    condition: TemporalCondition<unknown>;
    policy: IBusinessPolicy<unknown>;
    name: string;
  }>;

  /**
   * Fallback policy when no temporal condition matches
   */
  fallbackPolicy?: IBusinessPolicy<unknown>;

  /**
   * Whether to include temporal info in violation details
   */
  includeTemporalInfo?: boolean;
}

/**
 * Temporal policy decorator - applies different policies based on time
 * Business-focused temporal rules - NOT generic time handling
 */
export class PolicyTemporalBehavior<T> implements IBusinessPolicy<T> {
  public readonly id: string;
  public readonly domain: string;
  public readonly name: string;

  constructor(
    private readonly basePolicy: IBusinessPolicy<T>,
    private readonly config: TemporalPolicyConfig
  ) {
    this.id = `temporal_${basePolicy.id}`;
    this.domain = basePolicy.domain;
    this.name = `Temporal ${basePolicy.name}`;
  }

  /**
   * Check policy with temporal logic
   */
  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    const temporal = this.buildTemporalInfo(request.context);
    const selectedPolicy = await this.selectPolicy(request.entity, request.context, temporal);

    try {
      const result = await selectedPolicy.check(request);

      // Enhance violation with temporal info if enabled
      if (result.isFailure && this.config.includeTemporalInfo) {
        const enhancedViolation = new PolicyViolation({
          code: result.error.code,
          message: result.error.message,
          severity: result.error.severity,
          ...(result.error.field && { field: result.error.field }),
          policyId: this.id,
          domain: this.domain,
          context: request.context,
          details: {
            ...result.error.details,
            temporal,
            selectedPolicy: selectedPolicy.id,
            temporalReason: this.getTemporalReason(temporal),
          },
        });

        return Result.fail(enhancedViolation);
      }

      return result;
    } catch (error) {
      const violation = new PolicyViolation({
        code: 'TEMPORAL_POLICY_ERROR',
        message: `Temporal policy execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'ERROR',
        policyId: this.id,
        domain: this.domain,
        context: request.context,
        details: {
          temporal,
          selectedPolicy: selectedPolicy.id,
          originalError: error,
        },
      });

      return Result.fail(violation);
    }
  }

  /**
   * Select appropriate policy based on temporal conditions
   */
  private async selectPolicy(
    entity: T,
    context: PolicyContext,
    temporal: TemporalInfo
  ): Promise<IBusinessPolicy<T>> {
    // Check custom conditions first (highest priority)
    if (this.config.customConditions) {
      for (const { condition, policy, name } of this.config.customConditions) {
        try {
          const matches = await condition(entity, context, temporal);
          if (matches) {
            return policy as IBusinessPolicy<T>;
          }
        } catch (error) {
          // Log error but continue to next condition
          console.warn(`Temporal condition '${name}' failed:`, error);
        }
      }
    }

    // Check predefined temporal conditions
    if (temporal.isHoliday && this.config.holidayPolicy) {
      return this.config.holidayPolicy as IBusinessPolicy<T>;
    }

    if (temporal.isWeekend && this.config.weekendPolicy) {
      return this.config.weekendPolicy as IBusinessPolicy<T>;
    }

    if (temporal.isBusinessHours && this.config.businessHoursPolicy) {
      return this.config.businessHoursPolicy as IBusinessPolicy<T>;
    }

    if (!temporal.isBusinessHours && this.config.afterHoursPolicy) {
      return this.config.afterHoursPolicy as IBusinessPolicy<T>;
    }

    // Use fallback or base policy
    return (this.config.fallbackPolicy || this.basePolicy) as IBusinessPolicy<T>;
  }

  /**
   * Build temporal information from context
   */
  private buildTemporalInfo(context: PolicyContext): TemporalInfo {
    const timestamp = context.timestamp || new Date();
    const timezone = this.config.businessCalendar.timezone || 'UTC';

    // For simplicity, using basic date operations
    // In production, consider using a proper timezone library
    const dayOfWeek = timestamp.getDay();
    const timeOfDay = this.formatTime(timestamp);

    const isWeekend = this.isWeekend(dayOfWeek);
    const isHoliday = this.isHoliday(timestamp);
    const isBusinessHours = this.isBusinessHours(timestamp, dayOfWeek);

    return {
      timestamp,
      timezone,
      isBusinessHours,
      isWeekend,
      isHoliday,
      dayOfWeek,
      timeOfDay,
    };
  }

  /**
   * Check if current time is weekend
   */
  private isWeekend(dayOfWeek: number): boolean {
    const workingDays = this.config.businessCalendar.workingDays || [1, 2, 3, 4, 5]; // Mon-Fri
    return !workingDays.includes(dayOfWeek);
  }

  /**
   * Check if current date is holiday
   */
  private isHoliday(timestamp: Date): boolean {
    if (!this.config.businessCalendar.holidays) {
      return false;
    }

    const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
    return this.config.businessCalendar.holidays.some(
      holiday => holiday.toISOString().split('T')[0] === dateStr
    );
  }

  /**
   * Check if current time is within business hours
   */
  private isBusinessHours(timestamp: Date, dayOfWeek: number): boolean {
    if (this.isWeekend(dayOfWeek)) {
      return false;
    }

    const businessHours = this.config.businessCalendar.businessHours;
    if (!businessHours) {
      return true; // No restrictions
    }

    const timeOfDay = this.formatTime(timestamp);
    return timeOfDay >= businessHours.start && timeOfDay <= businessHours.end;
  }

  /**
   * Format time as HH:MM
   */
  private formatTime(timestamp: Date): string {
    const hours = timestamp.getHours().toString().padStart(2, '0');
    const minutes = timestamp.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Get human-readable reason for temporal selection
   */
  private getTemporalReason(temporal: TemporalInfo): string {
    if (temporal.isHoliday) return 'Holiday policy applied';
    if (temporal.isWeekend) return 'Weekend policy applied';
    if (temporal.isBusinessHours) return 'Business hours policy applied';
    return 'After hours policy applied';
  }

  // Implement IBusinessPolicy interface

  public and(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return this.basePolicy.and(other);
  }

  public or(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return this.basePolicy.or(other);
  }

  public not(): IBusinessPolicy<T> {
    return new PolicyTemporalBehavior(this.basePolicy.not(), this.config);
  }

  public when(condition: PolicyCondition<T>): IPolicyConditionalBuilder<T> {
    return this.basePolicy.when(condition);
  }

  /**
   * Create temporal policy decorator
   */
  public static create<T>(
    policy: IBusinessPolicy<T>,
    config: TemporalPolicyConfig
  ): PolicyTemporalBehavior<T> {
    return new PolicyTemporalBehavior(policy, config);
  }
}

/**
 * Builder for temporal policy configuration
 */
export class PolicyTemporalBehaviorBuilder<T> {
  private config: Partial<TemporalPolicyConfig> = {};

  constructor(private readonly basePolicy: IBusinessPolicy<T>) {}

  /**
   * Set business calendar
   */
  public withBusinessCalendar(calendar: BusinessCalendar): PolicyTemporalBehaviorBuilder<T> {
    this.config.businessCalendar = calendar;
    return this;
  }

  /**
   * Set business hours
   */
  public withBusinessHours(start: string, end: string): PolicyTemporalBehaviorBuilder<T> {
    if (!this.config.businessCalendar) {
      this.config.businessCalendar = {};
    }
    this.config.businessCalendar.businessHours = { start, end };
    return this;
  }

  /**
   * Set working days
   */
  public withWorkingDays(days: number[]): PolicyTemporalBehaviorBuilder<T> {
    if (!this.config.businessCalendar) {
      this.config.businessCalendar = {};
    }
    this.config.businessCalendar.workingDays = days;
    return this;
  }

  /**
   * Set timezone
   */
  public withTimezone(timezone: string): PolicyTemporalBehaviorBuilder<T> {
    if (!this.config.businessCalendar) {
      this.config.businessCalendar = {};
    }
    this.config.businessCalendar.timezone = timezone;
    return this;
  }

  /**
   * Set holidays
   */
  public withHolidays(holidays: Date[]): PolicyTemporalBehaviorBuilder<T> {
    if (!this.config.businessCalendar) {
      this.config.businessCalendar = {};
    }
    this.config.businessCalendar.holidays = holidays;
    return this;
  }

  /**
   * Set policy for business hours
   */
  public duringBusinessHours(policy: IBusinessPolicy<T>): PolicyTemporalBehaviorBuilder<T> {
    this.config.businessHoursPolicy = policy as IBusinessPolicy<unknown>;
    return this;
  }

  /**
   * Set policy for weekends
   */
  public duringWeekends(policy: IBusinessPolicy<T>): PolicyTemporalBehaviorBuilder<T> {
    this.config.weekendPolicy = policy as IBusinessPolicy<unknown>;
    return this;
  }

  /**
   * Set policy for holidays
   */
  public duringHolidays(policy: IBusinessPolicy<T>): PolicyTemporalBehaviorBuilder<T> {
    this.config.holidayPolicy = policy as IBusinessPolicy<unknown>;
    return this;
  }

  /**
   * Set policy for after hours
   */
  public duringAfterHours(policy: IBusinessPolicy<T>): PolicyTemporalBehaviorBuilder<T> {
    this.config.afterHoursPolicy = policy as IBusinessPolicy<unknown>;
    return this;
  }

  /**
   * Add custom temporal condition
   */
  public when(
    name: string,
    condition: TemporalCondition<T>,
    policy: IBusinessPolicy<T>
  ): PolicyTemporalBehaviorBuilder<T> {
    if (!this.config.customConditions) {
      this.config.customConditions = [];
    }

    this.config.customConditions.push({
      name,
      condition: condition as TemporalCondition<unknown>,
      policy: policy as IBusinessPolicy<unknown>,
    });

    return this;
  }

  /**
   * Set fallback policy
   */
  public otherwise(policy: IBusinessPolicy<T>): PolicyTemporalBehaviorBuilder<T> {
    this.config.fallbackPolicy = policy as IBusinessPolicy<unknown>;
    return this;
  }

  /**
   * Include temporal info in violations
   */
  public withTemporalInfo(include = true): PolicyTemporalBehaviorBuilder<T> {
    this.config.includeTemporalInfo = include;
    return this;
  }

  /**
   * Build temporal policy
   */
  public build(): PolicyTemporalBehavior<T> {
    if (!this.config.businessCalendar) {
      throw new Error('Business calendar is required for temporal policy');
    }

    return PolicyTemporalBehavior.create(this.basePolicy, this.config as TemporalPolicyConfig);
  }

  /**
   * Create builder from policy
   */
  public static from<T>(policy: IBusinessPolicy<T>): PolicyTemporalBehaviorBuilder<T> {
    return new PolicyTemporalBehaviorBuilder(policy);
  }
}

/**
 * Factory for common temporal policy patterns
 */
export class PolicyTemporalBehaviorFactory {
  /**
   * Create standard business hours policy
   */
  public static businessHours<T>(
    policy: IBusinessPolicy<T>,
    businessHoursPolicy: IBusinessPolicy<T>,
    afterHoursPolicy?: IBusinessPolicy<T>
  ): PolicyTemporalBehavior<T> {
    return PolicyTemporalBehaviorBuilder.from(policy)
      .withBusinessHours('09:00', '17:00')
      .withWorkingDays([1, 2, 3, 4, 5]) // Mon-Fri
      .duringBusinessHours(businessHoursPolicy)
      .duringAfterHours(afterHoursPolicy || policy)
      .withTemporalInfo(true)
      .build();
  }

  /**
   * Create weekend-aware policy
   */
  public static weekendAware<T>(
    policy: IBusinessPolicy<T>,
    weekdayPolicy: IBusinessPolicy<T>,
    weekendPolicy: IBusinessPolicy<T>
  ): PolicyTemporalBehavior<T> {
    return PolicyTemporalBehaviorBuilder.from(policy)
      .withWorkingDays([1, 2, 3, 4, 5])
      .duringBusinessHours(weekdayPolicy)
      .duringWeekends(weekendPolicy)
      .withTemporalInfo(true)
      .build();
  }

  /**
   * Create holiday-aware policy
   */
  public static holidayAware<T>(
    policy: IBusinessPolicy<T>,
    holidays: Date[],
    holidayPolicy: IBusinessPolicy<T>
  ): PolicyTemporalBehavior<T> {
    return PolicyTemporalBehaviorBuilder.from(policy)
      .withHolidays(holidays)
      .duringHolidays(holidayPolicy)
      .withTemporalInfo(true)
      .build();
  }
}
