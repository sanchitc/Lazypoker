import { CHIP_COLORS } from '@common/constants';

/** Sorted denominations from CHIP_COLORS, descending */
export const DENOMINATIONS = CHIP_COLORS.map(c => c.value).sort((a, b) => b - a);

/** Color lookup by denomination value */
export const CHIP_COLOR_MAP = new Map(CHIP_COLORS.map(c => [c.value, c.color]));
export const CHIP_LABEL_MAP = new Map(CHIP_COLORS.map(c => [c.value, c.label]));

/**
 * Decompose an amount into chip denominations using largest-first greedy.
 * Returns a Map of denomination → count.
 */
export function decomposeChips(amount: number, denoms: number[] = DENOMINATIONS): Map<number, number> {
  const result = new Map<number, number>();
  let remaining = amount;
  for (const d of denoms) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / d);
    if (count > 0) {
      result.set(d, count);
      remaining -= count * d;
    }
  }
  // Handle remainder with smallest denomination if rounding issues
  if (remaining > 0) {
    const smallest = denoms[denoms.length - 1];
    result.set(smallest, (result.get(smallest) ?? 0) + Math.ceil(remaining / smallest));
  }
  return result;
}

/**
 * Get available denominations for a given stack total.
 * Returns ascending order with count available for each.
 */
export function getAvailableDenominations(stackTotal: number): { value: number; color: string; label: string; count: number }[] {
  const breakdown = decomposeChips(stackTotal);
  return CHIP_COLORS
    .filter(c => stackTotal >= c.value)
    .map(c => ({
      value: c.value,
      color: c.color,
      label: c.label,
      count: breakdown.get(c.value) ?? 0,
    }));
}

/** Total from a chip map */
export function chipMapTotal(chips: Map<number, number>): number {
  let total = 0;
  for (const [denom, count] of chips) {
    total += denom * count;
  }
  return total;
}
