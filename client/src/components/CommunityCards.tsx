import { Card as CardType } from '@common/types';
import Card from './Card';

interface CommunityCardsProps {
  cards: CardType[];
}

export default function CommunityCards({ cards }: CommunityCardsProps) {
  if (cards.length === 0) return null;

  return (
    <div className="flex justify-center gap-2">
      {cards.map((card, i) => (
        <div
          key={i}
          className="animate-card-lift"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <Card card={card} size="md" />
        </div>
      ))}
      {Array.from({ length: 5 - cards.length }, (_, i) => (
        <div
          key={`empty-${i}`}
          className="surface-panel-soft rounded-lg border-dashed border-bone/10"
          style={{ width: 48, height: 67 }}
        />
      ))}
    </div>
  );
}
