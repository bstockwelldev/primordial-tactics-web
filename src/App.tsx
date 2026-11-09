/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { Navbar } from './components/Navbar';
import { BaseCampView } from './components/BaseCampView';
import { TamingExpeditionView } from './components/TamingExpeditionView';
import { EvolutionTreeView } from './components/EvolutionTreeView';
import { TacticalArenaView } from './components/TacticalArenaView';
import { IslandCampaignView } from './components/IslandCampaignView';
import { MagitekLabView } from './components/MagitekLabView';
import { NpcDialogueModal } from './components/NpcDialogueModal';
import { AIFeedbackModal } from './components/AIFeedbackModal';
import { RoadmapModal } from './components/RoadmapModal';
import { MultiplayerLobbyModal } from './components/MultiplayerLobbyModal';

const GameShell: React.FC = () => {
  const { activeScreen } = useGame();

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      <Navbar />

      <main className="flex-1 pb-16">
        {activeScreen === 'base' && <BaseCampView />}
        {activeScreen === 'campaign' && <IslandCampaignView />}
        {activeScreen === 'magitek' && <MagitekLabView />}
        {activeScreen === 'taming' && <TamingExpeditionView />}
        {activeScreen === 'evolution' && <EvolutionTreeView />}
        {activeScreen === 'arena' && <TacticalArenaView />}
      </main>

      {/* Interactive Modals */}
      <NpcDialogueModal />
      <AIFeedbackModal />
      <RoadmapModal />
      <MultiplayerLobbyModal />
    </div>
  );
};

export default function App() {
  return (
    <GameProvider>
      <GameShell />
    </GameProvider>
  );
}
