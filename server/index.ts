import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameManager } from './game-manager.js';
import { setupSocketHandlers } from './socket-handlers.js';
import { getLanIP } from './utils.js';
import { runMigrations } from './db/migrate.js';
import { statsRouter } from './api/stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);

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

// Analytics API
app.use('/api', statsRouter);

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
