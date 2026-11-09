import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { MAGITEK_AUGMENTS, CRAFTING_RECIPES } from '../game/constants';
import {
  Cpu,
  Zap,
  Shield,
  Eye,
  Radio,
  Plus,
  Trash2,
  Wrench,
  Sparkles,
  Layers,
  Activity,
  Flame,
} from 'lucide-react';

export const MagitekLabView: React.FC = () => {
  const {
    tamedDinos,
    resources,
    equipAugment,
    unequipAugment,
    craftItem,
    inventory,
  } = useGame();

  const [selectedDinoId, setSelectedDinoId] = useState<string>(
    tamedDinos[0]?.instanceId || ''
  );
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const selectedDino = tamedDinos.find((d) => d.instanceId === selectedDinoId) || tamedDinos[0];

  const handleInstall = (augmentId: string) => {
    if (!selectedDino) return;
    const success = equipAugment(selectedDino.instanceId, augmentId);
    if (success) {
      setFeedbackMsg({ text: 'Magitek cybernetic augment synthesized and installed successfully!' });
    } else {
      setFeedbackMsg({
        text: 'Insufficient Magitek Cores or augment already equipped in this slot.',
        error: true,
      });
    }
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleDismantle = (augmentId: string) => {
    if (!selectedDino) return;
    const success = unequipAugment(selectedDino.instanceId, augmentId);
    if (success) {
      setFeedbackMsg({ text: 'Augment removed. Salvaged 50% of Magitek Cores.' });
    }
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleCraftMagitek = (recipeId: string) => {
    const success = craftItem(recipeId);
    if (success) {
      setFeedbackMsg({ text: 'High-tech Magitek equipment synthesized!' });
    } else {
      setFeedbackMsg({ text: 'Missing required prehistoric resources or Magitek cores.', error: true });
    }
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const magitekRecipes = CRAFTING_RECIPES.filter((r) => r.category === 'magitek');

  const getSlotIcon = (slot: string) => {
    switch (slot) {
      case 'weapon':
        return <Zap className="w-4 h-4 text-rose-400" />;
      case 'carapace':
        return <Shield className="w-4 h-4 text-cyan-400" />;
      case 'reactor':
        return <Activity className="w-4 h-4 text-amber-400" />;
      case 'neural':
        return <Eye className="w-4 h-4 text-purple-400" />;
      default:
        return <Cpu className="w-4 h-4 text-stone-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Magitek Facility Header */}
      <div className="relative overflow-hidden rounded-xl border border-stone-800 bg-gradient-to-r from-stone-950 via-cyan-950/20 to-purple-950/20 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <span className="text-xs uppercase tracking-widest text-cyan-400 font-mono">
                Ancient Tech Division · Sub-Biosphere Lab
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-100">
              Magitek Synthesis Facility
            </h1>
            <p className="text-sm text-stone-400 max-w-2xl">
              Harness zero-point energy and cybernetic relics left by prehistoric precursors. Graft plasma talons,
              kinetic carapaces, and neural uplinks onto your tamed dinosaur units.
            </p>
          </div>

          {/* Resources Summary */}
          <div className="flex items-center gap-4 bg-stone-900/80 border border-stone-800 rounded-lg p-3">
            <div className="text-left pr-3 border-r border-stone-800">
              <span className="text-[10px] uppercase text-stone-400 block font-mono">Magitek Cores</span>
              <span className="text-xl font-bold font-mono text-cyan-300">
                {resources.magitekCores || 0}
              </span>
            </div>
            <div className="text-left">
              <span className="text-[10px] uppercase text-stone-400 block font-mono">Titanite Ore</span>
              <span className="text-xl font-bold font-mono text-purple-300">
                {resources.titanite || 0}
              </span>
            </div>
          </div>
        </div>

        {feedbackMsg && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs font-mono border ${
              feedbackMsg.error
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
            }`}
          >
            {feedbackMsg.text}
          </div>
        )}
      </div>

      {/* Main Augmentation Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dino Selection & Current Augmented Loadout */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-stone-400 uppercase font-mono px-1">
            <span>Select Dinosaur Specimen</span>
            <span>Stable Roster ({tamedDinos.length})</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {tamedDinos.map((dino) => {
              const isSelected = selectedDino?.instanceId === dino.instanceId;
              const augmentCount = (dino.equippedAugments || []).length;
              return (
                <div
                  key={dino.instanceId}
                  onClick={() => setSelectedDinoId(dino.instanceId)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-stone-900 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/20'
                      : 'bg-stone-950/70 border-stone-800 hover:border-stone-700 hover:bg-stone-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-stone-200 text-sm">{dino.customName}</h3>
                      <p className="text-xs text-stone-400">
                        Lv {dino.level} · {dino.speciesId}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-mono text-cyan-400">
                        {augmentCount} / 4 Slots
                      </span>
                      <div className="text-[11px] text-stone-400 mt-0.5">
                        ATK {dino.attack} · DEF {dino.defense} · SPD {dino.speed}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Dino Augment Hardpoints */}
          {selectedDino && (
            <div className="rounded-xl border border-stone-800 bg-stone-950/80 p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <div>
                  <span className="text-xs text-cyan-400 font-mono uppercase">Augment Matrix</span>
                  <h3 className="text-base font-bold text-stone-100">{selectedDino.customName}</h3>
                </div>
                <div className="text-xs font-mono text-stone-400">
                  HP {selectedDino.maxHp}
                </div>
              </div>

              {/* Installed cybernetic modules */}
              <div className="space-y-2">
                <span className="text-xs text-stone-400 font-mono uppercase block">Installed Hardware</span>
                {(!selectedDino.equippedAugments || selectedDino.equippedAugments.length === 0) ? (
                  <div className="p-4 rounded-lg border border-dashed border-stone-800 text-center text-xs text-stone-400">
                    No Magitek augments currently grafted. Choose an ancient cyber-relic from the catalog.
                  </div>
                ) : (
                  selectedDino.equippedAugments.map((augId) => {
                    const aug = MAGITEK_AUGMENTS.find((a) => a.id === augId);
                    if (!aug) return null;
                    return (
                      <div
                        key={aug.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-cyan-900/40 bg-cyan-950/20"
                      >
                        <div className="flex items-center gap-2.5">
                          {getSlotIcon(aug.slot)}
                          <div>
                            <span className="text-xs font-semibold text-stone-200 block">{aug.name}</span>
                            <span className="text-[11px] text-stone-400">
                              Slot: <span className="uppercase font-mono text-cyan-400">{aug.slot}</span>
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDismantle(aug.id)}
                          className="flex items-center gap-1 text-[11px] font-mono text-rose-400 hover:text-rose-300 p-1.5 rounded hover:bg-rose-500/10 cursor-pointer"
                          title="Dismantle augment & reclaim 50% cores"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Dismantle</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Magitek Augment Catalog & Plasma Crafting */}
        <div className="lg:col-span-7 space-y-6">
          {/* Cybernetic Augments Available for Installation */}
          <div className="rounded-xl border border-stone-800 bg-stone-950/80 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <span className="text-xs text-cyan-400 font-mono uppercase">Ancient Synthesis</span>
                <h2 className="text-lg font-bold text-stone-100">Cybernetic Augmentation Blueprint Catalog</h2>
              </div>
              <span className="text-xs font-mono text-stone-400">
                {MAGITEK_AUGMENTS.length} Relic Blueprints
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MAGITEK_AUGMENTS.map((augment) => {
                const isEquipped = (selectedDino?.equippedAugments || []).includes(augment.id);
                const canAffordCores = (resources.magitekCores || 0) >= augment.magitekCost;

                return (
                  <div
                    key={augment.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                      isEquipped
                        ? 'bg-cyan-950/20 border-cyan-500/40'
                        : 'bg-stone-900/50 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getSlotIcon(augment.slot)}
                          <h4 className="text-xs font-bold text-stone-100">{augment.name}</h4>
                        </div>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-stone-700 bg-stone-800 text-stone-300">
                          {augment.slot}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-400 leading-snug">{augment.description}</p>
                    </div>

                    {/* Stat Boosts and Cost */}
                    <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                        {augment.statBonus.attack && <span>+{augment.statBonus.attack} ATK</span>}
                        {augment.statBonus.defense && <span>+{augment.statBonus.defense} DEF</span>}
                        {augment.statBonus.speed && <span>+{augment.statBonus.speed} SPD</span>}
                        {augment.statBonus.hp && <span>+{augment.statBonus.hp} HP</span>}
                      </div>

                      <div className="flex items-center gap-1 text-xs font-mono text-cyan-300">
                        <Cpu className="w-3.5 h-3.5" />
                        <span>{augment.magitekCost} Cores</span>
                      </div>
                    </div>

                    <button
                      disabled={isEquipped || !canAffordCores || !selectedDino}
                      onClick={() => handleInstall(augment.id)}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isEquipped
                          ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                          : canAffordCores
                          ? 'bg-cyan-600 hover:bg-cyan-500 text-stone-950 shadow-md shadow-cyan-950/40'
                          : 'bg-stone-800/50 text-stone-500 border border-stone-700 cursor-not-allowed'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isEquipped ? 'Installed on Dino' : 'Synthesize & Graft'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* High-Tech Magitek Crafting (Plasma Tranqs & Barriers) */}
          <div className="rounded-xl border border-stone-800 bg-stone-950/80 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <span className="text-xs text-cyan-400 font-mono uppercase">Munitions & Field Deployables</span>
                <h3 className="text-base font-bold text-stone-100">Plasma & Cybernetic Synthesis</h3>
              </div>
              <span className="text-xs font-mono text-stone-400">High-Tech Gear</span>
            </div>

            <div className="space-y-2">
              {magitekRecipes.map((recipe) => {
                const ownedCount = inventory[recipe.id] || 0;
                return (
                  <div
                    key={recipe.id}
                    className="p-3.5 rounded-lg border border-stone-800 bg-stone-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-stone-200">{recipe.name}</span>
                        <span className="text-[11px] font-mono text-cyan-400">
                          (Owned: {ownedCount})
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-400">{recipe.description}</p>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-stone-400 pt-1">
                        <span>Cost:</span>
                        {Object.entries(recipe.cost).map(([k, v]) => (
                          <span key={k} className="text-stone-300">
                            {v} {k}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleCraftMagitek(recipe.id)}
                      className="shrink-0 px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono transition-all cursor-pointer"
                    >
                      Craft x{recipe.quantity}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
