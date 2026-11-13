import React, { useEffect, useRef } from 'react';
import { Hand } from 'lucide-react';
import type { Slot } from '../game/party';

interface Props {
  name: string;
  slot: Slot;
  round: number;
  /** Names of the units this player is about to command. */
  units: string[];
  onReady: () => void;
}

const TONE: Record<Slot, { ring: string; text: string; button: string }> = {
  0: { ring: 'border-emerald-500/50 bg-emerald-500/10', text: 'text-emerald-300', button: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400' },
  1: { ring: 'border-sky-500/50 bg-sky-500/10', text: 'text-sky-300', button: 'bg-sky-600 hover:bg-sky-500 border-sky-400' },
};

/** Pass & play: shown between human phases so the device changes hands before anyone acts. */
export const HandoffOverlay: React.FC<Props> = ({ name, slot, round, units, onReady }) => {
  const ready = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ready.current?.focus();
  }, []);
  const tone = TONE[slot];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pass the device to ${name}`}
      data-testid="party-handoff"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-950/95 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm text-center space-y-5">
        <div className={`mx-auto w-16 h-16 rounded-2xl border flex items-center justify-center ${tone.ring}`}>
          <Hand className={`w-8 h-8 ${tone.text}`} />
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-stone-400">Round {round}</p>
          <h2 className="text-2xl font-extrabold text-stone-100 break-words">Pass the device to <span className={tone.text}>{name}</span></h2>
          {units.length > 0 && <p className="text-sm text-stone-400">Commanding: {units.join(', ')}</p>}
        </div>
        <button
          ref={ready}
          data-testid="party-ready"
          onClick={onReady}
          className={`w-full min-h-14 rounded-xl border text-base font-bold text-white transition-colors cursor-pointer ${tone.button}`}
        >
          I'm ready
        </button>
      </div>
    </div>
  );
};
