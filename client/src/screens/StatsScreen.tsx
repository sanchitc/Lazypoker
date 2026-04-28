import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPlayerKey } from '@/lib/playerKey';

interface RecentHand {
  handId: string;
  handNumber: number;
  roomCode: string;
  startedAt: string;
  potTotal: number;
  won: boolean;
  net: number;
}

interface Stats {
  displayName: string;
  firstSeenAt: string;
  handsPlayed: number;
  vpip: number;
  pfr: number;
  wtsd: number;
  winRate: number;
  biggestPotWon: number;
  netChips: number;
  recentHands: RecentHand[];
}

export default function StatsScreen({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/stats/${encodeURIComponent(getPlayerKey())}`);
        if (cancelled) return;
        if (res.status === 503) {
          setError('Analytics not enabled on this server.');
        } else if (res.status === 404) {
          setError('No stats yet — play a hand first.');
        } else if (!res.ok) {
          setError('Failed to load stats.');
        } else {
          setStats(await res.json());
        }
      } catch {
        if (!cancelled) setError('Failed to load stats.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="h-full flex flex-col items-center p-6 felt-noise vignette overflow-y-auto">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl text-bone">Your stats</h1>
          <Button variant="outline" onClick={onBack}>Back</Button>
        </div>

        {loading && <div className="text-bone-dim">Loading…</div>}
        {error && <div className="text-bone-dim">{error}</div>}

        {stats && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>{stats.displayName}</CardTitle>
                <div className="text-sm text-bone-dim">
                  {stats.handsPlayed} hand{stats.handsPlayed === 1 ? '' : 's'} played
                </div>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              <Stat label="VPIP" value={pct(stats.vpip)} hint="put $ in pre-flop" />
              <Stat label="PFR" value={pct(stats.pfr)} hint="raised pre-flop" />
              <Stat label="WTSD" value={pct(stats.wtsd)} hint="reached showdown" />
              <Stat label="Win rate" value={pct(stats.winRate)} hint="hands won" />
              <Stat label="Biggest pot" value={`${stats.biggestPotWon}`} hint="chips" />
              <Stat
                label="Net chips"
                value={`${stats.netChips >= 0 ? '+' : ''}${stats.netChips}`}
                hint="all-time"
                tone={stats.netChips >= 0 ? 'pos' : 'neg'}
              />
            </div>

            <h2 className="font-display text-xl text-bone mb-3">Recent hands</h2>
            {stats.recentHands.length === 0 ? (
              <div className="text-bone-dim text-sm">No hands yet.</div>
            ) : (
              <div className="space-y-2">
                {stats.recentHands.map(h => (
                  <div
                    key={h.handId}
                    className="flex items-center justify-between rounded-md bg-felt/60 brass-hairline px-4 py-3"
                  >
                    <div>
                      <div className="text-bone text-sm">
                        Room {h.roomCode} · Hand #{h.handNumber}
                      </div>
                      <div className="text-bone-dim text-xs">
                        {new Date(h.startedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={h.won ? 'text-emerald-400' : 'text-bone-dim'}>
                        {h.won ? 'WON' : '—'}
                      </div>
                      <div className={`text-sm ${h.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {h.net >= 0 ? '+' : ''}{h.net}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'pos' | 'neg' }) {
  const valueColor = tone === 'pos' ? 'text-emerald-400' : tone === 'neg' ? 'text-rose-400' : 'text-bone';
  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <div className="text-xs uppercase tracking-wider text-bone-dim mb-1">{label}</div>
        <div className={`font-display text-2xl ${valueColor}`}>{value}</div>
        {hint && <div className="text-xs text-bone-dim mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}
