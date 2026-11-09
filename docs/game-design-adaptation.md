# Game design adaptation — what's left for this version

Design authority is [`GDD.md`](GDD.md) (v1.2, cleaned 2026-11-09): it guides mechanics and theme; the repo is authoritative for technical structure. Stack: web/React, browser-based, eventual seamless multiplayer.

This doc is the gap list between that design and the scaffold as built (commit `f5600e69`, 2026-11-09). Each item states what the GDD says, what the code has, what's left, and a recommendation. Nothing here is decided until Brandon says so.

## Already adapted (done)

- Stack: Unity/C# out, web/React in. GDD §5/§11–15 removed, not rewritten.
- GDD cleaned to v1.2: duplicates merged, AI-chat residue dropped.
- FPS minigame: kept as an eventual roadmap idea (decided 2026-11-09).
- Combat rules engine exists and is substantial (`src/game/rules.ts` + tests): movement, damage curve, torpor, taming chance, evolution, win condition, resources.
- Data model exists: 5 species, 10 evolution branches, 4 islands, 8 resources, crafting recipes, base buildings, Magitek augments, NPC profiles.

## Gaps

### 1. Unit class taxonomy — decide the player-facing names

- GDD: Blade, Skewer, Crush, Hulk, Human.
- Code: `UnitClass` is the union of both sets — GDD's five plus Striker, Tank, Scout, Siege, Controller. `rules.ts` treats them as alias pairs with shared passives: Blade↔Striker (crit), Hulk↔Tank (mitigation), Crush↔Siege (torpor); Skewer (pierce) and Human (+10% damage) stand alone.
- Left: (a) **Scout has no passive** — give it one or cut it. (b) Pick one canonical set of player-facing names.
- Recommendation: canonicalize on the GDD's five (design authority), with the code's four as legacy aliases to rename when combat work starts; give Scout a passive (e.g. flanking/movement) or cut it.

### 2. Torpor / taming loop — wire the rules to the flow

- GDD: taming and hunts, no torpor mechanic specified.
- Code: torpor is fully specified in `rules.ts` (build-up with defense reduction, ≥80% torpor = tamable, bait raises chance: meat +25, kibble +50, cap 99%) and applied in arena combat — but the arena has no tame action, and `GameContext.tameCreature()` adds a level-1 dino instantly with no roll. `calculateTamingChance` / `isTamingViable` have no caller in the files read.
- Left: the expedition flow — encounter → torpor → bait → chance roll → roster. Decide whether arena torpor can lead to a tame, or taming stays expedition-only.
- Recommendation: adopt torpor into the design (it is the most specific mechanic the code has) and wire the roll into the taming view.

### 3. Campaign → arena — build the vs-AI path

- GDD: liberate island sectors from the evil tribe (PvE campaign).
- Code: `IslandSector` carries `enemySquad`, `threatLevel`, rewards, lore; `startSectorMission()` switches to the arena screen; `recordMatchResult()` liberates the sector on a win. But the arena server only builds PvP rosters on `join_room` — nothing loads a sector's enemy squad into a room, and there is no AI opponent.
- Left: the whole PvE battle path — AI opponent driving the enemy squad, mission handoff into the arena, win/loss back to the campaign.
- Recommendation: this is the first playable solo slice after the docs. (Arena PvP already works between two humans.)

### 4. Multiplayer design section — GDD has none

- GDD: single-player campaign.
- Code: lobby, rooms, quick match, `MatchRecord`, in-memory sessions.
- Left: a design section for sessions — lobby → room → match → debrief → shared progression; casual vs ranked; reconnects; what happens to campaign progress in/after multiplayer. The `/api/roadmap` endpoint already sketches Phase 2 (tribe alliances, guilds, ranked seasons) and Phase 3 (tournaments, co-op raids) — reconcile with the GDD roadmap rather than letting two roadmaps drift.
- Recommendation: write the section when the PvE slice lands, not before.

### 5. Economy and progression numbers — adopt or replace

- GDD: names the systems (resources, crafting, tech research, unit growth) with no numbers.
- Code: concrete v1 numbers everywhere — 8 resources; building upgrade cost ×1.5 per level; flat XP awards (craft +45, upgrade +120, tame +200, evolve +350, liberate +250, match win +300 / loss +100); evolution amber gates; starter resources and two starter dinos (raptor L5, trike L4).
- Left: a balance pass, and a player level curve — `playerLevel` starts at 5 and never increases; XP accumulates with no level-up.
- Recommendation: adopt the code's numbers as v1 values in the design, then balance by playing; add the level curve before any progression tuning.

