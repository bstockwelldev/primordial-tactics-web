import React from 'react';
import { useGame } from '../context/GameContext';
import { Sparkles, X, CheckCircle2, AlertTriangle, ArrowRight, Trophy } from 'lucide-react';

export const AIFeedbackModal: React.FC = () => {
  const { showDebriefModal, setShowDebriefModal, lastMatchSummary } = useGame();

  if (!showDebriefModal || !lastMatchSummary) return null;

  const { grade, summary, strengths, weaknesses, tacticalRecommendation } = lastMatchSummary;

  const getGradeColor = (g: string) => {
    switch (g?.toUpperCase()) {
      case 'S':
      case 'A+':
      case 'A':
        return 'text-amber-400 border-amber-500 bg-amber-950/40';
      case 'B':
        return 'text-emerald-400 border-emerald-500 bg-emerald-950/40';
      default:
        return 'text-blue-400 border-blue-500 bg-blue-950/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl space-y-4 p-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <Sparkles className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="font-black text-xl text-stone-100">AI Tactical Combat Debrief</h3>
              <p className="text-xs text-stone-400">Personalized Post-Match Strategic Analysis</p>
            </div>
          </div>

          <button
            onClick={() => setShowDebriefModal(false)}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grade & Summary */}
        <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 flex items-center gap-4">
          <div
            className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center font-black text-2xl shadow-lg shrink-0 ${getGradeColor(
              grade
            )}`}
          >
            {grade || 'A'}
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Tactical Performance Rating
            </h4>
            <p className="text-xs text-stone-300 mt-1 leading-relaxed">
              {summary || 'Match analysis concluded with high-level tactical efficiency.'}
            </p>
          </div>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 space-y-2">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Tactical Strengths</span>
            </div>
            <ul className="space-y-1 text-stone-300 list-disc list-inside">
              {(strengths || []).map((s: string, i: number) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>

          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/40 space-y-2">
            <div className="font-bold text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>Areas for Improvement</span>
            </div>
            <ul className="space-y-1 text-stone-300 list-disc list-inside">
              {(weaknesses || []).map((w: string, i: number) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Tactical Recommendation */}
        {tacticalRecommendation && (
          <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/50 space-y-1 text-xs">
            <div className="font-bold text-purple-300 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-purple-400" />
              <span>Strategic Evolution & Loadout Recommendation</span>
            </div>
            <p className="text-stone-300 leading-relaxed">{tacticalRecommendation}</p>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            onClick={() => setShowDebriefModal(false)}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg cursor-pointer"
          >
            Acknowledge & Continue
          </button>
        </div>
      </div>
    </div>
  );
};
