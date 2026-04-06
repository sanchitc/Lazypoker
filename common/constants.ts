import { Rank, Suit } from './types.js';

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export const SUIT_COLORS: Record<Suit, string> = {
  hearts: '#e63946',
  diamonds: '#e63946',
  clubs: '#1d3557',
  spades: '#1d3557',
};

export const DEFAULT_CONFIG = {
  smallBlind: 5,
  bigBlind: 10,
  startingChips: 1000,
  maxPlayers: 10,
};

export const CHIP_COLORS = [
  { value: 1, color: '#f0f0f0', label: 'White' },
  { value: 5, color: '#e63946', label: 'Red' },
  { value: 25, color: '#2a9d8f', label: 'Green' },
  { value: 100, color: '#457b9d', label: 'Blue' },
  { value: 500, color: '#1d3557', label: 'Black' },
  { value: 1000, color: '#d4a843', label: 'Gold' },
];
