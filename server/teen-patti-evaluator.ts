import { Card, HandResult, Rank } from '../common/types.js';
import { RANK_VALUES } from '../common/constants.js';

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
 */

const RANK_SINGULAR: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
};

const RANK_PLURAL: Record<number, string> = {
  2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens',
  8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces',
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

export function evaluateTeenPattiHand(cards: [Card, Card, Card]): HandResult {
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

export function compareTeenPattiHands(a: HandResult, b: HandResult): number {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}
