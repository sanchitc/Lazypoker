import { Card as CardType } from '@common/types';
import Card from './Card';

interface CommunityCardsProps {
  cards: CardType[];
}

export default function CommunityCards({ cards }: CommunityCardsProps) {
  if (cards.length === 0) return null;

  return (
    <div className="flex gap-1.5 justify-center">
      {cards.map((card, i) => (
        <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
          <Card card={card} size="md" />
        </div>
      ))}
      {/* Placeholder slots for remaining cards */}
      {Array.from({ length: 5 - cards.length }, (_, i) => (
        <div key={`empty-${i}`} className="w-12 h-[68px] rounded-lg border border-white/10" />
      ))}
    </div>
  );
}
