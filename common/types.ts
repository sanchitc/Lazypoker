// ===== Card Types =====
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

// ===== Player =====
export interface Player {
  id: string;
  name: string;
  seatIndex: number;
  chips: number;
  currentBet: number;
  totalBetThisHand: number;
  holeCards: [Card, Card] | null;
  isDealer: boolean;
  isFolded: boolean;
  isAllIn: boolean;
  isSittingOut: boolean;
  isConnected: boolean;
  isAdmin: boolean;
}

// ===== Game =====
export type GameMode = 'full' | 'chip-only';

export type Phase =
  | 'SETUP'
  | 'WAITING'
  | 'PRE_FLOP'
  | 'FLOP'
  | 'TURN'
  | 'RIVER'
  | 'SHOWDOWN'
  | 'BETTING_ROUND'
  | 'HAND_COMPLETE';

export interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface GameState {
  roomCode: string;
  mode: GameMode;
  phase: Phase;
  players: Player[];
  communityCards: Card[];
  pots: Pot[];
  currentBet: number;
  minRaise: number;
  dealerSeatIndex: number;
  activePlayerIndex: number;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  startingChips: number;
  maxPlayers: number;
  lastAction: { playerId: string; action: string; amount?: number } | null;
  bettingRound: number; // 0-based, for chip-only mode tracking
}

// ===== Actions =====
export type PlayerAction =
  | { type: 'FOLD' }
  | { type: 'CHECK' }
  | { type: 'CALL' }
  | { type: 'RAISE'; amount: number }
  | { type: 'ALL_IN' }
  // Admin/Banker actions
  | { type: 'START_HAND' }
  | { type: 'NEXT_ROUND' } // chip-only: advance betting round
  | { type: 'DECLARE_WINNER'; winnerIds: string[] }
  | { type: 'ADD_CHIPS'; playerId: string; amount: number }
  | { type: 'REMOVE_CHIPS'; playerId: string; amount: number }
  | { type: 'KICK_PLAYER'; playerId: string }
  | { type: 'SET_DEALER'; seatIndex: number }
  | { type: 'END_GAME' };

// ===== Socket Events =====
export interface ServerToClientEvents {
  'state:update': (state: GameState) => void;
  'error': (data: { message: string }) => void;
  'game:ended': (data: { summary: GameSummary }) => void;
}

export interface ClientToServerEvents {
  'create': (data: { playerName: string; mode: GameMode }, callback: (response: { roomCode: string; playerId: string }) => void) => void;
  'join': (data: { playerName: string; roomCode: string }, callback: (response: { success: boolean; playerId?: string; error?: string }) => void) => void;
  'action': (data: { roomCode: string; playerId: string; action: PlayerAction }) => void;
  'select-seat': (data: { roomCode: string; playerId: string; seatIndex: number }) => void;
  'configure': (data: { roomCode: string; playerId: string; config: GameConfig }) => void;
  'reconnect-player': (data: { roomCode: string; playerId: string }, callback: (response: { success: boolean }) => void) => void;
}

export interface GameConfig {
  mode?: GameMode;
  smallBlind?: number;
  bigBlind?: number;
  startingChips?: number;
  maxPlayers?: number;
}

export interface GameSummary {
  players: { name: string; buyIn: number; cashOut: number; net: number }[];
  handsPlayed: number;
}

// ===== Hand Evaluation =====
export type HandRank =
  | 'royal-flush'
  | 'straight-flush'
  | 'four-of-a-kind'
  | 'full-house'
  | 'flush'
  | 'straight'
  | 'three-of-a-kind'
  | 'two-pair'
  | 'one-pair'
  | 'high-card';

export interface HandResult {
  rank: HandRank;
  rankValue: number; // higher is better
  kickers: number[];
  description: string;
}
