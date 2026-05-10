import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const KEY_STORAGE = 'lazypoker_admin_key';

type Tab = 'overview' | 'sessions' | 'hands' | 'players';

interface OverviewResponse {
  metrics: {
    uptimeSec: number;
    startedAt: number;
    http: { total: number; byPath: Array<{ path: string; count: number }>; byHourUTC: number[] };
    sockets: {
      currentConnections: number;
      totalConnections: number;
      totalDisconnections: number;
      eventCounts: Array<{ name: string; count: number }>;
    };
  };
  live: {
    rooms: number;
    players: number;
    connectedPlayers: number;
    byVariant: Record<string, number>;
    byPhase: Record<string, number>;
    roomList: Array<{
      roomCode: string;
      variant: string;
      mode: string;
      phase: string;
      handNumber: number;
      players: number;
      connected: number;
    }>;
  };
  dbEnabled: boolean;
}

interface SessionRow {
  id: string;
  socketId: string;
  playerKey: string | null;
  playerId: string | null;
  playerName: string | null;
  roomCode: string | null;
  ipMasked: string;
  userAgent: string | null;
  connectedAt: string;
  disconnectedAt: string | null;
  durationSec: number | null;
  reconnectCount: number;
}

interface HandsResponse {
  totals: { totalHands: number; totalActions: number; uniqueRooms: number; avgPot: number };
  daily: Array<{ day: string; variant: string; hands: number; avgPot: number }>;
}

interface PlayersResponse {
  players: Array<{
    playerKey: string;
    displayName: string;
    firstSeenAt: string;
    lastSeenAt: string;
    hands: number;
    sessions: number;
  }>;
}

export default function AdminScreen() {
  const [adminKey, setAdminKey] = useState<string>(() => localStorage.getItem(KEY_STORAGE) ?? '');
  const [keyInput, setKeyInput] = useState<string>('');
  const [tab, setTab] = useState<Tab>('overview');

  const fetchAdmin = useCallback(
    async <T,>(path: string): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> => {
      try {
        const res = await fetch(`/api/admin${path}`, { headers: { 'x-admin-key': adminKey } });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return { ok: false, status: res.status, error: body.error ?? `HTTP ${res.status}` };
        }
        return { ok: true, data: (await res.json()) as T };
      } catch (err) {
        return { ok: false, status: 0, error: err instanceof Error ? err.message : 'fetch failed' };
      }
    },
    [adminKey]
  );

  if (!adminKey) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 felt-noise vignette">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 space-y-4">
            <h1 className="font-display text-2xl text-bone">Admin</h1>
            <div className="space-y-2">
              <Label htmlFor="admin-key">Admin key</Label>
              <Input
                id="admin-key"
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && keyInput.trim()) {
                    localStorage.setItem(KEY_STORAGE, keyInput.trim());
                    setAdminKey(keyInput.trim());
                  }
                }}
                placeholder="enter ADMIN_KEY"
              />
            </div>
            <Button
              className="w-full"
              disabled={!keyInput.trim()}
              onClick={() => {
                localStorage.setItem(KEY_STORAGE, keyInput.trim());
                setAdminKey(keyInput.trim());
              }}
            >
              Unlock
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col felt-noise vignette overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b border-brass/20">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl text-bone">Admin</h1>
          <nav className="flex gap-1">
            {(['overview', 'sessions', 'hands', 'players'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  tab === t ? 'bg-brass/20 text-bone' : 'text-bone-dim hover:text-bone'
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            localStorage.removeItem(KEY_STORAGE);
            setAdminKey('');
            setKeyInput('');
          }}
        >
          Sign out
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {tab === 'overview' && <OverviewTab fetchAdmin={fetchAdmin} />}
        {tab === 'sessions' && <SessionsTab fetchAdmin={fetchAdmin} adminKey={adminKey} />}
        {tab === 'hands' && <HandsTab fetchAdmin={fetchAdmin} />}
        {tab === 'players' && <PlayersTab fetchAdmin={fetchAdmin} />}
      </main>
    </div>
  );
}

type Fetcher = <T,>(path: string) => Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }>;

