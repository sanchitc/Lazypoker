import { Router } from 'express';
import { getPool } from '../db/client.js';

export const statsRouter = Router();

statsRouter.get('/stats/:playerKey', async (req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.status(503).json({ error: 'analytics not enabled (DATABASE_URL unset)' });
  }

  const { playerKey } = req.params;
  if (!playerKey) return res.status(400).json({ error: 'missing playerKey' });

  try {
    const playerQ = pool.query<{ display_name: string; first_seen_at: Date }>(
      `SELECT display_name, first_seen_at FROM players WHERE player_key = $1`,
      [playerKey]
    );

    // One CTE per metric, joined at the end. All counts are over distinct hands.
    const aggQ = pool.query<{
      hands_played: string;
      vpip_hands: string;
      pfr_hands: string;
      wtsd_hands: string;
      win_hands: string;
      biggest_pot_won: string | null;
      total_won: string | null;
      total_committed: string | null;
    }>(
      `WITH my_hands AS (
         SELECT DISTINCT hand_id
         FROM actions
         WHERE player_key = $1 AND hand_id IS NOT NULL
       ),
       vpip AS (
         SELECT DISTINCT hand_id
         FROM actions
         WHERE player_key = $1
           AND phase = 'PRE_FLOP'
           AND action_type IN ('CALL', 'RAISE', 'ALL_IN')
       ),
       pfr AS (
         SELECT DISTINCT hand_id
         FROM actions
         WHERE player_key = $1
           AND phase = 'PRE_FLOP'
           AND action_type IN ('RAISE', 'ALL_IN')
       ),
       wtsd AS (
         SELECT DISTINCT hand_id
         FROM actions
         WHERE player_key = $1
           AND phase IN ('SHOWDOWN', 'HAND_COMPLETE')
       ),
       wins AS (
         SELECT hand_id, amount
         FROM actions
         WHERE player_key = $1 AND action_type = 'WIN_POT'
       ),
       committed AS (
         SELECT COALESCE(SUM(amount), 0) AS total
         FROM actions
         WHERE player_key = $1
           AND action_type IN ('CALL', 'RAISE', 'ALL_IN')
       )
       SELECT
         (SELECT COUNT(*) FROM my_hands)                                   AS hands_played,
         (SELECT COUNT(*) FROM vpip)                                       AS vpip_hands,
         (SELECT COUNT(*) FROM pfr)                                        AS pfr_hands,
         (SELECT COUNT(*) FROM wtsd)                                       AS wtsd_hands,
         (SELECT COUNT(DISTINCT hand_id) FROM wins)                        AS win_hands,
         (SELECT MAX(amount) FROM wins)                                    AS biggest_pot_won,
         (SELECT COALESCE(SUM(amount), 0) FROM wins)                       AS total_won,
         (SELECT total FROM committed)                                     AS total_committed
       `,
      [playerKey]
    );

    const recentQ = pool.query<{
      id: string;
      hand_number: number;
      room_code: string;
      started_at: Date;
      pot_total: number | null;
      won: boolean;
      net: number;
    }>(
      `SELECT
         h.id,
         h.hand_number,
         h.room_code,
         h.started_at,
         h.pot_total,
         EXISTS(SELECT 1 FROM actions a
                WHERE a.hand_id = h.id AND a.player_key = $1 AND a.action_type = 'WIN_POT') AS won,
         COALESCE((SELECT SUM(CASE WHEN action_type = 'WIN_POT' THEN amount ELSE -COALESCE(amount, 0) END)
                   FROM actions
                   WHERE hand_id = h.id AND player_key = $1
                     AND action_type IN ('CALL', 'RAISE', 'ALL_IN', 'WIN_POT')), 0) AS net
       FROM hands h
       WHERE EXISTS(SELECT 1 FROM actions a WHERE a.hand_id = h.id AND a.player_key = $1)
       ORDER BY h.started_at DESC
       LIMIT 10`,
      [playerKey]
    );

    const [playerR, aggR, recentR] = await Promise.all([playerQ, aggQ, recentQ]);

    if (playerR.rows.length === 0) {
      return res.status(404).json({ error: 'player not found' });
    }

    const a = aggR.rows[0];
    const handsPlayed = Number(a.hands_played);
    const ratio = (n: string) => (handsPlayed === 0 ? 0 : Number(n) / handsPlayed);
    const totalWon = Number(a.total_won ?? 0);
    const totalCommitted = Number(a.total_committed ?? 0);

    res.json({
      displayName: playerR.rows[0].display_name,
      firstSeenAt: playerR.rows[0].first_seen_at,
      handsPlayed,
      vpip: ratio(a.vpip_hands),
      pfr: ratio(a.pfr_hands),
      wtsd: ratio(a.wtsd_hands),
      winRate: ratio(a.win_hands),
      biggestPotWon: a.biggest_pot_won ? Number(a.biggest_pot_won) : 0,
      netChips: totalWon - totalCommitted,
      recentHands: recentR.rows.map(r => ({
        handId: r.id,
        handNumber: r.hand_number,
        roomCode: r.room_code,
        startedAt: r.started_at,
        potTotal: r.pot_total ?? 0,
        won: r.won,
        net: Number(r.net),
      })),
    });
  } catch (err) {
    console.error('[stats] query failed:', err);
    res.status(500).json({ error: 'internal error' });
  }
});
