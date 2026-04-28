import { GameState, GameMode, GameConfig, GameSummary, ChatMessage } from '../common/types.js';
import { createInitialState, addPlayer, removePlayer, selectSeat, processAction, filterStateForPlayer } from './game-engine.js';
import { generateRoomCode } from './utils.js';
import { upsertPlayer, startHand, endHand, logAction, logHandWinners } from './db/logger.js';

const CHAT_HISTORY_LIMIT = 50;

interface Room {
  state: GameState;
  playerSocketMap: Map<string, string>; // playerId -> socketId
  socketPlayerMap: Map<string, string>; // socketId -> playerId
  buyIns: Map<string, number>; // playerId -> total buy-in amount
  currentHandId: bigint | null;
  actionSeq: number;
  chatHistory: ChatMessage[];
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
      currentHandId: null,
      actionSeq: 0,
      chatHistory: [],
    });
    return roomCode;
  }

  joinRoom(roomCode: string, playerName: string, socketId: string, playerKey?: string): { playerId: string; state: GameState } | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    if (room.state.players.length >= room.state.maxPlayers) return null;

    const isAdmin = room.state.players.length === 0;
    const { state, playerId } = addPlayer(room.state, playerName, isAdmin, playerKey);
    room.state = state;
    room.playerSocketMap.set(playerId, socketId);
    room.socketPlayerMap.set(socketId, playerId);
    room.buyIns.set(playerId, state.startingChips);

    upsertPlayer(playerKey, playerName);

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

    const prevState = room.state;
    const newState = processAction(prevState, playerId, action);
    room.state = newState;

    // Track additional buy-ins
    if (action.type === 'ADD_CHIPS') {
      const current = room.buyIns.get(action.playerId) || 0;
      room.buyIns.set(action.playerId, current + action.amount);
    }

    // Engine returns same reference if action was rejected — skip logging.
    if (newState !== prevState) {
      this.recordAction(room, prevState, newState, playerId, action);
    }

    return room.state;
  }

  private recordAction(
    room: Room,
    prevState: GameState,
    newState: GameState,
    playerId: string,
    action: any
  ): void {
    // Hand started: increment in handNumber means a new hand has begun.
    if (newState.handNumber > prevState.handNumber) {
      room.currentHandId = null;
      room.actionSeq = 0;
      // Kick off async hand creation; subsequent actions race against this
      // resolving but the seq is still correct, and updates apply once handId
      // is available.
      void (async () => {
        try {
          room.currentHandId = await startHand(newState);
        } catch (err) {
          console.error('[log] startHand failed:', err);
        }
      })();
    }

    // Log the player action (skip pure admin lifecycle events that don't
    // affect a hand's action sequence).
    const skipTypes = new Set(['END_GAME', 'LEAVE_GAME', 'KICK_PLAYER', 'SET_DEALER',
                                'ADD_CHIPS', 'REMOVE_CHIPS', 'SHOW_CARDS', 'NEXT_ROUND',
                                'START_HAND']);
    if (!skipTypes.has(action.type)) {
      const seq = room.actionSeq++;
      logAction({
        handId: room.currentHandId,
        seq,
        prevState,
        newState,
        playerId,
        action,
      });
    }

    // Hand completed: synthesize WIN_POT events and finalize hand row.
    const handJustCompleted =
      prevState.phase !== 'HAND_COMPLETE' && newState.phase === 'HAND_COMPLETE';
    if (handJustCompleted && room.currentHandId !== undefined) {
      const startSeq = room.actionSeq;
      const { winnerKeys, potTotal } = logHandWinners(
        room.currentHandId,
        prevState,
        newState,
        startSeq
      );
      room.actionSeq = startSeq + winnerKeys.length;
      endHand(room.currentHandId, newState, winnerKeys, potTotal, newState.communityCards);
    }
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

  appendChatMessage(roomCode: string, msg: ChatMessage): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    room.chatHistory.push(msg);
    if (room.chatHistory.length > CHAT_HISTORY_LIMIT) {
      room.chatHistory.splice(0, room.chatHistory.length - CHAT_HISTORY_LIMIT);
    }
    return true;
  }

  getChatHistory(roomCode: string): ChatMessage[] {
    return this.rooms.get(roomCode)?.chatHistory ?? [];
  }

  isPlayerInRoom(roomCode: string, playerId: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    return room.state.players.some(p => p.id === playerId);
  }

  getPlayerName(roomCode: string, playerId: string): string | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    return room.state.players.find(p => p.id === playerId)?.name ?? null;
  }

  getAllPlayerSocketIds(roomCode: string): { playerId: string; socketId: string }[] {
    const room = this.rooms.get(roomCode);
    if (!room) return [];
    return Array.from(room.playerSocketMap.entries()).map(([playerId, socketId]) => ({
      playerId, socketId,
    }));
  }
}
