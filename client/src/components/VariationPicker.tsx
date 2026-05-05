import { useGame } from '../context/GameContext';
import { useSocket } from '../context/SocketContext';
import { TeenPattiVariation } from '@common/types';
import { TEEN_PATTI_VARIATIONS, TEEN_PATTI_VARIATION_ORDER } from '@common/teen-patti-variations';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

interface VariationPickerProps {
  disabled?: boolean;
}

export default function VariationPicker({ disabled }: VariationPickerProps) {
  const { gameState, playerId, roomCode } = useGame();
  const { socket } = useSocket();

  if (!gameState || !playerId || !roomCode) return null;

  const current: TeenPattiVariation = gameState.nextHandVariation ?? 'classic';

  const handleChange = (v: string) => {
    const variation = v as TeenPattiVariation;
    socket?.emit('action', {
      roomCode,
      playerId,
      action: { type: 'SET_NEXT_VARIATION', variation },
    });
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] surface-panel-soft px-3 py-2">
      <span className="text-[10px] uppercase tracking-[0.18em] text-bone-dim font-display">
        Next hand
      </span>
      <Select value={current} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger className="w-44 h-9 text-sm">
          <span className="truncate">{TEEN_PATTI_VARIATIONS[current].label}</span>
        </SelectTrigger>
        <SelectContent>
          {TEEN_PATTI_VARIATION_ORDER.map(id => {
            const meta = TEEN_PATTI_VARIATIONS[id];
            return (
              <SelectItem key={id} value={id}>
                <div className="flex flex-col">
                  <span className="font-medium">{meta.label}</span>
                  <span className="text-[10px] text-bone-dim">{meta.tagline}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
