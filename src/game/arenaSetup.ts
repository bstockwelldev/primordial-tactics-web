import { GridTile, IslandSector, TamedDino, UnitEntity } from '../types/game';
import { BALANCE, coopEnemyScaleFor, enemyLevelScale, playerLevelScale } from './balance';
import { DINOSAUR_SPECIES, UNIT_PORTRAITS } from './constants';

// Arena and squad construction for solo matches (skirmish + campaign). Pure, so the
// browser and the headless simulator build exactly the same match.

/**
 * Extra terrain for campaign arenas, by island (PvP and skirmish keep the plain arena).
 * Water: +1 AP to enter. Mud: -1 tile of reach. Bones: +5 defense. Tempest is open sky.
 */
export const ISLAND_TERRAIN: Record<string, Array<{ x: number; y: number; type: 'water' | 'mud' | 'bones' }>> = {
  primoris: [
    { x: 3, y: 2, type: 'water' },
    { x: 4, y: 3, type: 'water' },
    { x: 3, y: 4, type: 'water' },
  ],
  caldera: [
    { x: 2, y: 3, type: 'mud' },
    { x: 5, y: 2, type: 'mud' },
    { x: 4, y: 4, type: 'mud' },
  ],
  magitek_core: [
    { x: 3, y: 2, type: 'bones' },
    { x: 4, y: 3, type: 'bones' },
    { x: 4, y: 1, type: 'bones' },
  ],
};

/** The 8x6 arena: four rocks, two foliage tiles (+15 defense), plus the island's terrain if given. */
export function buildArenaGrid(islandId?: string): GridTile[] {
  const tiles: GridTile[] = [];
  const rocks = [
    { x: 2, y: 1 },
    { x: 5, y: 4 },
    { x: 3, y: 3 },
    { x: 4, y: 2 },
  ];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 8; x++) {
      const isRock = rocks.some((r) => r.x === x && r.y === y);
      const isFoliage = (x === 1 && y === 4) || (x === 6 && y === 1);
      tiles.push({
        x,
        y,
        type: isRock ? 'rock' : isFoliage ? 'foliage' : 'grass',
        walkable: !isRock,
        defenseBonus: isFoliage ? 15 : 0,
      });
    }
  }
  for (const o of (islandId && ISLAND_TERRAIN[islandId]) || []) {
    const t = tiles.find((tile) => tile.x === o.x && tile.y === o.y);
    if (t && t.type === 'grass') {
      t.type = o.type;
      t.defenseBonus = o.type === 'bones' ? 5 : 0;
    }
  }
  return tiles;
}

/** Pass & play: a buddy joins the host's party (see docs/local-coop-spec.md). */
export interface PartyOptions {
  guestName: string;
  /** Enemy stat multiplier for this match. Default: the sector's coopEnemyScaleFor. The balance report overrides it to tune. */
  enemyScale?: number;
}

/**
 * Player squad (commander + first two tamed dinos) and the enemy squad: the
 * sector's level-scaled squad for a campaign mission, otherwise the default rivals.
 */
