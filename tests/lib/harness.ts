/**
 * Test harness — boots the real server in-process so tests exercise the
 * actual GameManager, socket-handlers, and game-engine code paths.
 *
 * Why in-process: it's fast (no subprocess), avoids port conflicts on CI,
 * and keeps test runs deterministic. The same code that runs in production
 * runs here.
 */
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { Server as IOServer } from 'socket.io';
import { GameManager } from '../../server/game-manager.js';
import { setupSocketHandlers } from '../../server/socket-handlers.js';

export interface TestServer {
  url: string;
  port: number;
  io: IOServer;
  http: HttpServer;
  gameManager: GameManager;
  close: () => Promise<void>;
}

export async function startServer(): Promise<TestServer> {
  const http = createServer();
  const io = new IOServer(http, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });
  const gameManager = new GameManager();
  setupSocketHandlers(io, gameManager);

  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', () => resolve()));
  const port = (http.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}`;

  return {
    url,
    port,
    io,
    http,
    gameManager,
    close: async () => {
      io.close();
      await new Promise<void>((resolve, reject) =>
        http.close((err) => (err ? reject(err) : resolve()))
      );
    },
  };
}
