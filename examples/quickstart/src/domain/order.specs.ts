import { Specification } from '@vytches/ddd-validation';

/**
 * Inline specifications — preferred over class-based specs.
 * Each spec is a single line instead of a 20-30 LOC class file.
 */

interface OrderState {
  items: ReadonlyArray<{ sku: string; qty: number; price: number }>;
  placed: boolean;
  cancelled: boolean;
}

export const hasItems = Specification.create<OrderState>(order => order.items.length > 0);

export const isNotPlaced = Specification.create<OrderState>(order => !order.placed);

export const isNotCancelled = Specification.create<OrderState>(order => !order.cancelled);

export const canBePlaced = hasItems.and(isNotPlaced).and(isNotCancelled);

export const canBeCancelled = isNotCancelled;
