import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameManager } from './game-manager.js';
import { setupSocketHandlers } from './socket-handlers.js';
import { getLanIP } from './utils.js';

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

// Serve static client build in production
const clientDist = path.join(__dirname, '..', 'dist', 'client');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

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
