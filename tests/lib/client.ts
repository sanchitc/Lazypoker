/**
 * Promise-friendly socket client that mimics what the React app does.
 * Each instance simulates one connected browser tab / player.
 */
import { io as ioClient, Socket } from 'socket.io-client';
import type { GameState, GameSummary, GameMode, GameConfig, PlayerAction } from '../../common/types.js';

export class TestClient {
  socket: Socket;
  state: GameState | null = null;
  playerId: string | null = null;
  roomCode: string | null = null;
  summary: GameSummary | null = null;
  errors: string[] = [];
  stateHistory: GameState[] = [];
  private stateListeners: Array<(state: GameState) => void> = [];

  constructor(public name: string, public serverUrl: string) {
    this.socket = ioClient(serverUrl, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });

    this.socket.on('state:update', (s: GameState) => {
      this.state = s;
      this.stateHistory.push(s);
      this.stateListeners.forEach((cb) => cb(s));
    });
    this.socket.on('error', (data: { message: string }) => {
      this.errors.push(data.message);
    });
    this.socket.on('game:ended', (data: { summary: GameSummary }) => {
      this.summary = data.summary;
    });
  }

  async connect(): Promise<void> {
    if (this.socket.connected) return;
    await new Promise<void>((resolve, reject) => {
      this.socket.once('connect', () => resolve());
      this.socket.once('connect_error', reject);
    });
  }

  async create(mode: GameMode): Promise<{ roomCode: string; playerId: string }> {
    return new Promise((resolve) => {
      this.socket.emit('create', { playerName: this.name, mode }, (res: { roomCode: string; playerId: string }) => {
        this.playerId = res.playerId;
        this.roomCode = res.roomCode;
        resolve(res);
      });
    });
  }

  async join(roomCode: string): Promise<{ success: boolean; playerId?: string; error?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('join', { playerName: this.name, roomCode }, (res: any) => {
        if (res.success) {
          this.playerId = res.playerId;
          this.roomCode = roomCode;
        }
        resolve(res);
      });
    });
  }

  async reconnect(roomCode: string, playerId: string): Promise<{ success: boolean }> {
    return new Promise((resolve) => {
      this.socket.emit('reconnect-player', { roomCode, playerId }, (res: { success: boolean }) => {
        if (res.success) {
          this.playerId = playerId;
          this.roomCode = roomCode;
        }
        resolve(res);
      });
    });
  }

  selectSeat(seatIndex: number) {
    if (!this.playerId || !this.roomCode) throw new Error('not joined');
    this.socket.emit('select-seat', { roomCode: this.roomCode, playerId: this.playerId, seatIndex });
  }

  configure(config: GameConfig) {
    if (!this.playerId || !this.roomCode) throw new Error('not joined');
    this.socket.emit('configure', { roomCode: this.roomCode, playerId: this.playerId, config });
  }

  action(action: PlayerAction) {
    if (!this.playerId || !this.roomCode) throw new Error('not joined');
    this.socket.emit('action', { roomCode: this.roomCode, playerId: this.playerId, action });
  }

  /**
   * Wait until predicate matches the latest state, or timeout.
   * Used to synchronize tests against the broadcast loop.
   */
  async waitFor(pred: (s: GameState) => boolean, timeoutMs = 1500, label = 'state'): Promise<GameState> {
    if (this.state && pred(this.state)) return this.state;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.stateListeners = this.stateListeners.filter((c) => c !== cb);
        reject(new Error(`waitFor(${label}) timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      const cb = (s: GameState) => {
        if (pred(s)) {
          clearTimeout(timer);
          this.stateListeners = this.stateListeners.filter((c) => c !== cb);
          resolve(s);
        }
      };
      this.stateListeners.push(cb);
    });
  }

  me() {
    return this.state?.players.find((p) => p.id === this.playerId) || null;
  }

  isMyTurn(): boolean {
    if (!this.state) return false;
    return this.state.players[this.state.activePlayerIndex]?.id === this.playerId;
  }

  disconnect() {
    this.socket.disconnect();
  }
}

/** Allow micro-tasks/broadcasts to flush. */
export const flush = (ms = 25) => new Promise((r) => setTimeout(r, ms));
