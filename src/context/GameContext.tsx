import React, { createContext, useContext, useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  TamedDino,
  PrehistoricResources,
  BaseBuilding,
  ArenaRoomState,
  DinosaurSpeciesId,
  EvolutionBranchId,
  IslandSector,
  MagitekAugment,
} from '../types/game';
import {
  DINOSAUR_SPECIES,
  BASE_BUILDINGS,
  CRAFTING_RECIPES,
  ISLAND_CAMPAIGN_SECTORS,
  MAGITEK_AUGMENTS,
} from '../game/constants';
import { canAfford, deductResources, applyEvolution } from '../game/rules';
import { ARENA_URL, apiUrl } from '../lib/api';

export type ActiveScreen = 'base' | 'taming' | 'evolution' | 'arena' | 'campaign' | 'magitek';

interface GameContextType {
  playerName: string;
  setPlayerName: (name: string) => void;
  playerLevel: number;
  playerXp: number;
  resources: PrehistoricResources;
  inventory: Record<string, number>;
  tamedDinos: TamedDino[];
  baseBuildings: BaseBuilding[];
  activeScreen: ActiveScreen;
  setActiveScreen: (screen: ActiveScreen) => void;

  // Island Campaign
  campaignSectors: IslandSector[];
  activeSectorMission: IslandSector | null;
  startSectorMission: (sector: IslandSector) => void;
  liberateSector: (sectorId: string) => void;
  clearActiveSectorMission: () => void;

  // Magitek Tech
  equipAugment: (dinoInstanceId: string, augmentId: string) => boolean;
  unequipAugment: (dinoInstanceId: string, augmentId: string) => boolean;

  // Socket & Multiplayer
  socket: Socket | null;
  isConnected: boolean;
  currentRoom: ArenaRoomState | null;
  setCurrentRoom: (room: ArenaRoomState | null) => void;
  availableRooms: Array<{ roomId: string; name: string; hostName: string; status: string; playerCount: number }>;

  // Modals
  activeNpcModal: string | null;
  setActiveNpcModal: (npcId: string | null) => void;
  showRoadmapModal: boolean;
  setShowRoadmapModal: (show: boolean) => void;
  showLobbyModal: boolean;
  setShowLobbyModal: (show: boolean) => void;
  showDebriefModal: boolean;
  setShowDebriefModal: (show: boolean) => void;
  lastMatchSummary: any | null;
  setLastMatchSummary: (summary: any | null) => void;