function OverviewTab({ fetchAdmin }: { fetchAdmin: Fetcher }) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const r = await fetchAdmin<OverviewResponse>('/overview');
      if (cancelled) return;
      if (r.ok) {
        setData(r.data);
        setError('');
      } else {
        setError(r.error);
      }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [fetchAdmin]);

  if (error) return <ErrorBanner error={error} />;
  if (!data) return <div className="text-bone-dim">Loading…</div>;

  const { metrics, live, dbEnabled } = data;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {!dbEnabled && (
        <div className="rounded-md border border-yellow-600/50 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-200">
          DATABASE_URL is unset — sessions, hands, and players tabs will be empty.
        </div>
      )}

      <section>
        <h2 className="text-xs uppercase tracking-wider text-bone-dim mb-2">Live</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Active rooms" value={live.rooms} />
          <Stat label="Connected players" value={live.connectedPlayers} />
          <Stat label="Open sockets" value={metrics.sockets.currentConnections} />
          <Stat label="Uptime" value={formatUptime(metrics.uptimeSec)} />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-bone-dim mb-2">Totals (since restart)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="HTTP requests" value={metrics.http.total} />
          <Stat label="Socket connects" value={metrics.sockets.totalConnections} />
          <Stat label="Socket disconnects" value={metrics.sockets.totalDisconnections} />
          <Stat label="Variants live" value={Object.keys(live.byVariant).length} />
        </div>
      </section>

      {live.roomList.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-bone-dim mb-2">Rooms</h2>
          <div className="rounded-md bg-felt/60 brass-hairline overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-bone-dim text-xs uppercase">
                <tr>
                  <Th>Code</Th><Th>Variant</Th><Th>Phase</Th><Th>Hand</Th><Th>Players</Th><Th>Connected</Th>
                </tr>
              </thead>
              <tbody>
                {live.roomList.map((r) => (
                  <tr key={r.roomCode} className="border-t border-brass/10">
                    <Td><code className="text-brass">{r.roomCode}</code></Td>
                    <Td>{r.variant}</Td>
                    <Td>{r.phase}</Td>
                    <Td>#{r.handNumber}</Td>
                    <Td>{r.players}</Td>
                    <Td>{r.connected}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xs uppercase tracking-wider text-bone-dim mb-2">HTTP by path</h2>
          <BarList items={metrics.http.byPath.map(p => ({ label: p.path, value: p.count }))} />
        </div>
        <div>
          <h2 className="text-xs uppercase tracking-wider text-bone-dim mb-2">Socket events</h2>
          <BarList items={metrics.sockets.eventCounts.map(e => ({ label: e.name, value: e.count }))} />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-bone-dim mb-2">HTTP by UTC hour</h2>
        <HourChart hours={metrics.http.byHourUTC} />
      </section>
    </div>
  );
}

function SessionsTab({ fetchAdmin, adminKey }: { fetchAdmin: Fetcher; adminKey: string }) {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string>('');
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchAdmin<{ sessions: SessionRow[] }>('/sessions?limit=200');
      if (cancelled) return;
      if (r.ok) setRows(r.data.sessions);
      else setError(r.error);
    })();
    return () => { cancelled = true; };
  }, [fetchAdmin]);

  const reveal = async (id: string) => {
    const res = await fetch(`/api/admin/sessions/${id}/ip`, { headers: { 'x-admin-key': adminKey } });
    if (res.ok) {
      const body = (await res.json()) as { ip: string };
      setRevealed((prev) => ({ ...prev, [id]: body.ip }));
    }
  };

  if (error) return <ErrorBanner error={error} />;
  if (!rows) return <div className="text-bone-dim">Loading…</div>;
  if (rows.length === 0) return <div className="text-bone-dim">No sessions yet.</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="rounded-md bg-felt/60 brass-hairline overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-bone-dim text-xs uppercase">
            <tr>
              <Th>Connected</Th><Th>Player</Th><Th>Room</Th><Th>IP</Th><Th>Duration</Th><Th>Reconnects</Th><Th>UA</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-brass/10">
                <Td>{new Date(r.connectedAt).toLocaleString()}</Td>
                <Td>{r.playerName ?? <span className="text-bone-dim">—</span>}</Td>
                <Td>{r.roomCode ? <code className="text-brass">{r.roomCode}</code> : <span className="text-bone-dim">—</span>}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <code className="text-bone">{revealed[r.id] ?? r.ipMasked}</code>
                    {!revealed[r.id] && (
                      <button
                        onClick={() => reveal(r.id)}
                        className="text-xs text-brass hover:text-brass/80"
                        title="Reveal full IP"
                      >
                        reveal
                      </button>
                    )}
                  </div>
                </Td>
                <Td>{r.durationSec !== null ? `${r.durationSec}s` : <span className="text-emerald-400">live</span>}</Td>
                <Td>{r.reconnectCount}</Td>
                <Td className="max-w-[20ch] truncate" title={r.userAgent ?? ''}>
                  {r.userAgent ?? <span className="text-bone-dim">—</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HandsTab({ fetchAdmin }: { fetchAdmin: Fetcher }) {
  const [data, setData] = useState<HandsResponse | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchAdmin<HandsResponse>('/hands');
      if (cancelled) return;
      if (r.ok) setData(r.data);
      else setError(r.error);
    })();
    return () => { cancelled = true; };
  }, [fetchAdmin]);

  const dailyTotals = useMemo(() => {
    if (!data) return [];
    const byDay = new Map<string, number>();
    for (const d of data.daily) byDay.set(d.day, (byDay.get(d.day) ?? 0) + d.hands);
    return [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([day, hands]) => ({ day, hands }));
  }, [data]);

  if (error) return <ErrorBanner error={error} />;
  if (!data) return <div className="text-bone-dim">Loading…</div>;

  const max = Math.max(1, ...dailyTotals.map((d) => d.hands));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total hands" value={data.totals.totalHands} />
        <Stat label="Total actions" value={data.totals.totalActions} />
        <Stat label="Unique rooms" value={data.totals.uniqueRooms} />
        <Stat label="Avg pot" value={Math.round(data.totals.avgPot)} />
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-bone-dim mb-2">Hands per day (last 30)</h2>
        {dailyTotals.length === 0 ? (
          <div className="text-bone-dim text-sm">No hands logged yet.</div>
        ) : (
          <div className="space-y-1">
            {dailyTotals.map((d) => (
              <div key={d.day} className="flex items-center gap-3 text-sm">
                <div className="w-24 text-bone-dim text-xs">{d.day}</div>
                <div className="flex-1 h-3 bg-felt/60 rounded overflow-hidden">
                  <div className="h-full bg-brass/60" style={{ width: `${(d.hands / max) * 100}%` }} />
                </div>
                <div className="w-12 text-right text-bone">{d.hands}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-bone-dim mb-2">By variant (raw)</h2>
        <div className="rounded-md bg-felt/60 brass-hairline overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-bone-dim text-xs uppercase">
              <tr><Th>Day</Th><Th>Variant</Th><Th>Hands</Th><Th>Avg pot</Th></tr>
            </thead>
            <tbody>
              {data.daily.map((d, i) => (
                <tr key={`${d.day}-${d.variant}-${i}`} className="border-t border-brass/10">
                  <Td>{d.day}</Td><Td>{d.variant}</Td><Td>{d.hands}</Td><Td>{Math.round(d.avgPot)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PlayersTab({ fetchAdmin }: { fetchAdmin: Fetcher }) {
  const [data, setData] = useState<PlayersResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [orderBy, setOrderBy] = useState<'hands' | 'sessions'>('hands');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchAdmin<PlayersResponse>(`/players?orderBy=${orderBy}&limit=100`);
      if (cancelled) return;
      if (r.ok) setData(r.data);
      else setError(r.error);
    })();
    return () => { cancelled = true; };
  }, [fetchAdmin, orderBy]);

  if (error) return <ErrorBanner error={error} />;
  if (!data) return <div className="text-bone-dim">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-bone-dim">Sort by</span>
        {(['hands', 'sessions'] as const).map((o) => (
          <button
            key={o}
            onClick={() => setOrderBy(o)}
            className={`px-2 py-1 rounded ${orderBy === o ? 'bg-brass/20 text-bone' : 'text-bone-dim'}`}
          >
            {o}
          </button>
        ))}
      </div>

      <div className="rounded-md bg-felt/60 brass-hairline overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-bone-dim text-xs uppercase">
            <tr><Th>Name</Th><Th>Hands</Th><Th>Sessions</Th><Th>First seen</Th><Th>Last seen</Th></tr>
          </thead>
          <tbody>
            {data.players.map((p) => (
              <tr key={p.playerKey} className="border-t border-brass/10">
                <Td>{p.displayName}</Td>
                <Td>{p.hands}</Td>
                <Td>{p.sessions}</Td>
                <Td>{new Date(p.firstSeenAt).toLocaleDateString()}</Td>
                <Td>{new Date(p.lastSeenAt).toLocaleString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <div className="text-xs uppercase tracking-wider text-bone-dim mb-1">{label}</div>
        <div className="font-display text-2xl text-bone">{value}</div>
      </CardContent>
    </Card>
  );
}

function BarList({ items }: { items: Array<{ label: string; value: number }> }) {
  if (items.length === 0) return <div className="text-bone-dim text-sm">No data.</div>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-1">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3 text-sm">
          <div className="w-32 text-bone-dim text-xs truncate" title={i.label}>{i.label}</div>
          <div className="flex-1 h-2 bg-felt/60 rounded overflow-hidden">
            <div className="h-full bg-brass/60" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
          <div className="w-12 text-right text-bone">{i.value}</div>
        </div>
      ))}
    </div>
  );
}

function HourChart({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  return (
    <div className="flex items-end gap-0.5 h-24">
      {hours.map((h, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end" title={`${i}:00 UTC — ${h} requests`}>
          <div className="bg-brass/60 rounded-t" style={{ height: `${(h / max) * 100}%`, minHeight: h > 0 ? 2 : 0 }} />
          <div className="text-[10px] text-bone-dim text-center mt-1">{i}</div>
        </div>
      ))}
    </div>
  );
}

function ErrorBanner({ error }: { error: string }) {
  return (
    <div className="rounded-md border border-rose-600/50 bg-rose-900/20 px-4 py-3 text-sm text-rose-200">
      {error}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-normal">{children}</th>;
}

function Td({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return <td className={`px-3 py-2 ${className ?? ''}`} title={title}>{children}</td>;
}

function formatUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}
