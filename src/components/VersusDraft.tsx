import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Swords, X, Hand, Check } from 'lucide-react';
import type { UnitEntity } from '../types/game';
import { SQUAD_SIZE, VERSUS_TEMPLATE_IDS, VersusTemplateId, previewTemplate, validatePicks } from '../game/versus';
import { Player, VersusSeries, startSeries } from '../game/versusSeries';

// Blind simultaneous draft (docs/local-versus-spec.md, 3.3 and 3.6). Player 1 picks three, the device
// is handed over without showing them, Player 2 picks three, then both squads are revealed together.
// Picks live only in this component's state until the match starts: nothing is written to storage.

interface Props {
  hostName: string;
  portrait: (unit: UnitEntity) => string;
  onStart: (series: VersusSeries) => void;
  onCancel: () => void;
}

type Step = 'names' | 'pick0' | 'pass' | 'pick1' | 'reveal';

const TONE = [
  { text: 'text-emerald-300', chip: 'bg-emerald-950 border-emerald-800 text-emerald-300', on: 'border-emerald-400 bg-emerald-950/60 ring-2 ring-emerald-500/40', button: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400' },
  { text: 'text-sky-300', chip: 'bg-sky-950 border-sky-800 text-sky-300', on: 'border-sky-400 bg-sky-950/60 ring-2 ring-sky-500/40', button: 'bg-sky-600 hover:bg-sky-500 border-sky-400' },
] as const;

const cleanName = (raw: string, fallback: string) => raw.replace(/\p{Cc}/gu, '').trim().slice(0, 40) || fallback;

export const VersusDraft: React.FC<Props> = ({ hostName, portrait, onStart, onCancel }) => {
  const [step, setStep] = useState<Step>('names');
  const [guestDraft, setGuestDraft] = useState('Rival');
  const [picks, setPicks] = useState<[VersusTemplateId[], VersusTemplateId[]]>([[], []]);
  const [first, setFirst] = useState<Player>(0);
  const guestName = cleanName(guestDraft, 'Rival');
  const names: [string, string] = [hostName, guestName];
  const cards = useMemo(() => VERSUS_TEMPLATE_IDS.map((id) => ({ id, unit: previewTemplate(id) })), []);
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (step === 'pass') primary.current?.focus();
  }, [step]);

  const picker: Player | null = step === 'pick0' ? 0 : step === 'pick1' ? 1 : null;
  const mine = picker === null ? [] : picks[picker];
  const problem = picker === null ? null : validatePicks(mine);

  const toggle = (id: VersusTemplateId) => {
    if (picker === null) return;
    setPicks((prev) => {
      const cur = prev[picker];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < SQUAD_SIZE ? [...cur, id] : cur;
      const out: [VersusTemplateId[], VersusTemplateId[]] = [prev[0], prev[1]];
      out[picker] = next;
      return out;
    });
  };

  const btn = 'min-h-11 px-4 rounded-lg text-sm font-bold border transition-colors cursor-pointer';
  const shell = (title: string, subtitle: string, body: React.ReactNode, footer: React.ReactNode) => (
    <div role="dialog" aria-label="Versus draft" data-testid="versus-draft" data-step={step} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        <div className="p-4 bg-stone-950/90 border-b border-stone-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 shrink-0">
              <Swords className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-stone-100 truncate">{title}</h3>
              <p className="text-xs text-stone-400">{subtitle}</p>
            </div>
          </div>
          <button onClick={onCancel} aria-label="Close" className="p-2 rounded-lg text-stone-400 hover:text-stone-100 min-h-11 min-w-11 flex items-center justify-center shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto space-y-4">{body}</div>
        <div className="p-4 border-t border-stone-800 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );

  if (step === 'names') {
    return shell(
      'Versus',
      'Two players, one device. Each secretly picks three units.',
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 text-xs font-bold uppercase tracking-wider text-stone-400">
            Player 1
            <p className="min-h-11 flex items-center px-3 rounded-lg bg-stone-800/60 border border-stone-700 text-sm font-normal normal-case tracking-normal text-emerald-300 truncate">{hostName}</p>
          </div>
          <label className="block space-y-1 text-xs font-bold uppercase tracking-wider text-stone-400">
            Player 2
            <input
              data-testid="versus-name-input"
              value={guestDraft}
              maxLength={40}
              onChange={(e) => setGuestDraft(e.target.value)}
              className="block w-full min-h-11 px-3 rounded-lg bg-stone-800 border border-stone-700 text-sm font-normal normal-case tracking-normal text-stone-100"
            />
          </label>
        </div>
        <p className="text-xs text-stone-500">
          Everyone fights with the same level-5 units, so nothing from your save counts and nothing from it changes: no XP, loot or sector progress. You play two games with sides swapped, so each of you moves first once.
        </p>
      </>,
      <>
        <button className={`${btn} bg-stone-800 border-stone-700 text-stone-300`} onClick={onCancel}>Cancel</button>
        <button data-testid="versus-names-next" className={`${btn} bg-amber-600 hover:bg-amber-500 border-amber-500 text-white`} onClick={() => setStep('pick0')}>
          {hostName.length > 14 ? 'Player 1 picks' : `${hostName} picks`}
        </button>
      </>
    );
  }

  if (step === 'pass') {
    return (
      <div role="dialog" aria-modal="true" aria-label={`Pass the device to ${guestName}`} data-testid="versus-pass" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-950 text-center">
        <div className="w-full max-w-sm space-y-5">
          <div className="mx-auto w-16 h-16 rounded-2xl border border-sky-500/50 bg-sky-500/10 flex items-center justify-center">
            <Hand className="w-8 h-8 text-sky-300" />
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-stone-400">Squad locked in</p>
            <h2 className="text-2xl font-extrabold text-stone-100 break-words">Pass the device to <span className="text-sky-300">{guestName}</span></h2>
            <p className="text-sm text-stone-400">{hostName}'s picks stay hidden until both squads are in.</p>
          </div>
          <button ref={primary} data-testid="versus-pass-ready" onClick={() => setStep('pick1')} className="w-full min-h-14 rounded-xl border border-sky-400 bg-sky-600 hover:bg-sky-500 text-base font-bold text-white cursor-pointer">
            I'm {guestName.length > 18 ? 'ready' : guestName}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'reveal') {
    const firstName = names[first];
    return shell(
      'Squads revealed',
      `Coin flip: ${firstName} moves first in game 1.`,
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          {([0, 1] as Player[]).map((p) => (
            <div key={p} data-testid={`versus-reveal-${p}`} className={`p-3 rounded-xl border bg-stone-950/60 space-y-2 ${TONE[p].chip.split(' ')[1]}`}>
              <p className={`text-sm font-extrabold truncate ${TONE[p].text}`}>{names[p]}</p>
              {picks[p].map((id) => {
                const u = cards.find((c) => c.id === id)!.unit;
                return (
                  <div key={id} className="flex items-center gap-2.5">
                    <img src={portrait(u)} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover border border-stone-700 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-100 truncate">{u.name}</p>
                      <p className="text-xs text-stone-400">{u.unitClass} · {u.maxHp} HP</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <p className="text-xs text-stone-500">Game 2 swaps sides with the same squads. The pair is won by more game wins; at one win each, by the bigger total HP margin.</p>
      </>,
      <>
        <button className={`${btn} bg-stone-800 border-stone-700 text-stone-300`} onClick={onCancel}>Cancel</button>
        <button data-testid="versus-start" className={`${btn} bg-amber-600 hover:bg-amber-500 border-amber-500 text-white`} onClick={() => onStart(startSeries(names, [picks[0], picks[1]], first))}>
          Start game 1
        </button>
      </>
    );
  }

  // pick0 / pick1
  const p = picker as Player;
  return shell(
    `${names[p]}: pick ${SQUAD_SIZE} units`,
    p === 0 ? `Player 2 should look away. ${names[1]} picks next.` : `Player 1's picks are hidden until you lock in.`,
    <>
      <div className="grid gap-2 sm:grid-cols-2" data-testid="versus-cards">
        {cards.map(({ id, unit }) => {
          const on = mine.includes(id);
          return (
            <button
              key={id}
              type="button"
              data-testid={`versus-card-${id}`}
              aria-pressed={on}
              onClick={() => toggle(id)}
              className={`text-left p-3 rounded-xl border min-h-11 transition-colors cursor-pointer ${on ? TONE[p].on : 'border-stone-800 bg-stone-950/60 hover:border-stone-600'}`}
            >
              <div className="flex items-center gap-2.5">
                <img src={portrait(unit)} alt="" referrerPolicy="no-referrer" className="w-11 h-11 rounded-full object-cover border border-stone-700 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-stone-100 flex items-center gap-1.5">
                    <span className="truncate">{unit.name}</span>
                    {on && <Check className={`w-4 h-4 shrink-0 ${TONE[p].text}`} />}
                  </p>
                  <p className="text-xs text-stone-400">{unit.unitClass}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-stone-300 font-mono">
                HP {unit.maxHp} · ATK {unit.attack} · DEF {unit.defense} · SPD {unit.speed}
              </p>
              <p className="mt-1 text-[11px] text-stone-500">{unit.abilities.map((a) => a.name).join(', ')}</p>
            </button>
          );
        })}
      </div>
      <p data-testid="versus-count" className="text-xs text-stone-400">
        {mine.length} of {SQUAD_SIZE} picked{mine.length > 0 ? `: ${mine.map((id) => cards.find((c) => c.id === id)!.unit.name).join(', ')}` : ''}
      </p>
    </>,
    <>
      <button
        className={`${btn} bg-stone-800 border-stone-700 text-stone-300`}
        onClick={() => setPicks((prev) => (p === 0 ? [[], prev[1]] : [prev[0], []]))}
      >
        Clear
      </button>
      <button
        data-testid="versus-lock"
        disabled={!!problem}
        className={`${btn} text-white disabled:opacity-50 disabled:cursor-not-allowed ${TONE[p].button}`}
        onClick={() => {
          if (p === 0) setStep('pass');
          else {
            setFirst(Math.random() < 0.5 ? 0 : 1);
            setStep('reveal');
          }
        }}
      >
        Lock in squad
      </button>
    </>
  );
};
