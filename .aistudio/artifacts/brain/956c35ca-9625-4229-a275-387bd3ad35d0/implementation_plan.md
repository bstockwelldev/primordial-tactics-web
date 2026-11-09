# Primordial Tactics: Island Liberation & Magitek Evolution

An architectural and feature implementation plan aligning the existing web tactical RPG with the official **Primordial Tactics Game Design Document (V1.1)**, introducing an interactive multi-island liberation campaign, GDD-standardized combat classes, and the ancient Magitek technology progression system.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following key design decisions were confirmed during the Phase 1 clarification interview and govern this implementation plan:

- **Island Liberation Campaign**: Added an interactive Island Liberation Campaign Map featuring sector-by-sector tactical battle nodes, territory liberation tracking, and story lore tracing the struggle against the Evil Tribe.
- **Combat Unit Class Taxonomy**: Fully adopted the document's 5 core unit classes: `Blade` (agile slashing predators), `Skewer` (piercing frontal horn assault), `Crush` (heavy armored blunt impact & torpor), `Hulk` (colossal apex juggernauts), and `Human` (tactical survivor commanders & rifle skirmishers).
- **Magitek Ancient Technology Integration**: Introduced a dedicated **Magitek Research Lab** building inside the Base Enclave where recovered Magitek Cores from liberated island sectors are researched to unlock cybernetic gear, kinetic shields, and advanced dinosaur ability augmentations.

---

## 1. Overview & Core Concept

### What It Does
*Primordial Tactics* brings the full **Fight → Survive → Strengthen → Repeat** gameplay loop from the Game Design Document to life:
1. **Fight**: Tactical turn-based battles on an 8x6 topographic grid against the Evil Tribe's war dinosaurs and competitive multiplayer duels.
2. **Survive**: High-stakes taming expeditions into distinct island biomes, managing tranquilizer darts, torpor meters, and primal rations.
3. **Strengthen**: Base camp facility construction, Magitek tech research, amber gene mutations, and custom ability loadouts.
4. **Liberate & Repeat**: Traversal of diverse island archipelagos, liberating captured sectors from the Evil Tribe to reveal the mystery of ancient Magitek.

### Target Audience & Persona
Strategy and RPG enthusiasts who enjoy deep turn-based grid tactics (*Final Fantasy Tactics*, *Fire Emblem*, *Into the Breach*), dinosaur survival and taming loops (*ARK: Survival Evolved*), and tech-tree progression.

### Key Value
Seamless, real-time synchronization with deep tactical depth—playable directly in any browser on desktop or mobile, powered by Node.js, WebSockets, and Gemini AI tactical commanders.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Island Campaign Progression**:
   - Player navigates to the new **Island Campaign** navigation view.
   - An interactive archipelago map displays multiple islands (**Isla Primoris**, **Basalt Caldera**, **Tempest Spire**, and **The Magitek Core**).
   - Each island features contested sectors controlled by the Evil Tribe with clear threat ratings, enemy squad previews, and Magitek relic rewards.
   - Launching a sector loads a tactical battle with specific win conditions (wipe out tribe forces, rescue captive beasts, secure Magitek consoles).
   - Victorious battles liberate the sector, granting territorial resource yields and narrative story logs.

2. **Tactical Combat with Document Classes**:
   - Units deploy with standardized GDD classes (`Blade`, `Skewer`, `Crush`, `Hulk`, `Human`).
   - The battle HUD displays class badges with distinct tactical roles:
     - `Blade` (Velociraptor, Deinonychus): High mobility, critical strike bonus, arterial bleed lacerations.
     - `Skewer` (Triceratops, Styracosaurus): Direct charge paths, armor piercing, 2-tile knockback thrusts.
     - `Crush` (Ankylosaurus, Doedicurus): Heavy osteoderm protection, bone-shattering tail clubs, massive torpor infliction.
     - `Hulk` (Apex Carno, Titan Trike): Giant HP pools, earthshaker tremors, multi-target intimidation.
     - `Human` (Survivor Commander): Long-range tranq dart rifles, command rallying buffs, obsidian spears.

