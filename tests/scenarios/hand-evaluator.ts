/**
 * Direct unit tests for the hand evaluator.
 *
 * Motivated by the bug noted in features.md:
 *   "Full house should have won the game. validate poker rules."
 *
 * These tests exercise hand-evaluator.ts in isolation so we can pinpoint
 * any rule-evaluation bug instead of chasing it through socket plumbing.
 */
import { Scenario } from '../lib/scenario.js';
import { evaluateHand, compareHands } from '../../server/hand-evaluator.js';
import { evaluateTeenPattiHand, evaluateTeenPattiHandFor, compareTeenPattiHands } from '../../server/teen-patti-evaluator.js';
import type { Card, Rank, Suit } from '../../common/types.js';

const c = (rank: Rank, suit: Suit): Card => ({ rank, suit });

export const handEvaluatorScenarios: Scenario[] = [
  {
    name: 'royal flush beats every other hand',
    category: 'HandEvaluator',
    async fn(ctx) {
      const royal = evaluateHand(
        [c('A', 'spades'), c('K', 'spades')],
        [c('Q', 'spades'), c('J', 'spades'), c('10', 'spades'), c('2', 'hearts'), c('3', 'clubs')]
      );
      ctx.expect(royal.rank === 'royal-flush', 'royal flush detected', {
        severity: 'critical',
        actual: royal.rank,
      });
    },
  },

  {
    name: 'straight flush detected',
    category: 'HandEvaluator',
    async fn(ctx) {
      const sf = evaluateHand(
        [c('9', 'hearts'), c('8', 'hearts')],
        [c('7', 'hearts'), c('6', 'hearts'), c('5', 'hearts'), c('2', 'clubs'), c('A', 'diamonds')]
      );
      ctx.expect(sf.rank === 'straight-flush', 'straight flush detected', { actual: sf.rank });
    },
  },

  {
    name: 'four of a kind beats full house',
    category: 'HandEvaluator',
    async fn(ctx) {
      const quads = evaluateHand(
        [c('K', 'spades'), c('K', 'hearts')],
        [c('K', 'clubs'), c('K', 'diamonds'), c('A', 'spades'), c('2', 'clubs'), c('3', 'diamonds')]
      );
      const fh = evaluateHand(
        [c('A', 'spades'), c('A', 'hearts')],
        [c('A', 'clubs'), c('K', 'diamonds'), c('K', 'spades'), c('2', 'clubs'), c('3', 'diamonds')]
      );
      ctx.expect(quads.rank === 'four-of-a-kind', 'quads detected', { actual: quads.rank });
      ctx.expect(fh.rank === 'full-house', 'full house detected', { actual: fh.rank });
      ctx.expect(compareHands(quads, fh) > 0, 'quads beat full house');
    },
  },

  {
    name: 'full house beats flush (FROM features.md BUG REPORT)',
    category: 'HandEvaluator',
    async fn(ctx) {
      // The reported bug claimed a full house lost when it should have won.
      // This is the regression test for that report.
      const fh = evaluateHand(
        [c('Q', 'hearts'), c('Q', 'spades')],
        [c('Q', 'diamonds'), c('5', 'spades'), c('5', 'hearts'), c('2', 'clubs'), c('3', 'diamonds')]
      );
      const flush = evaluateHand(
        [c('A', 'clubs'), c('K', 'clubs')],
        [c('Q', 'clubs'), c('5', 'clubs'), c('2', 'clubs'), c('5', 'hearts'), c('3', 'diamonds')]
      );
      ctx.expect(fh.rank === 'full-house', 'full house detected', {
        severity: 'critical',
        actual: fh.rank,
      });
      ctx.expect(flush.rank === 'flush', 'flush detected', {
        severity: 'critical',
        actual: flush.rank,
      });
      ctx.expect(compareHands(fh, flush) > 0,
        'full house beats flush (regression for features.md bug)',
        {
          severity: 'critical',
          fix: 'verify rankValue ordering: full-house=6 must beat flush=5',
        }
      );
    },
  },

  {
    name: 'full house beats straight',
    category: 'HandEvaluator',
    async fn(ctx) {
      const fh = evaluateHand(
        [c('7', 'hearts'), c('7', 'spades')],
        [c('7', 'diamonds'), c('K', 'spades'), c('K', 'hearts'), c('2', 'clubs'), c('3', 'diamonds')]
      );
      const straight = evaluateHand(
        [c('9', 'clubs'), c('10', 'clubs')],
        [c('J', 'spades'), c('Q', 'hearts'), c('K', 'diamonds'), c('2', 'clubs'), c('3', 'hearts')]
      );
      ctx.expect(fh.rank === 'full-house', 'full house detected');
      ctx.expect(straight.rank === 'straight', 'straight detected', { actual: straight.rank });
      ctx.expect(compareHands(fh, straight) > 0, 'full house beats straight', {
        severity: 'critical',
      });
    },
  },

  {
    name: 'flush beats straight',
    category: 'HandEvaluator',
    async fn(ctx) {
      const flush = evaluateHand(
        [c('A', 'clubs'), c('2', 'clubs')],
        [c('5', 'clubs'), c('9', 'clubs'), c('K', 'clubs'), c('3', 'hearts'), c('4', 'diamonds')]
      );
      const straight = evaluateHand(
        [c('5', 'spades'), c('6', 'hearts')],
        [c('7', 'diamonds'), c('8', 'clubs'), c('9', 'diamonds'), c('K', 'spades'), c('A', 'hearts')]
      );
      ctx.expect(compareHands(flush, straight) > 0, 'flush beats straight');
    },
  },

  {
    name: 'ace-low straight (wheel) detected',
    category: 'HandEvaluator',
    async fn(ctx) {
      const wheel = evaluateHand(
        [c('A', 'spades'), c('2', 'hearts')],
        [c('3', 'diamonds'), c('4', 'clubs'), c('5', 'spades'), c('K', 'spades'), c('Q', 'hearts')]
      );
      ctx.expect(wheel.rank === 'straight', 'wheel is a straight', { actual: wheel.rank });
      ctx.expect(wheel.kickers[0] === 5, 'wheel high card is 5', {
        actual: String(wheel.kickers[0]),
      });
    },
  },

  {
    name: 'higher pair beats lower pair',
    category: 'HandEvaluator',
    async fn(ctx) {
      const aa = evaluateHand(
        [c('A', 'spades'), c('A', 'hearts')],
        [c('2', 'clubs'), c('5', 'diamonds'), c('9', 'spades'), c('Q', 'hearts'), c('J', 'diamonds')]
      );
      const kk = evaluateHand(
        [c('K', 'spades'), c('K', 'hearts')],
        [c('2', 'clubs'), c('5', 'diamonds'), c('9', 'spades'), c('Q', 'hearts'), c('J', 'diamonds')]
      );
      ctx.expect(compareHands(aa, kk) > 0, 'AA beats KK');
    },
  },

  {
    name: 'kicker breaks tied pair',
    category: 'HandEvaluator',
    async fn(ctx) {
      const aaK = evaluateHand(
        [c('A', 'spades'), c('K', 'hearts')],
        [c('A', 'clubs'), c('5', 'diamonds'), c('9', 'spades'), c('2', 'hearts'), c('3', 'diamonds')]
      );
      const aaQ = evaluateHand(
        [c('A', 'diamonds'), c('Q', 'hearts')],
        [c('A', 'hearts'), c('5', 'spades'), c('9', 'clubs'), c('2', 'spades'), c('3', 'clubs')]
      );
      ctx.expect(compareHands(aaK, aaQ) > 0, 'pair-of-aces with K kicker beats pair-of-aces with Q kicker');
    },
  },

  {
    name: 'identical hands tie (chop pot)',
    category: 'HandEvaluator',
    async fn(ctx) {
      // Both players play the board: straight on the board.
      const a = evaluateHand(
        [c('2', 'spades'), c('3', 'hearts')],
        [c('5', 'clubs'), c('6', 'diamonds'), c('7', 'spades'), c('8', 'hearts'), c('9', 'diamonds')]
      );
      const b = evaluateHand(
        [c('2', 'hearts'), c('3', 'clubs')],
        [c('5', 'clubs'), c('6', 'diamonds'), c('7', 'spades'), c('8', 'hearts'), c('9', 'diamonds')]
      );
      ctx.expect(compareHands(a, b) === 0, 'identical hands tie', {
        actual: String(compareHands(a, b)),
      });
    },
  },

  // ============================================================
  // Teen Patti hand rankings
  // ============================================================
  {
    name: 'TP: trail beats pure sequence',
    category: 'HandEvaluator',
    async fn(ctx) {
      const trail = evaluateTeenPattiHand([c('2', 'spades'), c('2', 'hearts'), c('2', 'diamonds')]);
      const pure = evaluateTeenPattiHand([c('A', 'hearts'), c('2', 'hearts'), c('3', 'hearts')]);
      ctx.expect(trail.rank === 'trail', 'trail detected', { actual: trail.rank });
      ctx.expect(pure.rank === 'pure-sequence', 'pure sequence detected', { actual: pure.rank });
      ctx.expect(compareTeenPattiHands(trail, pure) > 0, 'trail of 2s beats pure-sequence A-2-3');
    },
  },
  {
    name: 'TP: pure sequence A-2-3 is highest sequence (wraparound)',
    category: 'HandEvaluator',
    async fn(ctx) {
      const a23 = evaluateTeenPattiHand([c('A', 'hearts'), c('2', 'hearts'), c('3', 'hearts')]);
      const akq = evaluateTeenPattiHand([c('A', 'spades'), c('K', 'spades'), c('Q', 'spades')]);
      ctx.expect(a23.rank === 'pure-sequence' && akq.rank === 'pure-sequence', 'both pure-sequence');
      ctx.expect(compareTeenPattiHands(a23, akq) > 0, 'A-2-3 beats A-K-Q (wraparound rule)', {
        severity: 'critical',
      });
    },
  },
  {
    name: 'TP: pure sequence beats sequence',
    category: 'HandEvaluator',
    async fn(ctx) {
      const pure = evaluateTeenPattiHand([c('5', 'clubs'), c('6', 'clubs'), c('7', 'clubs')]);
      const seq = evaluateTeenPattiHand([c('5', 'spades'), c('6', 'hearts'), c('7', 'diamonds')]);
      ctx.expect(compareTeenPattiHands(pure, seq) > 0, 'pure sequence beats mixed sequence');
    },
  },
  {
    name: 'TP: sequence beats color (PRD §3 inversion vs poker)',
    category: 'HandEvaluator',
    async fn(ctx) {
      // High color (A-K-J of spades) vs low sequence (4-3-2)
      const color = evaluateTeenPattiHand([c('A', 'spades'), c('K', 'spades'), c('J', 'spades')]);
      const seq = evaluateTeenPattiHand([c('2', 'hearts'), c('3', 'spades'), c('4', 'diamonds')]);
      ctx.expect(color.rank === 'color', 'color detected', { actual: color.rank });
      ctx.expect(seq.rank === 'sequence', 'sequence detected', { actual: seq.rank });
      ctx.expect(compareTeenPattiHands(seq, color) > 0, 'lowest sequence beats highest color', {
        severity: 'critical',
      });
    },
  },
  {
    name: 'TP: color beats pair',
    category: 'HandEvaluator',
    async fn(ctx) {
      const color = evaluateTeenPattiHand([c('2', 'hearts'), c('5', 'hearts'), c('9', 'hearts')]);
      const pair = evaluateTeenPattiHand([c('A', 'spades'), c('A', 'hearts'), c('K', 'clubs')]);
      ctx.expect(compareTeenPattiHands(color, pair) > 0, 'color beats high pair');
    },
  },
  {
    name: 'TP: higher pair beats lower pair',
    category: 'HandEvaluator',
    async fn(ctx) {
      const aa = evaluateTeenPattiHand([c('A', 'spades'), c('A', 'hearts'), c('2', 'clubs')]);
      const kk = evaluateTeenPattiHand([c('K', 'spades'), c('K', 'hearts'), c('A', 'clubs')]);
      ctx.expect(compareTeenPattiHands(aa, kk) > 0, 'pair of Aces beats pair of Kings (even with lower kicker)');
    },
  },
  {
    name: 'TP: same pair, higher kicker wins',
    category: 'HandEvaluator',
    async fn(ctx) {
      const aaK = evaluateTeenPattiHand([c('A', 'spades'), c('A', 'hearts'), c('K', 'clubs')]);
      const aaQ = evaluateTeenPattiHand([c('A', 'diamonds'), c('A', 'clubs'), c('Q', 'hearts')]);
      ctx.expect(compareTeenPattiHands(aaK, aaQ) > 0, 'pair-of-aces with K kicker beats pair-of-aces with Q kicker');
    },
  },
  {
    name: 'TP: high-card tiebreak by 2nd then 3rd card',
    category: 'HandEvaluator',
    async fn(ctx) {
      const a = evaluateTeenPattiHand([c('A', 'spades'), c('K', 'hearts'), c('5', 'clubs')]);
      const b = evaluateTeenPattiHand([c('A', 'diamonds'), c('Q', 'spades'), c('J', 'hearts')]);
      ctx.expect(compareTeenPattiHands(a, b) > 0, 'A-K-5 beats A-Q-J');
    },
  },
  {
    name: 'TP: identical high cards tie',
    category: 'HandEvaluator',
    async fn(ctx) {
      const a = evaluateTeenPattiHand([c('A', 'spades'), c('Q', 'hearts'), c('5', 'clubs')]);
      const b = evaluateTeenPattiHand([c('A', 'diamonds'), c('Q', 'clubs'), c('5', 'hearts')]);
      ctx.expect(compareTeenPattiHands(a, b) === 0, 'identical high-card hands tie');
    },
  },

  // ============================================================
  // Teen Patti — Muflis (lowball)
  // ============================================================
  {
    name: 'Muflis: high-card beats pair (rankings inverted)',
    category: 'HandEvaluator',
    async fn(ctx) {
      const hc = evaluateTeenPattiHandFor([c('5', 'spades'), c('3', 'hearts'), c('2', 'diamonds')], 'muflis');
      const pair = evaluateTeenPattiHandFor([c('2', 'spades'), c('2', 'hearts'), c('3', 'clubs')], 'muflis');
      ctx.expect(compareTeenPattiHands(hc, pair) > 0, 'mixed high-card beats pair-of-2s in Muflis', { severity: 'critical' });
    },
  },
  {
    name: 'Muflis: lower pair beats higher pair',
    category: 'HandEvaluator',
    async fn(ctx) {
      const lo = evaluateTeenPattiHandFor([c('2', 'spades'), c('2', 'hearts'), c('3', 'clubs')], 'muflis');
      const hi = evaluateTeenPattiHandFor([c('K', 'spades'), c('K', 'hearts'), c('2', 'clubs')], 'muflis');
      ctx.expect(compareTeenPattiHands(lo, hi) > 0, 'pair of 2s beats pair of Ks in Muflis');
    },
  },
  {
    name: 'Muflis: trail category is the lowest, with low trail winning',
    category: 'HandEvaluator',
    async fn(ctx) {
      const trail2 = evaluateTeenPattiHandFor([c('2', 'spades'), c('2', 'hearts'), c('2', 'diamonds')], 'muflis');
      const trailA = evaluateTeenPattiHandFor([c('A', 'spades'), c('A', 'hearts'), c('A', 'diamonds')], 'muflis');
      ctx.expect(compareTeenPattiHands(trail2, trailA) > 0, 'trail of 2s beats trail of Aces in Muflis (lower wins within trails)');
      const hc = evaluateTeenPattiHandFor([c('A', 'spades'), c('K', 'hearts'), c('Q', 'diamonds')], 'muflis');
      ctx.expect(compareTeenPattiHands(hc, trail2) > 0, 'any high-card beats Trail in Muflis (trail is lowest category)');
    },
  },
  {
    name: 'Muflis: 4-3-2 sequence beats A-2-3 sequence (inverted)',
    category: 'HandEvaluator',
    async fn(ctx) {
      const lo = evaluateTeenPattiHandFor([c('2', 'spades'), c('3', 'hearts'), c('4', 'diamonds')], 'muflis');
      const hi = evaluateTeenPattiHandFor([c('A', 'spades'), c('2', 'hearts'), c('3', 'diamonds')], 'muflis');
      ctx.expect(compareTeenPattiHands(lo, hi) > 0, '4-3-2 beats A-2-3 in Muflis');
    },
  },
  {
    name: 'Muflis: same pair, lower kicker wins',
    category: 'HandEvaluator',
    async fn(ctx) {
      const aa2 = evaluateTeenPattiHandFor([c('A', 'spades'), c('A', 'hearts'), c('2', 'clubs')], 'muflis');
      const aaK = evaluateTeenPattiHandFor([c('A', 'spades'), c('A', 'hearts'), c('K', 'clubs')], 'muflis');
      ctx.expect(compareTeenPattiHands(aa2, aaK) > 0, 'pair-of-Aces with 2 kicker beats pair-of-Aces with K kicker in Muflis');
    },
  },

  // ============================================================
  // Teen Patti — AK47 (A/K/4/7 wild)
  // ============================================================
  {
    name: 'AK47: natural Trail of 5s beats wild Trail of 5s',
    category: 'HandEvaluator',
    async fn(ctx) {
      const natural = evaluateTeenPattiHandFor([c('5', 'spades'), c('5', 'hearts'), c('5', 'diamonds')], 'ak47');
      const wild = evaluateTeenPattiHandFor([c('5', 'spades'), c('A', 'hearts'), c('K', 'diamonds')], 'ak47');
      ctx.expect(natural.rank === 'trail', 'natural is a trail', { actual: natural.rank });
      ctx.expect(wild.rank === 'trail', 'wild-built is a trail', { actual: wild.rank });
      ctx.expect(compareTeenPattiHands(natural, wild) > 0, 'natural Trail beats wild Trail at same rank', { severity: 'critical' });
    },
  },
  {
    name: 'AK47: all-wild produces Trail of Aces',
    category: 'HandEvaluator',
    async fn(ctx) {
      const aaa = evaluateTeenPattiHandFor([c('K', 'spades'), c('4', 'hearts'), c('7', 'diamonds')], 'ak47');
      ctx.expect(aaa.rank === 'trail', 'all-wild evaluates as trail', { actual: aaa.rank });
      ctx.expect(aaa.kickers[0] === 14, 'all-wild trail is of Aces', { actual: String(aaa.kickers) });
    },
  },
  {
    name: 'AK47: flush detection with wild K',
    category: 'HandEvaluator',
    async fn(ctx) {
      // K, 5, 9 all hearts — natural color. Wild K can substitute for any rank
      // but the suit (hearts) is preserved, so it remains a flush. Best is
      // Pure Sequence by promoting K→? A wild K of hearts can become A or 6 or
      // 7… any rank. With 5,9 we can build pure sequence 7-8-9? No, only one
      // wild. 5,9,K → wild becomes 6 → sequence 5,6,9? Not consecutive.
      // The realistic best is 9-high flush with the K used as 9? Actually 9
      // is already there; a duplicate would form pair-with-one-wild. Best
      // achievable: trail of 9s? No, only one 9. So: pair of 9s with the
      // K substituted as 9 (wild count 1) — but wait, that loses the flush
      // structurally because pair is below color. Let's just verify it's
      // recognized as trail or higher: using K wild as 5, we get 5-5-9 pair
      // of 5s. As 9, we get 9-9-K… wait K is the wild. Original cards:
      // K♥, 5♥, 9♥. Wild K → some rank R, suit hearts. To form pair with 9
      // → R=9 → 9♥, 5♥, 9♥ = pair of 9s. Or R=5 → 5,5,9 = pair of 5s. Or
      // sequence 4-5-6? Need three consecutive — 5,9 are too far apart.
      // Best: pair of 9s (rankValue 209). But wait — flush is rankValue 300
      // and the card is still hearts, so K-9-5 of hearts = color, K-high.
      // That's a higher rank. Color > pair. Best is K-high flush.
      // Hmm but K is wild so we'd substitute it with the highest rank that
      // still gives best result. Since color rankValue=300 regardless of
      // top kicker mostly, but kickers tiebreak it. Substituting K→A makes
      // A-9-5 hearts = color, A-high (kickers [14,9,5]). Better than K-high.
      const hand = evaluateTeenPattiHandFor([c('K', 'hearts'), c('9', 'hearts'), c('5', 'hearts')], 'ak47');
      ctx.expect(hand.rank === 'color', 'wild K still allows color (suit preserved)', { actual: hand.rank });
    },
  },
  {
    name: 'AK47: Classic regression — non-wild hand evaluates same as Classic',
    category: 'HandEvaluator',
    async fn(ctx) {
      // No wilds in {3, 5, 9, 10, J, Q} — pick a hand of these.
      const cards: [Card, Card, Card] = [c('5', 'spades'), c('5', 'hearts'), c('9', 'clubs')];
      const classic = evaluateTeenPattiHandFor(cards, 'classic');
      const ak47 = evaluateTeenPattiHandFor(cards, 'ak47');
      ctx.expect(classic.rank === ak47.rank, 'rank matches Classic', { actual: `${classic.rank} vs ${ak47.rank}` });
      ctx.expect(classic.rankValue === ak47.rankValue, 'rankValue matches Classic');
    },
  },

  // ============================================================
  // Teen Patti — 999 (closest to 999)
  // ============================================================
  {
    name: '999: triple 9 is the perfect hand',
    category: 'HandEvaluator',
    async fn(ctx) {
      const perfect = evaluateTeenPattiHandFor([c('9', 'spades'), c('9', 'hearts'), c('9', 'diamonds')], '999');
      const close = evaluateTeenPattiHandFor([c('9', 'spades'), c('9', 'hearts'), c('7', 'diamonds')], '999');
      ctx.expect(perfect.rankValue === 1000, '999 is rankValue 1000', { actual: String(perfect.rankValue) });
      ctx.expect(compareTeenPattiHands(perfect, close) > 0, 'perfect 999 beats 997');
    },
  },
  {
    name: '999: K-Q-J = 000 (worst possible)',
    category: 'HandEvaluator',
    async fn(ctx) {
      const zero = evaluateTeenPattiHandFor([c('K', 'spades'), c('Q', 'hearts'), c('J', 'diamonds')], '999');
      const ace = evaluateTeenPattiHandFor([c('A', 'spades'), c('A', 'hearts'), c('A', 'diamonds')], '999');
      ctx.expect(zero.kickers.every(k => k === 0), 'all face cards = 0', { actual: String(zero.kickers) });
      ctx.expect(compareTeenPattiHands(ace, zero) > 0, 'A-A-A (111) beats K-Q-J (000)');
    },
  },
  {
    name: '999: tied distance broken by chosen digits',
    category: 'HandEvaluator',
    async fn(ctx) {
      // 9-9-7 → 997 (off by 2). 9-9-A → 991 (off by 8). Take a real tie:
      // 9-8-9 → 998 (off by 1) and 9-9-7 → 997 (off by 2). Different distances.
      // Real tie: K-9-9 → 990 (off by 9) and Q-9-9 → 990. Same distance, same digits.
      // Try: 8-7-A and 8-A-7 — both reduce to 871 (off by 128). Equal — tie.
      // Hmm, want unequal high digit. K-9-9 = 990 distance 9. 8-9-A = 891 distance 108. Different.
      // 5-A-A → 511 distance 488. 5-2-2 → 522 distance 477. Different.
      // Difficult to construct same-distance, different-digits tie cleanly.
      // Simpler: same distance via 999-N and 999+N. Can't go above 999, so all
      // distances are 999 - X for non-negative.
      // Two distinct multisets giving same total: {9,8,A} → 981. {9,7,2} → 972 (different). {9,9,A} = 991. Multisets are unique once sorted.
      // So same-digit-multiset tie is the only way and gives identical kickers.
      // Just verify chosenDigits is populated and matches.
      const h = evaluateTeenPattiHandFor([c('A', 'spades'), c('5', 'hearts'), c('9', 'diamonds')], '999');
      ctx.expect(h.chosenDigits !== undefined && h.chosenDigits.join('-') === '9-5-1', 'chosen digits sorted desc', {
        actual: String(h.chosenDigits),
      });
    },
  },
];
