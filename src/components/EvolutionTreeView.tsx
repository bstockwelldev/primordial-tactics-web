import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { useGame } from '../context/GameContext';
import { DINOSAUR_SPECIES } from '../game/constants';
import { canEvolveDino } from '../game/rules';
import { DinosaurSpeciesId, EvolutionBranchId } from '../types/game';
import {
  Dna,
  Zap,
  Shield,
  Wind,
  Hammer,
  Droplet,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export const EvolutionTreeView: React.FC = () => {
  const { tamedDinos, resources, evolveCreature } = useGame();
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<DinosaurSpeciesId>('velociraptor');
  const [evolutionFeedback, setEvolutionFeedback] = useState<string | null>(null);

  const species = DINOSAUR_SPECIES[selectedSpeciesId];
  const matchingTamedDinos = tamedDinos.filter((d) => d.speciesId === selectedSpeciesId);

  const getSpeciesIcon = (id: DinosaurSpeciesId) => {
    switch (id) {
      case 'velociraptor':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'triceratops':
        return <Shield className="w-4 h-4 text-emerald-400" />;
      case 'pteranodon':
        return <Wind className="w-4 h-4 text-cyan-400" />;
      case 'ankylosaurus':
        return <Hammer className="w-4 h-4 text-blue-400" />;
      case 'dilophosaurus':
        return <Droplet className="w-4 h-4 text-purple-400" />;
    }
  };

  const handleEvolve = (dinoInstanceId: string, branchId: EvolutionBranchId, branchName: string) => {
    const success = evolveCreature(dinoInstanceId, branchId);
    if (success) {
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.5 },
      });
      setEvolutionFeedback(`Evolution Complete! Creature mutated into ${branchName}!`);
      setTimeout(() => setEvolutionFeedback(null), 4000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden border border-purple-900/40 bg-gradient-to-r from-stone-900 via-purple-950/40 to-stone-900 p-6 sm:p-8 shadow-2xl">
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold">
            <Dna className="w-3.5 h-3.5" />
            <span>Amber Research & Genetic Mutations</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight">
            Dinosaur Evolutionary Skill Tree
          </h2>
          <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
            Distill prehistoric amber to mutate your domesticated species into specialized tactical combat roles. Each of the 5 base species features dual evolutionary branches granting monumental stat multipliers and game-changing combat abilities.
          </p>
        </div>
      </div>

      {evolutionFeedback && (
        <div className="p-4 bg-purple-950 border border-purple-500/60 rounded-xl text-purple-200 text-sm flex items-center gap-2 shadow-xl animate-fade-in">
          <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
          <span className="font-semibold">{evolutionFeedback}</span>
        </div>
      )}

      {/* 5 Species Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
        {Object.values(DINOSAUR_SPECIES).map((sp) => {
          const isSelected = selectedSpeciesId === sp.id;
          return (
            <button
              key={sp.id}
              onClick={() => setSelectedSpeciesId(sp.id as DinosaurSpeciesId)}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 cursor-pointer shadow ${
                isSelected
                  ? 'bg-purple-950/80 border-purple-500 ring-2 ring-purple-500/30'
                  : 'bg-stone-900/80 border-stone-800 hover:border-stone-700'
              }`}
            >
              <div className="flex items-center justify-between">
                {sp.imageUrl ? (
                  <img
                    src={sp.imageUrl}
                    alt={sp.name}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-lg object-cover border border-purple-500/50"
                  />
                ) : (
                  <div className="p-1.5 rounded-lg bg-stone-800">
                    {getSpeciesIcon(sp.id as DinosaurSpeciesId)}
                  </div>
                )}
                <span className="text-[10px] uppercase font-bold text-stone-400 px-1.5 py-0.5 rounded bg-stone-950">
                  {sp.unitClass}
                </span>
              </div>
              <div>
                <h4 className="font-bold text-stone-100 text-xs sm:text-sm">{sp.name}</h4>
                <span className="text-[11px] text-stone-400 capitalize">{sp.diet}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Evolution Node Visualizer */}
      <div className="bg-stone-900/90 rounded-2xl p-6 border border-stone-800/80 shadow-2xl space-y-6">
        {/* Base Spec Overview */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-800">
          <div className="flex items-center gap-4">
            {species.imageUrl && (
              <img
                src={species.imageUrl}
                alt={species.name}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-2xl object-cover border-2 border-purple-500 shadow-xl shadow-purple-950/60 shrink-0"
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-stone-100">{species.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/50 font-bold uppercase">
                  Base Species Tier
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-1 max-w-xl leading-relaxed">
                {species.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs bg-stone-950 px-4 py-2 rounded-xl border border-stone-800">
            <div>
              <span className="text-stone-400">Base HP: </span>
              <span className="font-bold text-emerald-400">{species.baseHp}</span>
            </div>
            <div>
              <span className="text-stone-400">Attack: </span>
              <span className="font-bold text-red-400">{species.baseAttack}</span>
            </div>
            <div>
              <span className="text-stone-400">Defense: </span>
              <span className="font-bold text-blue-400">{species.baseDefense}</span>
            </div>
            <div>
              <span className="text-stone-400">Move Speed: </span>
              <span className="font-bold text-amber-400">{species.baseSpeed} tiles</span>
            </div>
          </div>
        </div>

        {/* Innate Abilities */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-stone-300 uppercase tracking-wider">
            Innate Species Abilities
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {species.innateAbilities.map((ab) => (
              <div
                key={ab.id}
                className="p-3 rounded-xl bg-stone-950/70 border border-stone-800/80 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-stone-200 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{ab.name}</span>
                  </h5>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-amber-300 font-bold">
                    {ab.apCost} AP
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed">{ab.description}</p>
                <div className="flex items-center gap-3 text-[10px] text-stone-500 pt-1">
                  <span>Range: {ab.range} tile(s)</span>
                  <span>•</span>
                  <span>Target: {ab.targetType}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evolution Branches */}
        <div className="space-y-3 pt-4 border-t border-stone-800">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span>Available Evolution Branches</span>
            </h4>
            <span className="text-xs text-stone-400">Select branch to evolve your tamed dino</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {species.evolutionBranches.map((branch) => {
              return (
                <div
                  key={branch.id}
                  className="p-5 rounded-xl bg-gradient-to-br from-stone-950 via-stone-900 to-purple-950/30 border border-purple-900/50 hover:border-purple-600/70 transition-all space-y-4 shadow-xl"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-stone-100 text-base">{branch.name}</h4>
                      <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">
                        {branch.description}
                      </p>
                    </div>
                  </div>

                  {/* Stat Multipliers */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs py-2 px-3 bg-stone-900 rounded-lg border border-purple-900/40">
                    <div>
                      <div className="text-[10px] text-stone-400">HP Multiplier</div>
                      <div className="font-bold text-emerald-400">
                        +{Math.round((branch.statMultipliers.hp - 1) * 100)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-stone-400">Attack</div>
                      <div className="font-bold text-red-400">
                        +{Math.round((branch.statMultipliers.attack - 1) * 100)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-stone-400">Defense</div>
                      <div className="font-bold text-blue-400">
                        +{Math.round((branch.statMultipliers.defense - 1) * 100)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-stone-400">Speed</div>
                      <div className="font-bold text-amber-400">
                        +{Math.round((branch.statMultipliers.speed - 1) * 100)}%
                      </div>
                    </div>
                  </div>

                  {/* Bonus Evolved Ability */}
                  <div className="p-3 rounded-lg bg-purple-950/50 border border-purple-800/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-purple-300">
                        ★ Bonus Ability: {branch.bonusAbility.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900 text-purple-200 font-bold">
                        {branch.bonusAbility.apCost} AP
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-300 leading-relaxed">
                      {branch.bonusAbility.description}
                    </p>
                  </div>

                  {/* Requirement & Evolve Buttons */}
                  <div className="pt-2 border-t border-stone-800 space-y-2">
                    <div className="flex items-center justify-between text-xs text-stone-400">
                      <span>Requirement: Level {branch.requiredLevel}</span>
                      <span
                        className={
                          resources.amber >= branch.requiredAmber
                            ? 'text-amber-400 font-bold'
                            : 'text-red-400 font-semibold'
                        }
                      >
                        Cost: {branch.requiredAmber} Amber (You have {resources.amber})
                      </span>
                    </div>

                    {matchingTamedDinos.length === 0 ? (
                      <div className="text-center py-2 text-xs text-stone-500 italic">
                        You do not own a tamed {species.name} yet. Tame one in the Expeditions tab!
                      </div>
                    ) : (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[11px] text-stone-400 block font-medium">
                          Select Companion to Mutate:
                        </span>
                        {matchingTamedDinos.map((dino) => {
                          const evalCheck = canEvolveDino(dino, branch, resources.amber);

                          return (
                            <div
                              key={dino.instanceId}
                              className="flex items-center justify-between p-2 rounded-lg bg-stone-950 border border-stone-800"
                            >
                              <div className="text-xs">
                                <span className="font-bold text-stone-200">{dino.customName}</span>
                                <span className="text-stone-400 ml-2">Lvl {dino.level}</span>
                                {dino.evolution && (
                                  <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-purple-900 text-purple-300 uppercase">
                                    Already Evolved
                                  </span>
                                )}
                              </div>

                              <button
                                onClick={() => handleEvolve(dino.instanceId, branch.id, branch.name)}
                                disabled={!evalCheck.canEvolve}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shadow ${
                                  evalCheck.canEvolve
                                    ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
                                    : 'bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700'
                                }`}
                                title={evalCheck.reason}
                              >
                                {dino.evolution ? 'Max Tier' : 'Evolve Mutation'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