3. **Magitek Research & Crafting**:
   - Players unlock and upgrade the **Magitek Research Lab** in the Base Enclave.
   - Researched technologies unlock advanced recipes in the Primal Smithy: *Magitek Tranq Railguns*, *Cyber-Neural Collars*, *Force-Field Saddles*, and *Magitek Overdrive*.
   - In the Gene Incubator, tamed dinosaurs can equip Magitek augmentations alongside natural amber evolutions.

### Visual Identity & Theme
- **Color Palette & Atmospheric Balance (60-30-10 Budget)**:
  - *60% Neutral Ground*: Deep primeval obsidian canvas (`#0C0A09`), slate earth (`#1C1917`), and weathered basalt.
  - *30% Structural Surfaces*: Jurassic fern emerald (`#064E3B`), volcanic bronze (`#78350F`), and deep purple gene labs (`#3B0764`).
  - *10% Focal Accents*: Electric Magitek cyan (`#06B6D4`), prehistoric amber gold (`#F59E0B`), and tribal war crimson (`#EF4444`).
- **Typography & Clean Metadata**:
  - Display Font: `Plus Jakarta Sans` / `Outfit` for bold, impactful headers.
  - Telemetry & Numbers: `font-mono tabular-nums` for AP, HP gauges, and coordinates.
  - Zero-Pill Discipline: Unboxed inline text metadata with subtle typographic separators (`·`, `/`).
- **Tactical Clarity**:
  - Actual high-resolution character tokens for all species and leaders with faction ring illumination.
  - Live hover inspection tooltips for terrain bonuses, status effects, and damage multipliers.

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Rationale | Alternatives Considered |
| :--- | :--- | :--- | :--- |
| **Campaign Structure** | Interactive Island Sector Map with node progression | Directly realizes Section 1 & 3 of GDD (island liberation against Evil Tribe) without disrupting the open PvP Tactical Arena. | Linear battle list (rejected: lacks visual sense of island exploration). |
| **Combat Class Architecture** | Adopt `{ Blade, Skewer, Crush, Hulk, Human }` | Adheres strictly to the GDD C# schema while preserving existing species balance and tactical counters. | Hybrid dual-classing (rejected: adds confusing UI clutter). |
| **Magitek Integration** | Magitek Research Lab facility + crafting recipes | Integrates cleanly into the existing Base Camp upgrade system while unlocking tangible endgame tactical powers. | Purely cosmetic skins (rejected: lacks gameplay progression depth). |
| **Save & Multi-Session Persistence** | Firestore database sync + local fallback | Matches our already provisioned Firestore DB (`ai-studio-primaltacticsdin-...`) to preserve liberated sectors and tamed rosters. | Browser-only localStorage (rejected: loses cross-device play). |

---

## 4. Technical Architecture & Data Strategy

### System Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRIMORDIAL TACTICS UI                          │
├─────────────────┬─────────────────┬─────────────────┬──────────────────┤
│ Base Enclave    │ Island Campaign │ Tactical Arena  │ Gene & Magitek   │
│ - Longhouse     │ - Sector Nodes  │ - 8x6 Grid Map  │ - Amber Trees    │
│ - Dino Stable   │ - Evil Tribe AI │ - Class Powers  │ - Cyber Augments │
│ - Smithy Craft  │ - Magitek Lore  │ - Real-Time PvP │ - Stat Boosts    │
└────────┬────────┴────────┬────────┴────────┬────────┴────────┬─────────┘
         │                 │                 │                 │
         ▼                 ▼                 ▼                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     GAME STATE & RULES ENGINE                         │
│ - rules.ts: canUnitMoveTo, calculateDamage, torpor, winConditions      │
│ - GameContext.tsx: inventory, tamedDinos, campaignSectors, buildings   │
│ - constants.ts: GDD unitClasses, Magitek recipes, island sectors       │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
┌──────────────────────────────────┐   ┌─────────────────────────────────┐
│     NODE.JS + SOCKET.IO SERVER   │   │       FIRESTORE DATABASE        │
│ - Real-time matchmaking rooms    │   │ - Player profile & campaign     │
│ - AI Bot skirmish arbiter        │   │ - Tamed dinosaur roster         │
│ - Gemini dynamic NPC dialogue    │   │ - Base buildings & Magitek tech │
└──────────────────────────────────┘   └─────────────────────────────────┘
```

### Data Model Updates

1. **Unit Class & Entity (`src/types/game.ts`)**:
```typescript
export type UnitClass = 'Blade' | 'Skewer' | 'Crush' | 'Hulk' | 'Human';

