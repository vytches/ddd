# Time Period Value Object - Advanced Example

**Version**: 2025-01-21 **Package**: @vytches-ddd/value-objects  
**Complexity**: Advanced **Domain**: Time Management & Scheduling **Patterns**:
Period Management, Duration Calculations, Overlap Detection **Dependencies**:
@vytches-ddd/value-objects, @vytches-ddd/domain-primitives

## Description

This example demonstrates creating a **TimePeriod** value object for advanced
time management scenarios including recurring periods, conflict detection, and
resource scheduling. Shows advanced patterns for time-based value objects with
business logic.

## Business Context

TimePeriod is essential for advanced scheduling systems, resource management,
booking platforms, and project planning. It provides sophisticated time period
operations, conflict resolution, and intelligent scheduling capabilities.

## Code Example

```typescript
// time-period.ts
import { ValueObject } from '@vytches-ddd/value-objects';
import {
  TimePeriodData,
  RecurrencePattern,
  ConflictResolution,
  ValueObjectValidationResult,
} from './types';
import {
  validateRequired,
  createSuccessResult,
  createFailureResult,
  combineValidationResults,
} from '../shared';

export class TimePeriod extends ValueObject<TimePeriodData> {
  private constructor(data: TimePeriodData) {
    super(data);
  }

  // ✅ FOCUS: Factory method with timezone support
  static create(
    startTime: Date,
    endTime: Date,
    timezone: string = 'UTC',
    recurrence?: RecurrencePattern
  ): TimePeriod {
    const data: TimePeriodData = {
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      timezone,
      recurrence,
      duration: endTime.getTime() - startTime.getTime(),
    };

    const validation = TimePeriod.validate(data);
    if (!validation.isValid) {
      throw new Error(`Invalid time period: ${validation.errors.join(', ')}`);
    }

    return new TimePeriod(data);
  }

  // ✅ FOCUS: Factory for recurring periods
  static createRecurring(
    startTime: Date,
    duration: number, // in minutes
    pattern: RecurrencePattern,
    timezone?: string
  ): TimePeriod {
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    return TimePeriod.create(startTime, endTime, timezone, pattern);
  }

  // ✅ FOCUS: Validation with business rules
  static validate(data: TimePeriodData): ValueObjectValidationResult {
    const results = [
      validateRequired(data.startTime, 'start time'),
      validateRequired(data.endTime, 'end time'),
      validateRequired(data.timezone, 'timezone'),
    ];

    // Time validity
    if (data.startTime && data.endTime && data.startTime >= data.endTime) {
      results.push(createFailureResult(['Start time must be before end time']));
    }

    // Duration limits (24 hours max for single period)
    if (data.duration > 24 * 60 * 60 * 1000) {
      results.push(createFailureResult(['Period cannot exceed 24 hours']));
    }

    // Minimum duration (15 minutes)
    if (data.duration < 15 * 60 * 1000) {
      results.push(createFailureResult(['Period must be at least 15 minutes']));
    }

    return combineValidationResults(...results);
  }

  // ✅ FOCUS: Conflict detection
  conflictsWith(other: TimePeriod): boolean {
    // Convert both periods to UTC for comparison
    const thisStart = this.toUTC().startTime;
    const thisEnd = this.toUTC().endTime;
    const otherStart = other.toUTC().startTime;
    const otherEnd = other.toUTC().endTime;

    return thisStart < otherEnd && thisEnd > otherStart;
  }

  // ✅ FOCUS: Overlap calculation
  getOverlap(other: TimePeriod): TimePeriod | null {
    if (!this.conflictsWith(other)) {
      return null;
    }

    const thisUTC = this.toUTC();
    const otherUTC = other.toUTC();

    const overlapStart = new Date(
      Math.max(thisUTC.startTime.getTime(), otherUTC.startTime.getTime())
    );

    const overlapEnd = new Date(
      Math.min(thisUTC.endTime.getTime(), otherUTC.endTime.getTime())
    );

    return TimePeriod.create(overlapStart, overlapEnd, 'UTC');
  }

  // ✅ FOCUS: Gap calculation
  getGap(other: TimePeriod): TimePeriod | null {
    if (this.conflictsWith(other)) {
      return null;
    }

    const thisUTC = this.toUTC();
    const otherUTC = other.toUTC();

    let gapStart: Date, gapEnd: Date;

    if (thisUTC.endTime <= otherUTC.startTime) {
      // This period ends before other starts
      gapStart = thisUTC.endTime;
      gapEnd = otherUTC.startTime;
    } else if (otherUTC.endTime <= thisUTC.startTime) {
      // Other period ends before this starts
      gapStart = otherUTC.endTime;
      gapEnd = thisUTC.startTime;
    } else {
      return null;
    }

    // Only return gap if it's meaningful (more than 1 minute)
    if (gapEnd.getTime() - gapStart.getTime() < 60 * 1000) {
      return null;
    }

    return TimePeriod.create(gapStart, gapEnd, 'UTC');
  }

  // ✅ FOCUS: Recurrence expansion
  expandRecurrence(
    untilDate: Date,
    maxOccurrences: number = 100
  ): TimePeriod[] {
    if (!this.data.recurrence) {
      return [this];
    }

    const periods: TimePeriod[] = [];
    let currentStart = new Date(this.data.startTime);
    let occurrences = 0;

    while (currentStart <= untilDate && occurrences < maxOccurrences) {
      const currentEnd = new Date(currentStart.getTime() + this.data.duration);

      periods.push(
        TimePeriod.create(currentStart, currentEnd, this.data.timezone)
      );

      currentStart = this.getNextOccurrence(currentStart);
      occurrences++;
    }

    return periods;
  }

  // ✅ FOCUS: Business day adjustments
  adjustToBusinessHours(
    businessStart: string = '09:00',
    businessEnd: string = '17:00'
  ): TimePeriod {
    const [startHour, startMinute] = businessStart.split(':').map(Number);
    const [endHour, endMinute] = businessEnd.split(':').map(Number);

    const adjustedStart = new Date(this.data.startTime);
    const adjustedEnd = new Date(this.data.endTime);

    // Adjust start time to business hours
    if (
      adjustedStart.getHours() < startHour ||
      (adjustedStart.getHours() === startHour &&
        adjustedStart.getMinutes() < startMinute)
    ) {
      adjustedStart.setHours(startHour, startMinute, 0, 0);
    }

    if (adjustedStart.getHours() >= endHour) {
      // Move to next business day
      adjustedStart.setDate(adjustedStart.getDate() + 1);
      adjustedStart.setHours(startHour, startMinute, 0, 0);
    }

    // Adjust end time to business hours
    if (adjustedEnd.getHours() >= endHour) {
      adjustedEnd.setHours(endHour, endMinute, 0, 0);
    }

    // Ensure minimum duration
    if (adjustedEnd <= adjustedStart) {
      adjustedEnd.setTime(adjustedStart.getTime() + 30 * 60 * 1000); // 30 minutes
    }

    return TimePeriod.create(adjustedStart, adjustedEnd, this.data.timezone);
  }

  // ✅ FOCUS: Resource allocation methods
  canAccommodate(duration: number): boolean {
    return this.data.duration >= duration;
  }

  split(splitTime: Date): [TimePeriod, TimePeriod] | null {
    if (splitTime <= this.data.startTime || splitTime >= this.data.endTime) {
      return null;
    }

    const firstPeriod = TimePeriod.create(
      this.data.startTime,
      splitTime,
      this.data.timezone
    );

    const secondPeriod = TimePeriod.create(
      splitTime,
      this.data.endTime,
      this.data.timezone
    );

    return [firstPeriod, secondPeriod];
  }

  // ✅ FOCUS: Time zone conversions
  toTimezone(targetTimezone: string): TimePeriod {
    if (this.data.timezone === targetTimezone) {
      return this;
    }

    // Simple timezone conversion (in production use proper timezone library)
    const startInTarget = new Date(
      this.data.startTime.toLocaleString('en-US', {
        timeZone: targetTimezone,
      })
    );
    const endInTarget = new Date(
      this.data.endTime.toLocaleString('en-US', {
        timeZone: targetTimezone,
      })
    );

    return TimePeriod.create(startInTarget, endInTarget, targetTimezone);
  }

  private toUTC(): { startTime: Date; endTime: Date } {
    return {
      startTime: new Date(this.data.startTime.toISOString()),
      endTime: new Date(this.data.endTime.toISOString()),
    };
  }

  // ✅ FOCUS: Utility methods
  getDurationInMinutes(): number {
    return this.data.duration / (60 * 1000);
  }

  getDurationInHours(): number {
    return this.data.duration / (60 * 60 * 1000);
  }

  isRecurring(): boolean {
    return !!this.data.recurrence;
  }

  isPast(): boolean {
    return this.data.endTime < new Date();
  }

  isFuture(): boolean {
    return this.data.startTime > new Date();
  }

  isCurrent(): boolean {
    const now = new Date();
    return this.data.startTime <= now && now <= this.data.endTime;
  }

  // ✅ FOCUS: Display methods
  toString(): string {
    const start = this.data.startTime.toLocaleString();
    const end = this.data.endTime.toLocaleString();
    return `${start} - ${end} (${this.data.timezone})`;
  }

  toHumanReadable(): string {
    const duration = this.getDurationInMinutes();
    const start = this.data.startTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (duration < 60) {
      return `${duration}min starting at ${start}`;
    } else {
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      const hourText = hours === 1 ? 'hour' : 'hours';
      const minText = minutes > 0 ? ` ${minutes}min` : '';
      return `${hours}${hourText}${minText} starting at ${start}`;
    }
  }

  // ✅ FOCUS: Private helper methods
  private getNextOccurrence(currentStart: Date): Date {
    if (!this.data.recurrence) {
      throw new Error('No recurrence pattern defined');
    }

    const next = new Date(currentStart);

    switch (this.data.recurrence.frequency) {
      case 'daily':
        next.setDate(next.getDate() + (this.data.recurrence.interval || 1));
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7 * (this.data.recurrence.interval || 1));
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + (this.data.recurrence.interval || 1));
        break;
      case 'yearly':
        next.setFullYear(
          next.getFullYear() + (this.data.recurrence.interval || 1)
        );
        break;
    }

    return next;
  }

  // ✅ FOCUS: Getters
  get startTime(): Date {
    return new Date(this.data.startTime);
  }

  get endTime(): Date {
    return new Date(this.data.endTime);
  }

  get timezone(): string {
    return this.data.timezone;
  }

  get duration(): number {
    return this.data.duration;
  }

  get recurrence(): RecurrencePattern | undefined {
    return this.data.recurrence;
  }

  // ✅ FOCUS: Value object equality
  protected isEqualTo(other: TimePeriod): boolean {
    return (
      this.data.startTime.getTime() === other.data.startTime.getTime() &&
      this.data.endTime.getTime() === other.data.endTime.getTime() &&
      this.data.timezone === other.data.timezone &&
      JSON.stringify(this.data.recurrence) ===
        JSON.stringify(other.data.recurrence)
    );
  }
}
```

