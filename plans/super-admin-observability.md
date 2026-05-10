# Plan: Super-Admin Observability Dashboard

> **Repo convention reminder:** after approval, copy this file to `plans/` in the
> repo per [CLAUDE.md](CLAUDE.md). Plan mode is restricted to writing under
> `~/.claude/plans/`, so the canonical copy lands in-repo at implementation time.

## Context

[Lazypoker](server/index.ts) is a small Express + Socket.IO + React poker app
deployed on Railway. As the user shares it with more players, they want
visibility into traffic and usage: request counts, player IPs, live game
state, and historical activity. Today the only admin-flavored surface is the
per-player [`/api/stats/:playerKey`](server/api/stats.ts) endpoint — there's no
view of *who* is connecting, *from where*, or *how busy* the system is overall.

Goal: a `/admin` page (gated by an `ADMIN_KEY` env secret) that exposes live
counts, recent sessions with masked IPs, and hand/game aggregates — reusing
the existing PostgreSQL setup with graceful degradation when `DATABASE_URL`
is absent.

## Decisions (confirmed with user)

- **Auth:** `ADMIN_KEY` env var; passed via `x-admin-key` header or `?key=` query.
- **IP storage:** persist raw IPs in `sessions` table; default the dashboard view
  to last-octet-masked (`73.12.45.xxx`) with a "reveal" toggle that re-fetches
  the raw value via a separate endpoint.
- **Deliverable:** API endpoints + React admin page.
- **Metrics in scope:** live state (rooms/players/sockets), connection events
  (joins/disconnects/reconnects), hand & game activity. *Out of scope:* error
  rates and latency p50/p95.

## Architecture

Two storage tiers, mirroring the existing pattern:

1. **In-memory counters** ([`server/observability/metrics.ts`](server/observability/metrics.ts), new) for
   hot data: total HTTP requests, per-event socket counts, live snapshots
   pulled from [`GameManager`](server/game-manager.ts). Resets on restart;
   that's fine — the dashboard polls on an interval.
2. **`sessions` table** (new migration) for durable connection history.
   One row per socket connection. Updated on disconnect/reconnect.
   *Not* logging every socket event to DB — the existing
   [`actions`](server/db/migrations.ts) table already captures game events,
   and per-event rows would balloon.

HTTP request volume is low (only `/api/stats/*` and SPA fallback), so a
lightweight Express middleware that bumps the in-memory counter + logs
to stdout is sufficient. Railway captures stdout for free retention.

## Schema change

Append migration `0003_admin_sessions` to
[`server/db/migrations.ts`](server/db/migrations.ts):

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id                BIGSERIAL PRIMARY KEY,
  socket_id         TEXT NOT NULL,
  player_key        TEXT REFERENCES players(player_key),
  player_id         TEXT,
  player_name       TEXT,
  room_code         TEXT,
  ip                TEXT NOT NULL,
  user_agent        TEXT,
  connected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at   TIMESTAMPTZ,
  reconnect_count   INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS sessions_connected_idx ON sessions (connected_at DESC);
