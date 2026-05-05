import { TeenPattiVariation } from './types.js';

export interface TeenPattiVariationMeta {
  id: TeenPattiVariation;
  // Long label, e.g. for the picker dropdown row.
  label: string;
  // Compact label used in the in-hand header chip.
  shortLabel: string;
  // One-liner shown under the long label in the picker.
  tagline: string;
  // Bullet list shown in the rules sheet.
  rules: string[];
}

export const TEEN_PATTI_VARIATIONS: Record<TeenPattiVariation, TeenPattiVariationMeta> = {
  classic: {
    id: 'classic',
    label: 'Classic',
    shortLabel: 'TEEN PATTI',
    tagline: 'Standard Teen Patti hand rankings',
    rules: [
      'Standard hand rankings (high to low):',
      'Trail (three of a kind)',
      'Pure Sequence (straight flush)',
      'Sequence (straight) — A-2-3 is the highest',
      'Color (flush)',
      'Pair',
      'High Card',
    ],
  },
  muflis: {
    id: 'muflis',
    label: 'Muflis (Lowball)',
    shortLabel: 'MUFLIS',
    tagline: 'Lowest hand wins — rankings inverted',
    rules: [
      'The LOWEST hand wins this round.',
      'High Card beats Pair beats Color beats Sequence beats Pure Sequence beats Trail.',
      'Within a category the lower cards win — pair of 2s beats pair of Kings.',
      'Sequence ordering is inverted too: 4-3-2 is the best sequence; A-2-3 the worst.',
      'Sideshows and shows still apply; the lower hand takes the pot.',
    ],
  },
  ak47: {
    id: 'ak47',
    label: 'AK47 (Wilds)',
    shortLabel: 'AK47',
    tagline: 'Aces, Kings, 4s and 7s are wild',
    rules: [
      'Aces, Kings, 4s and 7s are WILD.',
      'Wild cards can stand in for any rank to make the best hand.',
      'Suits do not change — a wild K♥ stays a heart for Color/Pure Sequence.',
      'A natural hand beats the same wild-built hand on tiebreak (3 fives natural beats 3 fives with a wild).',
      'Best possible hand: Trail of Aces.',
    ],
  },
  '999': {
    id: '999',
    label: '999 (Closest)',
    shortLabel: '999',
    tagline: 'Closest 3-digit total to 999 wins',
    rules: [
      'Each card is a single digit: A = 1, 2-9 = face value, 10/J/Q/K = 0.',
      'Arrange your three digits to form the 3-digit number closest to 999.',
      'Digits sorted high → low always give the closest result, so the engine picks for you.',
      'Closest total to 999 wins; ties break on the higher digits.',
      'Example: 9-9-7 → 997 (off by 2). K-Q-J → 000 (off by 999).',
    ],
  },
};

export const TEEN_PATTI_VARIATION_ORDER: TeenPattiVariation[] = [
  'classic',
  'muflis',
  'ak47',
  '999',
];
