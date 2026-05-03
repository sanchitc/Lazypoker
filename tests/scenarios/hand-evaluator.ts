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
import { evaluateTeenPattiHand, compareTeenPattiHands } from '../../server/teen-patti-evaluator.js';
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
];
