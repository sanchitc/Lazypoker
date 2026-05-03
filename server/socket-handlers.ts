import { Server, Socket } from 'socket.io';
import { GameManager } from './game-manager.js';
import { ClientToServerEvents, ServerToClientEvents } from '../common/types.js';

export function setupSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  gameManager: GameManager
) {
  function broadcastState(roomCode: string) {
    const players = gameManager.getAllPlayerSocketIds(roomCode);
    for (const { playerId, socketId } of players) {
      const filtered = gameManager.getFilteredState(roomCode, playerId);
      if (filtered) {
        io.to(socketId).emit('state:update', filtered);
      }
    }
  }

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('create', (data, callback) => {
      const roomCode = gameManager.createRoom(data.mode, data.variant ?? 'poker');
      const result = gameManager.joinRoom(roomCode, data.playerName, socket.id, data.playerKey);
      if (result) {
        socket.join(roomCode);
        callback({ roomCode, playerId: result.playerId });
        broadcastState(roomCode);
        socket.emit('chat:history', gameManager.getChatHistory(roomCode));
      }
    });

    socket.on('join', (data, callback) => {
      const result = gameManager.joinRoom(data.roomCode, data.playerName, socket.id, data.playerKey);
      if (result) {
        socket.join(data.roomCode);
        callback({ success: true, playerId: result.playerId });
        broadcastState(data.roomCode);
        socket.emit('chat:history', gameManager.getChatHistory(data.roomCode));
      } else {
        callback({ success: false, error: 'Room not found or full' });
      }
    });

    socket.on('reconnect-player', (data, callback) => {
      const state = gameManager.reconnectPlayer(data.roomCode, data.playerId, socket.id);
      if (state) {
        socket.join(data.roomCode);
        callback({ success: true });
        broadcastState(data.roomCode);
        socket.emit('chat:history', gameManager.getChatHistory(data.roomCode));
      } else {
        callback({ success: false });
      }
    });

    socket.on('select-seat', (data) => {
      const state = gameManager.selectSeat(data.roomCode, data.playerId, data.seatIndex);
      if (state) {
        broadcastState(data.roomCode);
      }
    });

    socket.on('configure', (data) => {
      const state = gameManager.configure(data.roomCode, data.playerId, data.config);
      if (state) {
        broadcastState(data.roomCode);
      }
    });

    socket.on('action', (data) => {
      if (data.action.type === 'LEAVE_GAME') {
        // Remove player from room and let them return to the home screen
        const summary = gameManager.getGameSummary(data.roomCode);
        gameManager.processAction(data.roomCode, data.playerId, data.action);
        if (summary) {
          // Send summary only to the leaving player so they see the results screen
          socket.emit('game:ended', { summary });
        }
        socket.leave(data.roomCode);
        broadcastState(data.roomCode);
        return;
      }

      const prevState = gameManager.getRoomState(data.roomCode);
      const state = gameManager.processAction(data.roomCode, data.playerId, data.action);
      if (state) {
        broadcastState(data.roomCode);

        // Only END_GAME ends the game session — and only if the engine actually
        // accepted it (admin-gated). Comparing references catches refused actions:
        // the engine returns the same state object when it rejects.
        if (data.action.type === 'END_GAME' && prevState !== state) {
          const summary = gameManager.getGameSummary(data.roomCode);
          if (summary) {
            io.to(data.roomCode).emit('game:ended', { summary });
            // Clean up room so stale sessions can't reconnect
            gameManager.deleteRoom(data.roomCode);
          }
        }
      } else {
        socket.emit('error', { message: 'Invalid action' });
      }
    });

    socket.on('chat:send', (data) => {
      // Verify the sender is actually in the room they claim to be in.
      if (!gameManager.isPlayerInRoom(data.roomCode, data.playerId)) return;

      const fromName = gameManager.getPlayerName(data.roomCode, data.playerId) ?? 'Player';

      // Light validation. The ciphertext is opaque to the server; we only
      // bound its size so a malicious client can't flood the room buffer.
      if (typeof data.iv !== 'string' || typeof data.ciphertext !== 'string') return;
      if (data.iv.length > 64 || data.ciphertext.length > 4096) return;

      const msg = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        fromPlayerId: data.playerId,
        fromName,
        iv: data.iv,
        ciphertext: data.ciphertext,
        sentAt: Date.now(),
      };

      gameManager.appendChatMessage(data.roomCode, msg);
      io.to(data.roomCode).emit('chat:message', msg);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      const result = gameManager.handleDisconnect(socket.id);
      if (result) {
        broadcastState(result.roomCode);
      }
    });
  });
}
