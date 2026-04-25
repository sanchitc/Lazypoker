import { GameState, GameMode, GameConfig, GameSummary } from '../common/types.js';
import { createInitialState, addPlayer, removePlayer, selectSeat, processAction, filterStateForPlayer } from './game-engine.js';
import { generateRoomCode } from './utils.js';

interface Room {
  state: GameState;
  playerSocketMap: Map<string, string>; // playerId -> socketId
  socketPlayerMap: Map<string, string>; // socketId -> playerId
  buyIns: Map<string, number>; // playerId -> total buy-in amount
}

export class GameManager {
  private rooms = new Map<string, Room>();

  createRoom(mode: GameMode): string {
    let roomCode: string;
    do {
      roomCode = generateRoomCode();
    } while (this.rooms.has(roomCode));

    const state = createInitialState(roomCode, mode);
    this.rooms.set(roomCode, {
      state: { ...state, phase: 'WAITING' },
      playerSocketMap: new Map(),
      socketPlayerMap: new Map(),
      buyIns: new Map(),
    });
    return roomCode;
  }

  joinRoom(roomCode: string, playerName: string, socketId: string): { playerId: string; state: GameState } | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    if (room.state.players.length >= room.state.maxPlayers) return null;

    const isAdmin = room.state.players.length === 0;
    const { state, playerId } = addPlayer(room.state, playerName, isAdmin);
    room.state = state;
    room.playerSocketMap.set(playerId, socketId);
    room.socketPlayerMap.set(socketId, playerId);
    room.buyIns.set(playerId, state.startingChips);

    return { playerId, state: room.state };
  }

  reconnectPlayer(roomCode: string, playerId: string, socketId: string): GameState | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.state.players.find(p => p.id === playerId);
    if (!player) return null;

    // Update socket mapping
    const oldSocketId = room.playerSocketMap.get(playerId);
    if (oldSocketId) room.socketPlayerMap.delete(oldSocketId);

    room.playerSocketMap.set(playerId, socketId);
    room.socketPlayerMap.set(socketId, playerId);

    room.state = {
      ...room.state,
      players: room.state.players.map(p =>
        p.id === playerId ? { ...p, isConnected: true } : p
      ),
    };

    return room.state;
  }

  handleDisconnect(socketId: string): { roomCode: string; playerId: string; state: GameState } | null {
    for (const [roomCode, room] of this.rooms) {
      const playerId = room.socketPlayerMap.get(socketId);
      if (playerId) {
        room.socketPlayerMap.delete(socketId);
        room.playerSocketMap.delete(playerId);

        // Mark disconnected but don't remove (allow reconnect)
        room.state = {
          ...room.state,
          players: room.state.players.map(p =>
            p.id === playerId ? { ...p, isConnected: false } : p
          ),
        };

        return { roomCode, playerId, state: room.state };
      }
    }
    return null;
  }

  selectSeat(roomCode: string, playerId: string, seatIndex: number): GameState | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.state = selectSeat(room.state, playerId, seatIndex);
    return room.state;
  }

  configure(roomCode: string, playerId: string, config: GameConfig): GameState | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.state.players.find(p => p.id === playerId);
    if (!player?.isAdmin) return null;

    if (config.mode !== undefined) room.state.mode = config.mode;
    if (config.smallBlind !== undefined) room.state.smallBlind = config.smallBlind;
    if (config.bigBlind !== undefined) room.state.bigBlind = config.bigBlind;
    if (config.maxPlayers !== undefined) room.state.maxPlayers = config.maxPlayers;
    if (config.startingChips !== undefined) {
      room.state.startingChips = config.startingChips;
      // Update all players who haven't started playing yet
      if (room.state.phase === 'WAITING' || room.state.phase === 'SETUP') {
        room.state.players = room.state.players.map(p => ({
          ...p,
          chips: config.startingChips!,
        }));
        for (const [pid] of room.buyIns) {
          room.buyIns.set(pid, config.startingChips!);
        }
      }
    }
    if (config.turnTimer !== undefined) room.state.turnTimer = config.turnTimer;
    if (config.allowPlayersAwardPot !== undefined) room.state.allowPlayersAwardPot = config.allowPlayersAwardPot;

    return room.state;
  }

  processAction(roomCode: string, playerId: string, action: any): GameState | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const newState = processAction(room.state, playerId, action);
    room.state = newState;

    // Track additional buy-ins
    if (action.type === 'ADD_CHIPS') {
      const current = room.buyIns.get(action.playerId) || 0;
      room.buyIns.set(action.playerId, current + action.amount);
    }

    return room.state;
  }

  getFilteredState(roomCode: string, playerId: string): GameState | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    return filterStateForPlayer(room.state, playerId);
  }

  getSocketId(roomCode: string, playerId: string): string | undefined {
    return this.rooms.get(roomCode)?.playerSocketMap.get(playerId);
  }

  getPlayerId(socketId: string): { roomCode: string; playerId: string } | null {
    for (const [roomCode, room] of this.rooms) {
      const playerId = room.socketPlayerMap.get(socketId);
      if (playerId) return { roomCode, playerId };
    }
    return null;
  }

  getRoomState(roomCode: string): GameState | null {
    return this.rooms.get(roomCode)?.state || null;
  }

  getGameSummary(roomCode: string): GameSummary | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    return {
      players: room.state.players.map(p => ({
        name: p.name,
        buyIn: room.buyIns.get(p.id) || 0,
        cashOut: p.chips,
        net: p.chips - (room.buyIns.get(p.id) || 0),
      })),
      handsPlayed: room.state.handNumber,
    };
  }

  deleteRoom(roomCode: string): void {
    this.rooms.delete(roomCode);
  }

  getAllPlayerSocketIds(roomCode: string): { playerId: string; socketId: string }[] {
    const room = this.rooms.get(roomCode);
    if (!room) return [];
    return Array.from(room.playerSocketMap.entries()).map(([playerId, socketId]) => ({
      playerId, socketId,
    }));
  }
}
