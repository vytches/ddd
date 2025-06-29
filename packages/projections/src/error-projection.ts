import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';
import { BaseProjection } from './projection-base';
import type { ErrorProjectionState } from './projection-interfaces';

export class ErrorProjection extends BaseProjection<ErrorProjectionState> {
  readonly name = 'system-errors';
  readonly eventTypes = ['ProjectionErrorOccurred']; // Custom event
  private readonly maxRecentErrors: number;
  private readonly maxErrorAge: number; // in milliseconds

  constructor(maxRecentErrors = 100, maxErrorAgeMs = 24 * 60 * 60 * 1000) {
    super();
    this.maxRecentErrors = maxRecentErrors;
    this.maxErrorAge = maxErrorAgeMs;
  }

  createInitialState(): ErrorProjectionState {
    return {
      totalErrors: 0,
      errorsByProjection: new Map(),
      errorsByType: new Map(),
      recentErrors: [],
    };
  }

  apply(state: ErrorProjectionState, event: IExtendedDomainEvent): ErrorProjectionState {
    return this.when(state, event, 'ProjectionErrorOccurred', (state, event) => {
      const { projectionName, eventType, error } = event.payload;
      const now = new Date();

      // Filter out old errors
      const recentErrors = state.recentErrors.filter(
        err => now.getTime() - err.timestamp.getTime() < this.maxErrorAge
      );

      return this.updateState(state, {
        totalErrors: state.totalErrors + 1,
        errorsByProjection: new Map(state.errorsByProjection).set(
          projectionName,
          (state.errorsByProjection.get(projectionName) || 0) + 1
        ),
        errorsByType: new Map(state.errorsByType).set(
          error.type,
          (state.errorsByType.get(error.type) || 0) + 1
        ),
        recentErrors: [
          {
            projectionName,
            eventType,
            error: error.message,
            timestamp: now,
          },
          ...recentErrors.slice(0, this.maxRecentErrors - 1),
        ],
      });
    });
  }
}
