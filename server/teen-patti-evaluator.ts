import { Card, HandResult, Rank, TeenPattiVariation } from '../common/types.js';
import { RANK_VALUES, SUIT_SYMBOLS } from '../common/constants.js';

/**
 * Three-card Teen Patti hand evaluator.
 *
 * Hand ranks (high to low — note sequence > color and A-2-3 wraparound):
 *   trail          three of a kind
 *   pure-sequence  straight flush
 *   sequence       straight
 *   color          flush
 *   pair-tp        a pair + kicker
 *   high-card-tp   nothing
 *
 * rankValue uses bands of 100 so different categories never collide:
 *   trail          600..699
 *   pure-sequence  500..599
 *   sequence       400..499
 *   color          300
 *   pair-tp        200..299
 *   high-card-tp   100
 * Within a category, ties are resolved via kickers[] (largest first).
 *
 * For sequences, the wraparound rule places A-2-3 above A-K-Q. We encode
 * this by mapping the run's "high card" to a sortable score where A-2-3 → 15
 * and A-K-Q → 14, then K-Q-J → 13, …, 4-3-2 → 4. Stored as kickers[0].
 *
 * Variation strategy: the dispatcher (evaluateTeenPattiHandFor) picks one of
 * four implementations. Each reshapes its rankValue/kickers so that the
 * existing compareTeenPattiHands comparator (higher rankValue wins, then
 * higher kicker) still picks the right winner. This keeps every call site
 * untouched — no comparator-direction flag, no extra dispatch on compare.
 */

const RANK_SINGULAR: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
};

const RANK_PLURAL: Record<number, string> = {
  2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens',
  8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces',
};

const RANK_SHORT: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

function sing(v: number): string { return RANK_SINGULAR[v] ?? String(v); }
function plur(v: number): string { return RANK_PLURAL[v] ?? String(v); }

function rankValue(rank: Rank): number {
  return RANK_VALUES[rank];
}

/**
 * Detect a 3-card sequence and return its sort score, or null if not.
 * A-2-3 (wraparound) → 15, A-K-Q → 14, ..., 4-3-2 → 4.
 */
function sequenceScore(values: number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  // Standard run of 3 consecutive values.
  if (sorted[1] === sorted[0] + 1 && sorted[2] === sorted[1] + 1) {
    return sorted[2]; // high card 4..14
  }
  // A-2-3 wraparound — treat as the highest sequence.
  if (sorted[0] === 2 && sorted[1] === 3 && sorted[2] === 14) {
    return 15;
  }
  return null;
}

function evaluateClassic(cards: [Card, Card, Card]): HandResult {
  const values = cards.map(c => rankValue(c.rank)).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isColor = suits.every(s => s === suits[0]);
  const seqScore = sequenceScore(values);

  // Trail (three of a kind)
  if (values[0] === values[1] && values[1] === values[2]) {
    return {
      rank: 'trail',
      rankValue: 600 + values[0],
      kickers: [values[0]],
      description: `Trail of ${plur(values[0])}`,
    };
  }

  // Pure sequence (straight flush)
  if (isColor && seqScore !== null) {
    return {
      rank: 'pure-sequence',
      rankValue: 500 + seqScore,
      kickers: [seqScore],
      description: seqScore === 15
        ? 'Pure Sequence A-2-3'
        : `Pure Sequence, ${sing(seqScore)}-high`,
    };
  }

  // Sequence (straight, mixed suits)
  if (seqScore !== null) {
    return {
      rank: 'sequence',
      rankValue: 400 + seqScore,
      kickers: [seqScore],
      description: seqScore === 15
        ? 'Sequence A-2-3'
        : `Sequence, ${sing(seqScore)}-high`,
    };
  }

  // Color (flush, not in sequence) — kickers carry the high-card tiebreak.
  if (isColor) {
    return {
      rank: 'color',
      rankValue: 300,
      kickers: values,
      description: `Color, ${sing(values[0])}-high`,
    };
  }

  // Pair
  let pairValue: number | null = null;
  let kicker: number | null = null;
  if (values[0] === values[1]) {
    pairValue = values[0];
    kicker = values[2];
  } else if (values[1] === values[2]) {
    pairValue = values[1];
    kicker = values[0];
  }
  if (pairValue !== null && kicker !== null) {
    return {
      rank: 'pair-tp',
      rankValue: 200 + pairValue,
      kickers: [pairValue, kicker],
      description: `Pair of ${plur(pairValue)}`,
    };
  }

  // High card
  return {
    rank: 'high-card-tp',
    rankValue: 100,
    kickers: values,
    description: `${sing(values[0])} High`,
  };
}

