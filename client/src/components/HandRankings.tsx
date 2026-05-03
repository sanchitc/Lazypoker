import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useGame } from '../context/GameContext';

const POKER_RANKINGS = [
  { rank: 1, name: 'Royal Flush', example: 'A♠K♠Q♠J♠T♠' },
  { rank: 2, name: 'Straight Flush', example: 'J♣T♣9♣8♣7♣' },
  { rank: 3, name: 'Four of a Kind', example: '4♠4♥4♦4♣J♠' },
  { rank: 4, name: 'Full House', example: '3♠3♥3♦7♥7♣' },
  { rank: 5, name: 'Flush', example: 'K♦J♦7♦5♦3♦' },
  { rank: 6, name: 'Straight', example: '6♠5♠4♦3♦2♥' },
  { rank: 7, name: 'Three of a Kind', example: '7♥7♦7♣2♥J♠' },
  { rank: 8, name: 'Two Pair', example: 'Q♠Q♥2♣2♥J♠' },
  { rank: 9, name: 'One Pair', example: '8♥8♠A♣K♠5♦' },
  { rank: 10, name: 'High Card', example: 'A♣Q♦J♠4♥3♣' },
];

const TEEN_PATTI_RANKINGS = [
  { rank: 1, name: 'Trail (Trio)', example: 'A♠A♥A♦' },
  { rank: 2, name: 'Pure Sequence', example: 'A♥2♥3♥' },
  { rank: 3, name: 'Sequence', example: 'A♠2♥3♣' },
  { rank: 4, name: 'Color', example: 'A♠K♠J♠' },
  { rank: 5, name: 'Pair', example: 'A♠A♥K♣' },
  { rank: 6, name: 'High Card', example: 'A♠Q♥J♣' },
];

const STORAGE_KEY = 'lazypoker_rankings_hidden';

function ExampleHand({ text }: { text: string }) {
  return (
    <span className="font-mono text-[12px] tracking-tight whitespace-nowrap">
      {[...text].map((c, i) => {
        const red = c === '♥' || c === '♦';
        return (
          <span key={i} className={red ? 'text-ember' : 'text-bone'}>
            {c}
          </span>
        );
      })}
    </span>
  );
}

export default function HandRankings() {
  const { gameState } = useGame();
  const isTeenPatti = gameState?.variant === 'teen-patti';
  const rankings = isTeenPatti ? TEEN_PATTI_RANKINGS : POKER_RANKINGS;
  const subtitle = isTeenPatti
    ? "Best to worst — Teen Patti. Sequence beats color; A-2-3 is highest."
    : "Best to worst — Texas Hold'em.";
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0');
  }, [hidden]);

  if (hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-30
                   h-14 w-2 rounded-l-full border border-brass/32 border-r-0
                   bg-panel-strong/85 hover:bg-panel
                   transition-all"
        aria-label="Show hand rankings button"
        title="Show hand rankings"
      />
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-2 top-1/2 -translate-y-1/2 z-40
                   flex h-11 w-11 items-center justify-center rounded-full border border-brass/20
                   bg-panel-strong/78 text-brass backdrop-blur-md hover:border-brass/34 hover:bg-panel
                   shadow-lg flex items-center justify-center
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-brass
                   active:scale-95 transition-all"
        aria-label="Hand rankings"
        title="Hand rankings"
      >
        <span className="text-[15px] font-bold tracking-tighter">
          <span className="text-ember">♥</span>
          <span className="text-bone">♠</span>
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[min(320px,calc(100vw-16px))] felt-noise flex flex-col">
          <SheetHeader>
            <SheetTitle>Hand Rankings</SheetTitle>
            <SheetDescription>{subtitle}</SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-2">
            <div className="px-2">
              {rankings.map(h => (
                <div
                  key={h.rank}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-sm hover:bg-bone/5"
                >
                  <span className="font-display text-base text-brass tabular-nums w-5 text-right">
                    {h.rank}
                  </span>
                  <span className="font-display text-sm text-bone flex-1 leading-tight">
                    {h.name}
                  </span>
                  <ExampleHand text={h.example} />
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="pt-3 mt-2 brass-hairline-t flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setHidden(true); setOpen(false); }}
            >
              Hide button
            </Button>
            <span className="text-[10px] text-bone-dim/70">tap outside to dismiss</span>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
