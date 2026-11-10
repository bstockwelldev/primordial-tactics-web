import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { apiUrl } from '../lib/api';
import * as asyncApi from '../lib/asyncApi';
import type { GameSummary } from '../lib/asyncApi';
import type { AsyncGame, GameAction } from '../game/engine';

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

  // Async multiplayer
  /** This browser's player id on the game server; null until registered / while offline. */
  myPlayerId: string | null;
  isConnected: boolean;
  /** The async game open in the arena, as the server last returned it. */
  asyncGame: AsyncGame | null;
  /** `asyncGame` in the arena's shape, with isPlayer meaning "mine". Null in solo play. */
  currentRoom: ArenaRoomState | null;
  setCurrentRoom: (room: ArenaRoomState | null) => void;
  myGames: GameSummary[];
  openGames: GameSummary[];
  yourTurnCount: number;
  refreshGames: () => Promise<void>;
  createAsyncGame: (visibility: 'open' | 'invite', turnHours: number) => Promise<string | null>;
  joinAsyncGame: (gameId: string) => Promise<string | null>;
  openAsyncGame: (gameId: string) => Promise<string | null>;
  /** Sends one action for the open game. Resolves to an error message, or null on success. */
  sendGameAction: (action: GameAction) => Promise<string | null>;
  pendingInviteId: string | null;
  clearPendingInvite: () => void;

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
  recordMatchResult: (won: boolean, turns: number, logs: any[], pvpGameId?: string) => void;
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

  // Async multiplayer state
  const [myPlayerId, setMyPlayerId] = useState<string | null>(() => asyncApi.getIdentity()?.playerId ?? null);
  const [isConnected, setIsConnected] = useState(false);
  const [asyncGame, setAsyncGame] = useState<AsyncGame | null>(null);
  const [myGames, setMyGames] = useState<GameSummary[]>([]);
  const [openGames, setOpenGames] = useState<GameSummary[]>([]);
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('game')
  );
  const asyncGameRef = useRef(asyncGame);
  asyncGameRef.current = asyncGame;

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

  // Register (or re-validate) this browser's player, then keep the games list fresh.
  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;

  const refreshGames = useCallback(async () => {
    if (!asyncApi.getIdentity()) {
      const me = await asyncApi.ensurePlayer(playerNameRef.current);
      if (!me) return setIsConnected(false);
      setMyPlayerId(me.playerId);
    }
    const [mine, open] = await Promise.all([asyncApi.listMyGames(), asyncApi.listOpenGames()]);
    if (mine.status === 401) {
      // The server no longer knows this token (e.g. database reset): register again.
      const me = await asyncApi.ensurePlayer(playerNameRef.current);
      setMyPlayerId(me?.playerId ?? null);
      return setIsConnected(!!me);
    }
    setIsConnected(mine.ok);
    if (mine.ok) setMyGames(mine.data.games);
    if (open.ok) setOpenGames(open.data.games);
  }, []);

  useEffect(() => {
    refreshGames();
    const tick = () => document.visibilityState === 'visible' && refreshGames();
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refreshGames]);

  // Keep the server-side name in step with the local one.
  useEffect(() => {
    if (!myPlayerId) return;
    const t = window.setTimeout(() => asyncApi.renamePlayer(playerName), 1500);
    return () => window.clearTimeout(t);
  }, [playerName, myPlayerId]);

  useEffect(() => {
    if (pendingInviteId) setShowLobbyModal(true);
  }, [pendingInviteId]);

  const clearPendingInvite = () => {
    setPendingInviteId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('game');
    window.history.replaceState({}, '', url.toString());
  };

  const openAsyncGame = async (gameId: string): Promise<string | null> => {
    const res = await asyncApi.getGame(gameId);
    if (!res.ok || res.data.preview) return res.data.error || 'You are not a player in this game.';
    setAsyncGame(res.data.game as AsyncGame);
    setActiveScreen('arena');
    setShowLobbyModal(false);
    return null;
  };

  const createAsyncGame = async (visibility: 'open' | 'invite', turnHours: number): Promise<string | null> => {
    const res = await asyncApi.createGame(visibility, turnHours);
    if (!res.ok) return res.data.error || 'Could not create the game.';
    await refreshGames();
    return null;
  };

  const joinAsyncGame = async (gameId: string): Promise<string | null> => {
    const res = await asyncApi.joinGame(gameId);
    if (!res.ok) return res.data.error || 'Could not join the game.';
    setAsyncGame(res.data.game);
    setActiveScreen('arena');
    setShowLobbyModal(false);
    refreshGames();
    return null;
  };

  const sendGameAction = async (action: GameAction): Promise<string | null> => {
    const game = asyncGameRef.current;
    if (!game) return 'No game is open.';
    const res = await asyncApi.sendAction(game.id, game.version, action);
    if (res.data.game) setAsyncGame(res.data.game); // on a conflict the server returns the fresh board
    if (res.ok && (action.type === 'end_turn' || action.type === 'resign')) refreshGames();
    return res.ok ? null : res.data.error || 'That action failed.';
  };

  // While an async game is open and it is not my move, poll for the opponent's turn.
  const openGameId = asyncGame?.id;
  const waitingOnOpponent = !!asyncGame && asyncGame.status !== 'completed' && asyncGame.activePlayerId !== myPlayerId;
  useEffect(() => {
    if (!openGameId || !waitingOnOpponent) return;
    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      const res = await asyncApi.getGame(openGameId);
      if (res.ok && !res.data.preview && asyncGameRef.current?.id === openGameId) setAsyncGame(res.data.game as AsyncGame);
    };
    const timer = window.setInterval(poll, 15_000);
    window.addEventListener('focus', poll);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', poll);
    };
  }, [openGameId, waitingOnOpponent]);

  // The arena renders a "room"; for an async game that is the server state seen from my side.
  const currentRoom = useMemo<ArenaRoomState | null>(() => {
    if (!asyncGame) return null;
    return {
      roomId: asyncGame.id,
      name: `${asyncGame.hostName} vs ${asyncGame.guestName || '…'}`,
      hostId: asyncGame.hostId,
      hostName: asyncGame.hostName,
      guestId: asyncGame.guestId ?? undefined,
      guestName: asyncGame.guestName ?? undefined,
      status: asyncGame.status,
      activeTurnPlayerId: asyncGame.activePlayerId ?? '',
      turnNumber: asyncGame.turnNumber,
      turnTimeLeft: 0,
      gridWidth: 8,
      gridHeight: 6,
      units: asyncGame.units.map((u) => ({ ...u, isPlayer: u.ownerId === myPlayerId })),
      actionLogs: asyncGame.actionLogs,
      winnerId: asyncGame.winnerId ?? undefined,
    };
  }, [asyncGame, myPlayerId]);

  const setCurrentRoom = (room: ArenaRoomState | null) => {
    if (!room) setAsyncGame(null);
  };

  const yourTurnCount = myGames.filter((g) => g.status === 'in_progress' && g.activePlayerId === myPlayerId).length;

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
    // Idempotent: a sector pays its rewards once, however many times a win is reported.
    if (!targetSector || targetSector.liberated) return;

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

  const recordMatchResult = async (won: boolean, turns: number, logs: any[], pvpGameId?: string) => {
    if (pvpGameId) {
      // A finished PvP game can be reopened from the list: pay its rewards only once.
      const paid: string[] = JSON.parse(localStorage.getItem('pt_rewarded_games') || '[]');
      if (paid.includes(pvpGameId)) return;
      localStorage.setItem('pt_rewarded_games', JSON.stringify([...paid, pvpGameId].slice(-200)));
    }
    setPlayerXp((xp) => xp + (won ? 300 : 100));
    addResources({
      amber: won ? 50 : 20,
      primalMeat: won ? 15 : 5,
      titanite: won ? 10 : 2,
      magitekCores: won ? 2 : 0,
    });

    if (won && activeSectorMission && !pvpGameId) {
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
        myPlayerId,
        isConnected,
        asyncGame,
        currentRoom,
        setCurrentRoom,
        myGames,
        openGames,
        yourTurnCount,
        refreshGames,
        createAsyncGame,
        joinAsyncGame,
        openAsyncGame,
        sendGameAction,
        pendingInviteId,
        clearPendingInvite,
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
