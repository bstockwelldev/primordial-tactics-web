import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { useGame } from '../context/GameContext';
import { PREHISTORIC_BIOMES, DINOSAUR_SPECIES, UNIT_PORTRAITS } from '../game/constants';
import { calculateTamingChance, isTamingViable } from '../game/rules';
import { DinosaurSpeciesId } from '../types/game';
import {
  Compass,
  Crosshair,
  ShieldAlert,
  Sparkles,
  Heart,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Flame,
  Feather,
} from 'lucide-react';

interface WildEncounter {
  speciesId: DinosaurSpeciesId;
  name: string;
  level: number;
  currentHp: number;
  maxHp: number;
  currentTorpor: number;
  maxTorpor: number;
  diet: string;
  temperament: 'Aggressive' | 'Territorial' | 'Skittish';
  tamed: boolean;
}

export const TamingExpeditionView: React.FC = () => {
  const {
    inventory,
    addResources,
    tameCreature,
    setActiveScreen,
    craftItem,
  } = useGame();

  const [selectedBiome, setSelectedBiome] = useState(PREHISTORIC_BIOMES[0]);
  const [isExpeditionActive, setIsExpeditionActive] = useState(false);
  const [wildDino, setWildDino] = useState<WildEncounter | null>(null);
  const [expeditionLogs, setExpeditionLogs] = useState<string[]>([]);
  const [selectedBait, setSelectedBait] = useState<'none' | 'meat' | 'kibble'>('none');
  const [customDinoName, setCustomDinoName] = useState('');
  const [tamingOutcome, setTamingOutcome] = useState<{ success: boolean; message: string } | null>(null);

  // Starts an expedition into the chosen biome
  const handleLaunchExpedition = () => {
    setIsExpeditionActive(true);
    setTamingOutcome(null);

    // Pick a wild dino species from the biome
    const randomSpeciesId = selectedBiome.dinoSpecies[
      Math.floor(Math.random() * selectedBiome.dinoSpecies.length)
    ] as DinosaurSpeciesId;

    const spec = DINOSAUR_SPECIES[randomSpeciesId];
    const encounter: WildEncounter = {
      speciesId: randomSpeciesId,
      name: spec.name,
      level: Math.floor(Math.random() * 5) + 1,
      currentHp: spec.baseHp,
      maxHp: spec.baseHp,
      currentTorpor: 0,
      maxTorpor: spec.baseTorporMax,
      diet: spec.diet,
      temperament: spec.diet === 'Carnivore' ? 'Aggressive' : 'Territorial',
      tamed: false,
    };

    setWildDino(encounter);
    setCustomDinoName(`Wild ${spec.name}`);

    // Gather some baseline prehistoric resources
    const gathered = {
      wood: Math.floor(Math.random() * 30) + 15,
      flint: Math.floor(Math.random() * 20) + 10,
      fiber: Math.floor(Math.random() * 25) + 10,
      amber: Math.floor(Math.random() * 20) + 5,
      primalMeat: Math.floor(Math.random() * 15) + 5,
    };
    addResources(gathered);

    setExpeditionLogs([
      `Entered ${selectedBiome.name}. Danger Rating: Level ${selectedBiome.dangerLevel}.`,
      `Foraged: +${gathered.wood} Wood, +${gathered.flint} Flint, +${gathered.amber} Amber, +${gathered.primalMeat} Meat.`,
      `TRACKED BEAST: A wild Level ${encounter.level} ${encounter.name} spotted among prehistoric ferns!`,
    ]);
  };

  // Shoots a tranq dart to build torpor
  const handleFireTranqDart = () => {
    if (!wildDino) return;
    if ((inventory.tranq_dart || 0) <= 0) {
      setExpeditionLogs((prev) => [
        ...prev,
        'Out of Tranquilizer Darts! Craft more in the Base Camp Smithy.',
      ]);
      return;
    }

    // Deduct dart
    inventory.tranq_dart = (inventory.tranq_dart || 1) - 1;

    const torporGain = Math.floor(Math.random() * 20) + 35; // 35 - 55 torpor
    const newTorpor = Math.min(wildDino.maxTorpor, wildDino.currentTorpor + torporGain);

    setWildDino({
      ...wildDino,
      currentTorpor: newTorpor,
    });

    const isViable = isTamingViable(newTorpor, wildDino.maxTorpor);

    setExpeditionLogs((prev) => [
      ...prev,
      `🎯 Tranq dart struck ${wildDino.name}! Torpor +${torporGain} (${newTorpor}/${wildDino.maxTorpor}).`,
      isViable
        ? `💤 ${wildDino.name} is stumbling in drowsiness! Ready to tame with bait!`
        : `⚠️ ${wildDino.name} is agitated! More torpor needed before attempting taming.`,
    ]);
  };

  // Uses bait
  const handleOfferBait = (baitType: 'meat' | 'kibble') => {
    if (!wildDino) return;

    if (baitType === 'kibble') {
      if ((inventory.primal_kibble || 0) <= 0) {
        setExpeditionLogs((prev) => [...prev, 'No Prime Kibble in inventory!']);
        return;
      }
      inventory.primal_kibble = (inventory.primal_kibble || 1) - 1;
      setSelectedBait('kibble');
      setExpeditionLogs((prev) => [
        ...prev,
        `🍖 Fed Prime Kibble to ${wildDino.name}. Huge taming affinity boost (+50% success)!`,
      ]);
    } else {
      setSelectedBait('meat');
      setExpeditionLogs((prev) => [
        ...prev,
        `🥩 Offered fresh primal meat to ${wildDino.name}. Taming affinity increased (+25%).`,
      ]);
    }
  };

  // Attempts final taming bond
  const handleAttemptTaming = () => {
    if (!wildDino) return;

    const chance = calculateTamingChance(wildDino.currentTorpor, wildDino.maxTorpor, selectedBait);
    const roll = Math.random() * 100;

    if (roll <= chance) {
      // Success!
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });

      tameCreature(wildDino.speciesId, customDinoName || `Tamed ${wildDino.name}`);
      setWildDino({ ...wildDino, tamed: true });
      setTamingOutcome({
        success: true,
        message: `Taming Successful! ${customDinoName || wildDino.name} has joined your survivor squad and entered the Base Dino Pen!`,
      });
      setExpeditionLogs((prev) => [
        ...prev,
        `🎉 TRIUMPH! ${wildDino.name} accepted your bond and is now a tamed creature!`,
      ]);
    } else {
      // Failed attempt
      setTamingOutcome({
        success: false,
        message: `Taming Failed! The beast snapped awake and fled into the primeval trees.`,
      });
      setExpeditionLogs((prev) => [
        ...prev,
        `❌ Taming failed (Roll: ${Math.round(roll)}% vs Required: <=${chance}%). The beast broke free.`,
      ]);
      setWildDino(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden border border-emerald-900/40 bg-gradient-to-r from-stone-900 via-emerald-950/40 to-stone-900 p-6 sm:p-8 shadow-2xl">
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
            <Compass className="w-3.5 h-3.5" />
            <span>High-Stakes Prehistoric Exploration</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight">
            Biome Expeditions & Dinosaur Taming
          </h2>
          <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
            Venture outside the safety of your base encampment into dangerous prehistoric biomes. Track wild beasts, build torpor with tranquilizer darts, and offer prime kibble to domesticate powerful creature units.
          </p>
        </div>
      </div>

      {/* Biome Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-stone-100 flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400" />
            <span>Choose Exploration Biome</span>
          </h3>
          <span className="text-xs text-stone-400">Different species dwell in each habitat</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PREHISTORIC_BIOMES.map((biome) => {
            const isSelected = selectedBiome.id === biome.id;
            return (
              <div
                key={biome.id}
                onClick={() => {
                  setSelectedBiome(biome);
                  setIsExpeditionActive(false);
                  setWildDino(null);
                }}
                className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-3 shadow-lg ${
                  isSelected
                    ? 'bg-stone-900 border-amber-500 ring-2 ring-amber-500/30'
                    : 'bg-stone-900/70 border-stone-800 hover:border-stone-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h4 className="font-bold text-stone-100 text-base">{biome.name}</h4>
                  <span className="text-xs px-2 py-0.5 rounded bg-stone-800 text-amber-400 font-semibold">
                    Danger {biome.dangerLevel}
                  </span>
                </div>

                <p className="text-xs text-stone-400 leading-relaxed">{biome.description}</p>

                <div className="space-y-1.5 pt-2 border-t border-stone-800/80 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">Native Species:</span>
                    <span className="font-semibold text-stone-200 capitalize">
                      {biome.dinoSpecies.join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">Rich Resources:</span>
                    <span className="font-semibold text-emerald-400 capitalize">
                      {biome.primaryResources.join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expedition Action Button */}
      {!isExpeditionActive && (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleLaunchExpedition}
            className="px-8 py-3.5 rounded-xl font-extrabold text-base bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-xl shadow-amber-950/50 flex items-center gap-3 transition-transform hover:scale-105 cursor-pointer"
          >
            <Compass className="w-5 h-5" />
            <span>Launch Expedition into {selectedBiome.name}</span>
          </button>
        </div>
      )}

      {/* Active Expedition & Taming Interface */}
      {isExpeditionActive && wildDino && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Wild Dinosaur Encounter Card */}
          <div className="lg:col-span-2 bg-stone-900/90 rounded-2xl p-6 border border-amber-900/40 shadow-2xl space-y-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <img
                  src={UNIT_PORTRAITS[wildDino.speciesId] || UNIT_PORTRAITS.velociraptor}
                  alt={wildDino.name}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-amber-500 shadow-xl shadow-amber-950/60 shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black text-stone-100">{wildDino.name}</h3>
                    <span className="text-xs px-2.5 py-1 rounded bg-stone-800 text-amber-400 font-bold border border-stone-700">
                      Level {wildDino.level}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-stone-400 mt-1 flex-wrap">
                    <span>Diet: {wildDino.diet}</span>
                    <span>•</span>
                    <span>Temperament: {wildDino.temperament}</span>
                    <span>•</span>
                    <span className="capitalize">Species: {wildDino.speciesId}</span>
                  </div>
                </div>
              </div>

              {wildDino.tamed && (
                <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500 text-xs font-bold uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>TAMED COMPANION</span>
                </span>
              )}
            </div>

            {/* Gauges: HP and Torpor */}
            <div className="space-y-4 bg-stone-950/80 p-5 rounded-xl border border-stone-800">
              {/* HP Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5" /> Vitality HP
                  </span>
                  <span className="text-stone-300">
                    {wildDino.currentHp} / {wildDino.maxHp}
                  </span>
                </div>
                <div className="w-full h-3 bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
                    style={{ width: `${(wildDino.currentHp / wildDino.maxHp) * 100}%` }}
                  />
                </div>
              </div>

              {/* Torpor Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-purple-400 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5" /> Torpor & Drowsiness
                  </span>
                  <span className="text-stone-300">
                    {wildDino.currentTorpor} / {wildDino.maxTorpor} ({Math.round(
                      (wildDino.currentTorpor / wildDino.maxTorpor) * 100
                    )}
                    %)
                  </span>
                </div>
                <div className="w-full h-3 bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 via-indigo-500 to-cyan-400 transition-all duration-300"
                    style={{ width: `${(wildDino.currentTorpor / wildDino.maxTorpor) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-stone-400 pt-0.5">
                  <span>Threshold for Taming: 80% Torpor</span>
                  <span
                    className={
                      isTamingViable(wildDino.currentTorpor, wildDino.maxTorpor)
                        ? 'text-emerald-400 font-bold'
                        : 'text-amber-400 font-medium'
                    }
                  >
                    {isTamingViable(wildDino.currentTorpor, wildDino.maxTorpor)
                      ? '✓ Ready to Claim'
                      : 'Build More Torpor'}
                  </span>
                </div>
              </div>
            </div>

            {/* Taming Controls */}
            {!wildDino.tamed ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Shoot Tranq Dart */}
                  <button
                    onClick={handleFireTranqDart}
                    className="p-3.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-purple-200 text-xs font-bold flex flex-col items-center justify-center gap-2 transition-all shadow cursor-pointer"
                  >
                    <Crosshair className="w-5 h-5 text-purple-400" />
                    <span>Fire Tranq Dart</span>
                    <span className="text-[10px] text-stone-400">
                      In Bag: {inventory.tranq_dart || 0}
                    </span>
                  </button>

                  {/* Feed Primal Meat */}
                  <button
                    onClick={() => handleOfferBait('meat')}
                    className={`p-3.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-2 transition-all shadow cursor-pointer ${
                      selectedBait === 'meat'
                        ? 'bg-amber-900 border-amber-500 text-amber-200'
                        : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-300'
                    }`}
                  >
                    <Flame className="w-5 h-5 text-red-400" />
                    <span>Offer Primal Meat</span>
                    <span className="text-[10px] text-stone-400">+25% Affinity</span>
                  </button>

                  {/* Feed Prime Kibble */}
                  <button
                    onClick={() => handleOfferBait('kibble')}
                    className={`p-3.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-2 transition-all shadow cursor-pointer ${
                      selectedBait === 'kibble'
                        ? 'bg-amber-900 border-amber-500 text-amber-200'
                        : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-300'
                    }`}
                  >
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span>Feed Prime Kibble</span>
                    <span className="text-[10px] text-stone-400">
                      In Bag: {inventory.primal_kibble || 0} (+50%)
                    </span>
                  </button>
                </div>

                {/* Final Taming Claim Section */}
                <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs text-stone-400">Estimated Taming Success Rate:</span>
                      <div className="text-xl font-black text-amber-400">
                        {calculateTamingChance(
                          wildDino.currentTorpor,
                          wildDino.maxTorpor,
                          selectedBait
                        )}
                        %
                      </div>
                    </div>

                    <div className="flex-1 max-w-xs">
                      <label className="text-[11px] text-stone-400 block mb-1">
                        Companion Name:
                      </label>
                      <input
                        type="text"
                        value={customDinoName}
                        onChange={(e) => setCustomDinoName(e.target.value)}
                        placeholder="Give your dinosaur a name"
                        className="w-full px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-stone-200 text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <button
                      onClick={handleAttemptTaming}
                      className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/60 cursor-pointer"
                    >
                      Attempt Taming Bond
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-center space-y-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="font-extrabold text-stone-100 text-lg">
                  {customDinoName || wildDino.name} Tamed!
                </h4>
                <p className="text-xs text-stone-300">
                  This creature is now housed in your Dino Pen and ready for combat training and gene evolution.
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveScreen('evolution')}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-purple-700 hover:bg-purple-600 text-white"
                  >
                    View in Evolution Tree
                  </button>
                  <button
                    onClick={handleLaunchExpedition}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-stone-800 hover:bg-stone-700 text-stone-200"
                  >
                    Track Next Dinosaur
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Expedition Feed & Log */}
          <div className="bg-stone-900/90 rounded-2xl p-5 border border-stone-800/80 shadow-xl flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <h4 className="font-bold text-stone-200 text-sm flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-400" />
                  <span>Expedition Logs</span>
                </h4>
                <span className="text-[11px] text-stone-400">Live Tracker</span>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 text-xs">
                {expeditionLogs.map((log, index) => (
                  <div
                    key={index}
                    className="p-2.5 rounded-lg bg-stone-950/60 border border-stone-800/60 text-stone-300 leading-relaxed"
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-stone-800 flex justify-between gap-2">
              <button
                onClick={() => {
                  setIsExpeditionActive(false);
                  setWildDino(null);
                }}
                className="w-full py-2 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700"
              >
                Return to Enclave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
