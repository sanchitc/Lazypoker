import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GameManager } from './game-manager.js';
import { setupSocketHandlers } from './socket-handlers.js';
import { getLanIP } from './utils.js';
import { runMigrations } from './db/migrate.js';
import { statsRouter } from './api/stats.js';
import { createAdminRouter } from './api/admin.js';
import { bumpHttp } from './observability/metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from repo root if present. Existing process.env vars win.
// No-op in production where Railway/etc. inject vars directly.
loadDotenv(path.resolve(process.cwd(), '.env'));

const PORT = parseInt(process.env.PORT || '3000', 10);

function loadDotenv(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const gameManager = new GameManager();
setupSocketHandlers(io, gameManager);

// Trust proxy for accurate client IPs behind Railway / load balancers.
app.set('trust proxy', true);

// HTTP request counter — runs before routes so we count every hit.
app.use((req, _res, next) => {
  // Group SPA fallback hits under '/' to avoid path-cardinality blowup.
  const path = req.path.startsWith('/api') ? req.path : (req.path === '/' ? '/' : '/static');
  bumpHttp(path);
  next();
});

// Analytics API
app.use('/api', statsRouter);
app.use('/api/admin', createAdminRouter(gameManager));

// Serve static client build in production
const clientDist = path.join(process.cwd(), 'dist', 'client');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Run migrations before accepting traffic. Non-fatal if DB is misconfigured —
// the app continues to run, just without analytics persistence.
try {
  await runMigrations();
} catch (err) {
  console.error('[boot] migrations failed; continuing without DB:', err);
}

httpServer.listen(PORT, '0.0.0.0', () => {
  const lanIP = getLanIP();
  console.log('');
  console.log('  ♠ ♥ ♦ ♣  LAZYPOKER  ♣ ♦ ♥ ♠');
  console.log('');
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${lanIP}:${PORT}`);
  console.log('');
  console.log('  Share the network URL with your friends!');
  console.log('');
});
