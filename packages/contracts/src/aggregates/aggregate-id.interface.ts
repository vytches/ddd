/**
 * Minimal interface that any aggregate ID must implement.
 * This allows for flexible ID types while ensuring basic functionality.
 */
export interface IAggregateId {
  /**
   * Convert the ID to a string representation.
   * This is required for serialization, logging, and storage.
   */
  toString(): string;

  /**
   * Optional: Compare this ID with another for equality.
   * If not provided, string comparison will be used.
   */
  equals?(other: IAggregateId): boolean;
}

/**
 * Type guard to check if a value implements IAggregateId
 */
export function isAggregateId(value: unknown): value is IAggregateId {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    'toString' in value &&
    typeof (value as Record<string, unknown>).toString === 'function'
  );
}

/**
 * Helper to compare two aggregate IDs
 */
export function areAggregateIdsEqual(id1: IAggregateId, id2: IAggregateId): boolean {
  // If either has an equals method, use it
  if ('equals' in id1 && typeof id1.equals === 'function') {
    return id1.equals(id2);
  }
  if ('equals' in id2 && typeof id2.equals === 'function') {
    return id2.equals(id1);
  }
  // Otherwise fall back to string comparison
  return id1.toString() === id2.toString();
}
