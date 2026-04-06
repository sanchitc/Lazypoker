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
      const roomCode = gameManager.createRoom(data.mode);
      const result = gameManager.joinRoom(roomCode, data.playerName, socket.id);
      if (result) {
        socket.join(roomCode);
        callback({ roomCode, playerId: result.playerId });
        broadcastState(roomCode);
      }
    });

    socket.on('join', (data, callback) => {
      const result = gameManager.joinRoom(data.roomCode, data.playerName, socket.id);
      if (result) {
        socket.join(data.roomCode);
        callback({ success: true, playerId: result.playerId });
        broadcastState(data.roomCode);
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
      const state = gameManager.processAction(data.roomCode, data.playerId, data.action);
      if (state) {
        broadcastState(data.roomCode);

        // Check if game ended
        if (data.action.type === 'END_GAME') {
          const summary = gameManager.getGameSummary(data.roomCode);
          if (summary) {
            io.to(data.roomCode).emit('game:ended', { summary });
          }
        }
      } else {
        socket.emit('error', { message: 'Invalid action' });
      }
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
