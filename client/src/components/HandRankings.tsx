import { useState, useEffect, useRef } from 'react';

const HAND_RANKINGS = [
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

const STORAGE_KEY = 'lazypoker_rankings_hidden';

function ExampleHand({ text }: { text: string }) {
  return (
    <span className="font-mono text-[13px] leading-none tracking-tight whitespace-nowrap">
      {[...text].map((c, i) => {
        const red = c === '♥' || c === '♦';
        const black = c === '♣' || c === '♠';
        return (
          <span
            key={i}
            className={red ? 'text-red-400' : black ? 'text-white/95' : 'text-white/70'}
          >
            {c}
          </span>
        );
      })}
    </span>
  );
}

export default function HandRankings() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  });

  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0');
  }, [hidden]);

  // Close panel when tapping outside, but let the underlying tap pass through
  // so action buttons remain operable while the panel is open.
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  if (hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-30
                   w-2 h-14 bg-gold/30 hover:bg-gold/60
                   rounded-l-full border border-gold/40 border-r-0
                   transition-all"
        aria-label="Show hand rankings button"
        title="Show hand rankings"
      />
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        className={`fixed right-2 top-1/2 -translate-y-1/2 z-40
                    w-10 h-10 rounded-full backdrop-blur-md
                    border shadow-lg flex items-center justify-center
                    leading-none active:scale-95 transition-all
                    ${open
                      ? 'bg-gold/40 border-gold/70 text-white'
                      : 'bg-black/40 border-gold/40 text-gold hover:bg-black/55'}`}
        aria-label="Hand rankings"
        title="Hand rankings"
      >
        <span className="text-[15px] font-bold tracking-tighter">
          <span className="text-red-400">♥</span>
          <span>♠</span>
        </span>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed right-2 z-40 animate-slide-up
                     top-12
                     w-[min(290px,calc(100vw-16px))]
                     max-h-[calc(100vh-220px)]
                     bg-felt-dark/95 backdrop-blur-xl rounded-2xl
                     border border-gold/30 shadow-2xl
                     flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/30">
            <span className="text-gold text-sm font-bold tracking-wide uppercase">
              Hand Rankings
            </span>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full text-white/70 hover:text-white hover:bg-white/10
                         flex items-center justify-center text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-1 py-1">
            {HAND_RANKINGS.map(h => (
              <div
                key={h.rank}
                className="flex items-center gap-2 px-2 py-2 rounded-lg"
              >
                <span className="w-5 text-xs text-gold/70 tabular-nums text-right font-bold">
                  {h.rank}
                </span>
                <span className="flex-1 text-sm text-white/90 font-medium leading-tight">
                  {h.name}
                </span>
                <ExampleHand text={h.example} />
              </div>
            ))}
          </div>

          <div className="px-3 py-2 border-t border-white/10 bg-black/20 flex items-center justify-between">
            <button
              onClick={() => { setHidden(true); setOpen(false); }}
              className="text-[11px] text-white/50 hover:text-white/80 underline-offset-2 hover:underline"
            >
              Hide button
            </button>
            <span className="text-[10px] text-white/40">tap outside to dismiss</span>
          </div>
        </div>
      )}
    </>
  );
}
