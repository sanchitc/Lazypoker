import { Card } from '../common/types.js';
import { SUITS, RANKS } from '../common/constants.js';

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export class Dealer {
  private deck: Card[] = [];
  private dealIndex = 0;

  shuffle(): void {
    this.deck = shuffleDeck(createDeck());
    this.dealIndex = 0;
  }

  deal(count: number): Card[] {
    const cards = this.deck.slice(this.dealIndex, this.dealIndex + count);
    this.dealIndex += count;
    return cards;
  }

  burn(): void {
    this.dealIndex++;
  }
}
