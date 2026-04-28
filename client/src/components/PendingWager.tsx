import { CHIP_COLOR_MAP } from '../utils/chipUtils';
import type { InferredAction } from '../hooks/useChipInteraction';

interface PendingWagerProps {
  pendingChips: Map<number, number>;
  pendingTotal: number;
  inferredAction: InferredAction;
  onUndo: () => void;
  onClear: () => void;
  disabled: boolean;
}

function getActionLabel(action: InferredAction): { text: string; color: string } {
  switch (action.type) {
    case 'CHECK': return { text: 'Check', color: 'text-[hsl(146_40%_79%)]' };
    case 'CALL':  return { text: `Call ${action.amount.toLocaleString()}`, color: 'text-[hsl(146_40%_79%)]' };
    case 'BET':   return { text: `Bet ${action.amount.toLocaleString()}`, color: 'text-brass' };
    case 'RAISE': return { text: `Raise to ${action.amount.toLocaleString()}`, color: 'text-brass' };
    case 'ALL_IN': return { text: `All-in ${action.amount.toLocaleString()}`, color: 'text-brass' };
    case 'INVALID': return { text: action.reason, color: 'text-[hsl(10_78%_76%)]' };
  }
}

export default function PendingWager({
  pendingChips,
  pendingTotal,
  inferredAction,
  onUndo,
  onClear,
  disabled,
}: PendingWagerProps) {
  const hasChips = pendingTotal > 0;
  const actionLabel = getActionLabel(inferredAction);
  const isInvalid = inferredAction.type === 'INVALID' && hasChips;

  const chipEntries = Array.from(pendingChips.entries())
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => b - a);

  if (!hasChips) {
    return (
      <div className="surface-pill flex h-11 items-center justify-center rounded-[18px] px-3">
        <span className={`text-xs font-medium ${actionLabel.color}`}>
          {actionLabel.text}
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-[20px] px-3 py-2 transition-colors
      ${isInvalid
        ? 'border border-ember/35 bg-ember/10'
        : 'surface-panel-soft'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 flex-wrap flex-1 items-center">
          {chipEntries.map(([denom, count]) => {
            const color = CHIP_COLOR_MAP.get(denom) ?? '#888';
            return (
              <div key={denom} className="flex items-center gap-0.5 animate-fade-in">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${color}, color-mix(in oklab, ${color} 65%, black))`,
                    border: '1px solid rgba(255,255,255,0.22)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 3px rgba(0,0,0,0.4)',
                  }}
                >
                  <span
                    className="text-[7px] font-mono font-bold"
                    style={{ color: denom <= 1 ? 'rgba(40,40,40,0.95)' : 'rgba(255,255,255,0.95)' }}
                  >
                    {denom >= 1000 ? `${denom / 1000}K` : denom}
                  </span>
                </div>
                {count > 1 && (
                  <span className="text-[9px] font-mono text-bone-dim/60 tabular-nums">×{count}</span>
                )}
              </div>
            );
          })}

          <span className="font-mono font-bold text-bone tabular-nums ml-auto text-sm">
            {pendingTotal.toLocaleString()}
          </span>
        </div>

        {!disabled && (
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={onUndo}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-bone/10 bg-panel-soft/70 text-bone-dim
                         hover:border-brass/24 hover:bg-panel-soft hover:text-bone active:scale-90
                         flex items-center justify-center text-xs transition-all
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              aria-label="Undo"
            >
              ↩
            </button>
            <button
              onClick={onClear}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-bone/10 bg-panel-soft/70 text-bone-dim
                         hover:border-brass/24 hover:bg-panel-soft hover:text-bone active:scale-90
                         flex items-center justify-center text-xs transition-all
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              aria-label="Clear"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className={`text-[10px] font-bold mt-0.5 uppercase tracking-[0.12em] ${actionLabel.color}`}>
        {actionLabel.text}
      </div>
    </div>
  );
}
