import type { InferredAction } from '../hooks/useChipInteraction';
import { Button, type ButtonProps } from '@/components/ui/button';

interface CommitButtonProps {
  inferredAction: InferredAction;
  canCommit: boolean;
  onCommit: () => void;
  disabled: boolean;
}

function getButtonConfig(action: InferredAction): { label: string; variant: ButtonProps['variant'] } {
  switch (action.type) {
    case 'CHECK': return { label: 'Check', variant: 'check' };
    case 'CALL': return { label: `Call ${action.amount.toLocaleString()}`, variant: 'call' };
    case 'BET': return { label: `Bet ${action.amount.toLocaleString()}`, variant: 'raise' };
    case 'RAISE': return { label: `Raise to ${action.amount.toLocaleString()}`, variant: 'raise' };
    case 'ALL_IN': return { label: `All In ${action.amount.toLocaleString()}`, variant: 'allin' };
    case 'INVALID': return { label: action.reason, variant: 'outline' };
  }
}

export default function CommitButton({ inferredAction, canCommit, onCommit, disabled }: CommitButtonProps) {
  const { label, variant } = getButtonConfig(inferredAction);
  const isDisabled = disabled || !canCommit;

  return (
    <Button
      variant={variant}
      size="lg"
      className="w-full uppercase tracking-[0.04em] font-bold"
      disabled={isDisabled}
      onClick={() => {
        if (!isDisabled) {
          if (navigator.vibrate) {
            navigator.vibrate(inferredAction.type === 'ALL_IN' ? [50, 30, 50] : 30);
          }
          onCommit();
        }
      }}
      aria-label={label}
    >
      {label}
    </Button>
  );
}
