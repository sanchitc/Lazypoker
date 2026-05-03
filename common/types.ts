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
  // Length is variant-dependent: 2 for poker, 3 for teen-patti.
  holeCards: Card[] | null;
  isDealer: boolean;
  isFolded: boolean;
  isAllIn: boolean;
  isSittingOut: boolean;
  isConnected: boolean;
  isAdmin: boolean;
  wantsToShowCards?: boolean;
  // Teen Patti: true once the player has chosen to look at their cards.
  // Server filters out their own holeCards until this flips to true (FR-14).
  hasSeenCards?: boolean;
  // Teen Patti: set when a sideshow this player requested was declined.
  // Blocks any further sideshow request from this player for the rest of
  // the hand. Reset on each new deal.
  sideshowDeclined?: boolean;
  // Stable client-generated id (localStorage). Used for analytics aggregation
  // across rooms/sessions. Server-only field; filtered out before sending state.
  playerKey?: string;
}

// ===== Game =====
export type GameMode = 'full' | 'chip-only';
export type GameVariant = 'poker' | 'teen-patti';

export type Phase =
  | 'SETUP'
  | 'WAITING'
  | 'PRE_FLOP'
  | 'FLOP'
  | 'TURN'
  | 'RIVER'
  | 'SHOWDOWN'
  | 'BETTING_ROUND'
  | 'HAND_COMPLETE'
  // Teen Patti phases
  | 'BETTING'
  | 'SIDESHOW_PENDING';

export interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface TeenPattiConfig {
  boot: number;
  // Maximum a single player may pay in one turn, expressed as a multiplier
  // of the current stake. Defaults to 4 per PRD §2.3.
  chaalLimitMultiplier: number;
  // Pot ceiling triggering a forced show, expressed as a multiplier of the
  // boot amount. Defaults to 128 per PRD §2.3.
  potLimitMultiplier: number;
}

export interface PendingSideshow {
  requesterId: string;
  targetId: string;
}

export interface GameState {
  roomCode: string;
  mode: GameMode;
  variant: GameVariant;
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
  actedThisRound: string[]; // player IDs who have acted in the current betting round
  turnTimer: number; // seconds per turn (0 = disabled)
  allowPlayersAwardPot: boolean; // whether non-admin players can award the pot
  lastHandSummary: HandSummary | null;
  // Teen Patti state
  teenPatti?: TeenPattiConfig;
  pendingSideshow?: PendingSideshow | null;
  // Per-hand registry of sideshow-granted card peeks. When a sideshow is
  // accepted, the requester gains the right to see the responder's cards
  // (asymmetric — the responder does not see the requester's). Cleared at
  // the start of each new hand.
  sideshowReveals?: Array<{ viewerId: string; subjectId: string }>;
  // Track who issued a CALL_SHOW so we can apply the "show-caller loses on tie"
  // rule (PRD D1) when resolving the showdown.
  showCallerId?: string | null;
}

// ===== Actions =====
export type PlayerAction =
  // Poker actions
  | { type: 'FOLD' }
  | { type: 'CHECK' }
  | { type: 'CALL' }
  | { type: 'RAISE'; amount: number }
  | { type: 'ALL_IN' }
  // Teen Patti actions
  | { type: 'PACK' }
  | { type: 'CHAAL' }
  | { type: 'RAISE_TP'; amount: number } // amount = total chips paid this turn
  | { type: 'SEE_CARDS' }
  | { type: 'REQUEST_SIDESHOW' }
  | { type: 'RESPOND_SIDESHOW'; accept: boolean }
  | { type: 'CALL_SHOW' }
  // Admin/Banker actions (variant-agnostic)
  | { type: 'START_HAND' }
  | { type: 'NEXT_ROUND' } // chip-only: advance betting round
  | { type: 'DECLARE_WINNER'; winnerIds: string[] }
  | { type: 'ADD_CHIPS'; playerId: string; amount: number }
  | { type: 'REMOVE_CHIPS'; playerId: string; amount: number }
  | { type: 'KICK_PLAYER'; playerId: string }
  | { type: 'SET_DEALER'; seatIndex: number }
  | { type: 'END_GAME' }
  | { type: 'SHOW_CARDS' }
  | { type: 'LEAVE_GAME' };

// ===== Chat =====
// Server stores and relays only the encrypted blob — `iv` and `ciphertext`
// are base64 strings produced by the client using a key derived from the
// room code. The server never sees plaintext.
export interface ChatMessage {
  id: string;
  fromPlayerId: string;
  fromName: string;
  iv: string;
  ciphertext: string;
  sentAt: number;
}

// ===== Socket Events =====
export interface ServerToClientEvents {
  'state:update': (state: GameState) => void;
  'error': (data: { message: string }) => void;
  'game:ended': (data: { summary: GameSummary }) => void;
  'chat:message': (msg: ChatMessage) => void;
  'chat:history': (msgs: ChatMessage[]) => void;
}

export interface ClientToServerEvents {
  'create': (data: { playerName: string; mode: GameMode; variant?: GameVariant; playerKey?: string }, callback: (response: { roomCode: string; playerId: string }) => void) => void;
  'join': (data: { playerName: string; roomCode: string; playerKey?: string }, callback: (response: { success: boolean; playerId?: string; error?: string }) => void) => void;
  'action': (data: { roomCode: string; playerId: string; action: PlayerAction }) => void;
  'select-seat': (data: { roomCode: string; playerId: string; seatIndex: number }) => void;
  'configure': (data: { roomCode: string; playerId: string; config: GameConfig }) => void;
  'reconnect-player': (data: { roomCode: string; playerId: string }, callback: (response: { success: boolean }) => void) => void;
  'chat:send': (data: { roomCode: string; playerId: string; iv: string; ciphertext: string }) => void;
}

export interface GameConfig {
  mode?: GameMode;
  smallBlind?: number;
  bigBlind?: number;
  startingChips?: number;
  maxPlayers?: number;
  turnTimer?: number;
  allowPlayersAwardPot?: boolean;
  // Teen Patti
  boot?: number;
  chaalLimitMultiplier?: number;
  potLimitMultiplier?: number;
}

export interface GameSummary {
  players: { name: string; buyIn: number; cashOut: number; net: number }[];
  handsPlayed: number;
}

// ===== Hand Evaluation =====
export type HandRank =
  // Poker
  | 'royal-flush'
  | 'straight-flush'
  | 'four-of-a-kind'
  | 'full-house'
  | 'flush'
  | 'straight'
  | 'three-of-a-kind'
  | 'two-pair'
  | 'one-pair'
  | 'high-card'
  // Teen Patti (3-card hands)
  | 'trail'
  | 'pure-sequence'
  | 'sequence'
  | 'color'
  | 'pair-tp'
  | 'high-card-tp';

export interface HandResult {
  rank: HandRank;
  rankValue: number; // higher is better
  kickers: number[];
  description: string;
}

// ===== Hand Summary =====
// Populated when a hand reaches HAND_COMPLETE so clients can render a
// prominent winner announcement.
export interface HandWinner {
  playerId: string;
  amount: number;
  handDescription?: string;
  handRank?: HandRank;
}

export interface HandSummary {
  handNumber: number;
  winners: HandWinner[];
  totalAwarded: number;
  reason: 'fold' | 'showdown' | 'declared' | 'pack' | 'show' | 'sideshow' | 'pot-limit';
}
