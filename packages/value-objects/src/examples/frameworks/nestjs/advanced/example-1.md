# Advanced Value Objects - NestJS Manual Setup

**Version**: 2025-01-21 **Package**: @vytches-ddd/value-objects  
**Complexity**: Advanced **Framework**: NestJS **Focus**: Manual advanced value
object integration with sophisticated business operations **Base Example**:
[TimePeriod Value Object](../../../advanced/example-1.md)

## Service Implementation

```typescript
// time-period.service.ts
import { Injectable } from '@nestjs/common';
import { TimePeriod, RecurrencePattern } from '@vytches-ddd/value-objects';
import {
  CreateTimePeriodDto,
  TimePeriodResponse,
  ScheduleOptimizationDto,
  ConflictAnalysisDto,
} from './types'; // From your application

@Injectable()
export class TimePeriodService {
  private readonly supportedTimezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
  ];

  // ✅ FOCUS: Create sophisticated time periods with recurrence
  createTimePeriod(dto: CreateTimePeriodDto): TimePeriodResponse {
    try {
      const recurrence: RecurrencePattern | undefined = dto.recurrence
        ? {
            frequency: dto.recurrence.frequency,
            interval: dto.recurrence.interval,
            daysOfWeek: dto.recurrence.daysOfWeek,
            monthlyPattern: dto.recurrence.monthlyPattern,
          }
        : undefined;

      const timePeriod = TimePeriod.create(
        new Date(dto.startTime),
        new Date(dto.endTime),
        dto.timezone,
        recurrence
      );

      return {
        success: true,
        data: {
          startTime: timePeriod.startTime,
          endTime: timePeriod.endTime,
          timezone: timePeriod.timezone,
          duration: timePeriod.getDurationInMinutes(),
          humanReadable: timePeriod.toHumanReadable(),
          recurrence: timePeriod.recurrence,
          isBusinessHours: timePeriod.isWithinBusinessHours(),
          nextOccurrence: recurrence
            ? timePeriod.getNextOccurrence()
            : undefined,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create time period',
      };
    }
  }

  // ✅ FOCUS: Advanced schedule optimization
  optimizeSchedule(dto: ScheduleOptimizationDto): {
    originalSchedule: TimePeriodResponse['data'][];
    optimizedSchedule: TimePeriodResponse['data'][];
    improvements: {
      timeReduction: number;
      conflictsEliminated: number;
      utilizationImprovement: number;
    };
    recommendations: string[];
  } {
    try {
      // Create time periods from input
      const originalPeriods = dto.timeSlots.map(slot =>
        TimePeriod.create(
          new Date(slot.startTime),
          new Date(slot.endTime),
          slot.timezone || 'UTC'
        )
      );

      // Detect conflicts and gaps
      const conflicts = this.findScheduleConflicts(originalPeriods);
      const gaps = this.findScheduleGaps(originalPeriods, dto.workingHours);

      // Optimize schedule by resolving conflicts and filling gaps efficiently
      const optimizedPeriods = this.resolveConflictsAndOptimize(
        originalPeriods,
        conflicts,
        gaps,
        dto.constraints
      );

      // Calculate improvements
      const originalDuration = originalPeriods.reduce(
        (sum, p) => sum + p.getDurationInMinutes(),
        0
      );
      const optimizedDuration = optimizedPeriods.reduce(
        (sum, p) => sum + p.getDurationInMinutes(),
        0
      );
      const timeReduction = originalDuration - optimizedDuration;

      const recommendations = this.generateOptimizationRecommendations(
        originalPeriods,
        optimizedPeriods,
        conflicts.length
      );

      return {
        originalSchedule: originalPeriods.map(p =>
          this.mapTimePeriodToResponse(p)
        ),
        optimizedSchedule: optimizedPeriods.map(p =>
          this.mapTimePeriodToResponse(p)
        ),
        improvements: {
          timeReduction,
          conflictsEliminated: conflicts.length,
          utilizationImprovement: this.calculateUtilizationImprovement(
            originalPeriods,
            optimizedPeriods
          ),
        },
        recommendations,
      };
    } catch (error) {
      throw new Error(
        `Failed to optimize schedule: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ✅ FOCUS: Sophisticated conflict analysis
  analyzeConflicts(dto: ConflictAnalysisDto): {
    conflicts: Array<{
      period1: TimePeriodResponse['data'];
      period2: TimePeriodResponse['data'];
      overlapDuration: number;
      severity: 'low' | 'medium' | 'high' | 'critical';
      resolutionStrategies: string[];
    }>;
    overallConflictScore: number;
    resolutionComplexity: 'simple' | 'moderate' | 'complex' | 'very-complex';
    autoResolutionPossible: boolean;
  } {
    try {
      const periods = dto.timePeriods.map(tp =>
        TimePeriod.create(
          new Date(tp.startTime),
          new Date(tp.endTime),
          tp.timezone || 'UTC'
        )
      );

      const conflicts = [];
      let totalOverlapMinutes = 0;

      // Analyze all pair-wise conflicts
      for (let i = 0; i < periods.length; i++) {
        for (let j = i + 1; j < periods.length; j++) {
          const period1 = periods[i];
          const period2 = periods[j];

          if (period1.conflictsWith(period2)) {
            const overlap = period1.getOverlap(period2);
            const overlapDuration = overlap
              ? overlap.getDurationInMinutes()
              : 0;
            totalOverlapMinutes += overlapDuration;

            const severity = this.determineSeverity(
              overlapDuration,
              period1,
              period2
            );
            const strategies = this.generateResolutionStrategies(
              period1,
              period2,
              severity
            );

            conflicts.push({
              period1: this.mapTimePeriodToResponse(period1),
              period2: this.mapTimePeriodToResponse(period2),
              overlapDuration,
              severity,
              resolutionStrategies: strategies,
            });
          }
        }
      }

      // Calculate overall metrics
      const totalDuration = periods.reduce(
        (sum, p) => sum + p.getDurationInMinutes(),
        0
      );
      const overallConflictScore =
        totalDuration > 0 ? (totalOverlapMinutes / totalDuration) * 100 : 0;

      const resolutionComplexity = this.assessResolutionComplexity(conflicts);
      const autoResolutionPossible =
        conflicts.every(c => c.severity !== 'critical') &&
        conflicts.length <= 5;

      return {
        conflicts,
        overallConflictScore: Math.round(overallConflictScore * 100) / 100,
        resolutionComplexity,
        autoResolutionPossible,
      };
    } catch (error) {
      throw new Error(
        `Failed to analyze conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ✅ FOCUS: Business hours adjustment and optimization
  adjustToBusinessHours(
    dto: CreateTimePeriodDto,
    businessHoursStart: string = '09:00',
    businessHoursEnd: string = '17:00',
    adjustmentStrategy: 'shift' | 'split' | 'compress' = 'shift'
  ): {
    original: TimePeriodResponse['data'];
    adjusted: TimePeriodResponse['data'];
    adjustmentMade: boolean;
    adjustmentType: string;
    businessReasoning: string;
  } {
    try {
      const original = TimePeriod.create(
        new Date(dto.startTime),
        new Date(dto.endTime),
        dto.timezone
      );

      let adjusted = original;
      let adjustmentMade = false;
      let adjustmentType = 'none';
      let businessReasoning =
        'No adjustment needed - already within business hours';

      // Check if adjustment is needed
      if (
        !original.isWithinBusinessHours(businessHoursStart, businessHoursEnd)
      ) {
        switch (adjustmentStrategy) {
          case 'shift':
            adjusted = original.adjustToBusinessHours(
              businessHoursStart,
              businessHoursEnd
            );
            adjustmentType = 'time-shift';
            businessReasoning =
              'Time period shifted to align with business hours while maintaining duration';
            adjustmentMade = true;
            break;

          case 'split':
            // For periods spanning multiple days, split across business days
            if (original.spansDays()) {
              const businessDayPeriods = original.splitToBusinessDays(
                businessHoursStart,
                businessHoursEnd
              );
              adjusted = businessDayPeriods[0]; // Take first business day period
              adjustmentType = 'multi-day-split';
              businessReasoning = `Long period split across ${businessDayPeriods.length} business days`;
              adjustmentMade = true;
            }
            break;

          case 'compress':
            // Compress period to fit within single business day
            const businessDayStart = this.createBusinessDayStart(
              original.startTime,
              businessHoursStart
            );
            const businessDayEnd = this.createBusinessDayEnd(
              original.startTime,
              businessHoursEnd
            );
            adjusted = TimePeriod.create(
              businessDayStart,
              businessDayEnd,
              original.timezone
            );
            adjustmentType = 'duration-compression';
            businessReasoning =
              'Period compressed to fit within single business day';
            adjustmentMade = true;
            break;
        }
      }

      return {
        original: this.mapTimePeriodToResponse(original),
        adjusted: this.mapTimePeriodToResponse(adjusted),
        adjustmentMade,
        adjustmentType,
        businessReasoning,
      };
    } catch (error) {
      throw new Error(
        `Failed to adjust to business hours: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ✅ FOCUS: Resource allocation over time periods
  allocateResources(
    timePeriods: CreateTimePeriodDto[],
    resources: Array<{
      id: string;
      capacity: number;
      availability: { start: string; end: string }[];
      cost: number;
    }>,
    requirements: Array<{
      periodIndex: number;
      resourcesNeeded: number;
      priority: 'low' | 'medium' | 'high' | 'critical';
    }>
  ): {
    allocations: Array<{
      timePeriod: TimePeriodResponse['data'];
      allocatedResources: Array<{
        resourceId: string;
        allocated: number;
        cost: number;
      }>;
      totalCost: number;
      utilization: number;
    }>;
    totalCost: number;
    averageUtilization: number;
    unmetRequirements: Array<{
      periodIndex: number;
      shortfall: number;
      priority: string;
    }>;
  } {
    try {
      const periods = timePeriods.map(tp =>
        TimePeriod.create(
          new Date(tp.startTime),
          new Date(tp.endTime),
          tp.timezone
        )
      );

      const allocations = [];
      let totalCost = 0;
      const unmetRequirements = [];

      // Process each time period
      periods.forEach((period, periodIndex) => {
        const requirement = requirements.find(
          req => req.periodIndex === periodIndex
        );
        if (!requirement) return;

        const allocation = {
          timePeriod: this.mapTimePeriodToResponse(period),
          allocatedResources: [] as Array<{
            resourceId: string;
            allocated: number;
            cost: number;
          }>,
          totalCost: 0,
          utilization: 0,
        };

        let remainingNeed = requirement.resourcesNeeded;

        // Sort resources by cost-effectiveness (capacity/cost ratio)
        const sortedResources = [...resources]
          .filter(resource => this.isResourceAvailable(resource, period))
          .sort((a, b) => b.capacity / b.cost - a.capacity / a.cost);

        // Allocate resources
        for (const resource of sortedResources) {
          if (remainingNeed <= 0) break;

          const allocated = Math.min(remainingNeed, resource.capacity);
          const cost =
            (allocated / resource.capacity) *
            resource.cost *
            period.getDurationInHours();

          allocation.allocatedResources.push({
            resourceId: resource.id,
            allocated,
            cost: Math.round(cost * 100) / 100,
          });

          allocation.totalCost += cost;
          remainingNeed -= allocated;
        }

        // Calculate utilization
        const totalAllocated = allocation.allocatedResources.reduce(
          (sum, ar) => sum + ar.allocated,
          0
        );
        allocation.utilization = Math.round(
          (totalAllocated / requirement.resourcesNeeded) * 100
        );

        allocations.push(allocation);
        totalCost += allocation.totalCost;

        // Track unmet requirements
        if (remainingNeed > 0) {
          unmetRequirements.push({
            periodIndex,
            shortfall: remainingNeed,
            priority: requirement.priority,
          });
        }
      });

      const averageUtilization =
        allocations.length > 0
          ? allocations.reduce((sum, a) => sum + a.utilization, 0) /
            allocations.length
          : 0;

      return {
        allocations,
        totalCost: Math.round(totalCost * 100) / 100,
        averageUtilization: Math.round(averageUtilization),
        unmetRequirements,
      };
    } catch (error) {
      throw new Error(
        `Failed to allocate resources: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ✅ FOCUS: Advanced timezone handling
  handleTimezoneConversion(
    dto: CreateTimePeriodDto,
    targetTimezone: string,
    considerDST: boolean = true
  ): {
    original: {
      timezone: string;
      startTime: Date;
      endTime: Date;
      isDST: boolean;
    };
    converted: {
      timezone: string;
      startTime: Date;
      endTime: Date;
      isDST: boolean;
    };
    timeDifference: number;
    dstWarnings: string[];
  } {
    try {
      if (!this.supportedTimezones.includes(targetTimezone)) {
        throw new Error(`Unsupported target timezone: ${targetTimezone}`);
      }

      const original = TimePeriod.create(
        new Date(dto.startTime),
        new Date(dto.endTime),
        dto.timezone
      );

      const converted = original.convertTimezone(targetTimezone);

      // Calculate time difference in hours
      const timeDifference = this.calculateTimezoneOffset(
        dto.timezone,
        targetTimezone
      );

      // DST warnings
      const dstWarnings = [];
      if (considerDST) {
        const originalDST = this.isDSTActive(original.startTime, dto.timezone);
        const convertedDST = this.isDSTActive(
          converted.startTime,
          targetTimezone
        );

        if (originalDST !== convertedDST) {
          dstWarnings.push('DST differences detected between timezones');
        }

        if (
          this.isDSTTransitionPeriod(
            original.startTime,
            original.endTime,
            dto.timezone
          )
        ) {
          dstWarnings.push('Period spans DST transition in source timezone');
        }

        if (
          this.isDSTTransitionPeriod(
            converted.startTime,
            converted.endTime,
            targetTimezone
          )
        ) {
          dstWarnings.push('Period spans DST transition in target timezone');
        }
      }

      return {
        original: {
          timezone: dto.timezone,
          startTime: original.startTime,
          endTime: original.endTime,
          isDST: this.isDSTActive(original.startTime, dto.timezone),
        },
        converted: {
          timezone: targetTimezone,
          startTime: converted.startTime,
          endTime: converted.endTime,
          isDST: this.isDSTActive(converted.startTime, targetTimezone),
        },
        timeDifference,
        dstWarnings,
      };
    } catch (error) {
      throw new Error(
        `Failed to handle timezone conversion: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private findScheduleConflicts(
    periods: TimePeriod[]
  ): Array<{ period1: TimePeriod; period2: TimePeriod }> {
    const conflicts = [];

    for (let i = 0; i < periods.length; i++) {
      for (let j = i + 1; j < periods.length; j++) {
        if (periods[i].conflictsWith(periods[j])) {
          conflicts.push({ period1: periods[i], period2: periods[j] });
        }
      }
    }

    return conflicts;
  }

  private findScheduleGaps(
    periods: TimePeriod[],
    workingHours: { start: string; end: string }
  ): TimePeriod[] {
    // Simple implementation - find gaps between consecutive periods
    const sorted = periods.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );
    const gaps: TimePeriod[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i].gap(sorted[i + 1]);
      if (gap && gap.getDurationInMinutes() > 30) {
        // Only consider gaps > 30 minutes
        gaps.push(gap);
      }
    }

    return gaps;
  }

  private resolveConflictsAndOptimize(
    originalPeriods: TimePeriod[],
    conflicts: Array<{ period1: TimePeriod; period2: TimePeriod }>,
    gaps: TimePeriod[],
    constraints?: any
  ): TimePeriod[] {
    // Simple conflict resolution - shift conflicting periods
    const resolved = [...originalPeriods];

    conflicts.forEach(conflict => {
      const index1 = resolved.indexOf(conflict.period1);
      const index2 = resolved.indexOf(conflict.period2);

      if (index1 !== -1 && index2 !== -1) {
        // Shift the second period to end after the first
        const shiftedPeriod = TimePeriod.create(
          conflict.period1.endTime,
          new Date(
            conflict.period1.endTime.getTime() +
              conflict.period2.getDurationInMinutes() * 60000
          ),
          conflict.period2.timezone
        );
        resolved[index2] = shiftedPeriod;
      }
    });

    return resolved;
  }

  private calculateUtilizationImprovement(
    original: TimePeriod[],
    optimized: TimePeriod[]
  ): number {
    const originalEfficiency = this.calculateScheduleEfficiency(original);
    const optimizedEfficiency = this.calculateScheduleEfficiency(optimized);

    return Math.round((optimizedEfficiency - originalEfficiency) * 100) / 100;
  }

  private calculateScheduleEfficiency(periods: TimePeriod[]): number {
    if (periods.length === 0) return 0;

    const totalDuration = periods.reduce(
      (sum, p) => sum + p.getDurationInMinutes(),
      0
    );
    const timeSpan =
      periods.length > 1
        ? periods[periods.length - 1].endTime.getTime() -
          periods[0].startTime.getTime()
        : periods[0].getDurationInMinutes() * 60000;

    return (totalDuration * 60000) / timeSpan;
  }

  private generateOptimizationRecommendations(
    original: TimePeriod[],
    optimized: TimePeriod[],
    conflictsResolved: number
  ): string[] {
    const recommendations = [];

    if (conflictsResolved > 0) {
      recommendations.push(
        `Resolved ${conflictsResolved} scheduling conflicts`
      );
    }

    const originalDuration = original.reduce(
      (sum, p) => sum + p.getDurationInMinutes(),
      0
    );
    const optimizedDuration = optimized.reduce(
      (sum, p) => sum + p.getDurationInMinutes(),
      0
    );

    if (optimizedDuration < originalDuration) {
      const saved = originalDuration - optimizedDuration;
      recommendations.push(`Saved ${saved} minutes through optimization`);
    }

    if (optimized.length < original.length) {
      recommendations.push(
        `Consolidated ${original.length - optimized.length} time periods`
      );
    }

    return recommendations;
  }

  private determineSeverity(
    overlapMinutes: number,
    period1: TimePeriod,
    period2: TimePeriod
  ): 'low' | 'medium' | 'high' | 'critical' {
    const overlapPercentage =
      overlapMinutes /
      Math.min(period1.getDurationInMinutes(), period2.getDurationInMinutes());

    if (overlapPercentage >= 0.8) return 'critical';
    if (overlapPercentage >= 0.5) return 'high';
    if (overlapPercentage >= 0.25) return 'medium';
    return 'low';
  }

  private generateResolutionStrategies(
    period1: TimePeriod,
    period2: TimePeriod,
    severity: string
  ): string[] {
    const strategies = [];

    switch (severity) {
      case 'critical':
        strategies.push('Reschedule one period to a different day');
        strategies.push('Split overlapping period into multiple sessions');
        break;
      case 'high':
        strategies.push('Shift start/end times to minimize overlap');
        strategies.push('Reduce duration of one period');
        break;
      case 'medium':
        strategies.push('Minor time adjustments');
        strategies.push('Accept minimal overlap if unavoidable');
        break;
      case 'low':
        strategies.push('Minor timing adjustments');
        break;
    }

    return strategies;
  }

  private assessResolutionComplexity(
    conflicts: Array<{ severity: string }>
  ): 'simple' | 'moderate' | 'complex' | 'very-complex' {
    const criticalCount = conflicts.filter(
      c => c.severity === 'critical'
    ).length;
    const highCount = conflicts.filter(c => c.severity === 'high').length;

    if (criticalCount > 3 || conflicts.length > 10) return 'very-complex';
    if (criticalCount > 1 || highCount > 3 || conflicts.length > 5)
      return 'complex';
    if (criticalCount > 0 || highCount > 1 || conflicts.length > 2)
      return 'moderate';
    return 'simple';
  }

  private createBusinessDayStart(date: Date, businessHours: string): Date {
    const [hours, minutes] = businessHours.split(':').map(Number);
    const businessStart = new Date(date);
    businessStart.setHours(hours, minutes, 0, 0);
    return businessStart;
  }

  private createBusinessDayEnd(date: Date, businessHours: string): Date {
    const [hours, minutes] = businessHours.split(':').map(Number);
    const businessEnd = new Date(date);
    businessEnd.setHours(hours, minutes, 0, 0);
    return businessEnd;
  }

  private isResourceAvailable(
    resource: { availability: { start: string; end: string }[] },
    period: TimePeriod
  ): boolean {
    // Simple availability check
    return resource.availability.some(window => {
      const windowStart = new Date(window.start);
      const windowEnd = new Date(window.end);
      return period.startTime >= windowStart && period.endTime <= windowEnd;
    });
  }

  private calculateTimezoneOffset(
    sourceTimezone: string,
    targetTimezone: string
  ): number {
    // Simplified timezone offset calculation
    const timezoneOffsets: Record<string, number> = {
      UTC: 0,
      'America/New_York': -5,
      'America/Chicago': -6,
      'America/Denver': -7,
      'America/Los_Angeles': -8,
      'Europe/London': 0,
      'Europe/Paris': 1,
      'Asia/Tokyo': 9,
    };

    const sourceOffset = timezoneOffsets[sourceTimezone] || 0;
    const targetOffset = timezoneOffsets[targetTimezone] || 0;

    return targetOffset - sourceOffset;
  }

  private isDSTActive(date: Date, timezone: string): boolean {
    // Simplified DST detection - in production use proper timezone library
    const month = date.getMonth();
    const dstTimezones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
    ];

    if (!dstTimezones.includes(timezone)) return false;

    // DST typically runs March to November in US
    return month >= 2 && month <= 10;
  }

  private isDSTTransitionPeriod(
    startDate: Date,
    endDate: Date,
    timezone: string
  ): boolean {
    // Check if period spans DST transition dates
    const march = startDate.getMonth() <= 2 && endDate.getMonth() >= 2;
    const november = startDate.getMonth() <= 10 && endDate.getMonth() >= 10;

    return (march || november) && timezone.startsWith('America/');
  }

  private mapTimePeriodToResponse(
    period: TimePeriod
  ): TimePeriodResponse['data'] {
    return {
      startTime: period.startTime,
      endTime: period.endTime,
      timezone: period.timezone,
      duration: period.getDurationInMinutes(),
      humanReadable: period.toHumanReadable(),
      recurrence: period.recurrence,
      isBusinessHours: period.isWithinBusinessHours(),
      nextOccurrence: period.recurrence
        ? period.getNextOccurrence()
        : undefined,
    };
  }
}
```

## Color Service Implementation

```typescript
// color.service.ts
import { Injectable } from '@nestjs/common';
import { Color } from '@vytches-ddd/value-objects';
import {
  CreateColorDto,
  ColorResponse,
  ColorPaletteDto,
  ColorAnalysisDto,
} from './types'; // From your application

@Injectable()
export class ColorService {
  private readonly standardColorNames = new Map([
    ['red', '#FF0000'],
    ['green', '#00FF00'],
    ['blue', '#0000FF'],
    ['white', '#FFFFFF'],
    ['black', '#000000'],
    ['yellow', '#FFFF00'],
    ['cyan', '#00FFFF'],
    ['magenta', '#FF00FF'],
  ]);

  // ✅ FOCUS: Advanced color creation and validation
  createColor(dto: CreateColorDto): ColorResponse {
    try {
      let color: Color;

      // Support multiple input formats
      switch (dto.format) {
        case 'hex':
          color = Color.fromHex(dto.value);
          break;
        case 'rgb':
          const rgb = this.parseRGBString(dto.value);
          color = Color.fromRGB(rgb.red, rgb.green, rgb.blue);
          break;
        case 'hsl':
          const hsl = this.parseHSLString(dto.value);
          color = Color.fromHSL(hsl.hue, hsl.saturation, hsl.lightness);
          break;
        case 'name':
          const hexValue = this.standardColorNames.get(dto.value.toLowerCase());
          if (!hexValue) {
            throw new Error(`Unknown color name: ${dto.value}`);
          }
          color = Color.fromHex(hexValue);
          break;
        default:
          throw new Error(`Unsupported color format: ${dto.format}`);
      }

      return {
        success: true,
        data: {
          hex: color.toHex(),
          rgb: color.toRGB(),
          hsl: color.toHSL(),
          luminance: color.getLuminance(),
          isLight: color.isLight(),
          isDark: color.isDark(),
          contrastRatio: dto.backgroundHex
            ? color.getContrastRatio(Color.fromHex(dto.backgroundHex))
            : undefined,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create color',
      };
    }
  }

  // ✅ FOCUS: Generate harmonious color palettes
  generatePalette(dto: ColorPaletteDto): {
    baseColor: ColorResponse['data'];
    palette: {
      complementary: ColorResponse['data'];
      triadic: ColorResponse['data'][];
      analogous: ColorResponse['data'][];
      monochromatic: ColorResponse['data'][];
      tetradic: ColorResponse['data'][];
    };
    accessibility: {
      wcagAACompliant: ColorResponse['data'][];
      wcagAAACompliant: ColorResponse['data'][];
    };
  } {
    try {
      const baseColor = Color.fromHex(dto.baseColorHex);

      // Generate color harmony schemes
      const complementary = baseColor.getComplementary();
      const triadic = baseColor.getTriadic();
      const analogous = baseColor.getAnalogous();
      const monochromatic = baseColor.getMonochromatic(5);
      const tetradic = baseColor.getTetradic();

      // Find accessible color combinations
      const backgroundColor = dto.backgroundHex
        ? Color.fromHex(dto.backgroundHex)
        : Color.fromHex('#FFFFFF');
      const allColors = [
        complementary,
        ...triadic,
        ...analogous,
        ...monochromatic,
        ...tetradic,
      ];

      const wcagAACompliant = allColors.filter(color =>
        color.meetsWCAGContrastAA(backgroundColor, false)
      );

      const wcagAAACompliant = allColors.filter(color =>
        color.meetsWCAGContrastAAA(backgroundColor, false)
      );

      return {
        baseColor: this.mapColorToResponse(baseColor),
        palette: {
          complementary: this.mapColorToResponse(complementary),
          triadic: triadic.map(color => this.mapColorToResponse(color)),
          analogous: analogous.map(color => this.mapColorToResponse(color)),
          monochromatic: monochromatic.map(color =>
            this.mapColorToResponse(color)
          ),
          tetradic: tetradic.map(color => this.mapColorToResponse(color)),
        },
        accessibility: {
          wcagAACompliant: wcagAACompliant.map(color =>
            this.mapColorToResponse(color)
          ),
          wcagAAACompliant: wcagAAACompliant.map(color =>
            this.mapColorToResponse(color)
          ),
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to generate palette: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ✅ FOCUS: Analyze color properties and accessibility
  analyzeColor(dto: ColorAnalysisDto): {
    colorProperties: {
      hex: string;
      rgb: { red: number; green: number; blue: number };
      hsl: { hue: number; saturation: number; lightness: number };
      luminance: number;
      temperature: 'warm' | 'cool' | 'neutral';
      saturationLevel: 'muted' | 'moderate' | 'vibrant';
      lightnessLevel: 'dark' | 'medium' | 'light';
    };
    accessibility: {
      backgroundContrasts: Array<{
        backgroundColor: string;
        contrastRatio: number;
        wcagAA: { normal: boolean; large: boolean };
        wcagAAA: { normal: boolean; large: boolean };
      }>;
      colorBlindness: {
        protanopia: { visible: boolean; alternative: string };
        deuteranopia: { visible: boolean; alternative: string };
        tritanopia: { visible: boolean; alternative: string };
      };
    };
    psychology: {
      emotions: string[];
      associations: string[];
      culturalMeanings: string[];
      brandPersonality: string[];
    };
    recommendations: {
      bestUseCase: string;
      pairing: string[];
      avoidWith: string[];
      improvementSuggestions: string[];
    };
  } {
    try {
      const color = Color.fromHex(dto.colorHex);
      const rgb = color.toRGB();
      const hsl = color.toHSL();

      // Analyze color properties
      const temperature = this.analyzeColorTemperature(hsl.hue);
      const saturationLevel = this.analyzeSaturationLevel(hsl.saturation);
      const lightnessLevel = this.analyzeLightnessLevel(hsl.lightness);

      // Accessibility analysis
      const backgroundContrasts =
        dto.backgroundColors?.map(bgHex => {
          const bgColor = Color.fromHex(bgHex);
          const contrastRatio = color.getContrastRatio(bgColor);

          return {
            backgroundColor: bgHex,
            contrastRatio: Math.round(contrastRatio * 100) / 100,
            wcagAA: {
              normal: color.meetsWCAGContrastAA(bgColor, false),
              large: color.meetsWCAGContrastAA(bgColor, true),
            },
            wcagAAA: {
              normal: color.meetsWCAGContrastAAA(bgColor, false),
              large: color.meetsWCAGContrastAAA(bgColor, true),
            },
          };
        }) || [];

      // Color blindness simulation
      const colorBlindness = {
        protanopia: {
          visible: this.isVisibleToColorBlind(color, 'protanopia'),
          alternative: this.suggestColorBlindAlternative(color, 'protanopia'),
        },
        deuteranopia: {
          visible: this.isVisibleToColorBlind(color, 'deuteranopia'),
          alternative: this.suggestColorBlindAlternative(color, 'deuteranopia'),
        },
        tritanopia: {
          visible: this.isVisibleToColorBlind(color, 'tritanopia'),
          alternative: this.suggestColorBlindAlternative(color, 'tritanopia'),
        },
      };

      // Color psychology analysis
      const psychology = this.analyzeColorPsychology(
        hsl.hue,
        saturationLevel,
        lightnessLevel
      );

      // Generate recommendations
      const recommendations = this.generateColorRecommendations(
        color,
        temperature,
        saturationLevel,
        lightnessLevel,
        backgroundContrasts
      );

      return {
        colorProperties: {
          hex: color.toHex(),
          rgb,
          hsl,
          luminance: color.getLuminance(),
          temperature,
          saturationLevel,
          lightnessLevel,
        },
        accessibility: {
          backgroundContrasts,
          colorBlindness,
        },
        psychology,
        recommendations,
      };
    } catch (error) {
      throw new Error(
        `Failed to analyze color: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private parseRGBString(rgb: string): {
    red: number;
    green: number;
    blue: number;
  } {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) throw new Error('Invalid RGB format');

    return {
      red: parseInt(match[1]),
      green: parseInt(match[2]),
      blue: parseInt(match[3]),
    };
  }

  private parseHSLString(hsl: string): {
    hue: number;
    saturation: number;
    lightness: number;
  } {
    const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) throw new Error('Invalid HSL format');

    return {
      hue: parseInt(match[1]),
      saturation: parseInt(match[2]),
      lightness: parseInt(match[3]),
    };
  }

  private analyzeColorTemperature(hue: number): 'warm' | 'cool' | 'neutral' {
    if ((hue >= 0 && hue <= 60) || (hue >= 300 && hue <= 360)) return 'warm';
    if (hue >= 180 && hue <= 240) return 'cool';
    return 'neutral';
  }

  private analyzeSaturationLevel(
    saturation: number
  ): 'muted' | 'moderate' | 'vibrant' {
    if (saturation < 30) return 'muted';
    if (saturation < 70) return 'moderate';
    return 'vibrant';
  }

  private analyzeLightnessLevel(
    lightness: number
  ): 'dark' | 'medium' | 'light' {
    if (lightness < 30) return 'dark';
    if (lightness < 70) return 'medium';
    return 'light';
  }

  private analyzeColorPsychology(
    hue: number,
    saturationLevel: string,
    lightnessLevel: string
  ): {
    emotions: string[];
    associations: string[];
    culturalMeanings: string[];
    brandPersonality: string[];
  } {
    // Simplified color psychology mapping
    const hueBasedPsychology = this.getHueBasedPsychology(hue);

    // Modify based on saturation and lightness
    let emotions = [...hueBasedPsychology.emotions];
    let associations = [...hueBasedPsychology.associations];

    if (saturationLevel === 'muted') {
      emotions.push('calm', 'sophisticated');
    } else if (saturationLevel === 'vibrant') {
      emotions.push('energetic', 'attention-grabbing');
    }

    if (lightnessLevel === 'light') {
      emotions.push('gentle', 'airy');
    } else if (lightnessLevel === 'dark') {
      emotions.push('serious', 'mysterious');
    }

    return {
      emotions,
      associations,
      culturalMeanings: hueBasedPsychology.culturalMeanings,
      brandPersonality: hueBasedPsychology.brandPersonality,
    };
  }

  private getHueBasedPsychology(hue: number): {
    emotions: string[];
    associations: string[];
    culturalMeanings: string[];
    brandPersonality: string[];
  } {
    if (hue >= 0 && hue < 60) {
      // Red-Orange
      return {
        emotions: ['passionate', 'energetic', 'urgent'],
        associations: ['fire', 'love', 'danger'],
        culturalMeanings: ['luck (China)', 'celebration', 'warning'],
        brandPersonality: ['bold', 'exciting', 'youthful'],
      };
    } else if (hue >= 60 && hue < 120) {
      // Yellow-Green
      return {
        emotions: ['happy', 'optimistic', 'natural'],
        associations: ['sun', 'nature', 'growth'],
        culturalMeanings: ['prosperity', 'harmony', 'renewal'],
        brandPersonality: ['friendly', 'organic', 'innovative'],
      };
    } else if (hue >= 120 && hue < 240) {
      // Blue-Cyan
      return {
        emotions: ['calm', 'trustworthy', 'professional'],
        associations: ['sky', 'ocean', 'technology'],
        culturalMeanings: ['stability', 'loyalty', 'wisdom'],
        brandPersonality: ['reliable', 'corporate', 'secure'],
      };
    } else {
      // Purple-Magenta
      return {
        emotions: ['creative', 'luxurious', 'spiritual'],
        associations: ['royalty', 'mystery', 'magic'],
        culturalMeanings: ['nobility', 'creativity', 'transformation'],
        brandPersonality: ['premium', 'artistic', 'innovative'],
      };
    }
  }

  private generateColorRecommendations(
    color: Color,
    temperature: string,
    saturationLevel: string,
    lightnessLevel: string,
    backgroundContrasts: any[]
  ): {
    bestUseCase: string;
    pairing: string[];
    avoidWith: string[];
    improvementSuggestions: string[];
  } {
    const suggestions = [];
    const pairing = [];
    const avoidWith = [];

    // Use case recommendations
    let bestUseCase = 'general purpose';
    if (temperature === 'cool' && saturationLevel === 'muted') {
      bestUseCase = 'corporate branding and professional interfaces';
    } else if (temperature === 'warm' && saturationLevel === 'vibrant') {
      bestUseCase = 'call-to-action buttons and attention-grabbing elements';
    } else if (lightnessLevel === 'light') {
      bestUseCase = 'backgrounds and subtle UI elements';
    }

    // Pairing recommendations
    if (temperature === 'warm') {
      pairing.push('neutral grays', 'cool blues for contrast');
    } else {
      pairing.push('warm oranges', 'neutral beiges');
    }

    // What to avoid
    if (lightnessLevel === 'light') {
      avoidWith.push('other light colors', 'low contrast combinations');
    }

    // Accessibility improvements
    const poorContrasts = backgroundContrasts.filter(
      bg => bg.contrastRatio < 4.5
    );
    if (poorContrasts.length > 0) {
      suggestions.push('Improve contrast ratios for better accessibility');
    }

    return {
      bestUseCase,
      pairing,
      avoidWith,
      improvementSuggestions: suggestions,
    };
  }

  private isVisibleToColorBlind(color: Color, type: string): boolean {
    // Simplified color blindness check
    const rgb = color.toRGB();

    switch (type) {
      case 'protanopia': // Red-blind
        return rgb.green > 100 || rgb.blue > 100;
      case 'deuteranopia': // Green-blind
        return rgb.red > 100 || rgb.blue > 100;
      case 'tritanopia': // Blue-blind
        return rgb.red > 100 || rgb.green > 100;
      default:
        return true;
    }
  }

  private suggestColorBlindAlternative(color: Color, type: string): string {
    // Simple alternative suggestion
    const hsl = color.toHSL();

    switch (type) {
      case 'protanopia':
        return Color.fromHSL(200, hsl.saturation, hsl.lightness).toHex();
      case 'deuteranopia':
        return Color.fromHSL(260, hsl.saturation, hsl.lightness).toHex();
      case 'tritanopia':
        return Color.fromHSL(60, hsl.saturation, hsl.lightness).toHex();
      default:
        return color.toHex();
    }
  }

  private mapColorToResponse(color: Color): ColorResponse['data'] {
    return {
      hex: color.toHex(),
      rgb: color.toRGB(),
      hsl: color.toHSL(),
      luminance: color.getLuminance(),
      isLight: color.isLight(),
      isDark: color.isDark(),
    };
  }
}
```

## Module Configuration

```typescript
// advanced-value-objects.module.ts
import { Module } from '@nestjs/common';
import { TimePeriodService } from './time-period.service';
import { ColorService } from './color.service';
import { CoordinatesService } from './coordinates.service';

@Module({
  providers: [TimePeriodService, ColorService, CoordinatesService],
  exports: [TimePeriodService, ColorService, CoordinatesService],
})
export class AdvancedValueObjectsModule {}
```

## Key Points

- **Advanced Business Logic**: Complex scheduling, optimization, and conflict
  resolution
- **Sophisticated Analysis**: Deep color analysis with psychology and
  accessibility insights
- **Performance Optimization**: Resource allocation and schedule optimization
  algorithms
- **Comprehensive Validation**: Multi-layered validation with business rule
  enforcement
- **Rich Domain Operations**: Advanced mathematical and business operations
- **Enterprise Features**: Timezone handling, DST awareness, and cultural
  considerations

## Benefits

- **Complex Problem Solving**: Handles sophisticated business scenarios and edge
  cases
- **Rich Analytics**: Provides deep insights into domain data and patterns
- **Business Intelligence**: Supports data-driven decision making
- **Scalable Operations**: Efficient algorithms for resource optimization
- **Professional Quality**: Enterprise-grade features for production systems
