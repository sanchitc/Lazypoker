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
    case 'CHECK': return { text: 'Check', color: 'text-green-400' };
    case 'CALL': return { text: `Call ${action.amount.toLocaleString()}`, color: 'text-green-400' };
    case 'BET': return { text: `Bet ${action.amount.toLocaleString()}`, color: 'text-gold' };
    case 'RAISE': return { text: `Raise to ${action.amount.toLocaleString()}`, color: 'text-gold' };
    case 'ALL_IN': return { text: `All-in ${action.amount.toLocaleString()}`, color: 'text-yellow-400' };
    case 'INVALID': return { text: action.reason, color: 'text-red-400' };
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
      <div className="flex items-center justify-center h-8">
        <span className={`text-xs font-medium ${actionLabel.color}`}>
          {actionLabel.text}
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl px-2.5 py-1.5 transition-colors
      ${isInvalid ? 'bg-red-900/20 border border-red-500/30' : 'bg-white/5 border border-white/8'}`}>
      <div className="flex items-center justify-between gap-2">
        {/* Chip visuals inline */}
        <div className="flex gap-1 flex-wrap flex-1 items-center">
          {chipEntries.map(([denom, count]) => {
            const color = CHIP_COLOR_MAP.get(denom) ?? '#888';
            return (
              <div key={denom} className="flex items-center gap-0.5 animate-fade-in">
                <div
                  className="w-5 h-5 rounded-full border border-white/25 flex items-center justify-center"
                  style={{
                    backgroundColor: color,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                  }}
                >
                  <span className={`text-[7px] font-bold
                    ${denom >= 500 ? 'text-white' : denom <= 1 ? 'text-gray-600' : 'text-white'}`}>
                    {denom >= 1000 ? `${denom / 1000}K` : denom}
                  </span>
                </div>
                {count > 1 && (
                  <span className="text-[9px] text-white/40 tabular-nums">x{count}</span>
                )}
              </div>
            );
          })}

          {/* Total */}
          <span className="text-sm font-black text-white tabular-nums ml-auto">
            {pendingTotal.toLocaleString()}
          </span>
        </div>

        {/* Undo/Clear */}
        {!disabled && (
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={onUndo}
              className="w-7 h-7 rounded-lg bg-white/10 text-white/50 flex items-center justify-center
                         hover:bg-white/20 active:scale-90 transition-all text-xs"
              aria-label="Undo"
            >
              ↩
            </button>
            <button
              onClick={onClear}
              className="w-7 h-7 rounded-lg bg-white/10 text-white/50 flex items-center justify-center
                         hover:bg-white/20 active:scale-90 transition-all text-xs"
              aria-label="Clear"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Inferred action label */}
      <div className={`text-[10px] font-bold mt-0.5 ${actionLabel.color}`}>
        {actionLabel.text}
      </div>
    </div>
  );
}