### 6. Terrain and islands — from fixed arena to island maps

- GDD: terrain impacts movement and strategy; islands have distinct cultures and climates.
- Code: 6 tile types (grass, water, rock, mud, foliage, bones); the arena is a fixed 8×6 grid with hardcoded obstacles and two foliage tiles (+15 defense); 4 islands (`primoris`, `caldera`, `tempest`, `magitek_core`) with sectors, threat levels, and rewards.
- Left: island/terrain design — biome tile sets, per-sector maps (vs the one fixed arena), threat scaling.
- Recommendation: keep the fixed arena for PvP; design sector maps as arena variants for campaign.

### 7. Magitek — spec the research side

- GDD: Magitek is a story mystery ("ancient technology source").
- Code: `MagitekAugment` (slots: weapon, carapace, neural, reactor; cost in magitekCores), equip/unequip with a 50% refund, Magitek Lab view.
- Left: the research design — which augments exist, costs, unlock flow, how magitekCores are earned.
- Recommendation: short design pass once the economy numbers (gap 5) are adopted.

### 8. AI features — keep or cut

- GDD: no LLM features (only the removed Muse Sprite art note).
- Code: Gemini NPC dialogue (`/api/npc-dialogue`, `gemini-2.5-flash`, canned fallback) and AI match coaching (`/api/match-feedback`, structured JSON debrief + grade).
- Left: the keep-or-cut decision; if kept, a short spec (which NPCs, when coaching triggers, key-less fallback behavior is already built).
- Recommendation: keep — it's built, it degrades gracefully without a key, and it fits the "guides" theme. Decide with the name call.

### 9. Persistence and auth — wire what was designed

- GDD: save/load system (§9).
- Code: Firestore blueprint + default-deny owner-only rules + `saveUserProfile` / `saveMatchRecord` helpers exist — but `GameContext` persists only to localStorage and never imports the Firebase module; no sign-in flow in the files read; match records are never saved.
- Left: wire auth + Firestore sync (profile, dinos, base, matches) and decide the localStorage → cloud migration. Also gate/remove `quickAddDemoResources()` before real play.
- Recommendation: wire after the PvE slice — localStorage is fine for solo verification, and the schema already exists.

### 10. Combat fidelity — two bugs found while reading

- **Class passives don't fire in live arena play.** `use_ability` in `server.ts` calls `calculateDamage` / `calculateTorporDamage` without attacker/defender class, so Skewer pierce, Human +10%, Blade/Striker crit bonus, Hulk/Tank mitigation, and Crush/Siege torpor bonus are all dead in real matches. The rules exist; the call site drops them. Fix: pass the classes through.
- **Lobby list goes stale.** The client emits `get_rooms` on `rooms_updated`, but the server has no `get_rooms` handler — the list only refreshes on connect. Fix: add the handler.
- **Turn timer is tracked, not enforced.** `turnTimeLeft` resets to 45 on turn change, but no server-side countdown forces a turn over. Decide: enforce or drop the timer.

### 11. Name — Primordial vs Primal

- GDD and repo say **Primordial Tactics**; app metadata, the HTML title, and server strings (health endpoint, Gemini prompts, console log) say **Primal Tactics**.
- Left: pick one. The rename touches `package.json` (also still `react-example` v0.0.0), `index.html`, `metadata.json`, and the server strings.

### 12. Roadmap unification — three roadmaps, one plan

- GDD §8 (month-based, includes the FPS minigame as an eventual idea) and the `/api/roadmap` endpoint (Phase 1–4: Tactical Core → Tribe Alliances → Gene Splicing → Open Persistent World) disagree in phasing and content.
- Left: one roadmap. The endpoint's Phase 2–4 (guilds, ranked seasons, tournaments, co-op raids, open world) is a bigger scope claim than the GDD's — reconcile before it becomes the plan by default.

### 13. The truncated Special Feature

- GDD §2: "Unscaled difficulty with permanent alterations based…" — the sentence cuts off in v1.1 and was kept as-is in v1.2.
- Left: Brandon to finish the thought. (Is this permadeath? Persistent world changes? It reads like a core feature, not a footnote.)

## Suggested order

1. Name + class taxonomy (cheap, unblocks the docs and UI copy).
2. Combat fidelity fixes (gap 10) — small, mechanical.
3. Campaign vs-AI path (gap 3) — the first playable solo slice.
4. Taming loop wiring (gap 2).
5. Persistence/auth (gap 9).
6. Balance pass + level curve (gap 5), then Magitek spec (gap 7).
7. Multiplayer design section + roadmap unification (gaps 4, 12).