export interface MagitekAugment {
  id: string;
  name: string;
  slot: 'weapon' | 'carapace' | 'neural' | 'reactor';
  statBonus: { hp?: number; attack?: number; defense?: number; speed?: number };
  unlockedAbilityId?: string;
  magitekCost: number;
}

export interface IslandSector {
  id: string;
  islandId: 'primoris' | 'caldera' | 'tempest' | 'magitek_core';
  islandName: string;
  sectorName: string;
  liberated: boolean;
  threatLevel: number;
  enemySquad: Array<{ name: string; speciesId: string; level: number; unitClass: UnitClass }>;
  rewards: { amber: number; titanite: number; magitekCores: number; wood: number };
  loreLog: string;
}
```

2. **GDD Class Mappings (`src/game/constants.ts`)**:
- `Velociraptor` → **Blade** (High agility, Sickle Rend bleed)
- `Triceratops` → **Skewer** (Horn Impale, Earthshaker Charge)
- `Ankylosaurus` → **Crush** (Bone Club, Fracture Breaker torpor)
- `Titan Trike / Apex Carno` → **Hulk** (Colossal health, Tectonic Stomp)
- `Survivor Commander` → **Human** (Tranq Rifle, Spear Thrust, Pack Rally)

3. **Campaign Map Component (`src/components/IslandCampaignView.tsx`)**:
- Interactive sector node map with visual liberation status (red controlled by Evil Tribe vs green liberated).
- Sector briefing modal with threat analysis, enemy squad preview, and "Launch Liberation Strike" CTA that transitions directly into tactical combat.
- Post-battle victory triggers sector liberation, awards Magitek Cores, and unlocks adjacent island nodes.

4. **Magitek Research Lab (`src/components/MagitekLabView.tsx` & Base Camp)**:
- New building tier in Base Camp Enclave.
- Research tree: *Phase 1: Magitek Energy Extract*, *Phase 2: Neural Synapse Harness*, *Phase 3: Cybernetic Raptor Claws*, *Phase 4: Aegis Shield Generators*.
- Interactive equipment bay to slot Magitek enhancements onto tamed dinosaurs.

---

## 5. Phased Implementation Roadmap

- **Phase 1: Core Type & Data Alignment**
  - Update `src/types/game.ts` with GDD `UnitClass` enum (`Blade`, `Skewer`, `Crush`, `Hulk`, `Human`), `IslandSector`, and `MagitekAugment`.
  - Update `src/game/constants.ts` with GDD class definitions, 12 island sector nodes across 4 islands, and Magitek tech tree recipes.
  - Update rules and combat damage calculators to account for Blade bleed scaling, Skewer frontal charges, Crush torpor multipliers, and Hulk threat bonuses.

- **Phase 2: Island Liberation Campaign System**
  - Create `src/components/IslandCampaignView.tsx` with interactive sector selector, threat analysis, and Evil Tribe narrative logs.
  - Wire sector combat into `TacticalArenaView.tsx` so completing a campaign mission marks the sector as liberated and yields rewards.

- **Phase 3: Magitek Research Lab & Cybernetic Augments**
  - Add the Magitek Lab facility to `BASE_BUILDINGS` in `src/game/constants.ts`.
  - Implement Magitek augmentation workbench in Base Camp and Evolution Tree to allow slotting high-tech relics into tamed dinosaurs.
  - Add Magitek crafting recipes to Primal Smithy.

- **Phase 4: Verification & Polish**
  - Execute test suite (`tsx --test src/game/rules.test.ts`) covering all new GDD class interactions.
  - Run `compile_applet` and `lint_applet` to ensure zero compilation or type errors.
  - Playwright browser test verifying the Island Campaign flow, sector liberation battle, Magitek crafting, and tactical grid combat.
