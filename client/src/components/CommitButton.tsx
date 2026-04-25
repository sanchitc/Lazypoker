import type { InferredAction } from '../hooks/useChipInteraction';

interface CommitButtonProps {
  inferredAction: InferredAction;
  canCommit: boolean;
  onCommit: () => void;
  disabled: boolean;
}

function getButtonConfig(action: InferredAction): { label: string; bgClass: string; textClass: string } {
  switch (action.type) {
    case 'CHECK':
      return { label: 'Check', bgClass: 'bg-green-600 hover:bg-green-500', textClass: 'text-white' };
    case 'CALL':
      return { label: `Call ${action.amount.toLocaleString()}`, bgClass: 'bg-green-600 hover:bg-green-500', textClass: 'text-white' };
    case 'BET':
      return { label: `Bet ${action.amount.toLocaleString()}`, bgClass: 'bg-gold hover:bg-yellow-400', textClass: 'text-black' };
    case 'RAISE':
      return { label: `Raise to ${action.amount.toLocaleString()}`, bgClass: 'bg-gold hover:bg-yellow-400', textClass: 'text-black' };
    case 'ALL_IN':
      return { label: `ALL IN ${action.amount.toLocaleString()}`, bgClass: 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400', textClass: 'text-black' };
    case 'INVALID':
      return { label: action.reason, bgClass: 'bg-white/10', textClass: 'text-white/30' };
  }
}

export default function CommitButton({ inferredAction, canCommit, onCommit, disabled }: CommitButtonProps) {
  const { label, bgClass, textClass } = getButtonConfig(inferredAction);
  const isDisabled = disabled || !canCommit;

  return (
    <button
      disabled={isDisabled}
      onClick={() => {
        if (!isDisabled) {
          if (navigator.vibrate) {
            navigator.vibrate(inferredAction.type === 'ALL_IN' ? [50, 30, 50] : 30);
          }
          onCommit();
        }
      }}
      className={`w-full py-3 rounded-xl font-black text-sm tracking-wide transition-all uppercase
        ${isDisabled
          ? 'bg-white/8 text-white/25 cursor-default'
          : `${bgClass} ${textClass} active:scale-[0.97] shadow-lg`
        }`}
      aria-label={label}
    >
      {label}
    </button>
  );
}
