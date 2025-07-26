# Date Range Value Object - Intermediate Example

**Version**: 2025-01-21 **Package**: @vytches/ddd-value-objects  
**Complexity**: Intermediate **Domain**: Time & Scheduling **Patterns**: Range
Value Objects, Time Calculations, Business Day Logic **Dependencies**:
@vytches/ddd-value-objects, @vytches/ddd-domain-primitives

## Description

This example demonstrates creating a **DateRange** value object that
encapsulates time periods with advanced business logic including business day
calculations, overlap detection, duration analysis, and timezone handling. Shows
intermediate patterns for range-based value objects with temporal intelligence.

## Business Context

DateRange is essential for scheduling systems, booking platforms, project
management, and financial reporting. It provides intelligent date range
operations, business day calculations, and overlap detection. Critical for
resource booking, project timelines, billing periods, and availability
management.

## Code Example

```typescript
// date-range.ts
import { ValueObject } from '@vytches/ddd-value-objects';
import {
  DateRangeData,
  DateRangeCalculation,
  ValueObjectValidationResult,
} from './types';
import {
  validateRequired,
  createSuccessResult,
  createFailureResult,
  combineValidationResults,
} from '../shared';

export class DateRange extends ValueObject<DateRangeData> {
  private static readonly DEFAULT_HOLIDAYS: Date[] = [
    // Common US holidays - in real implementation would be configurable
    new Date('2025-01-01'), // New Year's Day
    new Date('2025-07-04'), // Independence Day
    new Date('2025-12-25'), // Christmas
  ];

  private constructor(data: DateRangeData) {
    super(data);
  }

  // ✅ FOCUS: Factory methods with comprehensive validation
  static create(
    startDate: Date,
    endDate: Date,
    timezone?: string,
    inclusive: boolean = true
  ): DateRange {
    const data: DateRangeData = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      timezone,
      inclusive,
    };

    const validation = DateRange.validate(data);
    if (!validation.isValid) {
      throw new Error(`Invalid date range: ${validation.errors.join(', ')}`);
    }

    return new DateRange(data);
  }

  // ✅ FOCUS: Factory for business day ranges
  static createBusinessDays(
    startDate: Date,
    businessDays: number,
    holidays: Date[] = DateRange.DEFAULT_HOLIDAYS
  ): DateRange {
    if (businessDays <= 0) {
      throw new Error('Business days must be positive');
    }

    const endDate = DateRange.addBusinessDays(
      startDate,
      businessDays,
      holidays
    );
    return DateRange.create(startDate, endDate);
  }

  // ✅ FOCUS: Factory for specific durations
  static createDuration(
    startDate: Date,
    duration: { days?: number; weeks?: number; months?: number; years?: number }
  ): DateRange {
    const endDate = new Date(startDate);

    if (duration.years) {
      endDate.setFullYear(endDate.getFullYear() + duration.years);
    }
    if (duration.months) {
      endDate.setMonth(endDate.getMonth() + duration.months);
    }
    if (duration.weeks) {
      endDate.setDate(endDate.getDate() + duration.weeks * 7);
    }
    if (duration.days) {
      endDate.setDate(endDate.getDate() + duration.days);
    }

    return DateRange.create(startDate, endDate);
  }

  // ✅ FOCUS: Comprehensive validation
  static validate(data: DateRangeData): ValueObjectValidationResult {
    const results: ValueObjectValidationResult[] = [];

    // Required field validation
    results.push(validateRequired(data.startDate, 'start date'));
    results.push(validateRequired(data.endDate, 'end date'));

    // Date validity
    if (data.startDate && isNaN(data.startDate.getTime())) {
      results.push(createFailureResult(['Start date is not a valid date']));
    }
    if (data.endDate && isNaN(data.endDate.getTime())) {
      results.push(createFailureResult(['End date is not a valid date']));
    }

    // Range validity
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      results.push(
        createFailureResult(['Start date must be before or equal to end date'])
      );
    }

    // Timezone validation
    if (data.timezone && !DateRange.isValidTimezone(data.timezone)) {
      results.push(createFailureResult([`Invalid timezone: ${data.timezone}`]));
    }

    return combineValidationResults(...results);
  }

  // ✅ FOCUS: Advanced range operations
  contains(date: Date): boolean {
    if (this.data.inclusive) {
      return date >= this.data.startDate && date <= this.data.endDate;
    } else {
      return date > this.data.startDate && date < this.data.endDate;
    }
  }

  overlaps(other: DateRange): boolean {
    if (this.data.inclusive && other.data.inclusive) {
      return (
        this.data.startDate <= other.data.endDate &&
        this.data.endDate >= other.data.startDate
      );
    } else {
      return (
        this.data.startDate < other.data.endDate &&
        this.data.endDate > other.data.startDate
      );
    }
  }

  intersect(other: DateRange): DateRange | null {
    if (!this.overlaps(other)) {
      return null;
    }

    const startDate =
      this.data.startDate > other.data.startDate
        ? this.data.startDate
        : other.data.startDate;

    const endDate =
      this.data.endDate < other.data.endDate
        ? this.data.endDate
        : other.data.endDate;

    return DateRange.create(
      startDate,
      endDate,
      this.data.timezone,
      this.data.inclusive
    );
  }

  union(other: DateRange): DateRange {
    const startDate =
      this.data.startDate < other.data.startDate
        ? this.data.startDate
        : other.data.startDate;

    const endDate =
      this.data.endDate > other.data.endDate
        ? this.data.endDate
        : other.data.endDate;

    return DateRange.create(
      startDate,
      endDate,
      this.data.timezone,
      this.data.inclusive
    );
  }

  gap(other: DateRange): DateRange | null {
    // Check if ranges don't overlap and have a gap between them
    if (this.overlaps(other)) {
      return null;
    }

    let earlierRange: DateRange, laterRange: DateRange;

    if (this.data.endDate < other.data.startDate) {
      earlierRange = this;
      laterRange = other;
    } else if (other.data.endDate < this.data.startDate) {
      earlierRange = other;
      laterRange = this;
    } else {
      return null;
    }

    return DateRange.create(
      new Date(earlierRange.data.endDate.getTime() + 1),
      new Date(laterRange.data.startDate.getTime() - 1)
    );
  }

  // ✅ FOCUS: Business day calculations
  getBusinessDaysCount(holidays: Date[] = DateRange.DEFAULT_HOLIDAYS): number {
    let count = 0;
    const current = new Date(this.data.startDate);
    const endDate = new Date(this.data.endDate);

    while (current <= endDate) {
      if (DateRange.isBusinessDay(current, holidays)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  getWeekendDaysCount(): number {
    let count = 0;
    const current = new Date(this.data.startDate);
    const endDate = new Date(this.data.endDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Sunday or Saturday
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  getHolidaysCount(holidays: Date[] = DateRange.DEFAULT_HOLIDAYS): number {
    return holidays.filter(holiday => this.contains(holiday)).length;
  }

  // ✅ FOCUS: Duration calculations
  getDurationCalculation(
    holidays: Date[] = DateRange.DEFAULT_HOLIDAYS
  ): DateRangeCalculation {
    const startTime = this.data.startDate.getTime();
    const endTime = this.data.endDate.getTime();
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const millisecondsPerHour = 60 * 60 * 1000;

    const durationDays = Math.ceil((endTime - startTime) / millisecondsPerDay);
    const durationHours = Math.ceil(
      (endTime - startTime) / millisecondsPerHour
    );

    const businessDays = this.getBusinessDaysCount(holidays);
    const includesWeekends = this.getWeekendDaysCount() > 0;
    const holidayList = holidays.filter(holiday => this.contains(holiday));

    return {
      durationDays,
      durationHours,
      businessDays,
      includesWeekends,
      holidays: holidayList,
    };
  }

  // ✅ FOCUS: Range manipulation
  extend(days: number): DateRange {
    const newEndDate = new Date(this.data.endDate);
    newEndDate.setDate(newEndDate.getDate() + days);

    return DateRange.create(
      this.data.startDate,
      newEndDate,
      this.data.timezone,
      this.data.inclusive
    );
  }

  shrink(days: number): DateRange {
    const newEndDate = new Date(this.data.endDate);
    newEndDate.setDate(newEndDate.getDate() - days);

    if (newEndDate <= this.data.startDate) {
      throw new Error('Shrinking would make end date before start date');
    }

    return DateRange.create(
      this.data.startDate,
      newEndDate,
      this.data.timezone,
      this.data.inclusive
    );
  }

  shift(days: number): DateRange {
    const newStartDate = new Date(this.data.startDate);
    const newEndDate = new Date(this.data.endDate);

    newStartDate.setDate(newStartDate.getDate() + days);
    newEndDate.setDate(newEndDate.getDate() + days);

    return DateRange.create(
      newStartDate,
      newEndDate,
      this.data.timezone,
      this.data.inclusive
    );
  }

  split(splitDate: Date): [DateRange, DateRange] | null {
    if (!this.contains(splitDate)) {
      return null;
    }

    const firstRange = DateRange.create(
      this.data.startDate,
      splitDate,
      this.data.timezone,
      this.data.inclusive
    );

    const nextDay = new Date(splitDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const secondRange = DateRange.create(
      nextDay,
      this.data.endDate,
      this.data.timezone,
      this.data.inclusive
    );

    return [firstRange, secondRange];
  }

  // ✅ FOCUS: Chunking and iteration
  chunkByDays(chunkSize: number): DateRange[] {
    if (chunkSize <= 0) {
      throw new Error('Chunk size must be positive');
    }

    const chunks: DateRange[] = [];
    const current = new Date(this.data.startDate);

    while (current <= this.data.endDate) {
      const chunkEnd = new Date(current);
      chunkEnd.setDate(chunkEnd.getDate() + chunkSize - 1);

      // Don't exceed the original end date
      if (chunkEnd > this.data.endDate) {
        chunkEnd.setTime(this.data.endDate.getTime());
      }

      chunks.push(
        DateRange.create(
          new Date(current),
          chunkEnd,
          this.data.timezone,
          this.data.inclusive
        )
      );

      current.setDate(current.getDate() + chunkSize);
    }

    return chunks;
  }

  chunkByWeeks(): DateRange[] {
    return this.chunkByDays(7);
  }

  chunkByMonths(): DateRange[] {
    const chunks: DateRange[] = [];
    const current = new Date(this.data.startDate);

    while (current <= this.data.endDate) {
      const monthEnd = new Date(
        current.getFullYear(),
        current.getMonth() + 1,
        0
      );

      // Don't exceed the original end date
      if (monthEnd > this.data.endDate) {
        monthEnd.setTime(this.data.endDate.getTime());
      }

      chunks.push(
        DateRange.create(
          new Date(current),
          monthEnd,
          this.data.timezone,
          this.data.inclusive
        )
      );

      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
    }

    return chunks;
  }

  // ✅ FOCUS: Query methods
  isToday(): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    return this.contains(today) || this.contains(todayEnd);
  }

  isCurrentWeek(): boolean {
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
    currentWeekEnd.setHours(23, 59, 59, 999);

    const currentWeek = DateRange.create(currentWeekStart, currentWeekEnd);
    return this.overlaps(currentWeek);
  }

  isCurrentMonth(): boolean {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const currentMonth = DateRange.create(monthStart, monthEnd);
    return this.overlaps(currentMonth);
  }

  isPast(): boolean {
    return this.data.endDate < new Date();
  }

  isFuture(): boolean {
    return this.data.startDate > new Date();
  }

  isCurrent(): boolean {
    const now = new Date();
    return this.contains(now);
  }

  // ✅ FOCUS: Display and formatting
  toString(): string {
    const startStr = this.data.startDate.toLocaleDateString();
    const endStr = this.data.endDate.toLocaleDateString();
    return `${startStr} - ${endStr}`;
  }

  toISO8601(): string {
    const startISO = this.data.startDate.toISOString().split('T')[0];
    const endISO = this.data.endDate.toISOString().split('T')[0];
    return `${startISO}/${endISO}`;
  }

  toHumanReadable(): string {
    const calculation = this.getDurationCalculation();

    if (calculation.durationDays === 1) {
      return this.data.startDate.toLocaleDateString();
    } else if (calculation.durationDays <= 7) {
      return `${calculation.durationDays} days (${this.toString()})`;
    } else if (calculation.durationDays <= 31) {
      const weeks = Math.floor(calculation.durationDays / 7);
      const days = calculation.durationDays % 7;
      let result = `${weeks} week${weeks !== 1 ? 's' : ''}`;
      if (days > 0) {
        result += ` ${days} day${days !== 1 ? 's' : ''}`;
      }
      return `${result} (${this.toString()})`;
    } else {
      const months = Math.floor(calculation.durationDays / 30);
      return `~${months} month${months !== 1 ? 's' : ''} (${this.toString()})`;
    }
  }

  // ✅ FOCUS: Getters
  get startDate(): Date {
    return new Date(this.data.startDate);
  }

  get endDate(): Date {
    return new Date(this.data.endDate);
  }

  get timezone(): string | undefined {
    return this.data.timezone;
  }

  get inclusive(): boolean {
    return this.data.inclusive ?? true;
  }

  get duration(): number {
    return this.data.endDate.getTime() - this.data.startDate.getTime();
  }

  get durationInDays(): number {
    return Math.ceil(this.duration / (24 * 60 * 60 * 1000));
  }

  // Private helper methods
  private static addBusinessDays(
    startDate: Date,
    businessDays: number,
    holidays: Date[]
  ): Date {
    const result = new Date(startDate);
    let addedDays = 0;

    while (addedDays < businessDays) {
      result.setDate(result.getDate() + 1);

      if (DateRange.isBusinessDay(result, holidays)) {
        addedDays++;
      }
    }

    return result;
  }

  private static isBusinessDay(date: Date, holidays: Date[]): boolean {
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend) return false;

    const isHoliday = holidays.some(
      holiday =>
        holiday.getFullYear() === date.getFullYear() &&
        holiday.getMonth() === date.getMonth() &&
        holiday.getDate() === date.getDate()
    );

    return !isHoliday;
  }

  private static isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  // ✅ FOCUS: Value object equality implementation
  protected isEqualTo(other: DateRange): boolean {
    return (
      this.data.startDate.getTime() === other.data.startDate.getTime() &&
      this.data.endDate.getTime() === other.data.endDate.getTime() &&
      this.data.timezone === other.data.timezone &&
      this.data.inclusive === other.data.inclusive
    );
  }
}
```