  // Actions
  addResources: (res: Partial<PrehistoricResources>) => void;
  craftItem: (recipeId: string) => boolean;
  upgradeBuilding: (buildingId: string) => boolean;
  tameCreature: (speciesId: DinosaurSpeciesId, customName: string) => boolean;
  evolveCreature: (dinoInstanceId: string, branchId: EvolutionBranchId) => boolean;
  recordMatchResult: (won: boolean, turns: number, logs: any[]) => void;
  quickAddDemoResources: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const INITIAL_RESOURCES: PrehistoricResources = {
  wood: 120,
  flint: 75,
  fiber: 110,
  iron: 45,
  primalMeat: 25,
  amber: 180,
  titanite: 25,
  magitekCores: 15,
};

const INITIAL_DINOS: TamedDino[] = [
  {
    instanceId: 'dino_starter_raptor',
    speciesId: 'velociraptor',
    customName: 'Ghostclaw',
    level: 5,
    xp: 520,
    currentHp: 160,
    maxHp: 160,
    currentTorpor: 0,
    maxTorpor: 120,
    attack: 48,
    defense: 16,
    speed: 4,
    equippedAbilities: ['raptor_slash', 'raptor_pounce'],
  },
  {
    instanceId: 'dino_starter_trike',
    speciesId: 'triceratops',
    customName: 'Shieldhorn',
    level: 4,
    xp: 410,
    currentHp: 290,
    maxHp: 290,
    currentTorpor: 0,
    maxTorpor: 260,
    attack: 34,
    defense: 38,
    speed: 2,
    equippedAbilities: ['trike_gore', 'goring_charge'],
  },
];

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('pt_player_name') || 'Survivor Rex');
  const [playerLevel, setPlayerLevel] = useState(5);
  const [playerXp, setPlayerXp] = useState(650);
  const [resources, setResources] = useState<PrehistoricResources>(() => {
    const saved = localStorage.getItem('pt_resources');
    return saved ? JSON.parse(saved) : INITIAL_RESOURCES;
  });
  const [inventory, setInventory] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('pt_inventory');
    return saved ? JSON.parse(saved) : { tranq_dart: 6, primal_kibble: 3, chitin_armor: 1 };
  });
  const [tamedDinos, setTamedDinos] = useState<TamedDino[]>(() => {
    const saved = localStorage.getItem('pt_dinos');
    return saved ? JSON.parse(saved) : INITIAL_DINOS;
  });
  const [baseBuildings, setBaseBuildings] = useState<BaseBuilding[]>(BASE_BUILDINGS);
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('base');

  // Modals state
  const [activeNpcModal, setActiveNpcModal] = useState<string | null>(null);
  const [showRoadmapModal, setShowRoadmapModal] = useState(false);
  const [showLobbyModal, setShowLobbyModal] = useState(false);
  const [showDebriefModal, setShowDebriefModal] = useState(false);
  const [lastMatchSummary, setLastMatchSummary] = useState<any | null>(null);

  // Sockets state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<ArenaRoomState | null>(null);
  const [availableRooms, setAvailableRooms] = useState<
    Array<{ roomId: string; name: string; hostName: string; status: string; playerCount: number }>
  >([]);

  const [campaignSectors, setCampaignSectors] = useState<IslandSector[]>(() => {
    const saved = localStorage.getItem('pt_campaign_sectors');
    return saved ? JSON.parse(saved) : ISLAND_CAMPAIGN_SECTORS;
  });
  const [activeSectorMission, setActiveSectorMission] = useState<IslandSector | null>(null);

  // Local storage sync
  useEffect(() => {
    localStorage.setItem('pt_player_name', playerName);
    localStorage.setItem('pt_resources', JSON.stringify(resources));
    localStorage.setItem('pt_inventory', JSON.stringify(inventory));
    localStorage.setItem('pt_dinos', JSON.stringify(tamedDinos));
    localStorage.setItem('pt_campaign_sectors', JSON.stringify(campaignSectors));
  }, [playerName, resources, inventory, tamedDinos, campaignSectors]);

  // Socket connection initialization
  useEffect(() => {
    const s = io(ARENA_URL || window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    s.on('connect', () => {
      console.log('Connected to Primal Tactics WebSocket server:', s.id);
      setIsConnected(true);
    });

    s.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setIsConnected(false);
    });

    s.on('rooms_list', (list) => {
      setAvailableRooms(list);
    });

    s.on('rooms_updated', () => {
      // Fetch updated rooms
      s.emit('get_rooms');
    });

    s.on('room_created', (room: ArenaRoomState) => {
      setCurrentRoom(room);
      setActiveScreen('arena');
      setShowLobbyModal(false);
    });

    s.on('room_state_updated', (room: ArenaRoomState) => {
      setCurrentRoom(room);
      setActiveScreen('arena');
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  const addResources = (res: Partial<PrehistoricResources>) => {
    setResources((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(res)) {
        const key = k as keyof PrehistoricResources;
        next[key] = (next[key] || 0) + (v || 0);
      }
      return next;
    });
  };

  const quickAddDemoResources = () => {
    addResources({
      wood: 150,
      flint: 100,
      fiber: 150,
      iron: 80,
      primalMeat: 50,
      amber: 250,
      titanite: 50,
      magitekCores: 20,
    });
    setInventory((prev) => ({
      ...prev,
      tranq_dart: (prev.tranq_dart || 0) + 5,
      primal_kibble: (prev.primal_kibble || 0) + 3,
      magitek_plasma_dart: (prev.magitek_plasma_dart || 0) + 3,
    }));
  };

  const craftItem = (recipeId: string): boolean => {
    const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return false;

    if (!canAfford(recipe.cost, resources)) return false;

    setResources((prev) => deductResources(recipe.cost, prev));
    setInventory((prev) => ({
      ...prev,
      [recipe.id]: (prev[recipe.id] || 0) + recipe.quantity,
    }));
    setPlayerXp((xp) => xp + 45);
    return true;
  };

  const upgradeBuilding = (buildingId: string): boolean => {
    const building = baseBuildings.find((b) => b.id === buildingId);
    if (!building || building.level >= building.maxLevel) return false;

    if (!canAfford(building.costNextLevel, resources)) return false;

    setResources((prev) => deductResources(building.costNextLevel, prev));
    setBaseBuildings((prev) =>
      prev.map((b) => {
        if (b.id !== buildingId) return b;
        const nextLevel = b.level + 1;
        const nextCost = { ...b.costNextLevel };
        for (const k in nextCost) {
          (nextCost as any)[k] = Math.round((nextCost as any)[k] * 1.5);
        }
        return {
          ...b,
          level: nextLevel,
          costNextLevel: nextCost,
        };
      })
    );
    setPlayerXp((xp) => xp + 120);
    return true;
  };

  const tameCreature = (speciesId: DinosaurSpeciesId, customName: string): boolean => {
    const spec = DINOSAUR_SPECIES[speciesId];
    if (!spec) return false;

    const newDino: TamedDino = {
      instanceId: `dino_${Date.now()}`,
      speciesId,
      customName: customName || `Wild ${spec.name}`,
      level: 1,
      xp: 0,
      currentHp: spec.baseHp,
      maxHp: spec.baseHp,
      currentTorpor: 0,
      maxTorpor: spec.baseTorporMax,
      attack: spec.baseAttack,
      defense: spec.baseDefense,
      speed: spec.baseSpeed,
      equippedAbilities: spec.innateAbilities.slice(0, 2).map((a) => a.id),
      equippedAugments: [],
    };

    setTamedDinos((prev) => [...prev, newDino]);
    setPlayerXp((xp) => xp + 200);
    return true;
  };

  const evolveCreature = (dinoInstanceId: string, branchId: EvolutionBranchId): boolean => {
    const dino = tamedDinos.find((d) => d.instanceId === dinoInstanceId);
    if (!dino) return false;

    const species = DINOSAUR_SPECIES[dino.speciesId];
    const evolution = species.evolutionBranches.find((b) => b.id === branchId);
    if (!evolution) return false;

    if (resources.amber < evolution.requiredAmber) return false;

    setResources((prev) => ({
      ...prev,
      amber: prev.amber - evolution.requiredAmber,
    }));

    setTamedDinos((prev) =>
      prev.map((d) => {
        if (d.instanceId !== dinoInstanceId) return d;
        return applyEvolution(d, evolution);
      })
    );

    setPlayerXp((xp) => xp + 350);
    return true;
  };

  // Island Campaign Methods
  const startSectorMission = (sector: IslandSector) => {
    setActiveSectorMission(sector);
    setActiveScreen('arena');
  };

  const liberateSector = (sectorId: string) => {
    const targetSector = campaignSectors.find((s) => s.id === sectorId);
    if (!targetSector) return;

    setCampaignSectors((prev) =>
      prev.map((sec) => (sec.id === sectorId ? { ...sec, liberated: true } : sec))
    );

    // Award sector rewards
    addResources(targetSector.rewards);
    setPlayerXp((xp) => xp + 250);
  };

  const clearActiveSectorMission = () => {
    setActiveSectorMission(null);
  };

  // Magitek Augments
  const equipAugment = (dinoInstanceId: string, augmentId: string): boolean => {
    const augment = MAGITEK_AUGMENTS.find((a) => a.id === augmentId);
    if (!augment) return false;

    if ((resources.magitekCores || 0) < augment.magitekCost) return false;

    const dino = tamedDinos.find((d) => d.instanceId === dinoInstanceId);
    if (!dino) return false;

    const alreadyEquipped = dino.equippedAugments || [];
    if (alreadyEquipped.includes(augmentId)) return false;

    // Deduct cost
    setResources((prev) => ({
      ...prev,
      magitekCores: Math.max(0, (prev.magitekCores || 0) - augment.magitekCost),
    }));

    // Apply stat bonus
    setTamedDinos((prev) =>
      prev.map((d) => {
        if (d.instanceId !== dinoInstanceId) return d;
        return {
          ...d,
          equippedAugments: [...(d.equippedAugments || []), augmentId],
          attack: d.attack + (augment.statBonus.attack || 0),
          defense: d.defense + (augment.statBonus.defense || 0),
          speed: d.speed + (augment.statBonus.speed || 0),
          maxHp: d.maxHp + (augment.statBonus.hp || 0),
          currentHp: d.currentHp + (augment.statBonus.hp || 0),
        };
      })
    );

    setPlayerXp((xp) => xp + 100);
    return true;
  };

  const unequipAugment = (dinoInstanceId: string, augmentId: string): boolean => {
    const augment = MAGITEK_AUGMENTS.find((a) => a.id === augmentId);
    if (!augment) return false;

    const dino = tamedDinos.find((d) => d.instanceId === dinoInstanceId);
    if (!dino || !(dino.equippedAugments || []).includes(augmentId)) return false;

    // Refund 50% rounded up
    const refund = Math.ceil(augment.magitekCost * 0.5);
    setResources((prev) => ({
      ...prev,
      magitekCores: (prev.magitekCores || 0) + refund,
    }));

    setTamedDinos((prev) =>
      prev.map((d) => {
        if (d.instanceId !== dinoInstanceId) return d;
        return {
          ...d,
          equippedAugments: (d.equippedAugments || []).filter((id) => id !== augmentId),
          attack: Math.max(10, d.attack - (augment.statBonus.attack || 0)),
          defense: Math.max(5, d.defense - (augment.statBonus.defense || 0)),
          speed: Math.max(1, d.speed - (augment.statBonus.speed || 0)),
          maxHp: Math.max(50, d.maxHp - (augment.statBonus.hp || 0)),
          currentHp: Math.min(d.currentHp, Math.max(50, d.maxHp - (augment.statBonus.hp || 0))),
        };
      })
    );

    return true;
  };

  const recordMatchResult = async (won: boolean, turns: number, logs: any[]) => {
    setPlayerXp((xp) => xp + (won ? 300 : 100));
    addResources({
      amber: won ? 50 : 20,
      primalMeat: won ? 15 : 5,
      titanite: won ? 10 : 2,
      magitekCores: won ? 2 : 0,
    });

    if (won && activeSectorMission) {
      liberateSector(activeSectorMission.id);
    }

    // Request AI Debrief
    try {
      const res = await fetch(apiUrl('/api/match-feedback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winnerName: won ? playerName : 'Opponent',
          loserName: won ? 'Opponent' : playerName,
          turns,
          actionLogs: logs,
          playerWon: won,
          sectorName: activeSectorMission?.sectorName,
        }),
      });
      const debrief = await res.json();
      setLastMatchSummary(debrief);
      setShowDebriefModal(true);
    } catch (err) {
      console.warn('Failed to fetch AI feedback:', err);
    }
  };

  return (
    <GameContext.Provider
      value={{
        playerName,
        setPlayerName,
        playerLevel,
        playerXp,
        resources,
        inventory,
        tamedDinos,
        baseBuildings,
        activeScreen,
        setActiveScreen,
        campaignSectors,
        activeSectorMission,
        startSectorMission,
        liberateSector,
        clearActiveSectorMission,
        equipAugment,
        unequipAugment,
        socket,
        isConnected,
        currentRoom,
        setCurrentRoom,
        availableRooms,
        activeNpcModal,
        setActiveNpcModal,
        showRoadmapModal,
        setShowRoadmapModal,
        showLobbyModal,
        setShowLobbyModal,
        showDebriefModal,
        setShowDebriefModal,
        lastMatchSummary,
        setLastMatchSummary,
        addResources,
        craftItem,
        upgradeBuilding,
        tameCreature,
        evolveCreature,
        recordMatchResult,
        quickAddDemoResources,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within GameProvider');
  return context;
};