/**
 * Muflis (lowball): structural rank is identical to Classic, but the order
 * is inverted. We reshape rankValue/kickers so the existing comparator picks
 * the Muflis winner without flipping the comparison direction.
 *
 * Reshape (best to worst in Muflis):
 *   high-card-tp   → 600 band
 *   pair-tp        → 500 band — within the band, lower pair > higher pair
 *   color          → 400 band
 *   sequence       → 300 band — within the band, lower seq > higher seq
 *   pure-sequence  → 200 band
 *   trail          → 100 band — lower trail > higher trail
 *
 * Within-class kickers are stored as (15 - k) so the comparator's "higher
 * kicker wins" picks the lower card. A-2-3 still detected structurally; it
 * remains the worst sequence in Muflis.
 */
function evaluateMuflis(cards: [Card, Card, Card]): HandResult {
  const base = evaluateClassic(cards);
  const inv = (k: number) => 15 - k;

  switch (base.rank) {
    case 'high-card-tp':
      return {
        rank: 'high-card-tp',
        rankValue: 600,
        kickers: base.kickers.map(inv),
        description: `${base.description} (Muflis)`,
      };
    case 'pair-tp': {
      const [pairValue, kicker] = base.kickers;
      return {
        rank: 'pair-tp',
        rankValue: 500 + inv(pairValue),
        kickers: [inv(pairValue), inv(kicker)],
        description: `${base.description} (Muflis)`,
      };
    }
    case 'color':
      return {
        rank: 'color',
        rankValue: 400,
        kickers: base.kickers.map(inv),
        description: `${base.description} (Muflis)`,
      };
    case 'sequence': {
      const [seq] = base.kickers;
      return {
        rank: 'sequence',
        rankValue: 300 + inv(seq),
        kickers: [inv(seq)],
        description: `${base.description} (Muflis)`,
      };
    }
    case 'pure-sequence': {
      const [seq] = base.kickers;
      return {
        rank: 'pure-sequence',
        rankValue: 200 + inv(seq),
        kickers: [inv(seq)],
        description: `${base.description} (Muflis)`,
      };
    }
    case 'trail': {
      const [v] = base.kickers;
      return {
        rank: 'trail',
        rankValue: 100 + inv(v),
        kickers: [inv(v)],
        description: `${base.description} (Muflis)`,
      };
    }
    default:
      return base;
  }
}

/**
 * AK47: A, K, 4, 7 are wild. Brute-force enumerate substitutions for each
 * wild slot (≤ 13³ = 2197 combos with at most 3 wilds) and pick the best
 * Classic result. Suits are preserved — a wild K♥ remains a heart, so flush
 * logic still works.
 *
 * To make a natural hand beat the same wild-built hand at the same rank, we
 * tack `(3 - wildCount)` onto the kickers as the final tiebreak. With the
 * comparator's "higher kicker wins" rule, fewer wilds (3) beats more (0/1/2)
 * at the same structural rank+kicker prefix.
 */
const AK47_WILD_RANKS: Set<Rank> = new Set(['A', 'K', '4', '7']);
const ALL_RANKS_FOR_WILD: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function compareForBest(a: HandResult, b: HandResult): number {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}