## Usage Examples

```typescript
// basic-date-range-usage.ts
import { DateRange } from './date-range';

// ✅ Creating date ranges
const projectTimeline = DateRange.create(
  new Date('2025-02-01'),
  new Date('2025-03-15')
);

const vacation = DateRange.create(
  new Date('2025-02-10'),
  new Date('2025-02-14')
);

console.log(projectTimeline.toString()); // "2/1/2025 - 3/15/2025"
console.log(projectTimeline.toHumanReadable()); // "~1 month (2/1/2025 - 3/15/2025)"

// ✅ Business day calculations
const businessDayRange = DateRange.createBusinessDays(
  new Date('2025-02-03'), // Monday
  10 // 10 business days
);

console.log(`Business days: ${businessDayRange.getBusinessDaysCount()}`); // 10

// ✅ Range operations
const hasOverlap = projectTimeline.overlaps(vacation);
console.log(`Project overlaps with vacation: ${hasOverlap}`); // true

const intersection = projectTimeline.intersect(vacation);
if (intersection) {
  console.log(`Overlap period: ${intersection}`); // "2/10/2025 - 2/14/2025"
}

// ✅ Duration analysis
const calculation = projectTimeline.getDurationCalculation();
console.log(`Total days: ${calculation.durationDays}`);
console.log(`Business days: ${calculation.businessDays}`);
console.log(`Includes weekends: ${calculation.includesWeekends}`);

// ✅ Range manipulation
const extendedProject = projectTimeline.extend(7); // Add 7 days
const shiftedVacation = vacation.shift(30); // Move 30 days later

console.log(`Extended project: ${extendedProject}`);
console.log(`Shifted vacation: ${shiftedVacation}`);
```

