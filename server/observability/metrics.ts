// In-memory counters for the admin dashboard. Resets on restart — the
// dashboard polls so transient counters are fine; durable history lives
// in the `sessions`, `hands`, and `actions` tables.

const HOUR_BUCKETS = 24;

interface HttpStats {
  total: number;
  byPath: Map<string, number>;
  byHour: number[]; // length 24, indexed by hour-of-day UTC
}

const httpStats: HttpStats = {
  total: 0,
  byPath: new Map(),
  byHour: new Array(HOUR_BUCKETS).fill(0),
};

const socketEventCounts = new Map<string, number>();
const socketConnectStats = {
  totalConnections: 0,
  totalDisconnections: 0,
  currentConnections: 0,
};

const startedAt = Date.now();

export function bumpHttp(path: string): void {
  httpStats.total += 1;
  httpStats.byPath.set(path, (httpStats.byPath.get(path) ?? 0) + 1);
  const hour = new Date().getUTCHours();
  httpStats.byHour[hour] += 1;
}

export function bumpSocketEvent(name: string): void {
  socketEventCounts.set(name, (socketEventCounts.get(name) ?? 0) + 1);
}

export function bumpSocketConnect(): void {
  socketConnectStats.totalConnections += 1;
  socketConnectStats.currentConnections += 1;
}

export function bumpSocketDisconnect(): void {
  socketConnectStats.totalDisconnections += 1;
  socketConnectStats.currentConnections = Math.max(
    0,
    socketConnectStats.currentConnections - 1
  );
}

export interface MetricsSnapshot {
  uptimeSec: number;
  startedAt: number;
  http: {
    total: number;
    byPath: Array<{ path: string; count: number }>;
    byHourUTC: number[];
  };
  sockets: {
    currentConnections: number;
    totalConnections: number;
    totalDisconnections: number;
    eventCounts: Array<{ name: string; count: number }>;
  };
}

export function snapshot(): MetricsSnapshot {
  return {
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    startedAt,
    http: {
      total: httpStats.total,
      byPath: [...httpStats.byPath.entries()]
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count),
      byHourUTC: [...httpStats.byHour],
    },
    sockets: {
      currentConnections: socketConnectStats.currentConnections,
      totalConnections: socketConnectStats.totalConnections,
      totalDisconnections: socketConnectStats.totalDisconnections,
      eventCounts: [...socketEventCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    },
  };
}
