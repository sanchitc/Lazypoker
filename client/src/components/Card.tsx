import { useId } from 'react';
import { Card as CardType } from '@common/types';
import { SUIT_COLORS, SUIT_SYMBOLS } from '@common/constants';

interface CardProps {
  card: CardType | null;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

// 5:7 poker proportions
const SIZES = {
  xs: { w: 26, h: 36,  rank: 'text-[11px]', suit: 'text-[11px]', corner: 'text-[7px]' },
  sm: { w: 32, h: 45,  rank: 'text-[11px]', suit: 'text-xs',   corner: 'text-[8px]' },
  md: { w: 48, h: 67,  rank: 'text-base',   suit: 'text-lg',   corner: 'text-[10px]' },
  lg: { w: 64, h: 90,  rank: 'text-2xl',    suit: 'text-2xl',  corner: 'text-xs' },
  xl: { w: 72, h: 100, rank: 'text-[30px]', suit: 'text-[28px]', corner: 'text-xs' },
};

export default function Card({ card, faceDown = false, size = 'md' }: CardProps) {
  const s = SIZES[size];
  const patternId = useId().replace(/:/g, '');

  if (faceDown || !card) {
    return (
      <div
        className="relative overflow-hidden rounded-lg border shadow-[0_16px_28px_-16px_rgba(0,0,0,0.65)]"
        style={{
          width: s.w,
          height: s.h,
          borderColor: 'hsl(var(--brass) / 0.18)',
          background:
            'radial-gradient(circle at 28% 24%, hsl(228 28% 26%), hsl(var(--velvet)) 48%, hsl(224 28% 10%) 100%)',
        }}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          style={{ opacity: 0.18 }}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 40 56"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <defs>
            <pattern id={patternId} x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M5 0 L10 5 L5 10 L0 5 Z" stroke="hsl(39 48% 64% / 0.72)" strokeWidth="0.45" fill="none" />
              <path d="M0 0 L10 10 M10 0 L0 10" stroke="hsl(214 18% 62% / 0.18)" strokeWidth="0.25" />
            </pattern>
          </defs>
          <rect width="40" height="56" fill={`url(#${patternId})`} />
        </svg>
        <div className="absolute inset-1 rounded-md border border-bone/8 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.14),transparent_38%)]" />
      </div>
    );
  }

  const symbol = SUIT_SYMBOLS[card.suit];
  const suitStyle = { color: SUIT_COLORS[card.suit] };

  return (
    <div
      className="relative overflow-hidden rounded-lg border shadow-[0_18px_30px_-18px_rgba(0,0,0,0.5)]"
      style={{
        width: s.w,
        height: s.h,
        borderColor: 'hsl(34 20% 78% / 0.95)',
        background:
          'linear-gradient(180deg, hsl(var(--card-face)) 0%, hsl(35 28% 92%) 55%, hsl(var(--card-shadow)) 100%)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 10%, rgba(255,255,255,0.12), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 42%, rgba(0,0,0,0.03) 100%)',
        }}
      />
      <div className="absolute inset-1 rounded-md border border-[rgba(255,255,255,0.45)] pointer-events-none" />

      <div className="absolute top-0.5 left-1 z-10 leading-none" style={suitStyle}>
        <div className={`font-display font-bold ${s.corner}`}>{card.rank}</div>
        <div className={`leading-none ${s.corner}`}>{symbol}</div>
      </div>

      <div className="absolute bottom-0.5 right-1 z-10 leading-none rotate-180" style={suitStyle}>
        <div className={`font-display font-bold ${s.corner}`}>{card.rank}</div>
        <div className={`leading-none ${s.corner}`}>{symbol}</div>
      </div>

      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-0.5">
        <span className={`font-display font-bold leading-none ${s.rank}`} style={suitStyle}>
          {card.rank}
        </span>
        <span className={`leading-none ${s.suit}`} style={suitStyle}>
          {symbol}
        </span>
      </div>
    </div>
  );
}
