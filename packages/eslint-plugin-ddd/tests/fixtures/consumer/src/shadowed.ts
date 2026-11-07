// FIXTURE of lookalikes: same names, other origin. Any finding here is a false alarm.
import { Result } from 'neverthrow';

class EntityId {
  constructor(readonly value: string) {}
  static createText(value: string): EntityId {
    return new EntityId(value);
  }
}

export const isResult = (value: unknown): boolean => value instanceof Result;
export const id = new EntityId('abc');
export const other = EntityId.createText('abc');

export function shadowedParameter(PolicyBuilder: { create(): { build(): void } }): void {
  PolicyBuilder.create().build();
}