export function buildSoloUnits(
  playerName: string,
  tamedDinos: TamedDino[],
  activeSectorMission: IslandSector | null,
  playerLevel: number = BALANCE.startLevel,
  party?: PartyOptions
): UnitEntity[] {
  // Player Hero is Human class with long-range tech utility
  const playerHeroUnit: UnitEntity = {
    id: 'player_hero',
    isPlayer: true,
    ownerId: 'player_me',
    name: `${playerName} (Commander)`,
    unitClass: 'Human',
    imageUrl: UNIT_PORTRAITS.hunter,
    x: 0,
    y: 2,
    hp: 200,
    maxHp: 200,
    torpor: 0,
    maxTorpor: 100,
    ap: 3,
    maxAp: 3,
    attack: 42,
    defense: 22,
    speed: 3,
    avatarIcon: 'User',
    abilities: [
      {
        id: 'tranq_shot',
        name: 'Tranq Rifle',
        apCost: 2,
        cooldown: 0,
        range: 4,
        targetType: 'enemy',
        damageMultiplier: 0.85,
        torporDamage: 50,
        description: 'Long-range narcotic dart inflicting 50 torpor damage and piercing light armor.',
        iconName: 'Crosshair',
      },
      {
        id: 'spear_thrust',
        name: 'Obsidian Spear',
        apCost: 1,
        cooldown: 0,
        range: 1,
        targetType: 'enemy',
        damageMultiplier: 1.0,
        description: 'Melee piercing strike dealing 100% physical damage.',
        iconName: 'Zap',
      },
    ],
    statusEffects: [],
  };

  // Dino 1 (Blade Class)
  const dino1 = tamedDinos[0];
  const dino1Species = dino1?.speciesId ? DINOSAUR_SPECIES[dino1.speciesId] : DINOSAUR_SPECIES.velociraptor;
  const playerDino1: UnitEntity = {
    id: 'player_raptor',
    isPlayer: true,
    ownerId: 'player_me',
    name: dino1?.customName || 'Ghostclaw (Raptor)',
    speciesId: dino1?.speciesId || 'velociraptor',
    unitClass: dino1Species?.unitClass || 'Blade',
    imageUrl: dino1?.imageUrl || dino1Species?.imageUrl || UNIT_PORTRAITS.velociraptor,
    x: 1,
    y: 1,
    hp: dino1?.maxHp || 160,
    maxHp: dino1?.maxHp || 160,
    torpor: dino1?.currentTorpor || 0,
    maxTorpor: dino1?.maxTorpor || 120,
    ap: 3,
    maxAp: 3,
    attack: dino1?.attack || 48,
    defense: dino1?.defense || 16,
    speed: dino1?.speed || 4,
    avatarIcon: 'Zap',
    abilities: dino1Species ? dino1Species.innateAbilities : DINOSAUR_SPECIES.velociraptor.innateAbilities,
    statusEffects: [],
  };

  // Dino 2 (Skewer Class)
  const dino2 = tamedDinos[1];
  const dino2Species = dino2?.speciesId ? DINOSAUR_SPECIES[dino2.speciesId] : DINOSAUR_SPECIES.triceratops;
  const playerDino2: UnitEntity = {
    id: 'player_trike',
    isPlayer: true,
    ownerId: 'player_me',
    name: dino2?.customName || 'Shieldhorn (Trike)',
    speciesId: dino2?.speciesId || 'triceratops',
    unitClass: dino2Species?.unitClass || 'Skewer',
    imageUrl: dino2?.imageUrl || dino2Species?.imageUrl || UNIT_PORTRAITS.triceratops,
    x: 1,
    y: 4,
    hp: dino2?.maxHp || 290,
    maxHp: dino2?.maxHp || 290,
    torpor: dino2?.currentTorpor || 0,
    maxTorpor: dino2?.maxTorpor || 260,
    ap: 3,
    maxAp: 3,
    attack: dino2?.attack || 34,
    defense: dino2?.defense || 38,
    speed: dino2?.speed || 2,
    avatarIcon: 'Shield',
    abilities: dino2Species ? dino2Species.innateAbilities : DINOSAUR_SPECIES.triceratops.innateAbilities,
    statusEffects: [],
  };

  // The buddy's commander is a second Human-class unit built like the host's. It keeps ownerId
  // 'player_me': winning, rewards and saves belong to the host (spec 3.5), and the arena identifies
  // the winning side by that id. Which human commands a unit is the separate `controller` field.
  const guestCommander: UnitEntity = {
    ...playerHeroUnit,
    id: 'player_guest',
    name: `${party?.guestName.trim() || 'Buddy'} (Commander)`,
    x: 0,
    y: 3,
    abilities: playerHeroUnit.abilities.map((a) => ({ ...a })),
    statusEffects: [],
  };
  // Default split: host keeps the commander and first dino; buddy gets the guest commander and second dino.
  const roster: UnitEntity[] = party
    ? [
        { ...playerHeroUnit, controller: 0 },
        { ...playerDino1, controller: 0 },
        { ...playerDino2, controller: 1 },
        { ...guestCommander, controller: 1 },
      ]
    : [playerHeroUnit, playerDino1, playerDino2];

  const grow = playerLevelScale(playerLevel);
  const playerUnits = roster.map((u) =>
    grow === 1
      ? u
      : {
          ...u,
          hp: Math.round(u.hp * grow),
          maxHp: Math.round(u.maxHp * grow),
          attack: Math.round(u.attack * grow),
          defense: Math.round(u.defense * grow),
        }
  );

  // Enemy units: build from activeSectorMission if launching campaign operation, else default rivals
  let enemyUnits: UnitEntity[] = [];
  if (activeSectorMission && activeSectorMission.enemySquad.length > 0) {
    const spawnSlots = [
      { x: 7, y: 3 },
      { x: 6, y: 1 },
      { x: 6, y: 4 },
    ];
    enemyUnits = activeSectorMission.enemySquad.map((enemy, idx) => {
      const slot = spawnSlots[idx] || { x: 7, y: idx + 1 };
      const species = enemy.speciesId ? DINOSAUR_SPECIES[enemy.speciesId] : null;
      const levelScale = enemyLevelScale(enemy.level);
      const hp = species ? Math.round(species.baseHp * levelScale) : 190;
      const attack = species ? Math.round(species.baseAttack * levelScale) : 40;
      const defense = species ? Math.round(species.baseDefense * levelScale) : 22;
      const speed = species ? species.baseSpeed : 3;

      return {
        id: `enemy_sector_${idx}`,
        isPlayer: false,
        ownerId: 'ai_bot',
        name: enemy.name,
        speciesId: enemy.speciesId,
        unitClass: enemy.unitClass,
        imageUrl:
          species?.imageUrl ||
          (enemy.unitClass === 'Human' ? UNIT_PORTRAITS.warlord : UNIT_PORTRAITS.velociraptor),
        x: slot.x,
        y: slot.y,
        hp,
        maxHp: hp,
        torpor: 0,
        maxTorpor: species ? species.baseTorporMax : 110,
        ap: 3,
        maxAp: 3,
        attack,
        defense,
        speed,
        avatarIcon: enemy.unitClass === 'Human' ? 'User' : 'Zap',
        abilities: species
          ? species.innateAbilities
          : [
              {
                id: 'tribe_spear',
                name: 'Primal Glaive',
                apCost: 2,
                cooldown: 0,
                range: 1,
                targetType: 'enemy',
                damageMultiplier: 1.15,
                description: 'Vicious slashing spear attack.',
                iconName: 'Zap',
              },
              {
                id: 'tribe_dart',
                name: 'Venom Needle',
                apCost: 2,
                cooldown: 0,
                range: 3,
                targetType: 'enemy',
                damageMultiplier: 0.85,
                torporDamage: 35,
                description: 'Poison dart applying torpor.',
                iconName: 'Crosshair',
              },
            ],
        statusEffects: [],
      };
    });
  } else {
    enemyUnits = [
      {
        id: 'enemy_hero',
        isPlayer: false,
        ownerId: 'ai_bot',
        name: 'Warlord Vorn (Rival)',
        unitClass: 'Blade',
        imageUrl: UNIT_PORTRAITS.warlord,
        x: 7,
        y: 3,
        hp: 200,
        maxHp: 200,
        torpor: 0,
        maxTorpor: 100,
        ap: 3,
        maxAp: 3,
        attack: 40,
        defense: 20,
        speed: 3,
        avatarIcon: 'User',
        abilities: [
          {
            id: 'tranq_shot',
            name: 'Tranq Rifle',
            apCost: 2,
            cooldown: 0,
            range: 4,
            targetType: 'enemy',
            damageMultiplier: 0.85,
            torporDamage: 45,
            description: 'Narcotic dart build up.',
            iconName: 'Crosshair',
          },
        ],
        statusEffects: [],
      },
      {
        id: 'enemy_ankylosaur',
        isPlayer: false,
        ownerId: 'ai_bot',
        name: 'Ironhide (Ankylosaurus)',
        speciesId: 'ankylosaurus',
        unitClass: 'Crush',
        imageUrl: UNIT_PORTRAITS.ankylosaurus,
        x: 6,
        y: 2,
        hp: 270,
        maxHp: 270,
        torpor: 0,
        maxTorpor: 240,
        ap: 3,
        maxAp: 3,
        attack: 44,
        defense: 45,
        speed: 2,
        avatarIcon: 'Hammer',
        abilities: DINOSAUR_SPECIES.ankylosaurus.innateAbilities,
        statusEffects: [],
      },
      {
        id: 'enemy_dilopho',
        isPlayer: false,
        ownerId: 'ai_bot',
        name: 'Venomspit (Dilophosaurus)',
        speciesId: 'dilophosaurus',
        unitClass: 'Blade',
        imageUrl: UNIT_PORTRAITS.dilophosaurus,
        x: 6,
        y: 4,
        hp: 170,
        maxHp: 170,
        torpor: 0,
        maxTorpor: 130,
        ap: 3,
        maxAp: 3,
        attack: 40,
        defense: 18,
        speed: 3,
        avatarIcon: 'Droplet',
        abilities: DINOSAUR_SPECIES.dilophosaurus.innateAbilities,
        statusEffects: [],
      },
    ];
  }

  // A party of four is stronger than the squad of three the sectors were built for.
  const coopScale = party ? party.enemyScale ?? coopEnemyScaleFor(activeSectorMission?.id) : 1;
  if (coopScale !== 1) {
    enemyUnits = enemyUnits.map((u) => ({
      ...u,
      hp: Math.round(u.hp * coopScale),
      maxHp: Math.round(u.maxHp * coopScale),
      attack: Math.round(u.attack * coopScale),
      defense: Math.round(u.defense * coopScale),
    }));
  }

  return [...playerUnits, ...enemyUnits];
}
