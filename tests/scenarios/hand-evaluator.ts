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
];
