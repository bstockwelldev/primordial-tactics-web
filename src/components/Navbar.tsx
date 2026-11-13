import React from 'react';
import { useGame, ActiveScreen } from '../context/GameContext';
import {
  Shield,
  Dna,
  Swords,
  Compass,
  Home,
  Map,
  Users,
  Sparkles,
  Zap,
  Flame,
  Feather,
  Cpu,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    activeScreen,
    setActiveScreen,
    resources,
    playerName,
    isConnected,
    setShowRoadmapModal,
    setShowLobbyModal,
    quickAddDemoResources,
    currentRoom,
    yourTurnCount,
    activeSectorMission,
  } = useGame();

  const navItems: { id: ActiveScreen; label: string; icon: React.ReactNode }[] = [
    { id: 'base', label: 'Base Enclave', icon: <Home className="w-4 h-4" /> },
    { id: 'campaign', label: 'Island Campaign', icon: <Compass className="w-4 h-4" /> },
    { id: 'magitek', label: 'Magitek Lab', icon: <Cpu className="w-4 h-4" /> },
    { id: 'taming', label: 'Taming & Biomes', icon: <Feather className="w-4 h-4" /> },
    { id: 'evolution', label: 'Gene Evolution', icon: <Dna className="w-4 h-4" /> },
    { id: 'arena', label: 'Tactical Arena', icon: <Swords className="w-4 h-4" /> },
  ];

  return (
    <header className="lg:sticky lg:top-0 z-40 bg-stone-950/90 backdrop-blur-md border-b border-stone-800 text-stone-100 shadow-xl">
      {/* Top Bar: Title, Resources, Global Actions */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Connection */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 via-amber-700 to-red-800 flex items-center justify-center shadow-lg shadow-amber-900/30 ring-1 ring-amber-500/40">
            <Flame className="w-6 h-6 text-amber-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold tracking-wider text-base sm:text-lg bg-gradient-to-r from-amber-400 via-orange-300 to-amber-200 bg-clip-text text-transparent">
                PRIMAL TACTICS
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Magitek Liberation
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <span className="flex items-center gap-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-500 shadow-emerald-500/50 shadow' : 'bg-red-500'
                  }`}
                />
                {isConnected ? 'Online' : 'Offline — solo play only'}
              </span>
              <span>•</span>
              <span className="text-stone-300 font-medium">{playerName}</span>
            </div>
          </div>
        </div>

        {/* Resources Bar */}
        <div className="flex flex-wrap items-center gap-1.5 lg:gap-2 order-3 w-full lg:order-none lg:w-auto bg-stone-900/80 px-2 lg:px-3 py-1.5 rounded-xl border border-stone-800/80 text-xs">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 font-mono shadow-sm">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold">Cores:</span>
            <span>{resources.magitekCores || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/50">
            <span className="font-bold">Amber:</span>
            <span>{resources.amber}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/50">
            <span className="font-bold">Titanite:</span>
            <span>{resources.titanite}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-stone-800/60 text-amber-100">
            <span className="font-bold">Wood:</span>
            <span>{resources.wood}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-stone-800/60 text-stone-300">
            <span className="font-bold">Flint:</span>
            <span>{resources.flint}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
            <span className="font-bold">Fiber:</span>
            <span>{resources.fiber}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-950/60 text-red-300 border border-red-800/40">
            <span className="font-bold">Meat:</span>
            <span>{resources.primalMeat}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Demo Resources */}
          <button
            onClick={quickAddDemoResources}
            title="Add Test Resources (Flint, Fiber, Amber, Meat)"
            className="flex items-center justify-center gap-1.5 min-h-11 min-w-11 lg:min-h-0 lg:min-w-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors border border-stone-700"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Add Supplies</span>
          </button>

{/* Multiplayer Lobby */}
          <button
            onClick={() => setShowLobbyModal(true)}
            className="flex items-center justify-center gap-1.5 min-h-11 min-w-11 lg:min-h-0 lg:min-w-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-md shadow-orange-950/50 transition-all"
          >
            <Users className="w-3.5 h-3.5" />
            <span>My Games</span>
            {yourTurnCount > 0 && (
              <span data-testid="your-turn-badge" className="ml-0.5 min-w-5 h-5 px-1 rounded-full bg-white text-orange-700 text-[11px] font-black flex items-center justify-center">
                {yourTurnCount}
              </span>
            )}
          </button>

          {/* Feature Roadmap */}
          <button
            onClick={() => setShowRoadmapModal(true)}
            className="flex items-center justify-center gap-1.5 min-h-11 min-w-11 lg:min-h-0 lg:min-w-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-600/40 transition-colors"
          >
            <Map className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Roadmap</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="max-w-7xl mx-auto px-4 flex gap-1 sm:gap-2 overflow-x-auto py-1 border-t border-stone-800/60 scrollbar-none">
        {navItems.map((item) => {
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveScreen(item.id)}
              className={`flex items-center gap-2 min-h-11 lg:min-h-0 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 shadow-inner shadow-amber-500/10'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60 border border-transparent'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.id === 'arena' && currentRoom && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
