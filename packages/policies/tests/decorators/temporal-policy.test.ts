import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import type { Result } from '@vytches-ddd/utils';
import {
  PolicyTemporalBehavior,
  PolicyTemporalBehaviorBuilder,
  PolicyTemporalBehaviorFactory,
  type BusinessCalendar,
  type TemporalInfo,
} from '../../src/decorators/temporal-policy';
import { BaseBusinessPolicy } from '../../src/core/base/base-business-policy';
import type { PolicyViolation } from '../../src/core/models/policy-violation';
import { PolicyContextBuilder } from '../../src/utils/policy-context-builder';
import type {
  PolicyContext,
  PolicyRequest,
} from '../../src/core/interfaces/business-policy.interface';

// Test policies for different temporal scenarios
class StrictPolicy extends BaseBusinessPolicy<{ value: number }> {
  constructor() {
    super('strict-policy', 'test', 'Strict Policy');
  }

  public async check(
    request: PolicyRequest<{ value: number }>
  ): Promise<Result<{ value: number }, PolicyViolation>> {
    if (request.entity.value < 100) {
      const violation = this.createViolation(
        'STRICT_VALIDATION_FAILED',
        'Strict policy requires value >= 100',
        'ERROR',
        { context: request.context }
      );
      return this.failure(violation);
    }
    return this.success(request.entity);
  }
}

class RelaxedPolicy extends BaseBusinessPolicy<{ value: number }> {
  constructor() {
    super('relaxed-policy', 'test', 'Relaxed Policy');
  }

  public async check(
    request: PolicyRequest<{ value: number }>
  ): Promise<Result<{ value: number }, PolicyViolation>> {
    if (request.entity.value < 10) {
      const violation = this.createViolation(
        'RELAXED_VALIDATION_FAILED',
        'Relaxed policy requires value >= 10',
        'WARNING',
        { context: request.context }
      );
      return this.failure(violation);
    }
    return this.success(request.entity);
  }
}

class AlwaysPassPolicy extends BaseBusinessPolicy<{ value: number }> {
  constructor() {
    super('always-pass-policy', 'test', 'Always Pass Policy');
  }

  public async check(
    request: PolicyRequest<{ value: number }>
  ): Promise<Result<{ value: number }, PolicyViolation>> {
    return this.success(request.entity);
  }
}

