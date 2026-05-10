import { getPool } from './client.js';

function fireAndForget(fn: () => Promise<void>, label: string) {
  void fn().catch((err) => {
    console.error(`[sessions] ${label} failed:`, err);
  });
}

export async function insertSession(args: {
  socketId: string;
  ip: string;
  userAgent: string | null;
}): Promise<bigint | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO sessions (socket_id, ip, user_agent)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [args.socketId, args.ip, args.userAgent]
    );
    return BigInt(rows[0].id);
  } catch (err) {
    console.error('[sessions] insertSession failed:', err);
    return null;
  }
}

export function attachPlayerToSession(args: {
  sessionId: bigint | null;
  playerKey: string | undefined;
  playerId: string;
  playerName: string;
  roomCode: string;
}) {
  if (!args.sessionId) return;
  const pool = getPool();
  if (!pool) return;
  fireAndForget(async () => {
    await pool.query(
      `UPDATE sessions
         SET player_key = COALESCE($2, player_key),
             player_id = $3,
             player_name = $4,
             room_code = $5
       WHERE id = $1`,
      [
        args.sessionId!.toString(),
        args.playerKey ?? null,
        args.playerId,
        args.playerName,
        args.roomCode,
      ]
    );
  }, 'attachPlayer');
}

export function markSessionDisconnected(sessionId: bigint | null) {
  if (!sessionId) return;
  const pool = getPool();
  if (!pool) return;
  fireAndForget(async () => {
    await pool.query(
      `UPDATE sessions
         SET disconnected_at = now()
       WHERE id = $1 AND disconnected_at IS NULL`,
      [sessionId.toString()]
    );
  }, 'markDisconnected');
}

export function bumpReconnect(sessionId: bigint | null) {
  if (!sessionId) return;
  const pool = getPool();
  if (!pool) return;
  fireAndForget(async () => {
    await pool.query(
      `UPDATE sessions
         SET reconnect_count = reconnect_count + 1,
             disconnected_at = NULL
       WHERE id = $1`,
      [sessionId.toString()]
    );
  }, 'bumpReconnect');
}
