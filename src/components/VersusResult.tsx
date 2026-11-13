import React from 'react';
import { Flame } from 'lucide-react';
import { VERSUS_TEMPLATE_IDS } from '../game/versus';
import { VersusSeries, pairResult } from '../game/versusSeries';

interface Props {
  series: VersusSeries;
  round: number;
  /** Why the game ended, for the line under the headline. */
  endedBy: 'wipeout' | 'limit';
  onNextGame: () => void;
  onRematch: () => void;
  onNewDraft: () => void;
  onQuit: () => void;
}

const nameOf = (id: string) => (id === 'commander' ? 'Commander' : id.charAt(0).toUpperCase() + id.slice(1));

/** Shown over the board when a versus game ends: after game 1 a hand-over to game 2, after game 2 the pair's result. */
export const VersusResult: React.FC<Props> = ({ series, round, endedBy, onNextGame, onRematch, onNewDraft, onQuit }) => {
  const last = series.results[series.results.length - 1];
  const gameWinner = last?.winner === 'a' ? series.names[0] : last?.winner === 'b' ? series.names[1] : null;
  const pair = pairResult(series);
  const btn = 'min-h-11 px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg cursor-pointer transition-transform hover:scale-105';
  const how = endedBy === 'limit' ? `Round limit reached after ${round} rounds: more HP left wins.` : `Ended in round ${round}.`;

  if (!pair) {
    const secondFirst = series.names[1 - series.first];
    return (
      <div data-testid="versus-result" data-stage="game1" className="space-y-4">
        <Flame className="w-10 h-10 text-amber-400 mx-auto" />
        <h3 className="text-2xl sm:text-3xl font-black text-stone-100">{gameWinner ? `${gameWinner} wins game 1` : 'Game 1 is a draw'}</h3>
        <p className="text-sm text-stone-300">{how}</p>
        <p className="text-sm text-stone-400">Game 2: same squads, sides swapped. {secondFirst} moves first.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button data-testid="versus-next-game" onClick={onNextGame} className={`${btn} bg-amber-600 hover:bg-amber-500 text-white`}>Start game 2</button>
          <button onClick={onQuit} className={`${btn} bg-stone-800 border border-stone-700 text-stone-300`}>Quit</button>
        </div>
      </div>
    );
  }

  const winnerName = pair.winner === 'a' ? series.names[0] : pair.winner === 'b' ? series.names[1] : null;
  return (
    <div data-testid="versus-result" data-stage="pair" className="space-y-4">
      <Flame className="w-12 h-12 text-amber-400 mx-auto" />
      <h3 className="text-2xl sm:text-3xl font-black text-stone-100">{winnerName ? `${winnerName} wins the match` : 'The match is a draw'}</h3>
      <p className="text-sm text-stone-300">
        Games: {series.names[0]} {pair.aWins}, {series.names[1]} {pair.bWins}
        {pair.aWins === pair.bWins && winnerName ? ' — decided by the bigger total HP margin' : ''}.
      </p>
      <p className="text-xs text-stone-500">{how}</p>
      <div className="grid gap-2 sm:grid-cols-2 text-left max-w-md mx-auto">
        {([0, 1] as const).map((p) => (
          <div key={p} className="p-2.5 rounded-xl bg-stone-900/80 border border-stone-800">
            <p className={`text-xs font-bold truncate ${p === 0 ? 'text-emerald-300' : 'text-sky-300'}`}>{series.names[p]}</p>
            <p className="text-xs text-stone-400">{series.picks[p].filter((id) => (VERSUS_TEMPLATE_IDS as readonly string[]).includes(id)).map(nameOf).join(', ')}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-stone-500">Nothing here changes your campaign: no XP, loot or sector progress.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button data-testid="versus-rematch" onClick={onRematch} className={`${btn} bg-amber-600 hover:bg-amber-500 text-white`}>Rematch</button>
        <button data-testid="versus-new-draft" onClick={onNewDraft} className={`${btn} bg-stone-700 hover:bg-stone-600 text-white`}>New draft</button>
        <button data-testid="versus-quit" onClick={onQuit} className={`${btn} bg-stone-800 border border-stone-700 text-stone-300`}>Quit</button>
      </div>
    </div>
  );
};