function evaluateAK47(cards: [Card, Card, Card]): HandResult {
  const wildSlots: number[] = [];
  cards.forEach((c, i) => { if (AK47_WILD_RANKS.has(c.rank)) wildSlots.push(i); });

  if (wildSlots.length === 0) {
    const r = evaluateClassic(cards);
    return { ...r, kickers: [...r.kickers, 3], wildSubstitutions: [] };
  }

  const choices: Rank[][] = wildSlots.map(() => ALL_RANKS_FOR_WILD);
  let best: HandResult | null = null;
  let bestSubs: { cardIndex: number; usedAs: number }[] = [];

  // Recursively enumerate substitutions.
  function recurse(slotIdx: number, current: [Card, Card, Card], subs: { cardIndex: number; usedAs: number }[]) {
    if (slotIdx === wildSlots.length) {
      const r = evaluateClassic(current);
      if (best === null || compareForBest(r, best) > 0) {
        best = r;
        bestSubs = [...subs];
      }
      return;
    }
    const slot = wildSlots[slotIdx];
    const originalSuit = cards[slot].suit;
    for (const rank of choices[slotIdx]) {
      const next: [Card, Card, Card] = [current[0], current[1], current[2]];
      next[slot] = { rank, suit: originalSuit };
      subs.push({ cardIndex: slot, usedAs: RANK_VALUES[rank] });
      recurse(slotIdx + 1, next, subs);
      subs.pop();
    }
  }
  recurse(0, [cards[0], cards[1], cards[2]], []);

  const wildCount = wildSlots.length;
  // best is non-null because at least one combo runs.
  const result = best as unknown as HandResult;

  // Append (3 - wildCount) as the final kicker tiebreak: natural beats wild.
  const reshaped: HandResult = {
    ...result,
    kickers: [...result.kickers, 3 - wildCount],
    description: describeAK47(cards, result, bestSubs),
    wildSubstitutions: bestSubs,
  };
  return reshaped;
}

function describeAK47(
  original: [Card, Card, Card],
  base: HandResult,
  subs: { cardIndex: number; usedAs: number }[],
): string {
  if (subs.length === 0) return `${base.description} (natural)`;
  const subDescs = subs.map(s => {
    const c = original[s.cardIndex];
    return `${RANK_SHORT[RANK_VALUES[c.rank]]}${SUIT_SYMBOLS[c.suit]}→${RANK_SHORT[s.usedAs]}`;
  });
  return `${base.description} (wild: ${subDescs.join(', ')})`;
}

/**
 * 999: A=1, 2-9=face value, 10/J/Q/K=0. Sort digits descending and treat them
 * as a 3-digit number; the closest to 999 wins.
 *
 * Why descending is always optimal: 999 is the maximum 3-digit number, so the
 * largest representable number is closest. Digit-sorting descending produces
 * the largest number from a given multiset of digits.
 *
 * rankValue = 1000 - distance (range 1..1000; perfect 999 = 1000).
 * kickers = digitsDescending (natural same-distance tiebreak: higher first
 * digit wins, etc.)
 */
const RANK_TO_DIGIT: Record<Rank, number> = {
  'A': 1,
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 0, 'J': 0, 'Q': 0, 'K': 0,
};

function evaluate999(cards: [Card, Card, Card]): HandResult {
  const digits = cards.map(c => RANK_TO_DIGIT[c.rank]).sort((a, b) => b - a);
  const total = digits[0] * 100 + digits[1] * 10 + digits[2];
  const distance = Math.abs(999 - total);
  const totalStr = `${digits[0]}${digits[1]}${digits[2]}`;
  const description = distance === 0
    ? `Perfect 999! (${digits.join('-')})`
    : `${digits.join('-')} → ${totalStr} (off by ${distance})`;

  return {
    rank: 'high-card-tp',
    rankValue: 1000 - distance,
    kickers: digits,
    description,
    chosenDigits: digits,
  };
}

export function evaluateTeenPattiHandFor(
  cards: [Card, Card, Card],
  variation: TeenPattiVariation = 'classic',
): HandResult {
  switch (variation) {
    case 'muflis': return evaluateMuflis(cards);
    case 'ak47': return evaluateAK47(cards);
    case '999': return evaluate999(cards);
    case 'classic':
    default:
      return evaluateClassic(cards);
  }
}

// Backward-compatible alias — Classic Teen Patti.
export function evaluateTeenPattiHand(cards: [Card, Card, Card]): HandResult {
  return evaluateClassic(cards);
}

export function compareTeenPattiHands(a: HandResult, b: HandResult): number {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}