## Usage Examples

```typescript
// basic-time-period-usage.ts
import { TimePeriod } from './time-period';

// ✅ Creating time periods
const meeting = TimePeriod.create(
  new Date('2025-02-03T10:00:00'),
  new Date('2025-02-03T11:30:00'),
  'America/New_York'
);

const workshop = TimePeriod.create(
  new Date('2025-02-03T11:00:00'),
  new Date('2025-02-03T12:00:00'),
  'America/New_York'
);

console.log(meeting.toString());
// "2/3/2025, 10:00:00 AM - 2/3/2025, 11:30:00 AM (America/New_York)"

console.log(meeting.toHumanReadable());
// "1hour 30min starting at 10:00 AM"

// ✅ Conflict detection
const hasConflict = meeting.conflictsWith(workshop);
console.log(`Meetings conflict: ${hasConflict}`); // true

const overlap = meeting.getOverlap(workshop);
if (overlap) {
  console.log(`Overlap: ${overlap.getDurationInMinutes()} minutes`); // 30 minutes
}

// ✅ Recurring periods
const dailyStandup = TimePeriod.createRecurring(
  new Date('2025-02-03T09:00:00'),
  30, // 30 minutes
  {
    frequency: 'daily',
    interval: 1,
    daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
  },
  'America/New_York'
);

const nextWeekStandups = dailyStandup.expandRecurrence(
  new Date('2025-02-10'),
  5
);

console.log(`Generated ${nextWeekStandups.length} standup meetings`);

// ✅ Business hours adjustment
const afterHours = TimePeriod.create(
  new Date('2025-02-03T19:00:00'), // 7 PM
  new Date('2025-02-03T20:00:00'), // 8 PM
  'America/New_York'
);

const adjusted = afterHours.adjustToBusinessHours();
console.log(`Adjusted to: ${adjusted.toString()}`);
// Moved to next business day 9:00 AM
```

