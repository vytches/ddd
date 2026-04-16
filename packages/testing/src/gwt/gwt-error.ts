import type { IDomainEvent } from '@vytches/ddd-contracts';

/**
 * Error thrown when a GWT aggregate test assertion fails.
 * Provides formatted context showing Given/When/Then steps.
 *
 * @public
 * @stable
 * @since 0.24.0
 */
export class GWTAssertionError extends Error {
  constructor(
    public readonly givenEvents: ReadonlyArray<IDomainEvent>,
    public readonly expectedEvents: ReadonlyArray<IDomainEvent>,
    public readonly actualEvents: ReadonlyArray<IDomainEvent>,
    public readonly expectedError?: string,
    public readonly actualError?: Error
  ) {
    super(
      GWTAssertionError.formatMessage(
        givenEvents,
        expectedEvents,
        actualEvents,
        expectedError,
        actualError
      )
    );
    this.name = 'GWTAssertionError';
  }

  private static formatMessage(
    givenEvents: ReadonlyArray<IDomainEvent>,
    expectedEvents: ReadonlyArray<IDomainEvent>,
    actualEvents: ReadonlyArray<IDomainEvent>,
    expectedError?: string,
    actualError?: Error
  ): string {
    const lines: string[] = ['GWT Assertion Failed:', ''];

    lines.push('  Given:');
    if (givenEvents.length === 0) {
      lines.push('    (no prior events)');
    } else {
      for (const event of givenEvents) {
        lines.push(`    - ${event.eventName} ${JSON.stringify(event.payload ?? {})}`);
      }
    }

    lines.push('');

    if (expectedError !== undefined) {
      lines.push('  Expected error:');
      lines.push(`    ${expectedError}`);
      lines.push('');
      if (actualError) {
        lines.push('  Actual error:');
        lines.push(`    ${actualError.message}`);
      } else {
        lines.push('  Actual:');
        lines.push('    No error thrown');
        if (actualEvents.length > 0) {
          lines.push('    Events produced:');
          for (const event of actualEvents) {
            lines.push(`      - ${event.eventName}`);
          }
        }
      }
    } else {
      lines.push('  Expected events:');
      if (expectedEvents.length === 0) {
        lines.push('    (no events)');
      } else {
        for (const event of expectedEvents) {
          lines.push(`    - ${event.eventName} ${JSON.stringify(event.payload ?? {})}`);
        }
      }
      lines.push('');
      lines.push('  Actual events:');
      if (actualEvents.length === 0) {
        lines.push('    (no events)');
      } else {
        for (const event of actualEvents) {
          lines.push(`    - ${event.eventName} ${JSON.stringify(event.payload ?? {})}`);
        }
      }
    }

    return lines.join('\n');
  }
}
