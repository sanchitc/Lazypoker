import { Router, type Request, type Response, type NextFunction } from 'express';
import { getPool } from '../db/client.js';
import { snapshot as metricsSnapshot } from '../observability/metrics.js';
import { maskIp } from '../observability/ip-utils.js';
import type { GameManager } from '../game-manager.js';

export function createAdminRouter(gameManager: GameManager): Router {
  const router = Router();

  router.use(requireAdmin);

  router.get('/overview', (_req, res) => {
    res.json({
      metrics: metricsSnapshot(),
      live: gameManager.getLiveSnapshot(),
      dbEnabled: !!getPool(),
    });
  });

  router.get('/sessions', async (req, res) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: 'DATABASE_URL unset' });
    const limit = clampInt(req.query.limit, 100, 1, 500);
    try {
      const { rows } = await pool.query<{
        id: string;
        socket_id: string;
        player_key: string | null;
        player_id: string | null;
        player_name: string | null;
        room_code: string | null;
        ip: string;
        user_agent: string | null;
        connected_at: Date;
        disconnected_at: Date | null;
        reconnect_count: number;
      }>(
        `SELECT id, socket_id, player_key, player_id, player_name, room_code,
                ip, user_agent, connected_at, disconnected_at, reconnect_count
         FROM sessions
         ORDER BY connected_at DESC
         LIMIT $1`,
        [limit]
      );
      res.json({
        sessions: rows.map(r => ({
          id: r.id,
          socketId: r.socket_id,
          playerKey: r.player_key,
          playerId: r.player_id,
          playerName: r.player_name,
          roomCode: r.room_code,
          ipMasked: maskIp(r.ip),
          userAgent: r.user_agent,
          connectedAt: r.connected_at,
          disconnectedAt: r.disconnected_at,
          durationSec: r.disconnected_at
            ? Math.floor((r.disconnected_at.getTime() - r.connected_at.getTime()) / 1000)
            : null,
          reconnectCount: r.reconnect_count,
        })),
      });
    } catch (err) {
      console.error('[admin] sessions query failed:', err);
      res.status(500).json({ error: 'internal error' });
    }
  });

  router.get('/sessions/:id/ip', async (req, res) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: 'DATABASE_URL unset' });
    const id = req.params.id;
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'invalid id' });
    try {
      const { rows } = await pool.query<{ ip: string }>(
        `SELECT ip FROM sessions WHERE id = $1`,
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'not found' });
      res.json({ ip: rows[0].ip });
    } catch (err) {
      console.error('[admin] sessions ip query failed:', err);
      res.status(500).json({ error: 'internal error' });
    }
  });

  router.get('/hands', async (_req, res) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: 'DATABASE_URL unset' });
    try {
      const dailyQ = pool.query<{
        day: string;
        variant: string;
        hands: string;
        avg_pot: string | null;
      }>(
        `SELECT to_char(date_trunc('day', started_at), 'YYYY-MM-DD') AS day,
                variant,
                COUNT(*)::text AS hands,
                AVG(pot_total)::text AS avg_pot
         FROM hands
         WHERE started_at >= now() - interval '30 days'
         GROUP BY 1, 2
         ORDER BY 1 DESC, 2`
      );
      const totalsQ = pool.query<{
        total_hands: string;
        total_actions: string;
        unique_rooms: string;
        avg_pot: string | null;
      }>(
        `SELECT
           (SELECT COUNT(*) FROM hands)                 AS total_hands,
           (SELECT COUNT(*) FROM actions)               AS total_actions,
           (SELECT COUNT(DISTINCT room_code) FROM hands) AS unique_rooms,
           (SELECT AVG(pot_total) FROM hands WHERE pot_total IS NOT NULL) AS avg_pot`
      );
      const [dailyR, totalsR] = await Promise.all([dailyQ, totalsQ]);
      const t = totalsR.rows[0];
      res.json({
        totals: {
          totalHands: Number(t.total_hands),
          totalActions: Number(t.total_actions),
          uniqueRooms: Number(t.unique_rooms),
          avgPot: t.avg_pot ? Number(t.avg_pot) : 0,
        },
        daily: dailyR.rows.map(r => ({
          day: r.day,
          variant: r.variant,
          hands: Number(r.hands),
          avgPot: r.avg_pot ? Number(r.avg_pot) : 0,
        })),
      });
    } catch (err) {
      console.error('[admin] hands query failed:', err);
      res.status(500).json({ error: 'internal error' });
    }
  });

  router.get('/players', async (req, res) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: 'DATABASE_URL unset' });
    const orderBy = req.query.orderBy === 'sessions' ? 'sessions' : 'hands';
    const limit = clampInt(req.query.limit, 50, 1, 200);
    try {
      const { rows } = await pool.query<{
        player_key: string;
        display_name: string;
        first_seen_at: Date;
        last_seen_at: Date;
        hands: string;
        sessions: string;
      }>(
        `SELECT p.player_key,
                p.display_name,
                p.first_seen_at,
                p.last_seen_at,
                COALESCE(h.hands, 0)::text AS hands,
                COALESCE(s.sessions, 0)::text AS sessions
         FROM players p
         LEFT JOIN (
           SELECT player_key, COUNT(DISTINCT hand_id) AS hands
           FROM actions
           WHERE hand_id IS NOT NULL AND player_key IS NOT NULL
           GROUP BY player_key
         ) h ON h.player_key = p.player_key
         LEFT JOIN (
           SELECT player_key, COUNT(*) AS sessions
           FROM sessions
           WHERE player_key IS NOT NULL
           GROUP BY player_key
         ) s ON s.player_key = p.player_key
         ORDER BY ${orderBy === 'sessions' ? 's.sessions' : 'h.hands'} DESC NULLS LAST
         LIMIT $1`,
        [limit]
      );
      res.json({
        players: rows.map(r => ({
          playerKey: r.player_key,
          displayName: r.display_name,
          firstSeenAt: r.first_seen_at,
          lastSeenAt: r.last_seen_at,
          hands: Number(r.hands),
          sessions: Number(r.sessions),
        })),
      });
    } catch (err) {
      console.error('[admin] players query failed:', err);
      res.status(500).json({ error: 'internal error' });
    }
  });

  return router;
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    return res.status(503).json({ error: 'admin disabled (ADMIN_KEY unset)' });
  }
  const provided = (req.headers['x-admin-key'] as string | undefined) ?? (req.query.key as string | undefined);
  if (provided !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
