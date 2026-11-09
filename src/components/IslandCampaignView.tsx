import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { IslandSector } from '../types/game';
import { CLASS_TACTICAL_DETAILS } from '../game/constants';
import {
  Map,
  Shield,
  Zap,
  Swords,
  ChevronRight,
  Flame,
  CheckCircle2,
  Lock,
  Cpu,
  Compass,
} from 'lucide-react';

const ISLAND_TABS: Array<{
  id: 'primoris' | 'caldera' | 'tempest' | 'magitek_core';
  name: string;
  subtitle: string;
  gradient: string;
  accentBorder: string;
}> = [
  {
    id: 'primoris',
    name: 'Isla Primoris',
    subtitle: 'Verdant Fern Coastline',
    gradient: 'from-emerald-950/80 via-teal-950/50 to-stone-950/90',
    accentBorder: 'border-emerald-500/30 text-emerald-400',
  },
  {
    id: 'caldera',
    name: 'Basalt Caldera',
    subtitle: 'Volcanic Foundry & Mines',
    gradient: 'from-amber-950/80 via-red-950/50 to-stone-950/90',
    accentBorder: 'border-amber-500/30 text-amber-400',
  },
  {
    id: 'tempest',
    name: 'Tempest Spire',
    subtitle: 'Gale Crags & Eyrie',
    gradient: 'from-sky-950/80 via-indigo-950/50 to-stone-950/90',
    accentBorder: 'border-sky-500/30 text-sky-400',
  },
  {
    id: 'magitek_core',
    name: 'Magitek Core',
    subtitle: 'Subterranean Cyber-Sanctuary',
    gradient: 'from-purple-950/80 via-cyan-950/50 to-stone-950/90',
    accentBorder: 'border-cyan-500/30 text-cyan-400',
  },
];