## Advanced Scheduling System

```typescript
// advanced-scheduling-system.ts
import { TimePeriod } from './time-period';

class ResourceScheduler {
  private reservations = new Map<string, TimePeriod[]>();

  bookResource(
    resourceId: string,
    period: TimePeriod,
    conflictResolution: 'reject' | 'split' | 'adjust' = 'reject'
  ): {
    success: boolean;
    conflicts?: TimePeriod[];
    adjustedPeriod?: TimePeriod;
  } {
    const existingReservations = this.reservations.get(resourceId) || [];
    const conflicts = existingReservations.filter(reservation =>
      reservation.conflictsWith(period)
    );

    if (conflicts.length === 0) {
      // No conflicts, book directly
      existingReservations.push(period);
      this.reservations.set(resourceId, existingReservations);
      return { success: true };
    }

    // Handle conflicts based on resolution strategy
    switch (conflictResolution) {
      case 'reject':
        return { success: false, conflicts };

      case 'split':
        const splitResult = this.trySplitBooking(period, conflicts);
        if (splitResult.success) {
          existingReservations.push(...splitResult.periods!);
          this.reservations.set(resourceId, existingReservations);
        }
        return splitResult;

      case 'adjust':
        const adjustedPeriod = this.findNextAvailableSlot(
          resourceId,
          period.getDurationInMinutes()
        );
        if (adjustedPeriod) {
          existingReservations.push(adjustedPeriod);
          this.reservations.set(resourceId, existingReservations);
          return { success: true, adjustedPeriod };
        }
        return { success: false, conflicts };

      default:
        return { success: false, conflicts };
    }
  }

  private trySplitBooking(
    period: TimePeriod,
    conflicts: TimePeriod[]
  ): { success: boolean; periods?: TimePeriod[] } {
    const availablePeriods: TimePeriod[] = [];
    let currentStart = period.startTime;

    // Sort conflicts by start time
    const sortedConflicts = conflicts.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    for (const conflict of sortedConflicts) {
      // Check if there's space before this conflict
      if (currentStart < conflict.startTime) {
        const beforeConflict = TimePeriod.create(
          currentStart,
          conflict.startTime,
          period.timezone
        );

        // Only add if it's meaningful (at least 15 minutes)
        if (beforeConflict.getDurationInMinutes() >= 15) {
          availablePeriods.push(beforeConflict);
        }
      }

      currentStart = new Date(
        Math.max(currentStart.getTime(), conflict.endTime.getTime())
      );
    }

    // Check space after all conflicts
    if (currentStart < period.endTime) {
      const afterConflicts = TimePeriod.create(
        currentStart,
        period.endTime,
        period.timezone
      );

      if (afterConflicts.getDurationInMinutes() >= 15) {
        availablePeriods.push(afterConflicts);
      }
    }

    return {
      success: availablePeriods.length > 0,
      periods: availablePeriods.length > 0 ? availablePeriods : undefined,
    };
  }

  private findNextAvailableSlot(
    resourceId: string,
    durationMinutes: number,
    searchStart?: Date
  ): TimePeriod | null {
    const existingReservations = this.reservations.get(resourceId) || [];
    const start = searchStart || new Date();

    // Simple implementation: try hourly slots
    let candidate = new Date(start);
    candidate.setMinutes(0, 0, 0); // Round to hour

    for (let i = 0; i < 24 * 7; i++) {
      // Search up to a week
      const candidateEnd = new Date(
        candidate.getTime() + durationMinutes * 60 * 1000
      );
      const candidatePeriod = TimePeriod.create(candidate, candidateEnd);

      const hasConflict = existingReservations.some(reservation =>
        reservation.conflictsWith(candidatePeriod)
      );

      if (!hasConflict) {
        return candidatePeriod;
      }

      candidate.setHours(candidate.getHours() + 1);
    }

    return null;
  }

  getAvailability(resourceId: string, date: Date): TimePeriod[] {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const dayPeriod = TimePeriod.create(dayStart, dayEnd);
    const reservations = this.reservations.get(resourceId) || [];

    // Find gaps between reservations
    const availableSlots: TimePeriod[] = [];
    let currentStart = dayStart;

    const dayReservations = reservations
      .filter(r => r.conflictsWith(dayPeriod))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    for (const reservation of dayReservations) {
      if (currentStart < reservation.startTime) {
        const gap = TimePeriod.create(currentStart, reservation.startTime);
        availableSlots.push(gap);
      }
      currentStart = new Date(
        Math.max(currentStart.getTime(), reservation.endTime.getTime())
      );
    }

    // Add remaining time at end of day
    if (currentStart < dayEnd) {
      availableSlots.push(TimePeriod.create(currentStart, dayEnd));
    }

    return availableSlots;
  }
}

// Usage example
const scheduler = new ResourceScheduler();

const meetingRoom = 'conference-room-a';
const meeting1 = TimePeriod.create(
  new Date('2025-02-03T10:00:00'),
  new Date('2025-02-03T11:00:00')
);

const meeting2 = TimePeriod.create(
  new Date('2025-02-03T10:30:00'),
  new Date('2025-02-03T12:00:00')
);

// Book first meeting
const booking1 = scheduler.bookResource(meetingRoom, meeting1);
console.log('First booking:', booking1.success); // true

// Try to book conflicting meeting with split resolution
const booking2 = scheduler.bookResource(meetingRoom, meeting2, 'split');
console.log('Split booking result:', booking2);

// Check availability for the day
const availability = scheduler.getAvailability(
  meetingRoom,
  new Date('2025-02-03')
);

console.log(`Available slots: ${availability.length}`);
availability.forEach((slot, index) => {
  console.log(`Slot ${index + 1}: ${slot.toHumanReadable()}`);
});
```

## Key Features

- **Advanced Time Operations**: Overlap detection, gap calculation, and conflict
  resolution
- **Timezone Support**: Full timezone conversion and handling capabilities
- **Recurring Patterns**: Support for daily, weekly, monthly, and yearly
  recurrence
- **Business Logic**: Business hours adjustments and working day calculations
- **Resource Scheduling**: Advanced booking system with conflict resolution
  strategies
- **Flexible Duration**: Support for various duration formats and calculations

## Common Pitfalls

- **Timezone Complexity**: Always use proper timezone libraries for production
  systems
- **Recurrence Edge Cases**: Handle end dates, leap years, and DST transitions
  carefully
- **Performance**: Large recurrence expansions can be memory intensive
- **Business Rules**: Validate business-specific constraints (minimum durations,
  booking windows)

## Related Examples

- [Date Range Value Object](../intermediate/example-1.md) - Foundation for
  time-based calculations
- [User Profile Composite](../intermediate/example-2.md) - Complex value object
  composition patterns
