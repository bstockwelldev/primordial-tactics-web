import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { Map, X, CheckCircle2, Clock, Sparkles, Trophy, Shield, Rocket } from 'lucide-react';

export const RoadmapModal: React.FC = () => {
  const { showRoadmapModal, setShowRoadmapModal } = useGame();
  const [roadmapData, setRoadmapData] = useState<any | null>(null);

  useEffect(() => {
    if (showRoadmapModal && !roadmapData) {
      fetch('/api/roadmap')
        .then((res) => res.json())
        .then((data) => setRoadmapData(data))
        .catch((err) => console.warn('Failed to load roadmap:', err));
    }
  }, [showRoadmapModal, roadmapData]);

  if (!showRoadmapModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 bg-stone-950/90 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <Map className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-stone-100">
                MVP Launch & Development Feature Roadmap
              </h3>
              <p className="text-xs text-stone-400">
                Strategic Expansion Phases: From Tactical Prototype to Open-World MMO
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowRoadmapModal(false)}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Roadmap Phases List */}
        <div className="p-6 overflow-y-auto space-y-6">
          {(roadmapData?.phases || []).map((phaseItem: any, idx: number) => {
            const isCurrent = idx === 0;

            return (
              <div
                key={idx}
                className={`p-5 rounded-2xl border transition-all space-y-3 ${
                  isCurrent
                    ? 'bg-gradient-to-br from-stone-900 via-amber-950/30 to-stone-900 border-amber-500/80 shadow-xl ring-1 ring-amber-500/30'
                    : 'bg-stone-950/60 border-stone-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isCurrent ? (
                      <Rocket className="w-5 h-5 text-amber-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-stone-500" />
                    )}
                    <h4 className="font-extrabold text-stone-100 text-base">
                      {phaseItem.phase}
                    </h4>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                      isCurrent
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                        : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    {phaseItem.status}
                  </span>
                </div>

                <ul className="space-y-1.5 pt-1 text-xs text-stone-300">
                  {phaseItem.milestones.map((m: string, mIdx: number) => (
                    <li key={mIdx} className="flex items-start gap-2">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isCurrent ? 'text-amber-400' : 'text-stone-600'
                        }`}
                      />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-950/90 border-t border-stone-800 flex justify-end">
          <button
            onClick={() => setShowRoadmapModal(false)}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow cursor-pointer"
          >
            Close Roadmap
          </button>
        </div>
      </div>
    </div>
  );
};