export const IslandCampaignView: React.FC = () => {
  const { campaignSectors, startSectorMission, resources } = useGame();
  const [selectedIsland, setSelectedIsland] = useState<'primoris' | 'caldera' | 'tempest' | 'magitek_core'>('primoris');
  const [selectedSectorId, setSelectedSectorId] = useState<string>('sector_primoris_2');

  const islandSectors = campaignSectors.filter((s) => s.islandId === selectedIsland);
  const totalLiberated = campaignSectors.filter((s) => s.liberated).length;
  const liberationPercentage = Math.round((totalLiberated / campaignSectors.length) * 100);

  const activeSector =
    campaignSectors.find((s) => s.id === selectedSectorId) || islandSectors[0] || campaignSectors[0];

  return (
    <div className="space-y-6">
      {/* Campaign Strategic Header */}
      <div className="relative overflow-hidden rounded-xl border border-stone-800 bg-gradient-to-r from-stone-950 via-stone-900 to-cyan-950/30 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-cyan-400" />
              <span className="text-xs uppercase tracking-widest text-cyan-400 font-mono">
                Liberation Campaign · Archipelago Operations
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-100">
              Island Liberation Map
            </h1>
            <p className="text-sm text-stone-400 max-w-2xl">
              Break the Evil Tribe's tyrannical grip across the archipelago. Seize power conduits, recover ancient
              Magitek cores, and tame primeval guardians to emancipate the sanctuaries.
            </p>
          </div>

          {/* Campaign Global Progress */}
          <div className="flex items-center gap-4 bg-stone-900/80 border border-stone-800 rounded-lg p-3 min-w-[240px]">
            <div className="flex flex-col flex-1">
              <div className="flex justify-between text-xs text-stone-400 mb-1">
                <span>Archipelago Free</span>
                <span className="font-mono font-semibold text-cyan-400">{liberationPercentage}%</span>
              </div>
              <div className="h-2 w-full bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
                  style={{ width: `${liberationPercentage}%` }}
                />
              </div>
              <span className="text-[11px] text-stone-400 mt-1">
                {totalLiberated} of {campaignSectors.length} Sectors Liberated
              </span>
            </div>
            <div className="text-right border-l border-stone-800 pl-3">
              <span className="text-[10px] uppercase text-stone-400 block font-mono">Magitek Cores</span>
              <span className="text-lg font-bold font-mono text-cyan-300">
                {resources.magitekCores || 0}
              </span>
            </div>
          </div>
        </div>

        {/* 4 Island Region Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-6 pt-4 border-t border-stone-800/80">
          {ISLAND_TABS.map((tab) => {
            const islandSectorsCount = campaignSectors.filter((s) => s.islandId === tab.id);
            const islandLiberatedCount = islandSectorsCount.filter((s) => s.liberated).length;
            const isSelected = selectedIsland === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedIsland(tab.id);
                  const firstSector = campaignSectors.find((s) => s.islandId === tab.id);
                  if (firstSector) setSelectedSectorId(firstSector.id);
                }}
                className={`text-left p-3 rounded-lg border transition-all ${
                  isSelected
                    ? `bg-stone-900 ${tab.accentBorder} shadow-lg ring-1 ring-cyan-500/20`
                    : 'bg-stone-950/60 border-stone-800 hover:border-stone-700 hover:bg-stone-900/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className={isSelected ? 'text-stone-100 font-bold' : 'text-stone-300'}>
                    {tab.name}
                  </span>
                  <span className="text-[11px] font-mono text-stone-400">
                    {islandLiberatedCount}/{islandSectorsCount.length}
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 mt-0.5">{tab.subtitle}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Campaign Grid: Sectors List & Tactical Sector Intel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Sector Nodes on this Island */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-stone-400 uppercase font-mono px-1">
            <span>Island Sectors ({islandSectors.length})</span>
            <span>Threat Evaluation</span>
          </div>

          <div className="space-y-2">
            {islandSectors.map((sector, index) => {
              const isSelected = sector.id === activeSector.id;
              return (
                <div
                  key={sector.id}
                  onClick={() => setSelectedSectorId(sector.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-stone-900 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/20'
                      : sector.liberated
                      ? 'bg-stone-950/70 border-emerald-900/40 hover:border-emerald-800/60 hover:bg-stone-900/50'
                      : 'bg-stone-950/70 border-stone-800 hover:border-stone-700 hover:bg-stone-900/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-stone-400">0{index + 1}</span>
                        <h3 className="font-semibold text-stone-200 text-sm">{sector.sectorName}</h3>
                        {sector.liberated && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Liberated
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400 line-clamp-1">{sector.loreLog}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 justify-end text-xs font-mono text-amber-400">
                        <Flame className="w-3.5 h-3.5" />
                        <span>Tier {sector.threatLevel}</span>
                      </div>
                      <span className="text-[11px] text-cyan-400/80 font-mono block mt-1">
                        +{sector.rewards.magitekCores} Cores
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Tactical Mission Dossier for Selected Sector */}
        <div className="lg:col-span-7">
          <div className="rounded-xl border border-stone-800 bg-stone-950/80 p-6 space-y-6 shadow-xl">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-stone-400 font-mono uppercase">
                  <span>{activeSector.islandName}</span>
                  <span>·</span>
                  <span>Threat Level {activeSector.threatLevel}</span>
                </div>
                <h2 className="text-xl font-bold text-stone-100 mt-1">{activeSector.sectorName}</h2>
              </div>

              <div>
                {activeSector.liberated ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Sector Pacified & Free
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-400 text-xs font-medium">
                    <Lock className="w-4 h-4" />
                    Occupied by Evil Tribe
                  </span>
                )}
              </div>
            </div>

            {/* Ancient Lore & Recon Intel */}
            <div className="rounded-lg bg-stone-900/60 border border-stone-800/80 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase">
                <Cpu className="w-3.5 h-3.5" />
                <span>Sanctuary Lore & Reconnaissance Log</span>
              </div>
              <p className="text-sm text-stone-300 leading-relaxed italic">
                "{activeSector.loreLog}"
              </p>
            </div>

            {/* Enemy Garrison Composition & Class Synergies */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-400 uppercase font-mono">
                <span>Opposing Tribe Combatants ({activeSector.enemySquad.length})</span>
                <span>Tactical Class Archetypes</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {activeSector.enemySquad.map((enemy, idx) => {
                  const classInfo = CLASS_TACTICAL_DETAILS[enemy.unitClass] || CLASS_TACTICAL_DETAILS.Blade;
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-stone-800 bg-stone-900/40 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-200">{enemy.name}</span>
                        <span className="text-[11px] font-mono text-stone-400">Lv {enemy.level}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${classInfo.color}`}>
                          {enemy.unitClass}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-400 leading-tight">{classInfo.role}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Liberation Bounty & Magitek Rewards */}
            <div className="rounded-lg border border-stone-800 bg-stone-900/30 p-4 space-y-2">
              <span className="text-xs font-mono uppercase text-stone-400 block">
                Liberation Spoils & Harvest Caches
              </span>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 font-mono text-cyan-300">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>+{activeSector.rewards.magitekCores} Magitek Cores</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-amber-300">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>+{activeSector.rewards.amber} Amber</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-purple-300">
                  <Shield className="w-4 h-4 text-purple-400" />
                  <span>+{activeSector.rewards.titanite} Titanite</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-emerald-300">
                  <Map className="w-4 h-4 text-emerald-400" />
                  <span>+{activeSector.rewards.wood} Timber</span>
                </div>
              </div>
            </div>

            {/* Tactical Strike Action */}
            <div className="pt-2">
              <button
                onClick={() => startSectorMission(activeSector)}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-stone-950 font-bold text-sm tracking-wide shadow-lg shadow-cyan-950/50 transition-all cursor-pointer"
              >
                <Swords className="w-4 h-4" />
                <span>
                  {activeSector.liberated
                    ? 'Replay Sector Tactical Skirmish'
                    : `Deploy Strike Squad on ${activeSector.sectorName}`}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
