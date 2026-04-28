/**
 * Reconnect / leave / end-game flows.
 *
 * Storyline (from features.md and bug list):
 * - "Graceful allow users to log back in if they accidently refresh."
 * - "Allow users to logout of the game and join a different game server."
 * - "When game ends, users cannot logout of server. The server should end
 *    when admin ends game and go back to homescreen. The game is getting cached."
 */
import { Scenario } from '../lib/scenario.js';
import { TestClient, flush } from '../lib/client.js';

export const reconnectScenarios: Scenario[] = [
  {
    name: 'disconnect marks player as disconnected; reconnect restores them',
    category: 'Reconnect',
    async fn(ctx) {
      const a = await ctx.client('Alice');
      const b = await ctx.client('Bob');
      const { roomCode } = await a.create('full');
      await b.join(roomCode);
      await a.waitFor((s) => s.players.length === 2);

      const bobId = b.playerId!;
      b.disconnect();
      await flush(80);

      // Spawn a fresh client representing the same player after refresh
      const bReconnect = new TestClient('Bob', ctx.server.url);
      await bReconnect.connect();
      ctx.clients.push(bReconnect);
      const res = await bReconnect.reconnect(roomCode, bobId);
      ctx.expect(res.success, 'reconnect-player succeeds for known room+player', {
        severity: 'high',
      });
      await a.waitFor((s) => s.players.find((p) => p.id === bobId)!.isConnected === true,
        1500, 'reconnected flag updated');
    },
  },

  {
    name: 'reconnect to nonexistent room fails gracefully',
    category: 'Reconnect',
    async fn(ctx) {
      const c = await ctx.client('Ghost');
      const res = await c.reconnect('XXXX', 'fake-player');
      ctx.expect(res.success === false, 'reconnect to bad room rejected');
    },
  },

  {
    name: 'reconnect mid-hand preserves hole cards visibility for that player',
    category: 'Reconnect',
    async fn(ctx) {
      const a = await ctx.client('Alice');
      const b = await ctx.client('Bob');
      const { roomCode } = await a.create('full');
      await b.join(roomCode);
      await a.waitFor((s) => s.players.length === 2);
      a.selectSeat(0);
      b.selectSeat(1);
      await a.waitFor((s) => s.players.every((p) => p.seatIndex >= 0));

      a.action({ type: 'START_HAND' });
      // Both clients must observe PRE_FLOP before checking holeCards;
      // broadcasts are async per-socket.
      await a.waitFor((s) => s.phase === 'PRE_FLOP', 1500);
      await b.waitFor((s) => s.phase === 'PRE_FLOP' && !!b.me()?.holeCards, 1500, 'bob sees own cards');

      const bobId = b.playerId!;
      const bobCardsBefore = b.me()?.holeCards;
      ctx.expect(bobCardsBefore !== null && bobCardsBefore !== undefined,
        'Bob has hole cards mid-hand');

      b.disconnect();
      await flush(60);
      const bReconnect = new TestClient('Bob', ctx.server.url);
      await bReconnect.connect();
      ctx.clients.push(bReconnect);
      await bReconnect.reconnect(roomCode, bobId);
      await bReconnect.waitFor((s) => s.players.length === 2, 1500);
      const bobCardsAfter = bReconnect.me()?.holeCards;
      ctx.expect(bobCardsAfter !== null && bobCardsAfter !== undefined,
        'reconnected player still sees own hole cards',
        {
          severity: 'high',
          fix: 'filterStateForPlayer must include hole cards for the requesting player id',
        }
      );
    },
  },

  {
    name: 'LEAVE_GAME removes player and lets them return to home',
    category: 'LeaveGame',
    async fn(ctx) {
      const a = await ctx.client('Alice');
      const b = await ctx.client('Bob');
      const { roomCode } = await a.create('full');
      await b.join(roomCode);
      await a.waitFor((s) => s.players.length === 2);

      const bobId = b.playerId!;
      b.action({ type: 'LEAVE_GAME' });
      await a.waitFor((s) => !s.players.some((p) => p.id === bobId), 1500,
        'Bob removed after LEAVE_GAME');
      // Bob should also receive a summary
      await flush(50);
      ctx.expect(b.summary !== null,
        'leaving player gets game summary so ResultScreen renders',
        {
          severity: 'medium',
          fix: 'socket-handlers.ts emits game:ended on LEAVE_GAME — verified path',
        }
      );
    },
  },

  {
    name: 'admin END_GAME emits summary to everyone and clears the room',
    category: 'EndGame',
    async fn(ctx) {
      const a = await ctx.client('Alice');
      const b = await ctx.client('Bob');
      const { roomCode } = await a.create('full');
      await b.join(roomCode);
      await a.waitFor((s) => s.players.length === 2);

      a.action({ type: 'END_GAME' });
      await flush(150);
      ctx.expect(a.summary !== null, 'admin receives summary on END_GAME', {
        severity: 'high',
      });
      ctx.expect(b.summary !== null, 'all players receive summary on END_GAME', {
        severity: 'high',
        fix: 'socket-handlers emits to room before deleting; verified',
      });

      // After END_GAME, attempting to reconnect to the deleted room must fail.
      const ghost = new TestClient('Ghost', ctx.server.url);
      await ghost.connect();
      ctx.clients.push(ghost);
      const res = await ghost.reconnect(roomCode, a.playerId!);
      ctx.expect(res.success === false,
        'reconnect to ended room is rejected (prevents stale cache rejoin)',
        {
          severity: 'high',
          fix: 'gameManager.deleteRoom should be called after summary broadcast',
        }
      );
    },
  },

  {
    name: 'non-admin cannot END_GAME (security)',
    category: 'EndGame',
    async fn(ctx) {
      const a = await ctx.client('Alice');
      const b = await ctx.client('Bob');
      const { roomCode } = await a.create('full');
      await b.join(roomCode);
      await a.waitFor((s) => s.players.length === 2);
      const handBefore = a.state!.handNumber;

      // Non-admin sends END_GAME. The engine refuses (returns state unchanged),
      // but socket-handlers.ts only checks `state` truthy + action.type, not
      // that the engine actually transitioned. So everyone gets kicked.
      b.action({ type: 'END_GAME' });
      await flush(120);

      ctx.expect(a.summary === null,
        'admin should NOT receive game:ended when non-admin sends END_GAME',
        {
          severity: 'critical',
          expected: 'no summary broadcast',
          actual: a.summary ? 'summary broadcast to admin (room destroyed)' : 'ok',
          fix: 'In server/socket-handlers.ts, gate the END_GAME branch on the engine ' +
               'actually changing phase to HAND_COMPLETE *and* the requesting player ' +
               'being admin. e.g. compare prevState.phase vs newState.phase, or check ' +
               'gameManager.getPlayer(...).isAdmin before broadcasting game:ended.',
        }
      );
      ctx.expect(!!ctx.server.gameManager.getRoomState(roomCode),
        'room must still exist after non-admin END_GAME attempt',
        {
          severity: 'critical',
          fix: 'same as above — deleteRoom should never run for refused actions',
        }
      );
      ctx.expect(a.state!.handNumber === handBefore,
        'handNumber unchanged');
    },
  },
];
