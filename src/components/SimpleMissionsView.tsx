import React from 'react';
import { CheckCircle2, Swords } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { FLAGS } from '../config/flags';
import { missionList, nextMission } from '../game/missions';

/** Simple mode missions screen: a short list, one obvious next step, plain words. */
export const SimpleMissionsView: React.FC = () => {
  const { campaignSectors, startSectorMission, clearActiveSectorMission, setActiveScreen } = useGame();
  const missions = missionList(campaignSectors, FLAGS.fullCampaign);
  const next = nextMission(missions);
  const done = missions.filter((m) => m.liberated).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5" data-testid="simple-missions">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-stone-100">Your missions</h1>
        <p className="text-sm text-stone-300">
          {next
            ? `Win each battle to free the island. ${done} of ${missions.length} done.`
            : 'You freed the whole island. Replay a mission or try a practice battle.'}
        </p>
      </div>

      <ol className="space-y-3">
        {missions.map((m, i) => {
          const isNext = next?.id === m.id;
          return (
            <li key={m.id} className={`p-4 rounded-xl border flex items-center gap-3 ${isNext ? 'border-amber-500/60 bg-stone-900' : 'border-stone-800 bg-stone-950/70'}`}>
              <span className="w-8 h-8 shrink-0 rounded-full bg-stone-800 text-stone-200 font-bold flex items-center justify-center" aria-hidden="true">
                {m.liberated ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-stone-100">{`Mission ${i + 1}: ${m.sectorName}`}</h2>
                <p className="text-sm text-stone-300">
                  {m.liberated ? 'Done' : `Defeat ${m.enemySquad.length} rival${m.enemySquad.length === 1 ? '' : 's'}`}
                </p>
              </div>
              <button
                data-testid={isNext ? 'mission-start' : undefined}
                onClick={() => startSectorMission(m)}
                className={`min-h-11 px-4 rounded-lg font-bold text-sm cursor-pointer shrink-0 ${isNext ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-600'}`}
              >
                {m.liberated ? 'Replay' : 'Start'}
              </button>
            </li>
          );
        })}
      </ol>

      <button
        onClick={() => {
          clearActiveSectorMission();
          setActiveScreen('arena');
        }}
        className="min-h-11 px-4 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-stone-200 border border-stone-700 hover:bg-stone-800 cursor-pointer"
      >
        <Swords className="w-4 h-4" aria-hidden="true" />
        Practice battle
      </button>
    </div>
  );
};