CREATE INDEX IF NOT EXISTS sessions_ip_idx        ON sessions (ip);
CREATE INDEX IF NOT EXISTS sessions_player_idx    ON sessions (player_key);
```

Migrations are append-only and run on boot per
[`runMigrations()`](server/db/migrate.ts) — same pattern already in use.

## Server-side files

### New: `server/observability/ip-utils.ts`
- `extractIp(socket | req): string` — handles `x-forwarded-for` (Railway proxies),
  falls back to `socket.handshake.address` / `req.socket.remoteAddress`.
- `maskIp(ip: string): string` — returns `73.12.45.xxx` for v4, similar for v6.

### New: `server/observability/metrics.ts`
Plain module with:
- `httpRequests: { total, byPath: Map<string, number>, byHour: number[24] }`
- `socketEvents: Map<eventName, count>`
- `bumpHttp(path)`, `bumpSocketEvent(name)`, `snapshot()` — returns a JSON-safe
  object the admin endpoint can return.
- `liveState(gameManager)` — pulls room count, player count, connected socket
  count from `gameManager.rooms`. Reuses existing in-memory state; no new
  bookkeeping needed beyond counting.

### New: `server/api/admin.ts` (mirrors [`server/api/stats.ts`](server/api/stats.ts))
- `requireAdmin` middleware → 401 if `ADMIN_KEY` env unset or key mismatched.
  *Important:* if env is unset the route is fully disabled (no accidental
  open admin panel in dev/preview).
- `GET /api/admin/overview` — in-memory counters + live state. No DB needed.
- `GET /api/admin/sessions?limit=100` — recent rows from `sessions` with
  `ip` already masked. Each row gets `id` for reveal lookup.
- `GET /api/admin/sessions/:id/ip` — returns raw IP for one session.
- `GET /api/admin/hands` — daily hand counts grouped by `variant` and avg pot
  from [`hands`](server/db/migrations.ts) table; last 30 days.
- `GET /api/admin/players?orderBy=hands|sessions&limit=50` — top players.

### Modify: `server/index.ts`
- Add HTTP request-count middleware (before static handler) that calls
  `metrics.bumpHttp(req.path)`.
- `app.use('/api/admin', adminRouter)` mounted alongside existing `statsRouter`.

### Modify: `server/socket-handlers.ts`
- On `connection`: insert a `sessions` row (fire-and-forget, like
  [`logAction()`](server/game-manager.ts)) capturing IP + UA. Hold the
  inserted `id` on the socket for later updates.
- On `disconnect`: update `disconnected_at` for that session id.
- On `reconnect-player`: increment `reconnect_count` on the prior row keyed
  by `player_key`.
- On every socket event: `metrics.bumpSocketEvent(eventName)`.
- After `create` / `join` / `select-seat`: update the session row's
  `player_key`, `player_id`, `player_name`, `room_code` (we only know these
  *after* the handshake event — initial insert has them null).

### Modify: `server/game-manager.ts`
- Add `getLiveSnapshot()` returning `{ rooms: number, players: number,
  connectedSockets: number, byVariant: Record<string, number> }`. Reads
  existing `rooms` map; no new state.

## Client-side files

### New: `client/src/screens/AdminScreen.tsx`
- Key-entry form on first visit; persists key to `localStorage` under
  `lazypoker_admin_key`. Sent as `x-admin-key` header on every fetch.
- Tabs: **Overview** (live, polls every 5s) / **Sessions** / **Hands** /
  **Players**.
- Sessions tab: table with timestamp, masked IP, player name, room, duration,
  reconnects. Each row has an "eye" icon that calls `/sessions/:id/ip` to
  reveal the raw IP inline.
- Hands tab: simple bar list of hands/day for last 30 days (no chart libs —
  CSS bars matching the existing style in
  [`StatsScreen`](client/src/screens/StatsScreen.tsx)).

### Modify: `client/src/App.tsx`
- Add a `/admin` route that renders `AdminScreen`. Not linked from the lobby
  — admin URL is the gate alongside the key.

## Critical files to read before editing

- [server/socket-handlers.ts](server/socket-handlers.ts) — chokepoint for
  every connect / disconnect / event; main instrumentation site.
- [server/game-manager.ts](server/game-manager.ts) — owns `rooms` map; source
  of truth for live snapshot. Note the existing `fireAndForget` pattern for
  DB writes — follow it.
- [server/db/client.ts](server/db/client.ts) — `getPool()` returns `null` if
  no `DATABASE_URL`; admin endpoints must handle this.
- [server/api/stats.ts](server/api/stats.ts) — mirror its router style and
  503 handling for the new admin router.
- [client/src/screens/StatsScreen.tsx](client/src/screens/StatsScreen.tsx) —
  match its styling/fetch pattern in `AdminScreen`.

## Verification

End-to-end, post-implementation:

1. **Build & start:** `npm run dev` with `DATABASE_URL` set and
   `ADMIN_KEY=somesecret` in env.
2. **Auth gate:** `curl http://localhost:3000/api/admin/overview` → 401.
   `curl -H 'x-admin-key: somesecret' …` → 200 with counters.
3. **Live counters:** open two browser tabs, join a room, play a hand.
   Visit `/admin`, enter the key, confirm Overview shows 2 sockets, 1 room.
4. **Sessions persistence:** check Postgres directly — `SELECT * FROM sessions
   ORDER BY id DESC LIMIT 5` shows rows with IP, UA, room_code populated.
   Close a tab → its row gets `disconnected_at`.
5. **IP masking:** Sessions tab shows `…xxx`; clicking reveal fetches and
   displays the full address.
6. **DB-less mode:** unset `DATABASE_URL`, restart. `/admin` Overview tab
   still works (in-memory counters); Sessions/Hands tabs show a clear
   "analytics DB not configured" empty state.
7. **No regressions:** existing stats screen still loads; lobby/join/play
   flow unchanged.

## Out of scope (call out for follow-ups)

- Geo lookup for IPs (would need a maxmind DB or external API).
- Error rate / latency histograms.
- Long-term retention policy for `sessions` (table will grow without bound;
  add a TTL job later if needed).
- Rate-limiting on the admin endpoint itself.
