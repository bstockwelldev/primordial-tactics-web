import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useGame } from '../context/GameContext';
import {
  UnitEntity,
  GridTile,
  Ability,
  BattleActionLog,
} from '../types/game';
import {
  calculateDistance,
  canUnitMoveTo,
  calculateDamage,
  calculateTorporDamage,
  checkWinCondition,
} from '../game/rules';
import { runBotTurn } from '../game/bot';
import { buildArenaGrid, buildSoloUnits } from '../game/arenaSetup';
import { createRng, newSeed } from '../game/rng';
import type { GameAction } from '../game/engine';
import { timeLeft } from '../lib/asyncApi';
import { SOLO_SAVE_KEY, SoloSave } from '../game/soloSave';
import {
  DINOSAUR_SPECIES,
  UNIT_PORTRAITS,
  TERRAIN_INFO,
  STATUS_EFFECT_DETAILS,
  CLASS_TACTICAL_DETAILS,
} from '../game/constants';
import {
  Swords,
  Shield,
  Zap,
  Crosshair,
  Heart,
  Activity,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Users,
  Flame,
  Send,
  Eye,
  Hammer,
  Droplet,
  Info,
  Compass,
  CheckCircle2,
  HelpCircle,
  Cpu,
} from 'lucide-react';

export const TacticalArenaView: React.FC = () => {
  const {
    playerName,
    myPlayerId,
    asyncGame,
    sendGameAction,
    currentRoom,
    setCurrentRoom,
    recordMatchResult,
    setShowLobbyModal,
    tamedDinos,
    activeSectorMission,
    clearActiveSectorMission,
    setActiveScreen,
  } = useGame();

  // Helper to resolve high-res token portrait for any unit
  const getUnitPortrait = (unit: UnitEntity): string => {
    if (unit.imageUrl) return unit.imageUrl;
    if (unit.speciesId && UNIT_PORTRAITS[unit.speciesId]) {
      return UNIT_PORTRAITS[unit.speciesId];
    }
    return unit.isPlayer ? UNIT_PORTRAITS.hunter : UNIT_PORTRAITS.warlord;
  };

  // Grid setup (8x6)
  const [gridTiles] = useState<GridTile[]>(buildArenaGrid);

  // Local / Solo match state fallback (if not connected to a live socket room)
  const [isSoloMode, setIsSoloMode] = useState(!currentRoom);
  const [soloUnits, setSoloUnits] = useState<UnitEntity[]>([]);
  const [soloTurn, setSoloTurn] = useState<number>(1);
  const [soloIsPlayerTurn, setSoloIsPlayerTurn] = useState<boolean>(true);
  const [soloLogs, setSoloLogs] = useState<BattleActionLog[]>([]);
  const [soloWinner, setSoloWinner] = useState<string | null>(null);
  const soloUnitsRef = useRef(soloUnits);
  soloUnitsRef.current = soloUnits;
  const soloTurnRef = useRef(soloTurn);
  // Every die in a solo match (player and bot) comes from one seeded stream, so a match
  // is reproducible from its seed plus the player's inputs.
  const soloRngRef = useRef<() => number>(Math.random);
  soloTurnRef.current = soloTurn;

  // Interaction State
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);
  const [hoveredTile, setHoveredTile] = useState<GridTile | null>(null);
  const [hoveredAbility, setHoveredAbility] = useState<Ability | null>(null);
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [floatingNotification, setFloatingNotification] = useState<string | null>(null);

  // Initialize Solo Match
  const initSoloMatch = () => {
    setIsSoloMode(true);
    setSelectedUnitId('player_hero');
    setSelectedAbilityId(null);
    setHoveredTile(null);
    setSoloWinner(null);
    setSoloTurn(1);
    setSoloIsPlayerTurn(true);
    const seed = newSeed();
    soloRngRef.current = createRng(seed);

    setSoloUnits(buildSoloUnits(playerName, tamedDinos, activeSectorMission));
    setSoloLogs([
      {
        id: `log_init_${Date.now()}`,
        turn: 1,
        actorName: 'Arena Arbiter',
        actionName: 'Battle Started',
        text: activeSectorMission
          ? `Island Campaign Strike: Deploying to liberate [${activeSectorMission.sectorName}]! (Match seed ${seed})`
          : `The gladiatorial arena gates open! Hover over units and tiles to scan tactical information. (Match seed ${seed})`,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  // Restores the saved solo match for this mode (same sector, or skirmish), if there is one.
  const restoreSoloMatch = (): boolean => {
    let save: SoloSave | null = null;
    try {
      save = JSON.parse(localStorage.getItem(SOLO_SAVE_KEY) || 'null');
    } catch {}
    if (!save || !Array.isArray(save.units) || save.sectorId !== (activeSectorMission?.id ?? null)) return false;
    setIsSoloMode(true);
    setSelectedUnitId('player_hero');
    setSelectedAbilityId(null);
    setSoloWinner(null);
    setSoloTurn(save.turn);
    const seed = newSeed(); // the dice stream restarts from a fresh seed on resume
    soloRngRef.current = createRng(seed);
    soloUnitsRef.current = save.units;
    soloTurnRef.current = save.turn;
    setSoloUnits(save.units);
    setSoloLogs(save.logs);
    setSoloIsPlayerTurn(save.isPlayerTurn);
    if (!save.isPlayerTurn) setTimeout(() => runAiTurn(), 800); // closed mid enemy turn: let it finish
    return true;
  };

  const hasRoom = !!currentRoom;
  useEffect(() => {
    if (!hasRoom) {
      if (!restoreSoloMatch()) initSoloMatch();
    } else {
      setIsSoloMode(false);
    }
  }, [hasRoom, activeSectorMission]);

  // Keep the in-progress solo match on this device so it can be resumed from My Games.
  useEffect(() => {
    if (hasRoom || !isSoloMode || soloUnits.length === 0) return;
    if (soloWinner) {
      localStorage.removeItem(SOLO_SAVE_KEY);
      return;
    }
    const save: SoloSave = {
      sectorId: activeSectorMission?.id ?? null,
      units: soloUnits,
      logs: soloLogs.slice(-100),
      turn: soloTurn,
      isPlayerTurn: soloIsPlayerTurn,
    };
    localStorage.setItem(SOLO_SAVE_KEY, JSON.stringify(save));
  }, [hasRoom, isSoloMode, soloUnits, soloLogs, soloTurn, soloIsPlayerTurn, soloWinner]);

  // Derived Active Match State
  const activeUnits = currentRoom ? currentRoom.units : soloUnits;
  const activeLogs = currentRoom ? currentRoom.actionLogs : soloLogs;
  const currentTurnNumber = currentRoom ? currentRoom.turnNumber : soloTurn;
  const isMyTurn = currentRoom
    ? currentRoom.activeTurnPlayerId === myPlayerId
    : soloIsPlayerTurn;
  const isMatchOver = currentRoom ? currentRoom.status === 'completed' : !!soloWinner;
  const winnerId = currentRoom ? currentRoom.winnerId : soloWinner;

  const [inspectedUnitOverrideId, setInspectedUnitOverrideId] = useState<string | null>(null);

  // Selected Unit reference
  const selectedUnit = activeUnits.find((u) => u.id === selectedUnitId);

  // Unit under inspection: hovered unit takes priority, otherwise explicit inspected enemy override, otherwise selected unit
  const inspectedUnit =
    (hoveredTile && activeUnits.find((u) => u.x === hoveredTile.x && u.y === hoveredTile.y && u.hp > 0)) ||
    (inspectedUnitOverrideId && activeUnits.find((u) => u.id === inspectedUnitOverrideId && u.hp > 0)) ||
    selectedUnit;

  // Trigger Victory celebration
  useEffect(() => {
    if (isMatchOver) {
      const didWin = isSoloMode
        ? soloWinner === 'player_me'
        : winnerId === myPlayerId;

      if (didWin) {
        confetti({
          particleCount: 160,
          spread: 100,
          origin: { y: 0.5 },
        });
      }

      recordMatchResult(didWin, currentTurnNumber, activeLogs, currentRoom?.roomId);
    }
  }, [isMatchOver, currentRoom?.roomId]);

  // Send one action for the open async game; the server validates it and returns the new board.
  const [isSending, setIsSending] = useState(false);
  const act = async (action: GameAction) => {
    if (isSending) return;
    setIsSending(true);
    const error = await sendGameAction(action);
    setIsSending(false);
    if (error) {
      setFloatingNotification(error);
      setTimeout(() => setFloatingNotification(null), 3000);
    }
  };

  // Which abilities can actually be used here. Enemy-targeted ones are armed and then aimed
  // at a unit; self abilities fire at once (PvP only — they have no effect in solo yet);
  // ally abilities are not implemented in either mode.
  const abilityUse = (ability: Ability): 'target' | 'self' | 'unavailable' =>
    ability.targetType === 'enemy' || ability.targetType === 'tile'
      ? 'target'
      : ability.targetType === 'self' && currentRoom
      ? 'self'
      : 'unavailable';

  const armedAbility = selectedUnit?.abilities.find((a) => a.id === selectedAbilityId) || null;
  const enemiesInRange = (ability: Ability) =>
    selectedUnit
      ? activeUnits.filter(
          (u) => !u.isPlayer && u.hp > 0 && calculateDistance(selectedUnit.x, selectedUnit.y, u.x, u.y) <= ability.range
        ).length
      : 0;

  const handleAbilityButton = (ability: Ability) => {
    if (!selectedUnit) return;
    const use = abilityUse(ability);
    if (use === 'self') {
      act({ type: 'ability', unitId: selectedUnit.id, targetId: selectedUnit.id, abilityId: ability.id });
      setSelectedAbilityId(null);
    } else if (use === 'target') {
      setSelectedAbilityId(selectedAbilityId === ability.id ? null : ability.id);
    }
  };

  const notify = (text: string, ms = 2500) => {
    setFloatingNotification(text);
    setTimeout(() => setFloatingNotification(null), ms);
  };

  // Execute Move action or unit selection
  const handleTileClick = (targetX: number, targetY: number) => {
    if (!isMyTurn || isMatchOver) return;

    // Check if clicking a unit on this tile
    const clickedUnit = activeUnits.find(
      (u) => u.x === targetX && u.y === targetY && u.hp > 0
    );

    // If clicked a friendly unit, select it!
    if (clickedUnit && clickedUnit.isPlayer) {
      setSelectedUnitId(clickedUnit.id);
      setInspectedUnitOverrideId(null);
      setSelectedAbilityId(null);
      return;
    }

    // If ability was selected and clicked an enemy, trigger ability
    if (selectedUnit && selectedAbilityId && clickedUnit && !clickedUnit.isPlayer) {
      handleExecuteAbility(selectedUnit.id, clickedUnit.id, selectedAbilityId);
      return;
    }

    // If clicked an enemy unit without an armed ability, inspect that enemy's dossier!
    if (clickedUnit && !clickedUnit.isPlayer) {
      setInspectedUnitOverrideId(clickedUnit.id);
      if (selectedUnit?.isPlayer) notify('To attack: pick an attack above the grid, then tap the enemy.', 3500);
      return;
    }

    // With an attack armed, an empty tile is a mis-tap, not a move order.
    if (selectedAbilityId) {
      notify('Tap a red-highlighted enemy to attack, or cancel the attack to move.');
      return;
    }

    setInspectedUnitOverrideId(null);

    if (!selectedUnit || selectedUnit.hp <= 0) return;

    // Otherwise, attempt movement
    if (currentRoom) {
      act({ type: 'move', unitId: selectedUnit.id, x: targetX, y: targetY });
    } else {
      // Solo Mode Movement
      const occupied = soloUnits
        .filter((u) => u.hp > 0)
        .map((u) => ({ x: u.x, y: u.y, unitId: u.id }));

      const check = canUnitMoveTo(selectedUnit, targetX, targetY, gridTiles, occupied, selectedUnit.id);
      if (!check.valid) {
        setFloatingNotification(check.reason || 'Invalid movement tile.');
        setTimeout(() => setFloatingNotification(null), 2500);
        return;
      }

      setSoloUnits((prev) =>
        prev.map((u) => {
          if (u.id !== selectedUnit.id) return u;
          return {
            ...u,
            x: targetX,
            y: targetY,
            ap: u.ap - check.apCost,
          };
        })
      );

      setSoloLogs((prev) => [
        ...prev,
        {
          id: `log_${Date.now()}`,
          turn: soloTurn,
          actorName: selectedUnit.name,
          actionName: 'Moved',
          text: `${selectedUnit.name} advanced to (${targetX}, ${targetY}) [-${check.apCost} AP]`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }
  };

  // Execute Ability
  const handleExecuteAbility = (actorId: string, targetId: string, abilityId: string) => {
    const actor = activeUnits.find((u) => u.id === actorId);
    const target = activeUnits.find((u) => u.id === targetId);
    if (!actor || !target) return;

    const ability = actor.abilities.find((a) => a.id === abilityId);
    if (!ability) return;

    if (actor.ap < ability.apCost) {
      setFloatingNotification('Insufficient Action Points (AP)!');
      setTimeout(() => setFloatingNotification(null), 2500);
      return;
    }

    const dist = calculateDistance(actor.x, actor.y, target.x, target.y);
    if (dist > ability.range) {
      setFloatingNotification(`Target out of ability range (${dist}/${ability.range})!`);
      setTimeout(() => setFloatingNotification(null), 2500);
      return;
    }

    if (currentRoom) {
      act({ type: 'ability', unitId: actorId, targetId, abilityId });
      setSelectedAbilityId(null);
    } else {
      // Solo Mode Ability Execution
      const hasShield = target.statusEffects.some((s) => s.type === 'shield');
      const targetTile = gridTiles.find((t) => t.x === target.x && t.y === target.y);
      const terrainBonus = targetTile?.defenseBonus || 0;

      const result = calculateDamage(
        actor.attack,
        target.defense,
        ability.damageMultiplier || 1.0,
        hasShield,
        terrainBonus,
        actor.unitClass,
        target.unitClass,
        soloRngRef.current
      );

      let torporApplied = 0;
      if (ability.torporDamage) {
        torporApplied = calculateTorporDamage(ability.torporDamage, target.defense, actor.unitClass);
      }

      setSoloUnits((prev) =>
        prev.map((u) => {
          if (u.id === actor.id) {
            return { ...u, ap: u.ap - ability.apCost };
          }
          if (u.id === target.id) {
            const nextHp = Math.max(0, u.hp - result.damage);
            const nextTorpor = Math.min(u.maxTorpor, u.torpor + torporApplied);
            return { ...u, hp: nextHp, torpor: nextTorpor };
          }
          return u;
        })
      );

      let logMsg = `${actor.name} unleashed [${ability.name}] on ${target.name} for ${result.damage} damage!`;
      if (result.isCritical) logMsg += ' CRITICAL HIT!';
      if (torporApplied > 0) logMsg += ` (+${torporApplied} Torpor)`;

      setSoloLogs((prev) => [
        ...prev,
        {
          id: `log_${Date.now()}`,
          turn: soloTurn,
          actorName: actor.name,
          actionName: ability.name,
          targetName: target.name,
          damage: result.damage,
          torpor: torporApplied,
          text: logMsg,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);

      setSelectedAbilityId(null);

      // Check win condition in solo mode
      const updatedUnits = soloUnits.map((u) => {
        if (u.id === target.id) {
          return { ...u, hp: Math.max(0, u.hp - result.damage) };
        }
        return u;
      });

      const check = checkWinCondition(updatedUnits);
      if (check.isOver) {
        const winner = check.winnerPlayerId || 'player_me';
        // Rewards and sector liberation are paid once, by recordMatchResult (match-over effect).
        setSoloWinner(winner);
      }
    }
  };

  // End Turn
  const handleEndTurn = () => {
    if (!isMyTurn || isMatchOver) return;

    if (currentRoom) {
      act({ type: 'end_turn' });
    } else {
      // End player turn in solo mode, simulate AI turn
      setSoloIsPlayerTurn(false);
      setSoloTurn((t) => t + 1);

      // Refresh AP for AI units
      setSoloUnits((prev) =>
        prev.map((u) => {
          if (!u.isPlayer && u.hp > 0) return { ...u, ap: u.maxAp };
          return u;
        })
      );

      // Automated AI response
      setTimeout(() => {
        runAiTurn();
      }, 800);
    }
  };

  // Automated Rival AI Move in Solo Mode. The bot plan is computed once from the
  // latest units (ref, not a state updater) so it is never double-applied.
  const runAiTurn = () => {
    const result = runBotTurn(soloUnitsRef.current, gridTiles, soloTurnRef.current, soloRngRef.current);
    const check = checkWinCondition(result.units);

    // Hand the turn back with the player's AP refreshed
    setSoloUnits(result.units.map((u) => (u.isPlayer && u.hp > 0 ? { ...u, ap: u.maxAp } : u)));
    setSoloLogs((prev) => [...prev, ...result.logs]);

    if (check.isOver) {
      setSoloWinner(check.winnerPlayerId || 'enemy_bot');
    } else {
      setSoloIsPlayerTurn(true);
    }
  };

  // Send real-time battle chat
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    if (currentRoom) {
      setFloatingNotification('Chat is not available in async matches yet.');
      setTimeout(() => setFloatingNotification(null), 2500);
    } else {
      setSoloLogs((prev) => [
        ...prev,
        {
          id: `chat_${Date.now()}`,
          turn: soloTurn,
          actorName: playerName,
          actionName: 'Comms',
          text: `"${chatInput.trim()}"`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }
    setChatInput('');
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* Top Banner & Match Control */}
      <div className="bg-stone-900/90 rounded-2xl p-4 border border-stone-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        {/* Match Info */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-700/60 shadow">
            <Swords className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-stone-100 text-lg">
                {currentRoom ? currentRoom.name : 'Tactical Proving Grounds'}
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-stone-800 text-amber-300 border border-stone-700">
                {currentRoom ? 'Async PvP' : 'Solo AI Skirmish'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-stone-400 mt-0.5">
              <span>Turn: {currentTurnNumber}</span>
              <span>•</span>
              <span className={isMyTurn ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                {isMatchOver ? 'MATCH OVER' : isMyTurn ? '⚡ YOUR TURN' : "⏳ OPPONENT'S TURN"}
              </span>
              {asyncGame?.turnDeadline && !isMatchOver && (
                <>
                  <span>•</span>
                  <span data-testid="turn-deadline">{timeLeft(asyncGame.turnDeadline)} left</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {!currentRoom ? (
            <button
              onClick={() => setShowLobbyModal(true)}
              className="flex items-center gap-1.5 min-h-11 lg:min-h-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow cursor-pointer transition-transform hover:scale-105"
            >
              <Users className="w-3.5 h-3.5" />
              <span>PvP Duel</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setCurrentRoom(null);
                initSoloMatch();
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700"
            >
              Back to Solo
            </button>
          )}

          {currentRoom && !isMatchOver && (
            <button
              onClick={() => window.confirm('Resign this match? Your opponent wins.') && act({ type: 'resign' })}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-red-900/60 text-red-300 border border-red-900/60 cursor-pointer"
            >
              Resign
            </button>
          )}

          {!currentRoom && (
          <button
            onClick={initSoloMatch}
            className="flex items-center gap-1.5 min-h-11 lg:min-h-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Match</span>
          </button>
          )}

          <button
            onClick={handleEndTurn}
            disabled={!isMyTurn || isMatchOver}
            className={`min-h-11 lg:min-h-0 px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition-all ${
              isMyTurn && !isMatchOver
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white cursor-pointer shadow-emerald-950/50 hover:scale-105'
                : 'bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700'
            }`}
          >
            End Turn & Shift Initiative
          </button>
        </div>
      </div>

      {floatingNotification && (
        <div className="p-3 bg-red-950/90 border border-red-500 text-red-200 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xl animate-bounce">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span>{floatingNotification}</span>
        </div>
      )}

      {/* Active Island Campaign Operation Banner */}
      {activeSectorMission && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/60 via-stone-900 to-stone-950 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase text-cyan-400 font-semibold">
                  Island Campaign Operation
                </span>
                <span className="text-stone-500 text-xs">·</span>
                <span className="text-[10px] font-mono text-amber-400">
                  Threat Tier {activeSectorMission.threatLevel}
                </span>
                <span className="text-stone-500 text-xs">·</span>
                <span className="text-[10px] font-mono text-stone-400">{activeSectorMission.islandName}</span>
              </div>
              <h3 className="font-bold text-stone-100 text-base">
                Sector: {activeSectorMission.sectorName}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-stone-400 block">Liberation Bounty</span>
              <span className="text-xs font-mono font-bold text-cyan-300">
                +{activeSectorMission.rewards.magitekCores} Cores · +{activeSectorMission.rewards.amber} Amber
              </span>
            </div>
            <button
              onClick={() => {
                clearActiveSectorMission();
                setActiveScreen('campaign');
              }}
              className="px-3 py-1.5 rounded-lg border border-stone-700 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-mono transition-all cursor-pointer"
            >
              Island Map
            </button>
          </div>
        </div>
      )}

      {/* Arena Battlefield & Action Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Grid Canvas / Board (3 cols wide) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-stone-950/90 rounded-2xl p-4 sm:p-6 border border-stone-800 shadow-2xl relative overflow-x-auto">
            {/* Field Status Header */}
            <div className="flex items-center justify-between pb-3 text-xs text-stone-400 border-b border-stone-800/80 mb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-stone-300">Tactical Topography Grid (8x6)</span>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-sm shadow-emerald-500/50" />
                  <span>Ally Units</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shadow-sm shadow-red-500/50" />
                  <span>Rival Enemies</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block animate-pulse" />
                  <span>Selected</span>
                </span>
              </div>
            </div>

            {/* Quick actions for the selected unit: attacks live right next to the board */}
            {selectedUnit?.isPlayer && selectedUnit.hp > 0 && !isMatchOver && (
              <div data-testid="quick-actions" className="mb-3 p-2.5 rounded-xl bg-stone-900/80 border border-stone-800 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-stone-300 mr-1">{selectedUnit.name.split(' (')[0]}:</span>
                  {selectedUnit.abilities.map((ability) => {
                    const use = abilityUse(ability);
                    const affordable = selectedUnit.ap >= ability.apCost;
                    const armed = selectedAbilityId === ability.id;
                    const disabled = !isMyTurn || !affordable || use === 'unavailable';
                    return (
                      <button
                        key={ability.id}
                        onClick={() => handleAbilityButton(ability)}
                        disabled={disabled}
                        title={use === 'unavailable' ? 'Support abilities are not usable in this mode yet.' : ability.description}
                        className={`min-h-11 px-3 rounded-lg text-xs font-bold border transition-colors ${
                          armed
                            ? 'bg-red-600 border-red-400 text-white ring-2 ring-red-400/50'
                            : disabled
                            ? 'bg-stone-950/40 border-stone-900 text-stone-600 cursor-not-allowed'
                            : 'bg-stone-800 border-stone-600 text-stone-100 hover:border-red-400 cursor-pointer'
                        }`}
                      >
                        {ability.name}
                        <span className="ml-1.5 font-normal opacity-80">
                          {ability.apCost} AP{use === 'target' ? ` · range ${ability.range}` : use === 'self' ? ' · self' : ' · unavailable'}
                        </span>
                      </button>
                    );
                  })}
                  {armedAbility && (
                    <button onClick={() => setSelectedAbilityId(null)} className="min-h-11 px-3 rounded-lg text-xs font-semibold text-stone-300 border border-stone-700 hover:bg-stone-800 cursor-pointer">
                      Cancel
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-stone-400">
                  {!isMyTurn
                    ? 'Waiting for the other side to finish their turn.'
                    : armedAbility
                    ? enemiesInRange(armedAbility) > 0
                      ? `${armedAbility.name} armed — tap a red-highlighted enemy to attack.`
                      : `${armedAbility.name} armed, but no enemy is within ${armedAbility.range} tile${armedAbility.range > 1 ? 's' : ''}. Cancel and move closer.`
                    : selectedUnit.ap === 0
                    ? 'This unit is out of AP. Select another unit or end your turn.'
                    : 'Tap a green tile to move, or pick an attack and then tap an enemy.'}
                </p>
              </div>
            )}

            {/* The 8x6 Tactical Grid */}
            <div className="w-full max-w-2xl mx-auto grid grid-cols-8 gap-1 sm:gap-2 p-1.5 sm:p-2.5 rounded-xl bg-stone-900/60 border border-stone-800/80 shadow-inner">
              {gridTiles.map((tile) => {
                const unitOnTile = activeUnits.find(
                  (u) => u.x === tile.x && u.y === tile.y && u.hp > 0
                );
                const isSelected = selectedUnit?.x === tile.x && selectedUnit?.y === tile.y;
                const isHovered = hoveredTile?.x === tile.x && hoveredTile?.y === tile.y;

                // Check reachable
                let isReachable = false;
                if (selectedUnit && !unitOnTile && tile.walkable && isMyTurn) {
                  const dist = calculateDistance(selectedUnit.x, selectedUnit.y, tile.x, tile.y);
                  if (dist <= selectedUnit.speed && selectedUnit.ap >= Math.max(1, Math.ceil(dist / 2))) {
                    isReachable = true;
                  }
                }

                // Check targetable with currently selected ability
                let isTargetable = false;
                if (selectedUnit && selectedAbilityId && unitOnTile && !unitOnTile.isPlayer) {
                  const ability = selectedUnit.abilities.find((a) => a.id === selectedAbilityId);
                  if (ability) {
                    const dist = calculateDistance(selectedUnit.x, selectedUnit.y, tile.x, tile.y);
                    if (dist <= ability.range) {
                      isTargetable = true;
                    }
                  }
                }

                // Tiles the armed attack can reach (shown even when no enemy stands there)
                const isInAttackRange =
                  !!selectedUnit &&
                  !!armedAbility &&
                  tile.walkable &&
                  !isSelected &&
                  calculateDistance(selectedUnit.x, selectedUnit.y, tile.x, tile.y) <= armedAbility.range;
                if (armedAbility) isReachable = false; // aiming: hide move highlights

                return (
                  <div
                    key={`${tile.x}_${tile.y}`}
                    data-targetable={isTargetable || undefined}
                    onClick={() => handleTileClick(tile.x, tile.y)}
                    onMouseEnter={() => setHoveredTile(tile)}
                    onMouseLeave={() => setHoveredTile(null)}
                    className={`aspect-square min-w-0 rounded-lg sm:rounded-xl p-0.5 sm:p-1 relative flex flex-col justify-between items-center transition-all cursor-pointer select-none border group ${
                      !tile.walkable
                        ? 'bg-stone-950/90 border-stone-800/80 cursor-not-allowed opacity-90'
                        : isSelected
                        ? 'bg-amber-950/70 border-amber-400 ring-2 ring-amber-400 shadow-lg shadow-amber-950/60 scale-[1.02] z-10'
                        : isTargetable
                        ? 'bg-red-950/60 border-red-500 ring-2 ring-red-500 animate-pulse z-10'
                        : isInAttackRange
                        ? 'bg-red-950/25 border-red-900/70'
                        : isReachable
                        ? 'bg-emerald-950/50 border-emerald-500/70 hover:bg-emerald-900/60'
                        : isHovered
                        ? 'bg-stone-800 border-stone-600 shadow-md'
                        : tile.defenseBonus
                        ? 'bg-emerald-950/30 border-emerald-900/50'
                        : 'bg-stone-900/90 border-stone-800/80 hover:border-stone-700'
                    }`}
                  >
                    {/* Top Tile Coordinates & Terrain Tag */}
                    <div className="w-full hidden sm:flex justify-between items-center text-[9px] text-stone-500 font-mono px-0.5 leading-none">
                      <span>{tile.x},{tile.y}</span>
                      {!tile.walkable && (
                        <span className="text-stone-500 font-bold uppercase text-[8px]">Crags</span>
                      )}
                      {tile.defenseBonus ? (
                        <span className="text-emerald-400 font-bold text-[8px] bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-800/60">
                          +15%
                        </span>
                      ) : null}
                    </div>

                    {/* Unit Sprite / Token Image on Tile */}
                    {unitOnTile ? (
                      <div className="w-full flex flex-col items-center justify-center space-y-1">
                        <div
                          className={`relative w-7 h-7 sm:w-12 sm:h-12 rounded-full overflow-hidden shadow-xl transition-transform group-hover:scale-105 border-2 ${
                            unitOnTile.isPlayer
                              ? 'border-emerald-400 ring-2 ring-emerald-500/40 shadow-emerald-950'
                              : 'border-red-500 ring-2 ring-red-500/40 shadow-red-950'
                          }`}
                        >
                          <img
                            src={getUnitPortrait(unitOnTile)}
                            alt={unitOnTile.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />

                          {/* Class / Faction corner badge */}
                          <div
                            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                              unitOnTile.isPlayer
                                ? 'bg-emerald-600 text-white'
                                : 'bg-red-600 text-white'
                            }`}
                          >
                            {unitOnTile.unitClass[0]}
                          </div>
                        </div>

                        {/* Miniature HP & Torpor bars */}
                        <div className="w-full px-1 space-y-0.5">
                          {/* HP Bar */}
                          <div className="w-full h-1 bg-stone-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${(unitOnTile.hp / unitOnTile.maxHp) * 100}%` }}
                            />
                          </div>
                          {/* Torpor Bar */}
                          {unitOnTile.torpor > 0 && (
                            <div className="w-full h-1 bg-stone-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500 transition-all duration-300"
                                style={{
                                  width: `${(unitOnTile.torpor / unitOnTile.maxTorpor) * 100}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ) : isReachable ? (
                      <div className="w-3.5 h-3.5 rounded-full bg-emerald-400/80 animate-ping my-auto" />
                    ) : null}

                    {/* Bottom Status / AP Badge */}
                    {unitOnTile && (
                      <div className="text-[9px] font-bold text-amber-300 font-mono leading-none">
                        {unitOnTile.ap} AP
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Floating Topographic / Unit Scan Tooltip (Displays on hover) */}
            {hoveredTile && (
              <div className="mt-4 p-3.5 rounded-xl bg-stone-900/95 border border-amber-600/40 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-stone-800 text-amber-400">
                    <Info className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-stone-100">
                        {TERRAIN_INFO[hoveredTile.type]?.name || 'Prehistoric Terrain'}
                      </span>
                      <span className="font-mono text-stone-400 text-[11px]">
                        ({hoveredTile.x}, {hoveredTile.y})
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-stone-800 text-amber-300">
                        {TERRAIN_INFO[hoveredTile.type]?.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-300 mt-0.5">
                      {TERRAIN_INFO[hoveredTile.type]?.effect}
                    </p>
                  </div>
                </div>

                {/* If a unit occupies this hovered tile, preview stats */}
                {activeUnits.find((u) => u.x === hoveredTile.x && u.y === hoveredTile.y && u.hp > 0) && (() => {
                  const u = activeUnits.find((unit) => unit.x === hoveredTile.x && unit.y === hoveredTile.y && unit.hp > 0)!;
                  return (
                    <div className="flex items-center gap-3 bg-stone-950/80 px-3 py-1.5 rounded-xl border border-stone-800">
                      <img
                        src={getUnitPortrait(u)}
                        alt={u.name}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-full object-cover border border-stone-700"
                      />
                      <div>
                        <div className="font-bold text-stone-200 text-xs flex items-center gap-1.5">
                          <span>{u.name}</span>
                          <span className={`text-[9px] uppercase font-bold px-1 rounded ${u.isPlayer ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}`}>
                            {u.isPlayer ? 'Ally' : 'Rival'}
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-400 flex gap-2">
                          <span className="text-emerald-400 font-semibold">HP {u.hp}/{u.maxHp}</span>
                          <span>•</span>
                          <span className="text-purple-400 font-semibold">Torpor {u.torpor}/{u.maxTorpor}</span>
                          <span>•</span>
                          <span className="text-amber-400 font-semibold">{u.ap} AP</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Victory / Defeat Overlay Banner */}
            {isMatchOver && (
              <div className="absolute inset-0 bg-stone-950/90 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 text-center space-y-4 animate-fade-in z-20">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                  <Flame className="w-12 h-12 text-amber-400 mx-auto" />
                </div>
                <h3 className="text-3xl font-black text-stone-100">
                  {winnerId === (currentRoom ? myPlayerId : 'player_me')
                    ? activeSectorMission
                      ? 'SECTOR LIBERATED!'
                      : 'VICTORY IN THE SANDS!'
                    : 'DEFEAT IN THE ARENA'}
                </h3>
                <p className="text-sm text-stone-300 max-w-md">
                  {winnerId === (currentRoom ? myPlayerId : 'player_me')
                    ? activeSectorMission
                      ? `The Evil Tribe garrison at ${activeSectorMission.sectorName} has been routed! You earned +${activeSectorMission.rewards.magitekCores} Magitek Cores and +${activeSectorMission.rewards.amber} Amber.`
                      : 'Your dinosaur squad conquered the battlefield! Prehistoric Amber and battle experience granted.'
                    : 'Your squad was incapacitated. Retreat to your Base Camp Enclave to heal and regroup.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {activeSectorMission && winnerId === (currentRoom ? myPlayerId : 'player_me') && (
                    <button
                      onClick={() => {
                        clearActiveSectorMission();
                        setActiveScreen('campaign');
                      }}
                      className="px-6 py-2.5 rounded-xl font-bold text-xs bg-cyan-600 hover:bg-cyan-500 text-stone-950 shadow-lg cursor-pointer transition-transform hover:scale-105"
                    >
                      Return to Island Campaign Map
                    </button>
                  )}
                  <button
                    onClick={initSoloMatch}
                    className="px-6 py-2.5 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-500 text-white shadow-lg cursor-pointer transition-transform hover:scale-105"
                  >
                    Battle Again
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Unit Action Bar (Details & Abilities) */}
          {selectedUnit && (
            <div className="bg-stone-900/90 rounded-2xl p-5 border border-stone-800 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-stone-800">
                <div className="flex items-center gap-3.5">
                  {/* High Quality Character Portrait */}
                  <div
                    className={`relative w-14 h-14 rounded-2xl overflow-hidden shadow-xl border-2 ${
                      selectedUnit.isPlayer ? 'border-emerald-400 ring-2 ring-emerald-500/30' : 'border-red-400 ring-2 ring-red-500/30'
                    }`}
                  >
                    <img
                      src={getUnitPortrait(selectedUnit)}
                      alt={selectedUnit.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div>
                    <h4 className="font-extrabold text-stone-100 text-base flex items-center gap-2">
                      <span>{selectedUnit.name}</span>
                      {(() => {
                        const classInfo = CLASS_TACTICAL_DETAILS[selectedUnit.unitClass] || CLASS_TACTICAL_DETAILS.Blade;
                        return (
                          <span
                            className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${classInfo.color}`}
                            title={classInfo.bonus}
                          >
                            {classInfo.name} Class · {classInfo.role}
                          </span>
                        );
                      })()}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-stone-400 mt-1 flex-wrap">
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5" /> HP: {selectedUnit.hp}/{selectedUnit.maxHp}
                      </span>
                      <span>•</span>
                      <span className="text-purple-400 font-semibold flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5" /> Torpor: {selectedUnit.torpor}/{selectedUnit.maxTorpor}
                      </span>
                      <span>•</span>
                      <span>Attack: {selectedUnit.attack}</span>
                      <span>•</span>
                      <span>Defense: {selectedUnit.defense}</span>
                      <span>•</span>
                      <span>Speed: {selectedUnit.speed} tiles</span>
                    </div>
                  </div>
                </div>

                {/* AP Counter */}
                <div className="flex items-center gap-2 bg-stone-950 px-3.5 py-2 rounded-xl border border-stone-800">
                  <span className="text-xs text-stone-400 font-semibold">Action Points:</span>
                  <div className="flex gap-1.5">
                    {Array.from({ length: selectedUnit.maxAp }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-3.5 h-3.5 rounded-md ${
                          i < selectedUnit.ap ? 'bg-amber-400 shadow shadow-amber-400/50' : 'bg-stone-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Abilities List with Hover Tooltips */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Select Tactical Ability (Hover for breakdown):</span>
                  </span>
                  <span className="text-[11px] text-stone-400">
                    Remaining AP: <strong className="text-amber-300">{selectedUnit.ap}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {selectedUnit.abilities.map((ability) => {
                    const isSelected = selectedAbilityId === ability.id;
                    const canAffordAp = selectedUnit.ap >= ability.apCost;

                    return (
                      <div
                        key={ability.id}
                        className="relative"
                        onMouseEnter={() => setHoveredAbility(ability)}
                        onMouseLeave={() => setHoveredAbility(null)}
                      >
                        <button
                          onClick={() => handleAbilityButton(ability)}
                          disabled={!canAffordAp || !selectedUnit.isPlayer || !isMyTurn || abilityUse(ability) === 'unavailable'}
                          className={`w-full p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 cursor-pointer shadow h-full ${
                            isSelected
                              ? 'bg-amber-950/80 border-amber-400 ring-2 ring-amber-400/40 text-amber-100'
                              : canAffordAp
                              ? 'bg-stone-950/80 border-stone-800 hover:border-amber-600/60 text-stone-200'
                              : 'bg-stone-950/40 border-stone-900 text-stone-600 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs flex items-center gap-1.5">
                              {ability.iconName === 'Zap' && <Zap className="w-3.5 h-3.5 text-amber-400" />}
                              {ability.iconName === 'Shield' && <Shield className="w-3.5 h-3.5 text-emerald-400" />}
                              {ability.iconName === 'Crosshair' && <Crosshair className="w-3.5 h-3.5 text-red-400" />}
                              {ability.iconName === 'Hammer' && <Hammer className="w-3.5 h-3.5 text-blue-400" />}
                              {ability.iconName === 'Droplet' && <Droplet className="w-3.5 h-3.5 text-purple-400" />}
                              <span>{ability.name}</span>
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-amber-300 font-bold border border-stone-700">
                              {ability.apCost} AP
                            </span>
                          </div>

                          <p className="text-[11px] text-stone-400 line-clamp-2 leading-relaxed">
                            {ability.description}
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1.5 border-t border-stone-800/80">
                            <span>Range: {ability.range} tile{ability.range > 1 ? 's' : ''}</span>
                            {ability.torporDamage ? (
                              <span className="text-purple-400 font-bold">
                                +{ability.torporDamage} Torpor
                              </span>
                            ) : ability.damageMultiplier ? (
                              <span className="text-red-400 font-bold">
                                {Math.round(ability.damageMultiplier * 100)}% DMG
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Ability Tooltip Detail Popup */}
                {hoveredAbility && (
                  <div className="p-3.5 rounded-xl bg-stone-950/95 border border-amber-600/50 shadow-2xl text-xs space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-stone-800 pb-1.5">
                      <span className="font-bold text-amber-300 text-sm">
                        {hoveredAbility.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-bold border border-amber-800 text-[10px]">
                          Cost: {hoveredAbility.apCost} AP
                        </span>
                        <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 text-[10px]">
                          Range: {hoveredAbility.range} tile(s)
                        </span>
                      </div>
                    </div>
                    <p className="text-stone-300 text-xs leading-relaxed">
                      {hoveredAbility.description}
                    </p>
                    <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-stone-400 border-t border-stone-800/60">
                      {hoveredAbility.damageMultiplier && (
                        <span>Damage Multiplier: <strong className="text-red-400">{hoveredAbility.damageMultiplier}x</strong></span>
                      )}
                      {hoveredAbility.torporDamage && (
                        <span>Torpor Infliction: <strong className="text-purple-400">+{hoveredAbility.torporDamage}</strong></span>
                      )}
                      {hoveredAbility.effect && (
                        <span>Applies Status: <strong className="text-amber-400 capitalize">{hoveredAbility.effect}</strong></span>
                      )}
                      {hoveredAbility.areaOfEffect && (
                        <span>Splash Radius: <strong className="text-cyan-400">{hoveredAbility.areaOfEffect} tile(s)</strong></span>
                      )}
                    </div>
                  </div>
                )}

                {selectedAbilityId && (
                  <div className="p-3 bg-amber-950/70 border border-amber-500/60 rounded-xl text-xs text-amber-200 flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-2">
                      <Crosshair className="w-4 h-4 text-amber-400 animate-spin" />
                      <span>
                        🎯 <strong>{selectedUnit.abilities.find((a) => a.id === selectedAbilityId)?.name}</strong> armed! Click an highlighted enemy dinosaur in range to execute.
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedAbilityId(null)}
                      className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold cursor-pointer"
                    >
                      Cancel Target
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Tactical Scout Scanner & Combat Feed (1 col wide) */}
        <div className="space-y-4">
          {/* Tactical Scout Scanner Panel (Unit & Terrain Inspection) */}
          <div className="bg-stone-900/90 rounded-2xl p-4 border border-stone-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-800">
              <h4 className="font-bold text-stone-200 text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>Tactical Inspection Scanner</span>
              </h4>
              <span className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/50">
                Live Scan
              </span>
            </div>

            {inspectedUnit ? (
              <div className="space-y-3">
                {/* Character / Dino Portrait & Class Header */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 shadow-lg shrink-0 ${
                      inspectedUnit.isPlayer ? 'border-emerald-500' : 'border-red-500'
                    }`}
                  >
                    <img
                      src={getUnitPortrait(inspectedUnit)}
                      alt={inspectedUnit.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h5 className="font-extrabold text-stone-100 text-sm leading-tight">
                      {inspectedUnit.name}
                    </h5>
                    <div className="flex items-center gap-1.5 text-xs text-stone-400 mt-0.5">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        inspectedUnit.isPlayer ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'
                      }`}>
                        {inspectedUnit.isPlayer ? 'Ally Squad' : 'Rival Clan'}
                      </span>
                      <span className="text-amber-400 font-semibold">{inspectedUnit.unitClass}</span>
                    </div>
                  </div>
                </div>

                {/* HP Gauge */}
                <div className="space-y-1 bg-stone-950/70 p-2 rounded-lg border border-stone-800/80">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Heart className="w-3 h-3" /> Vitality HP
                    </span>
                    <span className="text-stone-300 font-mono">
                      {inspectedUnit.hp} / {inspectedUnit.maxHp} ({Math.round((inspectedUnit.hp / inspectedUnit.maxHp) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-stone-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
                      style={{ width: `${(inspectedUnit.hp / inspectedUnit.maxHp) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Torpor Gauge */}
                <div className="space-y-1 bg-stone-950/70 p-2 rounded-lg border border-stone-800/80">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-purple-400 flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Torpor (Drowsiness)
                    </span>
                    <span className="text-stone-300 font-mono">
                      {inspectedUnit.torpor} / {inspectedUnit.maxTorpor}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-stone-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-cyan-400 transition-all duration-300"
                      style={{ width: `${(inspectedUnit.torpor / inspectedUnit.maxTorpor) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-stone-500 block">
                    {inspectedUnit.torpor >= inspectedUnit.maxTorpor
                      ? '⚠️ Unconscious! Cannot take actions.'
                      : 'Build torpor using Tranq Darts or tail clubs.'}
                  </span>
                </div>

                {/* Stats Matrix */}
                <div className="grid grid-cols-4 gap-1.5 text-center bg-stone-950/70 p-2 rounded-lg border border-stone-800/80 text-[10px]">
                  <div>
                    <div className="text-stone-500 font-bold uppercase">Attack</div>
                    <div className="font-extrabold text-red-400 text-xs">{inspectedUnit.attack}</div>
                  </div>
                  <div>
                    <div className="text-stone-500 font-bold uppercase">Defense</div>
                    <div className="font-extrabold text-blue-400 text-xs">{inspectedUnit.defense}</div>
                  </div>
                  <div>
                    <div className="text-stone-500 font-bold uppercase">Speed</div>
                    <div className="font-extrabold text-amber-400 text-xs">{inspectedUnit.speed} T</div>
                  </div>
                  <div>
                    <div className="text-stone-500 font-bold uppercase">AP</div>
                    <div className="font-extrabold text-emerald-400 text-xs">{inspectedUnit.ap}/{inspectedUnit.maxAp}</div>
                  </div>
                </div>

                {/* Active Status Effects */}
                {inspectedUnit.statusEffects.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                      Active Status Effects:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {inspectedUnit.statusEffects.map((status, idx) => {
                        const detail = STATUS_EFFECT_DETAILS[status.type];
                        return (
                          <div
                            key={idx}
                            onMouseEnter={() => setHoveredStatus(status.type)}
                            onMouseLeave={() => setHoveredStatus(null)}
                            className="px-2 py-1 rounded bg-stone-950 border border-stone-700 text-[10px] text-stone-300 flex items-center gap-1 cursor-pointer"
                          >
                            <span className="font-bold capitalize text-amber-300">{status.type}</span>
                            <span className="text-stone-500">({status.duration}t)</span>
                          </div>
                        );
                      })}
                    </div>

                    {hoveredStatus && STATUS_EFFECT_DETAILS[hoveredStatus] && (
                      <div className="p-2 rounded bg-stone-950 border border-stone-700 text-[11px] text-stone-300 space-y-1">
                        <strong className="text-amber-400">{STATUS_EFFECT_DETAILS[hoveredStatus].name}:</strong>
                        <p className="text-stone-400 text-[10px]">{STATUS_EFFECT_DETAILS[hoveredStatus].description}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-stone-500 text-xs space-y-2">
                <Compass className="w-8 h-8 mx-auto text-stone-700" />
                <p>Hover or click any dinosaur or tile on the arena battlefield to scan tactical attributes.</p>
              </div>
            )}
          </div>

          {/* Combat Feed & Real-time Chat (1 col wide) */}
          <div className="bg-stone-900/90 rounded-2xl p-4 border border-stone-800 shadow-xl flex flex-col justify-between space-y-4 max-h-[380px]">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <h4 className="font-bold text-stone-200 text-sm flex items-center gap-2">
                  <Swords className="w-4 h-4 text-red-400" />
                  <span>Combat Feed</span>
                </h4>
                <span className="text-[11px] text-stone-400">Tactical Log</span>
              </div>

              <div className="space-y-2 overflow-y-auto max-h-52 pr-1 text-xs">
                {activeLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded-lg bg-stone-950/60 border border-stone-800/60 text-stone-300 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-stone-500">
                      <span className="font-bold text-amber-400">{log.actorName}</span>
                      <span>{/^\d{4}-\d\d-\d\dT/.test(log.timestamp) ? new Date(log.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : log.timestamp}</span>
                    </div>
                    <p className="leading-relaxed text-stone-300 text-[11px]">{log.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Chat Input */}
            <form onSubmit={handleSendChat} className="pt-2 border-t border-stone-800 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Tactical coms..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="p-2 min-h-11 min-w-11 lg:min-h-0 lg:min-w-0 flex items-center justify-center rounded-lg bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
