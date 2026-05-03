import type { GameState, Player, PlayerAction, Card } from '../../common/types.js';
import { getPool } from './client.js';

function fireAndForget(fn: () => Promise<void>, label: string) {
  void fn().catch((err) => {
    console.error(`[log] ${label} failed:`, err);
  });
}

export function upsertPlayer(playerKey: string | undefined, displayName: string) {
  if (!playerKey) return;
  const pool = getPool();
  if (!pool) return;
  fireAndForget(async () => {
    await pool.query(
      `INSERT INTO players (player_key, display_name)
       VALUES ($1, $2)
       ON CONFLICT (player_key) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             last_seen_at = now()`,
      [playerKey, displayName]
    );
  }, 'upsertPlayer');
}

export async function startHand(state: GameState): Promise<bigint | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const numPlayers = state.players.filter(p => !p.isSittingOut).length;
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO hands (room_code, hand_number, mode, small_blind, big_blind, num_players, variant)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [state.roomCode, state.handNumber, state.mode, state.smallBlind, state.bigBlind, numPlayers, state.variant]
    );
    return BigInt(rows[0].id);
  } catch (err) {
    console.error('[log] startHand failed:', err);
    return null;
  }
}

export function endHand(
  handId: bigint | null,
  state: GameState,
  winnerKeys: string[],
  potTotal: number,
  boardCards: Card[]
) {
  if (!handId) return;
  const pool = getPool();
  if (!pool) return;
  fireAndForget(async () => {
    await pool.query(
      `UPDATE hands
         SET ended_at = now(),
             winner_keys = $2,
             pot_total = $3,
             board_cards = $4
       WHERE id = $1`,
      [handId.toString(), winnerKeys, potTotal, JSON.stringify(boardCards)]
    );
  }, 'endHand');
}

export function logAction(args: {
  handId: bigint | null;
  seq: number;
  prevState: GameState;
  newState: GameState;
  playerId: string;
  action: PlayerAction;
}) {
  const pool = getPool();
  if (!pool) return;

  const { handId, seq, prevState, newState, playerId, action } = args;
  const prevPlayer = prevState.players.find(p => p.id === playerId);
  const newPlayer = newState.players.find(p => p.id === playerId);
  if (!prevPlayer || !newPlayer) return;

  const actionType = action.type;
  let amount: number | null = null;
  if (action.type === 'RAISE' || action.type === 'RAISE_TP') amount = action.amount;
  else if (
    action.type === 'CALL' ||
    action.type === 'ALL_IN' ||
    action.type === 'CHAAL' ||
    action.type === 'REQUEST_SIDESHOW' ||
    action.type === 'CALL_SHOW'
  ) {
    amount = prevPlayer.chips - newPlayer.chips;
  }

  const potTotal = newState.pots.reduce((sum, p) => sum + p.amount, 0);
  const playerKey = (prevPlayer as Player & { playerKey?: string }).playerKey ?? null;

  fireAndForget(async () => {
    await pool.query(
      `INSERT INTO actions
         (hand_id, room_code, seq, player_key, player_id, player_name,
          action_type, amount, phase, betting_round,
          chips_before, chips_after, current_bet, pot_total, hole_cards)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        handId ? handId.toString() : null,
        newState.roomCode,
        seq,
        playerKey,
        playerId,
        prevPlayer.name,
        actionType,
        amount,
        newState.phase,
        newState.bettingRound,
        prevPlayer.chips,
        newPlayer.chips,
        newState.currentBet,
        potTotal,
        prevPlayer.holeCards ? JSON.stringify(prevPlayer.holeCards) : null,
      ]
    );
  }, 'logAction');
}

/**
 * Synthesize WIN_POT events by diffing chip counts before/after a hand completes.
 */
export function logHandWinners(
  handId: bigint | null,
  prevState: GameState,
  newState: GameState,
  startingSeq: number
): { winnerKeys: string[]; potTotal: number } {
  const pool = getPool();
  const winnerKeys: string[] = [];
  let potTotal = 0;
  let seq = startingSeq;

  for (const newP of newState.players) {
    const prevP = prevState.players.find(p => p.id === newP.id);
    if (!prevP) continue;
    const delta = newP.chips - prevP.chips;
    if (delta <= 0) continue;
    potTotal += delta;
    const key = (newP as Player & { playerKey?: string }).playerKey;
    if (key) winnerKeys.push(key);

    if (pool && handId) {
      const currentSeq = seq++;
      const playerKey = key ?? null;
      fireAndForget(async () => {
        await pool.query(
          `INSERT INTO actions
             (hand_id, room_code, seq, player_key, player_id, player_name,
              action_type, amount, phase, betting_round,
              chips_before, chips_after, current_bet, pot_total, hole_cards)
           VALUES ($1,$2,$3,$4,$5,$6,'WIN_POT',$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            handId.toString(),
            newState.roomCode,
            currentSeq,
            playerKey,
            newP.id,
            newP.name,
            delta,
            newState.phase,
            newState.bettingRound,
            prevP.chips,
            newP.chips,
            newState.currentBet,
            0,
            newP.holeCards ? JSON.stringify(newP.holeCards) : null,
          ]
        );
      }, 'logWinPot');
    }
  }

  return { winnerKeys, potTotal };
}
