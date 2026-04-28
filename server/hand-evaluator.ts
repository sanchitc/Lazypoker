import { Card, HandResult, HandRank, Rank } from '../common/types.js';
import { RANK_VALUES } from '../common/constants.js';

function rankValue(rank: Rank): number {
  return RANK_VALUES[rank];
}

const RANK_LABELS: Record<number, string> = {
  2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens',
  8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces',
};

const RANK_SINGULAR: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
};

function plural(v: number): string { return RANK_LABELS[v] ?? String(v); }
function singular(v: number): string { return RANK_SINGULAR[v] ?? String(v); }

function getCombinations(cards: Card[], size: number): Card[][] {
  if (size === 0) return [[]];
  if (cards.length < size) return [];
  const [first, ...rest] = cards;
  const withFirst = getCombinations(rest, size - 1).map(combo => [first, ...combo]);
  const withoutFirst = getCombinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

function evaluateFiveCards(cards: Card[]): HandResult {
  const values = cards.map(c => rankValue(c.rank)).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check for straight
  let isStraight = false;
  let straightHigh = 0;

  // Normal straight check
  const uniqueValues = [...new Set(values)].sort((a, b) => b - a);
  if (uniqueValues.length >= 5) {
    for (let i = 0; i <= uniqueValues.length - 5; i++) {
      if (uniqueValues[i] - uniqueValues[i + 4] === 4) {
        isStraight = true;
        straightHigh = uniqueValues[i];
        break;
      }
    }
    // Ace-low straight (A-2-3-4-5)
    if (!isStraight && uniqueValues.includes(14) && uniqueValues.includes(2) &&
        uniqueValues.includes(3) && uniqueValues.includes(4) && uniqueValues.includes(5)) {
      isStraight = true;
      straightHigh = 5; // 5-high straight
    }
  }

  // Count ranks
  const rankCounts = new Map<number, number>();
  for (const v of values) {
    rankCounts.set(v, (rankCounts.get(v) || 0) + 1);
  }
  const counts = [...rankCounts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // by count desc
    return b[0] - a[0]; // by value desc
  });

  const makeResult = (rank: HandRank, rankVal: number, kickers: number[], desc: string): HandResult => ({
    rank, rankValue: rankVal, kickers, description: desc,
  });

  // Royal flush
  if (isFlush && isStraight && straightHigh === 14) {
    return makeResult('royal-flush', 9, [14], 'Royal Flush');
  }
  // Straight flush
  if (isFlush && isStraight) {
    return makeResult('straight-flush', 8, [straightHigh], `Straight Flush, ${singular(straightHigh)}-high`);
  }
  // Four of a kind
  if (counts[0][1] === 4) {
    const quad = counts[0][0];
    const kicker = counts[1][0];
    return makeResult('four-of-a-kind', 7, [quad, kicker], `Four of a Kind, ${plural(quad)}`);
  }
  // Full house
  if (counts[0][1] === 3 && counts[1][1] >= 2) {
    return makeResult('full-house', 6, [counts[0][0], counts[1][0]], `Full House, ${plural(counts[0][0])} over ${plural(counts[1][0])}`);
  }
  // Flush
  if (isFlush) {
    return makeResult('flush', 5, values.slice(0, 5), `Flush, ${singular(values[0])}-high`);
  }
  // Straight
  if (isStraight) {
    return makeResult('straight', 4, [straightHigh], `Straight, ${singular(straightHigh)}-high`);
  }
  // Three of a kind
  if (counts[0][1] === 3) {
    const trips = counts[0][0];
    const kickers = counts.filter(c => c[1] === 1).map(c => c[0]).slice(0, 2);
    return makeResult('three-of-a-kind', 3, [trips, ...kickers], `Three of a Kind, ${plural(trips)}`);
  }
  // Two pair
  if (counts[0][1] === 2 && counts[1][1] === 2) {
    const highPair = Math.max(counts[0][0], counts[1][0]);
    const lowPair = Math.min(counts[0][0], counts[1][0]);
    const kicker = counts.find(c => c[1] === 1)?.[0] || 0;
    return makeResult('two-pair', 2, [highPair, lowPair, kicker], `Two Pair, ${plural(highPair)} and ${plural(lowPair)}`);
  }
  // One pair
  if (counts[0][1] === 2) {
    const pair = counts[0][0];
    const kickers = counts.filter(c => c[1] === 1).map(c => c[0]).slice(0, 3);
    return makeResult('one-pair', 1, [pair, ...kickers], `Pair of ${plural(pair)}`);
  }
  // High card
  return makeResult('high-card', 0, values.slice(0, 5), `${singular(values[0])} High`);
}

export function evaluateHand(holeCards: [Card, Card], communityCards: Card[]): HandResult {
  const allCards = [...holeCards, ...communityCards];
  const combos = getCombinations(allCards, 5);

  let best: HandResult | null = null;
  for (const combo of combos) {
    const result = evaluateFiveCards(combo);
    if (!best || compareHands(result, best) > 0) {
      best = result;
    }
  }
  return best!;
}

export function compareHands(a: HandResult, b: HandResult): number {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}
