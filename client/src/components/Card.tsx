import { Card as CardType } from '@common/types';
import { SUIT_SYMBOLS, SUIT_COLORS } from '@common/constants';

interface CardProps {
  card: CardType | null;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function Card({ card, faceDown = false, size = 'md' }: CardProps) {
  const sizes = {
    sm: { w: 'w-8', h: 'h-12', text: 'text-[10px]', suit: 'text-xs' },
    md: { w: 'w-12', h: 'h-[68px]', text: 'text-sm', suit: 'text-base' },
    lg: { w: 'w-16', h: 'h-[92px]', text: 'text-lg', suit: 'text-xl' },
  };

  const s = sizes[size];

  if (faceDown || !card) {
    return (
      <div className={`${s.w} ${s.h} rounded-lg bg-gradient-to-br from-blue-800 to-blue-900
                        border border-blue-600 shadow-md flex items-center justify-center`}>
        <div className="text-blue-400 text-lg">♠</div>
      </div>
    );
  }

  const color = SUIT_COLORS[card.suit];
  const symbol = SUIT_SYMBOLS[card.suit];

  return (
    <div className={`${s.w} ${s.h} rounded-lg bg-white shadow-md flex flex-col
                      items-center justify-center border border-gray-200 relative`}>
      <span className={`${s.text} font-bold leading-none`} style={{ color }}>
        {card.rank}
      </span>
      <span className={`${s.suit} leading-none`} style={{ color }}>
        {symbol}
      </span>
    </div>
  );
}
