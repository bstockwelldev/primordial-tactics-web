import React, { useMemo, useState } from 'react';
import { Users, X, ArrowLeftRight, RotateCcw } from 'lucide-react';
import type { UnitEntity } from '../types/game';
import { Slot, assignSlots, defaultAssignments, swapAssignments, validateSplit } from '../game/party';

interface Props {
  hostName: string;
  /** Builds the human-side units for a given buddy name (default split already applied). */
  buildUnits: (guestName: string) => UnitEntity[];
  portrait: (unit: UnitEntity) => string;
  onConfirm: (guestName: string, units: UnitEntity[]) => void;
  onCancel: () => void;
}

const SLOT_TONE: Record<Slot, { chip: string; active: string }> = {
  0: { chip: 'bg-emerald-950 text-emerald-300 border-emerald-800', active: 'bg-emerald-700 border-emerald-400 text-white' },
  1: { chip: 'bg-sky-950 text-sky-300 border-sky-800', active: 'bg-sky-700 border-sky-400 text-white' },
};

/** Pass & play setup: name the buddy and decide which of them commands each unit. */
export const PartySetupModal: React.FC<Props> = ({ hostName, buildUnits, portrait, onConfirm, onCancel }) => {
  const [guestDraft, setGuestDraft] = useState('Buddy');
  const guestName = guestDraft.replace(/\p{Cc}/gu, '').trim().slice(0, 40) || 'Buddy';

  const base = useMemo(() => buildUnits(guestName).filter((u) => u.isPlayer), [buildUnits, guestName]);
  const [assignments, setAssignments] = useState<Record<string, Slot>>(() => defaultAssignments(base));
  const units = useMemo(() => assignSlots(base, assignments), [base, assignments]);
  const problem = validateSplit(units);
  const names: [string, string] = [hostName, guestName];

  const btn = 'min-h-11 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer';

  return (
    <div role="dialog" aria-label="Party setup" data-testid="party-setup" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 bg-stone-950/90 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30">
              <Users className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-100">Play with a buddy</h3>
              <p className="text-xs text-stone-400">Share this device. You each command part of the party.</p>
            </div>
          </div>
          <button onClick={onCancel} aria-label="Close" className="p-2 rounded-lg text-stone-400 hover:text-stone-100 min-h-11 min-w-11 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          <label className="block space-y-1 text-xs font-bold uppercase tracking-wider text-stone-400">
            Buddy's name
            <input
              data-testid="buddy-name-input"
              value={guestDraft}
              maxLength={40}
              onChange={(e) => setGuestDraft(e.target.value)}
              className="block w-full min-h-11 px-3 rounded-lg bg-stone-800 border border-stone-700 text-sm font-normal normal-case tracking-normal text-stone-100"
            />
          </label>

          <div className="space-y-2">
            {units.map((u) => {
              const slot = (u.controller ?? 0) as Slot;
              return (
                <div key={u.id} data-testid={`party-row-${u.id}`} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-stone-950/60 border border-stone-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src={portrait(u)} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover border border-stone-700 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-100 truncate">{u.name}</p>
                      <p className="text-xs text-stone-400">{u.unitClass} · {u.maxHp} HP</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0" role="group" aria-label={`Who commands ${u.name}`}>
                    {([0, 1] as Slot[]).map((s) => (
                      <button
                        key={s}
                        data-testid={`assign-${u.id}-${s}`}
                        aria-pressed={slot === s}
                        onClick={() => setAssignments((a) => ({ ...a, [u.id]: s }))}
                        className={`${btn} max-w-24 truncate ${slot === s ? SLOT_TONE[s].active : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-200'}`}
                      >
                        {names[s]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <button className={`${btn} bg-stone-800 border-stone-700 text-stone-200 flex items-center gap-1.5`} onClick={() => setAssignments((a) => swapAssignments(a))}>
              <ArrowLeftRight className="w-3.5 h-3.5" /> Swap
            </button>
            <button className={`${btn} bg-stone-800 border-stone-700 text-stone-200 flex items-center gap-1.5`} onClick={() => setAssignments(defaultAssignments(base))}>
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>

          {problem && <p role="alert" data-testid="party-problem" className="text-xs text-amber-300">{problem}</p>}
          <p className="text-xs text-stone-500">
            Each round {hostName} acts, then {guestName}, then the rival clan. Rewards go to {hostName}'s save.
          </p>
        </div>

        <div className="p-4 border-t border-stone-800 flex justify-end gap-2">
          <button className={`${btn} bg-stone-800 border-stone-700 text-stone-300`} onClick={onCancel}>Cancel</button>
          <button
            data-testid="party-start"
            disabled={!!problem}
            className={`${btn} bg-amber-600 hover:bg-amber-500 border-amber-500 text-white disabled:opacity-50 disabled:cursor-not-allowed`}
            onClick={() => onConfirm(guestName, units)}
          >
            Start with {guestName}
          </button>
        </div>
      </div>
    </div>
  );
};
