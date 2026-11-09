import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { CRAFTING_RECIPES, UNIT_PORTRAITS } from '../game/constants';
import { canAfford } from '../game/rules';
import {
  Home,
  Hammer,
  Feather,
  Wrench,
  Dna,
  Eye,
  Plus,
  Shield,
  Zap,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Package,
  Cpu,
} from 'lucide-react';

export const BaseCampView: React.FC = () => {
  const {
    resources,
    inventory,
    baseBuildings,
    upgradeBuilding,
    craftItem,
    tamedDinos,
    setActiveScreen,
  } = useGame();

  const [craftingFeedback, setCraftingFeedback] = useState<string | null>(null);

  const getBuildingIcon = (icon: string) => {
    switch (icon) {
      case 'Home':
        return <Home className="w-5 h-5 text-amber-400" />;
      case 'Feather':
        return <Feather className="w-5 h-5 text-emerald-400" />;
      case 'Wrench':
        return <Wrench className="w-5 h-5 text-cyan-400" />;
      case 'Dna':
        return <Dna className="w-5 h-5 text-purple-400" />;
      case 'Eye':
        return <Eye className="w-5 h-5 text-orange-400" />;
      case 'Cpu':
        return <Cpu className="w-5 h-5 text-cyan-400" />;
      default:
        return <Home className="w-5 h-5 text-amber-400" />;
    }
  };

  const handleCraft = (recipeId: string, recipeName: string) => {
    const success = craftItem(recipeId);
    if (success) {
      setCraftingFeedback(`Successfully crafted ${recipeName}!`);
      setTimeout(() => setCraftingFeedback(null), 3000);
    }
  };

  const handleUpgrade = (buildingId: string, buildingName: string) => {
    const success = upgradeBuilding(buildingId);
    if (success) {
      setCraftingFeedback(`Upgraded ${buildingName}!`);
      setTimeout(() => setCraftingFeedback(null), 3000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Banner & Camp Header */}
      <div className="relative rounded-2xl overflow-hidden border border-amber-900/40 bg-gradient-to-r from-stone-900 via-amber-950/40 to-stone-900 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <Home className="w-3.5 h-3.5" />
            <span>Prehistoric Sanctuary Tier 1 Enclave</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight">
            Survivor Enclave & Base Operations
          </h2>
          <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
            Reinforce your prehistoric settlement, forge tranquilizer darts in the smithy, brew prime kibbles, and maintain your tamed dinosaur strike squad.
          </p>
        </div>

        {/* Quick status bar */}
        <div className="mt-6 pt-4 border-t border-stone-800/80 flex flex-wrap gap-4 text-xs">
          <div className="bg-stone-900/80 px-3 py-1.5 rounded-lg border border-stone-800">
            <span className="text-stone-400">Tamed Squad Size: </span>
            <span className="text-amber-400 font-bold">{tamedDinos.length} Dinosaurs</span>
          </div>
          <div className="bg-stone-900/80 px-3 py-1.5 rounded-lg border border-stone-800">
            <span className="text-stone-400">Crafting Bench: </span>
            <span className="text-emerald-400 font-bold">Operational</span>
          </div>
          <div className="bg-stone-900/80 px-3 py-1.5 rounded-lg border border-stone-800">
            <span className="text-stone-400">Gene Incubator: </span>
            <span className="text-cyan-400 font-bold">Online</span>
          </div>
        </div>
      </div>

      {craftingFeedback && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-sm flex items-center gap-2 shadow-lg animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{craftingFeedback}</span>
        </div>
      )}

      {/* Main Grid: Base Buildings & Crafting Bench */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Buildings Column (2 cols wide on large) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hammer className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-stone-100">Base Enclave Structures</h3>
            </div>
            <span className="text-xs text-stone-400">Upgrade buildings to unlock advanced tiers</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {baseBuildings.map((building) => {
              const affordable = canAfford(building.costNextLevel, resources);
              const isMax = building.level >= building.maxLevel;

              return (
                <div
                  key={building.id}
                  className="bg-stone-900/80 rounded-xl p-5 border border-stone-800/80 hover:border-amber-700/50 transition-all flex flex-col justify-between space-y-4 shadow-lg"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-stone-800/90 border border-stone-700">
                          {getBuildingIcon(building.icon)}
                        </div>
                        <div>
                          <h4 className="font-bold text-stone-200 text-sm sm:text-base">
                            {building.name}
                          </h4>
                          <span className="text-xs text-amber-400 font-semibold">
                            Level {building.level} / {building.maxLevel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-stone-400 leading-relaxed">
                      {building.description}
                    </p>

                    {/* Perks List */}
                    <div className="space-y-1 pt-1">
                      {building.perks.map((perk, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-stone-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{perk}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Upgrade Footer */}
                  <div className="pt-3 border-t border-stone-800/80 flex items-center justify-between">
                    <div className="text-[11px] text-stone-400">
                      {isMax ? (
                        <span className="text-emerald-400 font-bold">Max Level Reached</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          <span className="font-medium text-stone-300">Cost:</span>
                          {Object.entries(building.costNextLevel).map(([res, amount]) => (
                            <span
                              key={res}
                              className={`px-1.5 py-0.5 rounded bg-stone-800 ${
                                (resources[res as keyof typeof resources] || 0) >= (amount || 0)
                                  ? 'text-stone-300'
                                  : 'text-red-400 font-semibold'
                              }`}
                            >
                              {amount} {res}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {building.id === 'magitek_lab' && (
                        <button
                          onClick={() => setActiveScreen('magitek')}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 cursor-pointer transition-all"
                        >
                          Access Lab
                        </button>
                      )}
                      {building.id === 'incubator' && (
                        <button
                          onClick={() => setActiveScreen('evolution')}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 cursor-pointer transition-all"
                        >
                          Gene Tree
                        </button>
                      )}
                      {!isMax && (
                        <button
                          onClick={() => handleUpgrade(building.id, building.name)}
                          disabled={!affordable}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow ${
                            affordable
                              ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                              : 'bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700'
                          }`}
                        >
                          Upgrade
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Crafting & Inventory Column */}
        <div className="space-y-6">
          {/* Crafting Bench */}
          <div className="bg-stone-900/90 rounded-2xl p-5 border border-stone-800/80 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-stone-100 text-base">Primal Smithy</h3>
              </div>
              <span className="text-xs text-stone-400">Prehistoric Crafting</span>
            </div>

            <div className="space-y-3">
              {CRAFTING_RECIPES.map((recipe) => {
                const affordable = canAfford(recipe.cost, resources);

                return (
                  <div
                    key={recipe.id}
                    className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800/80 space-y-2 hover:border-cyan-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-stone-200 text-sm flex items-center gap-1.5">
                          <span>{recipe.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-cyan-300 uppercase font-semibold">
                            +{recipe.quantity}
                          </span>
                        </h4>
                        <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">
                          {recipe.description}
                        </p>
                      </div>

                      <button
                        onClick={() => handleCraft(recipe.id, recipe.name)}
                        disabled={!affordable}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all ${
                          affordable
                            ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/40 shadow cursor-pointer'
                            : 'bg-stone-800 text-stone-500 border border-stone-700/60 cursor-not-allowed'
                        }`}
                      >
                        Craft
                      </button>
                    </div>

                    {/* Cost pills */}
                    <div className="flex flex-wrap gap-1.5 text-[11px] pt-1">
                      {Object.entries(recipe.cost).map(([res, amt]) => {
                        const hasEnough = (resources[res as keyof typeof resources] || 0) >= (amt || 0);
                        return (
                          <span
                            key={res}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              hasEnough
                                ? 'bg-stone-800/80 text-stone-300'
                                : 'bg-red-950/80 text-red-300 border border-red-800/50'
                            }`}
                          >
                            {amt} {res}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Inventory Box */}
          <div className="bg-stone-900/90 rounded-2xl p-5 border border-stone-800/80 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-stone-200 text-sm">Survivor Gear & Supplies</h4>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-stone-950/70 p-2.5 rounded-xl border border-stone-800 flex items-center justify-between">
                <span className="text-stone-400">Tranq Darts:</span>
                <span className="font-bold text-cyan-300">{inventory.tranq_dart || 0}</span>
              </div>
              <div className="bg-stone-950/70 p-2.5 rounded-xl border border-stone-800 flex items-center justify-between">
                <span className="text-stone-400">Plasma Tranqs:</span>
                <span className="font-bold text-cyan-400 font-mono">{inventory.magitek_plasma_dart || 0}</span>
              </div>
              <div className="bg-stone-950/70 p-2.5 rounded-xl border border-stone-800 flex items-center justify-between">
                <span className="text-stone-400">Prime Kibble:</span>
                <span className="font-bold text-amber-300">{inventory.primal_kibble || 0}</span>
              </div>
              <div className="bg-stone-950/70 p-2.5 rounded-xl border border-stone-800 flex items-center justify-between">
                <span className="text-stone-400">Chitin Armor:</span>
                <span className="font-bold text-emerald-300">{inventory.chitin_armor || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tamed Dinosaur Squad Showcase */}
      <div className="space-y-4 pt-4 border-t border-stone-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-stone-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>Active Dinosaur Stable</span>
            </h3>
            <p className="text-xs text-stone-400">
              Creatures tamed in the wild and ready for tactical arena combat.
            </p>
          </div>

          <button
            onClick={() => setActiveScreen('taming')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tame New Dinos</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tamedDinos.map((dino) => {
            const portrait = dino.imageUrl || UNIT_PORTRAITS[dino.speciesId] || UNIT_PORTRAITS.velociraptor;

            return (
              <div
                key={dino.instanceId}
                className="bg-stone-900/90 rounded-xl p-4 border border-stone-800/80 hover:border-amber-600/50 transition-all space-y-3 shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={portrait}
                      alt={dino.customName}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-xl object-cover border-2 border-amber-600/60 shadow-md shrink-0"
                    />
                    <div>
                      <h4 className="font-bold text-stone-100 text-base">{dino.customName}</h4>
                      <span className="text-xs text-amber-400 font-semibold capitalize">
                        {dino.speciesId} • Level {dino.level}
                      </span>
                    </div>
                  </div>
                  {dino.evolution && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 font-bold uppercase shrink-0">
                      Evolved
                    </span>
                  )}
                </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs py-2 bg-stone-950/60 rounded-lg border border-stone-800/50">
                <div>
                  <div className="text-[10px] text-stone-400">HP</div>
                  <div className="font-bold text-emerald-400">{dino.maxHp}</div>
                </div>
                <div>
                  <div className="text-[10px] text-stone-400">Attack</div>
                  <div className="font-bold text-red-400">{dino.attack}</div>
                </div>
                <div>
                  <div className="text-[10px] text-stone-400">Defense</div>
                  <div className="font-bold text-blue-400">{dino.defense}</div>
                </div>
                <div>
                  <div className="text-[10px] text-stone-400">Speed</div>
                  <div className="font-bold text-amber-400">{dino.speed}</div>
                </div>
              </div>

              {/* Equipped Abilities */}
              <div className="space-y-1">
                <span className="text-[11px] text-stone-400 font-medium">Equipped Abilities:</span>
                <div className="flex flex-wrap gap-1">
                  {dino.equippedAbilities.map((abId) => (
                    <span
                      key={abId}
                      className="text-[10px] px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700 capitalize font-medium"
                    >
                      {abId.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={() => setActiveScreen('evolution')}
                  className="w-full py-1.5 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-600/30 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Dna className="w-3.5 h-3.5" />
                  <span>Inspect Gene Tree</span>
                </button>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
};