## Advanced Operations

```typescript
// advanced-date-range-operations.ts
import { DateRange } from './date-range';

// ✅ Complex range analysis
class ProjectManager {
  private projectRanges: Map<string, DateRange> = new Map();

  addProject(projectId: string, range: DateRange): void {
    this.projectRanges.set(projectId, range);
  }

  findOverlappingProjects(projectId: string): string[] {
    const targetRange = this.projectRanges.get(projectId);
    if (!targetRange) return [];

    const overlapping: string[] = [];

    this.projectRanges.forEach((range, id) => {
      if (id !== projectId && targetRange.overlaps(range)) {
        overlapping.push(id);
      }
    });

    return overlapping;
  }

  getResourceUtilization(timeFrame: DateRange): {
    totalProjects: number;
    overlappingPeriods: DateRange[];
    maxConcurrentProjects: number;
  } {
    const relevantProjects = Array.from(this.projectRanges.values()).filter(
      range => range.overlaps(timeFrame)
    );

    const overlappingPeriods: DateRange[] = [];
    let maxConcurrent = 0;

    // Find all overlapping combinations
    for (let i = 0; i < relevantProjects.length; i++) {
      for (let j = i + 1; j < relevantProjects.length; j++) {
        const overlap = relevantProjects[i].intersect(relevantProjects[j]);
        if (overlap) {
          overlappingPeriods.push(overlap);
        }
      }
    }

    // Calculate maximum concurrent projects (simplified)
    const allDates = new Set<number>();
    relevantProjects.forEach(range => {
      const current = new Date(range.startDate);
      while (current <= range.endDate) {
        allDates.add(current.getTime());
        current.setDate(current.getDate() + 1);
      }
    });

    allDates.forEach(dateTime => {
      const date = new Date(dateTime);
      const concurrent = relevantProjects.filter(range =>
        range.contains(date)
      ).length;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
    });

    return {
      totalProjects: relevantProjects.length,
      overlappingPeriods,
      maxConcurrentProjects: maxConcurrent,
    };
  }
}

// ✅ Scheduling system
class MeetingScheduler {
  private bookedSlots: DateRange[] = [];

  addMeeting(meetingRange: DateRange): {
    success: boolean;
    conflicts?: DateRange[];
  } {
    const conflicts = this.bookedSlots.filter(slot =>
      slot.overlaps(meetingRange)
    );

    if (conflicts.length > 0) {
      return { success: false, conflicts };
    }

    this.bookedSlots.push(meetingRange);
    return { success: true };
  }

  findAvailableSlots(
    searchPeriod: DateRange,
    duration: number, // in hours
    businessHoursOnly: boolean = true
  ): DateRange[] {
    const availableSlots: DateRange[] = [];
    const durationMs = duration * 60 * 60 * 1000; // Convert to milliseconds

    let currentTime = new Date(searchPeriod.startDate);

    while (currentTime < searchPeriod.endDate) {
      const slotEnd = new Date(currentTime.getTime() + durationMs);

      // Don't exceed search period
      if (slotEnd > searchPeriod.endDate) break;

      const proposedSlot = DateRange.create(currentTime, slotEnd);

      // Check if slot is during business hours (if required)
      if (businessHoursOnly && !this.isBusinessHours(proposedSlot)) {
        currentTime = this.getNextBusinessHour(currentTime);
        continue;
      }

      // Check for conflicts
      const hasConflict = this.bookedSlots.some(slot =>
        slot.overlaps(proposedSlot)
      );

      if (!hasConflict) {
        availableSlots.push(proposedSlot);
      }

      // Move to next hour
      currentTime.setHours(currentTime.getHours() + 1);
    }

    return availableSlots;
  }

  private isBusinessHours(slot: DateRange): boolean {
    const start = slot.startDate;
    const end = slot.endDate;

    const startHour = start.getHours();
    const endHour = end.getHours();
    const startDay = start.getDay();
    const endDay = end.getDay();

    // Check if both start and end are during business hours (9 AM - 5 PM)
    const isStartBusinessHour = startHour >= 9 && startHour < 17;
    const isEndBusinessHour = endHour >= 9 && endHour <= 17;

    // Check if both are weekdays (Monday = 1, Friday = 5)
    const isStartWeekday = startDay >= 1 && startDay <= 5;
    const isEndWeekday = endDay >= 1 && endDay <= 5;

    return (
      isStartBusinessHour && isEndBusinessHour && isStartWeekday && isEndWeekday
    );
  }

  private getNextBusinessHour(date: Date): Date {
    const nextHour = new Date(date);
    nextHour.setHours(nextHour.getHours() + 1);

    // If after business hours, move to next day 9 AM
    if (nextHour.getHours() >= 17) {
      nextHour.setDate(nextHour.getDate() + 1);
      nextHour.setHours(9, 0, 0, 0);
    }

    // If weekend, move to Monday 9 AM
    if (nextHour.getDay() === 0 || nextHour.getDay() === 6) {
      const daysToMonday = nextHour.getDay() === 0 ? 1 : 2;
      nextHour.setDate(nextHour.getDate() + daysToMonday);
      nextHour.setHours(9, 0, 0, 0);
    }

    return nextHour;
  }
}

// Usage examples
const pm = new ProjectManager();
pm.addProject(
  'web-redesign',
  DateRange.create(new Date('2025-02-01'), new Date('2025-03-15'))
);
pm.addProject(
  'mobile-app',
  DateRange.create(new Date('2025-02-15'), new Date('2025-04-01'))
);
pm.addProject(
  'database-upgrade',
  DateRange.create(new Date('2025-03-01'), new Date('2025-03-31'))
);

const overlapping = pm.findOverlappingProjects('web-redesign');
console.log('Overlapping projects:', overlapping); // ['mobile-app', 'database-upgrade']

const q1 = DateRange.create(new Date('2025-01-01'), new Date('2025-03-31'));
const utilization = pm.getResourceUtilization(q1);
console.log(
  `Max concurrent projects in Q1: ${utilization.maxConcurrentProjects}`
);

// Meeting scheduler
const scheduler = new MeetingScheduler();
const meeting1 = DateRange.create(
  new Date('2025-02-03 10:00:00'),
  new Date('2025-02-03 11:00:00')
);

const result = scheduler.addMeeting(meeting1);
console.log('Meeting scheduled:', result.success);

const searchPeriod = DateRange.create(
  new Date('2025-02-03 08:00:00'),
  new Date('2025-02-03 18:00:00')
);

const availableSlots = scheduler.findAvailableSlots(searchPeriod, 1); // 1 hour meetings
console.log(`Available slots: ${availableSlots.length}`);
```

## Key Features

- **Range Operations**: Overlap detection, intersection, union, and gap analysis
- **Business Logic**: Business day calculations with holiday support
- **Duration Analysis**: Multiple duration calculation methods
- **Range Manipulation**: Extend, shrink, shift, and split operations
- **Chunking**: Break ranges into smaller periods (days, weeks, months)
- **Time Intelligence**: Current period detection and temporal queries
- **Flexible Display**: Multiple formatting options for different contexts

## Common Pitfalls

- **Timezone Handling**: Be aware of timezone implications for range boundaries
- **Inclusive vs Exclusive**: Understand the impact of inclusive/exclusive
  ranges
- **Business Day Logic**: Account for holidays and regional variations
- **Date Mutations**: Always create new Date objects to maintain immutability
- **Performance**: Large date ranges can be expensive for day-by-day iteration

## Related Examples

- [Money Value Object](../basic/example-1.md) - Numeric precision patterns
- [User Profile Composite](./example-2.md) - Complex composite value objects