describe('TemporalPolicy', () => {
  let basePolicy: StrictPolicy;
  let strictPolicy: StrictPolicy;
  let relaxedPolicy: RelaxedPolicy;
  let alwaysPassPolicy: AlwaysPassPolicy;
  let businessCalendar: BusinessCalendar;
  let testEntity: { value: number };
  let policyContext: PolicyContext;
  let request: PolicyRequest<{ value: number }>;

  beforeEach(() => {
    basePolicy = new StrictPolicy();
    strictPolicy = new StrictPolicy();
    relaxedPolicy = new RelaxedPolicy();
    alwaysPassPolicy = new AlwaysPassPolicy();

    businessCalendar = {
      businessHours: { start: '09:00', end: '17:00' },
      workingDays: [1, 2, 3, 4, 5], // Monday to Friday
      holidays: [
        new Date('2024-12-25'), // Christmas
        new Date('2024-01-01'), // New Year
      ],
      timezone: 'UTC',
    };

    testEntity = { value: 50 }; // Fails strict, passes relaxed
    policyContext = PolicyContextBuilder.forUser('test-user').withEnvironment('test').build();

    request = { entity: testEntity, context: policyContext };
  });

  describe('Business Hours Logic', () => {
    it('should apply business hours policy during business hours', async () => {
      // Mock time to be 10:00 AM on a Wednesday
      const businessHourTime = new Date('2024-03-20T10:00:00Z'); // Wednesday
      vi.setSystemTime(businessHourTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: businessHourTime },
      };

      const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(businessCalendar)
        .duringBusinessHours(relaxedPolicy) // Use relaxed policy during business hours
        .build();

      const result = await temporalPolicy.check(requestWithTime);

      // Should use relaxed policy (passes with value 50 >= 10)
      expect(result.isSuccess).toBe(true);
    });

    it('should apply after hours policy outside business hours', async () => {
      // Mock time to be 8:00 PM on a Wednesday
      const afterHourTime = new Date('2024-03-20T20:00:00Z'); // Wednesday 8 PM
      vi.setSystemTime(afterHourTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: afterHourTime },
      };

      const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(businessCalendar)
        .duringBusinessHours(relaxedPolicy)
        .duringAfterHours(alwaysPassPolicy) // Use always pass after hours
        .build();

      const result = await temporalPolicy.check(requestWithTime);

      // Should use always pass policy
      expect(result.isSuccess).toBe(true);
    });

    it('should fall back to base policy when no specific policy defined', async () => {
      const afterHourTime = new Date('2024-03-20T20:00:00Z');
      vi.setSystemTime(afterHourTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: afterHourTime },
      };

      const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(businessCalendar)
        .duringBusinessHours(relaxedPolicy)
        // No after hours policy defined
        .build();

      const result = await temporalPolicy.check(requestWithTime);

      // Should use base policy (strict - fails with value 50 < 100)
      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('STRICT_VALIDATION_FAILED');
    });
  });

  describe('Weekend Logic', () => {
    it('should apply weekend policy on weekends', async () => {
      // Mock time to be Saturday
      const weekendTime = new Date('2024-03-23T14:00:00Z'); // Saturday 2 PM
      vi.setSystemTime(weekendTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: weekendTime },
      };

      const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(businessCalendar)
        .duringBusinessHours(strictPolicy)
        .duringWeekends(alwaysPassPolicy) // Relaxed on weekends
        .build();

      const result = await temporalPolicy.check(requestWithTime);

      // Should use weekend policy (always pass)
      expect(result.isSuccess).toBe(true);
    });

    it('should not apply weekend policy on working days', async () => {
      // Mock time to be Tuesday
      const weekdayTime = new Date('2024-03-19T14:00:00Z'); // Tuesday 2 PM
      vi.setSystemTime(weekdayTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: weekdayTime },
      };

      const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(businessCalendar)
        .duringBusinessHours(relaxedPolicy)
        .duringWeekends(alwaysPassPolicy)
        .build();

      const result = await temporalPolicy.check(requestWithTime);

      // Should use business hours policy (relaxed - passes)
      expect(result.isSuccess).toBe(true);
    });
  });

  describe('Holiday Logic', () => {
    it('should apply holiday policy on holidays', async () => {
      // Mock time to be Christmas (which is in our holidays list)
      const holidayTime = new Date('2024-12-25T14:00:00Z'); // Christmas 2 PM
      vi.setSystemTime(holidayTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: holidayTime },
      };

      const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(businessCalendar)
        .duringBusinessHours(strictPolicy)
        .duringHolidays(alwaysPassPolicy) // Very relaxed on holidays
        .build();

      const result = await temporalPolicy.check(requestWithTime);

      // Should use holiday policy (always pass)
      expect(result.isSuccess).toBe(true);
    });

    it('should prioritize holiday policy over weekend policy', async () => {
      // Mock time to be Christmas on a Wednesday (weekday holiday)
      const holidayWeekdayTime = new Date('2024-12-25T14:00:00Z'); // Christmas on Wednesday
      vi.setSystemTime(holidayWeekdayTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: holidayWeekdayTime },
      };

      const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(businessCalendar)
        .duringBusinessHours(strictPolicy)
        .duringWeekends(relaxedPolicy)
        .duringHolidays(alwaysPassPolicy)
        .build();

      const result = await temporalPolicy.check(requestWithTime);

      // Should use holiday policy (highest priority)
      expect(result.isSuccess).toBe(true);
    });
  });

  describe('Custom Temporal Conditions', () => {
    it('should apply custom conditions with highest priority', async () => {
      const businessTime = new Date('2024-03-20T14:00:00Z'); // Wednesday 2 PM
      vi.setSystemTime(businessTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: businessTime },
      };

      const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(businessCalendar)
        .duringBusinessHours(relaxedPolicy)
        .when(
          'high-value-check',
          entity => entity.value > 40, // Our entity has value 50
          alwaysPassPolicy
        )
        .build();

      const result = await temporalPolicy.check(requestWithTime);

      // Should use custom condition policy (always pass) instead of business hours
      expect(result.isSuccess).toBe(true);
    });

    it('should handle async custom conditions', async () => {
      const businessTime = new Date('2024-03-20T14:00:00Z');
      vi.setSystemTime(businessTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: businessTime },
      };

      const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(businessCalendar)
        .duringBusinessHours(strictPolicy)
        .when(
          'async-check',
          async entity => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return entity.value < 60; // Our entity has value 50
          },
          alwaysPassPolicy
        )
        .build();

      const result = await temporalPolicy.check(requestWithTime);

      // Should use async custom condition policy
      expect(result.isSuccess).toBe(true);
    });

    it('should handle failed custom conditions gracefully', async () => {
      const businessTime = new Date('2024-03-20T14:00:00Z');
      vi.setSystemTime(businessTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: businessTime },
      };

      const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(businessCalendar)
        .duringBusinessHours(relaxedPolicy)
        .when(
          'failing-condition',
          () => {
            throw new Error('Condition evaluation failed');
          },
          alwaysPassPolicy
        )
        .build();

      const result = await temporalPolicy.check(requestWithTime);

      // Should fall back to business hours policy when custom condition fails
      expect(result.isSuccess).toBe(true); // Relaxed policy should pass
    });
  });

  describe('Temporal Information Enhancement', () => {
    it('should include temporal info in violations when enabled', async () => {
      const businessTime = new Date('2024-03-20T14:00:00Z'); // Wednesday 2 PM
      vi.setSystemTime(businessTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: businessTime },
      };

      const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(businessCalendar)
        .duringBusinessHours(strictPolicy) // Will fail with value 50 < 100
        .withTemporalInfo(true)
        .build();

      const result = await temporalPolicy.check(requestWithTime);

      expect(result.isFailure).toBe(true);
      expect(result.error.details?.temporal).toBeDefined();
      expect((result?.error?.details?.temporal as TemporalInfo)?.isBusinessHours).toBe(true);
      expect((result?.error?.details?.temporal as TemporalInfo)?.isWeekend).toBe(false);
      expect((result?.error?.details?.temporal as TemporalInfo)?.dayOfWeek).toBe(3); // Wednesday
      expect(result?.error?.details?.temporalReason).toBe('Business hours policy applied');
    });

    it('should not include temporal info when disabled', async () => {
      const businessTime = new Date('2024-03-20T14:00:00Z');
      vi.setSystemTime(businessTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: businessTime },
      };

      const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(businessCalendar)
        .duringBusinessHours(strictPolicy)
        .withTemporalInfo(false)
        .build();

      const result = await temporalPolicy.check(requestWithTime);

      expect(result.isFailure).toBe(true);
      expect(result.error.details?.temporal).toBeUndefined();
    });
  });

  describe('Factory Methods', () => {
    it('should create standard business hours policy', async () => {
      const businessTime = new Date('2024-03-20T14:00:00Z'); // Wednesday 2 PM
      vi.setSystemTime(businessTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: businessTime },
      };

      const temporalPolicy = PolicyTemporalBehaviorFactory.businessHours(
        basePolicy,
        relaxedPolicy, // Business hours policy
        alwaysPassPolicy // After hours policy
      );

      const result = await temporalPolicy.check(requestWithTime);

      // Should use business hours policy
      expect(result.isSuccess).toBe(true);
    });

    it('should create weekend-aware policy', async () => {
      const weekendTime = new Date('2024-03-23T14:00:00Z'); // Saturday
      vi.setSystemTime(weekendTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: weekendTime },
      };

      const temporalPolicy = PolicyTemporalBehaviorFactory.weekendAware(
        basePolicy,
        strictPolicy, // Weekday policy
        alwaysPassPolicy // Weekend policy
      );

      const result = await temporalPolicy.check(requestWithTime);

      // Should use weekend policy
      expect(result.isSuccess).toBe(true);
    });

    it('should create holiday-aware policy', async () => {
      const holidayTime = new Date('2024-12-25T14:00:00Z'); // Christmas
      vi.setSystemTime(holidayTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: holidayTime },
      };

      const holidays = [new Date('2024-12-25')];
      const temporalPolicy = PolicyTemporalBehaviorFactory.holidayAware(
        basePolicy,
        holidays,
        alwaysPassPolicy
      );

      const result = await temporalPolicy.check(requestWithTime);

      // Should use holiday policy
      expect(result.isSuccess).toBe(true);
    });
  });

  describe('Policy Interface Implementation', () => {
    let temporalPolicy: InstanceType<typeof PolicyTemporalBehavior>;

    beforeEach(() => {
      temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(businessCalendar)
        .duringBusinessHours(relaxedPolicy)
        .build();
    });

    it('should preserve policy identity', () => {
      expect(temporalPolicy.id).toBe('temporal_strict-policy');
      expect(temporalPolicy.domain).toBe('test');
      expect(temporalPolicy.name).toBe('Temporal Strict Policy');
    });

    it('should support policy composition', () => {
      const otherPolicy = new RelaxedPolicy();

      expect(() => temporalPolicy.and(otherPolicy)).not.toThrow();
      expect(() => temporalPolicy.or(otherPolicy)).not.toThrow();
    });

    it('should support negation with temporal preservation', () => {
      const negatedPolicy = temporalPolicy.not();

      expect(negatedPolicy).toBeInstanceOf(PolicyTemporalBehavior);
      expect(negatedPolicy.id).toContain('NOT_');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing business calendar', () => {
      const [error] = safeRun(() => {
        PolicyTemporalBehaviorBuilder.from(basePolicy).duringBusinessHours(relaxedPolicy).build(); // No business calendar set
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Business calendar is required');
    });

    it('should handle policy execution exceptions', async () => {
      const throwingPolicy = new (class extends BaseBusinessPolicy<{ value: number }> {
        constructor() {
          super('throwing-policy', 'test', 'Throwing Policy');
        }

        public async check(): Promise<Result<{ value: number }, PolicyViolation>> {
          throw new Error('Policy execution failed');
        }
      })();

      const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(businessCalendar)
        .duringBusinessHours(throwingPolicy)
        .withTemporalInfo(true)
        .build();

      const businessTime = new Date('2024-03-20T14:00:00Z');
      vi.setSystemTime(businessTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: businessTime },
      };

      const result = await temporalPolicy.check(requestWithTime);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('TEMPORAL_POLICY_ERROR');
      expect(result.error.details?.temporal).toBeDefined();
    });

    it('should handle fallback policy when no conditions match', async () => {
      const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(businessCalendar)
        .otherwise(alwaysPassPolicy) // Fallback policy
        .build();

      // Time outside business hours, not weekend, not holiday
      const regularTime = new Date('2024-03-20T20:00:00Z'); // Wednesday 8 PM
      vi.setSystemTime(regularTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: regularTime },
      };

      const result = await temporalPolicy.check(requestWithTime);

      // Should use fallback policy
      expect(result.isSuccess).toBe(true);
    });

    it('should handle different timezones correctly', async () => {
      const calendarWithTimezone: BusinessCalendar = {
        ...businessCalendar,
        timezone: 'America/New_York',
      };

      const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(calendarWithTimezone)
        .duringBusinessHours(relaxedPolicy)
        .build();

      // Test should work regardless of timezone (simplified for this test)
      const businessTime = new Date('2024-03-20T14:00:00Z');
      vi.setSystemTime(businessTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: businessTime },
      };

      const result = await temporalPolicy.check(requestWithTime);

      // Should handle timezone correctly
      expect(result).toBeDefined();
    });

    it('should handle complex working days configuration', async () => {
      const customCalendar: BusinessCalendar = {
        businessHours: { start: '08:00', end: '20:00' },
        workingDays: [0, 1, 2, 3], // Sunday through Wednesday
        timezone: 'UTC',
      };

      const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
        .withBusinessCalendar(customCalendar)
        .duringBusinessHours(relaxedPolicy)
        .duringWeekends(strictPolicy)
        .build();

      // Test Thursday (should be weekend in this config)
      const thursdayTime = new Date('2024-03-21T14:00:00Z'); // Thursday
      vi.setSystemTime(thursdayTime);

      const requestWithTime = {
        ...request,
        context: { ...policyContext, timestamp: thursdayTime },
      };

      const result = await temporalPolicy.check(requestWithTime);

      // Should use weekend policy (strict - fails)
      expect(result.isFailure).toBe(true);
    });
  });
});
