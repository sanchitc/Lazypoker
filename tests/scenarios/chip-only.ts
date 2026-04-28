/**
 * Chip-only mode storyline:
 * Players hold real cards in their hands; the app only tracks chips and
 * betting rounds. Admin/banker manually advances streets and declares
 * the winner.
 */
import { Scenario } from '../lib/scenario.js';
import { flush } from '../lib/client.js';
import type { GameState } from '../../common/types.js';

async function setup3PlayerChipOnly(ctx: any) {
  const a = await ctx.client('Alice');
  const b = await ctx.client('Bob');
  const c = await ctx.client('Carol');
  const { roomCode } = await a.create('chip-only');
  await b.join(roomCode);
  await c.join(roomCode);
  await c.waitFor((s: GameState) => s.players.length === 3);

  a.configure({ smallBlind: 10, bigBlind: 20, startingChips: 1000 });
  await a.waitFor((s: GameState) => s.smallBlind === 10);

  a.selectSeat(0);
  b.selectSeat(1);
  c.selectSeat(2);
  await a.waitFor((s: GameState) => s.players.every((p) => p.seatIndex >= 0));
  return { a, b, c };
}

export const chipOnlyScenarios: Scenario[] = [
  {
    name: 'no hole cards dealt in chip-only mode',
    category: 'ChipOnly',
    async fn(ctx) {
      const { a } = await setup3PlayerChipOnly(ctx);
      a.action({ type: 'START_HAND' });
      const s = await a.waitFor((s) => s.phase === 'PRE_FLOP', 1500);
      const cardsDealt = s.players.some((p) => p.holeCards !== null);
      ctx.expect(!cardsDealt, 'no hole cards dealt', {
        severity: 'high',
        actual: cardsDealt ? 'cards present' : 'no cards',
      });
      ctx.expect(s.communityCards.length === 0, 'no community cards drawn');
    },
  },

  {
    name: 'admin advances streets manually with NEXT_ROUND',
    category: 'ChipOnly',
    async fn(ctx) {
      const { a, b, c } = await setup3PlayerChipOnly(ctx);
      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'PRE_FLOP', 1500);

      const clients = [a, b, c];
      // Round 1: everyone calls/checks to advance to FLOP
      const playStreet = async () => {
        let safety = 6;
        while (safety-- > 0) {
          await flush(20);
          const s = a.state!;
          if (s.activePlayerIndex < 0) break;
          const ap = s.players[s.activePlayerIndex];
          const t = clients.find((cl) => cl.playerId === ap.id)!;
          if (t.me()!.currentBet < s.currentBet) t.action({ type: 'CALL' });
          else t.action({ type: 'CHECK' });
        }
      };

      await playStreet();
      await a.waitFor((s) => s.phase === 'FLOP' && s.activePlayerIndex === -1, 1500, 'paused on flop');

      // Communicate that betting is paused and admin must NEXT_ROUND
      ctx.expect(a.state!.activePlayerIndex === -1,
        'betting paused for physical card dealing',
        { fix: 'engine sets activePlayerIndex=-1 between streets in chip-only' }
      );

      a.action({ type: 'NEXT_ROUND' });
      await a.waitFor((s) => s.phase === 'FLOP' && s.activePlayerIndex >= 0, 1500, 'flop betting started');

      await playStreet();
      await a.waitFor((s) => s.phase === 'TURN' && s.activePlayerIndex === -1, 1500);
      a.action({ type: 'NEXT_ROUND' });
      await a.waitFor((s) => s.phase === 'TURN' && s.activePlayerIndex >= 0, 1500);

      await playStreet();
      await a.waitFor((s) => s.phase === 'RIVER' && s.activePlayerIndex === -1, 1500);
      a.action({ type: 'NEXT_ROUND' });
      await a.waitFor((s) => s.phase === 'RIVER' && s.activePlayerIndex >= 0, 1500);

      await playStreet();
      await a.waitFor((s) => s.phase === 'HAND_COMPLETE', 1500, 'final round complete, awaiting winner');
      ctx.expect(a.state!.pots[0].amount > 0,
        'pot still holds chips until DECLARE_WINNER',
        { severity: 'high' }
      );
    },
  },

  {
    name: 'admin declares winner — pot is awarded',
    category: 'ChipOnly',
    async fn(ctx) {
      const { a, b, c } = await setup3PlayerChipOnly(ctx);
      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'PRE_FLOP');

      // Quick fold-out: two players fold pre-flop, BB wins
      const clients = [a, b, c];
      let safety = 5;
      while (safety-- > 0) {
        await flush(30);
        const s = a.state!;
        if (s.phase === 'HAND_COMPLETE' || s.activePlayerIndex < 0) break;
        const ap = s.players[s.activePlayerIndex];
        const t = clients.find((cl) => cl.playerId === ap.id)!;
        t.action({ type: 'FOLD' });
      }
      await a.waitFor((s) => s.phase === 'HAND_COMPLETE', 1500);

      // After fold-out the engine awards directly. Run again with a checkdown
      // to test DECLARE_WINNER specifically.
      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'PRE_FLOP');

      // Loop: at each prompt just call/check, advance streets via NEXT_ROUND
      const checkdown = async () => {
        for (let i = 0; i < 30; i++) {
          await flush(20);
          const s = a.state!;
          if (s.phase === 'HAND_COMPLETE') return;
          if (s.activePlayerIndex < 0) {
            if (['FLOP', 'TURN', 'RIVER'].includes(s.phase)) {
              a.action({ type: 'NEXT_ROUND' });
            } else break;
            continue;
          }
          const ap = s.players[s.activePlayerIndex];
          const t = clients.find((cl) => cl.playerId === ap.id)!;
          if (t.me()!.currentBet < s.currentBet) t.action({ type: 'CALL' });
          else t.action({ type: 'CHECK' });
        }
      };
      await checkdown();
      await a.waitFor((s) => s.phase === 'HAND_COMPLETE', 2000);

      const pot = a.state!.pots[0].amount;
      ctx.expect(pot > 0, 'pot is preserved at hand-complete in chip-only', {
        severity: 'high',
        actual: String(pot),
        fix: 'engine should NOT auto-award in chip-only — admin must DECLARE_WINNER',
      });

      // Admin declares Bob the winner
      a.action({ type: 'DECLARE_WINNER', winnerIds: [b.playerId!] });
      await a.waitFor((s) => s.pots[0].amount === 0, 1500, 'pot awarded');
      const bobChips = a.state!.players.find((p) => p.id === b.playerId)!.chips;
      const total = a.state!.players.reduce((sum, p) => sum + p.chips, 0);
      ctx.expect(total === 3000, 'chips conserved after manual award');
      ctx.expect(bobChips > 1000, 'declared winner has more than starting chips', {
        actual: String(bobChips),
      });
    },
  },

  {
    name: 'cannot start next hand while pot still holds chips',
    category: 'ChipOnly',
    async fn(ctx) {
      const { a, b, c } = await setup3PlayerChipOnly(ctx);
      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'PRE_FLOP');

      const clients = [a, b, c];
      // Force HAND_COMPLETE with chips in pot via checkdown
      const checkdown = async () => {
        for (let i = 0; i < 30; i++) {
          await flush(20);
          const s = a.state!;
          if (s.phase === 'HAND_COMPLETE') return;
          if (s.activePlayerIndex < 0) {
            if (['FLOP', 'TURN', 'RIVER'].includes(s.phase)) a.action({ type: 'NEXT_ROUND' });
            else return;
            continue;
          }
          const ap = s.players[s.activePlayerIndex];
          const t = clients.find((cl) => cl.playerId === ap.id)!;
          if (t.me()!.currentBet < s.currentBet) t.action({ type: 'CALL' });
          else t.action({ type: 'CHECK' });
        }
      };
      await checkdown();
      await a.waitFor((s) => s.phase === 'HAND_COMPLETE');

      const handBefore = a.state!.handNumber;
      const potBefore = a.state!.pots[0].amount;
      ctx.expect(potBefore > 0, 'pot has chips to be awarded');

      a.action({ type: 'START_HAND' });
      await flush(80);
      ctx.expect(a.state!.handNumber === handBefore,
        'START_HAND blocked while pot is unawarded',
        {
          severity: 'medium',
          fix: 'engine guards this; verify UI shows clear message',
        }
      );
    },
  },

  {
    name: 'allowPlayersAwardPot lets non-admin declare winner',
    category: 'ChipOnly',
    async fn(ctx) {
      const { a, b, c } = await setup3PlayerChipOnly(ctx);
      a.configure({ allowPlayersAwardPot: true });
      await a.waitFor((s) => s.allowPlayersAwardPot === true);
      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'PRE_FLOP');

      const clients = [a, b, c];
      // Run fast checkdown
      for (let i = 0; i < 30; i++) {
        await flush(20);
        const s = a.state!;
        if (s.phase === 'HAND_COMPLETE') break;
        if (s.activePlayerIndex < 0) {
          if (['FLOP', 'TURN', 'RIVER'].includes(s.phase)) a.action({ type: 'NEXT_ROUND' });
          else break;
          continue;
        }
        const ap = s.players[s.activePlayerIndex];
        const t = clients.find((cl) => cl.playerId === ap.id)!;
        if (t.me()!.currentBet < s.currentBet) t.action({ type: 'CALL' });
        else t.action({ type: 'CHECK' });
      }
      await a.waitFor((s) => s.phase === 'HAND_COMPLETE');

      // Non-admin Bob declares
      b.action({ type: 'DECLARE_WINNER', winnerIds: [c.playerId!] });
      await a.waitFor((s) => s.pots[0].amount === 0, 1000, 'non-admin award succeeded');
    },
  },
];
