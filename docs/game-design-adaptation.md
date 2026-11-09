# Game design adaptation — what's left for this version

Design authority is [`GDD.md`](GDD.md) (v1.2, cleaned 2026-11-09): it guides mechanics and theme; the repo is authoritative for technical structure. Stack: web/React, browser-based (desktop + mobile), eventual seamless multiplayer. Deploy target is Vercel; Firebase/GCP was removed 2026-11-09.

This doc is the gap list between that design and the scaffold as built (through commit `f34e0ea8`, 2026-11-09). Each item states what the GDD says, what the code has, what's left, and a recommendation. Nothing here is decided until Brandon says so.

## Already adapted (done)

- Stack: Unity/C# out, web/React in. GDD §5/§11–15 removed, not rewritten.
- GDD cleaned to v1.2: duplicates merged, AI-chat residue dropped.
- FPS minigame: kept as an eventual roadmap idea (decided 2026-11-09).
- Firebase/GCP scrapped 2026-11-09: `firebase` dep dropped, `src/lib/firebase.ts` + `firebase-applet-config.json` + `firestore.rules` + `firebase-blueprint.json` deleted (commits `8ddd7142`, `617db5e6`, `60bdf81a`, `a87147d4`, `f34e0ea8`). Verified beforehand: no code imported the Firebase module; the helpers were dead code. Persistence is localStorage-only by design now.
- Combat rules engine exists and is substantial (`src/game/rules.ts` + tests): movement, damage curve, torpor, taming chance, evolution, win condition, resources.
- Data model exists: 5 species, 10 evolution branches, 4 islands (12 sectors), 8 resources, crafting recipes, base buildings, 5 Magitek augments, NPC profiles.
- **Solo vs-AI path is built** (verified 2026-11-09 by reading `TacticalArenaView.tsx`): opening the arena without a room starts a solo skirmish; campaign missions load the sector's enemy squad (level-scaled), otherwise default rivals; win liberates the sector.
- **Taming loop is wired** (verified 2026-11-09 by reading `TamingExpeditionView.tsx`): biome → encounter → tranq darts build torpor → bait → chance roll (`calculateTamingChance` / `isTamingViable`) → roster. The earlier "unwired" read was wrong — the view uses both helpers.

## Gaps

### 1. Unit class taxonomy — cleanup, not design

- GDD: Blade, Skewer, Crush, Hulk, Human.
- Code: `UnitClass` is the union of both sets — GDD's five plus Striker, Tank, Scout, Siege, Controller. `rules.ts` treats them as alias pairs with shared passives: Blade↔Striker (crit), Hulk↔Tank (mitigation), Crush↔Siege (torpor); Skewer (pierce) and Human (+10% damage) stand alone. `constants.ts` already labels the four extras "// Legacy aliases" — Scout is an alias of Blade, not a passive-less class of its own.
- Left: rename/remove the alias entries in code and UI copy; nothing to design.
- Recommendation: canonicalize on the GDD's five (design authority); delete the alias entries when combat work starts.

### 2. Torpor / taming loop — details, not wiring

- GDD: taming and hunts, no torpor mechanic specified.
- Code: the expedition loop is fully wired (see "Already adapted"): tranq darts build torpor, bait raises chance (meat +25, kibble +50, cap 99%), a failed roll loses the encounter. Arena combat also builds torpor but has no tame action.
- Left: (a) tranq torpor in the taming view is a flat random 35–55, not the `calculateTorporDamage` formula (which accounts for defense and the Crush/Siege +35% bonus); (b) the view mutates `inventory` directly (`inventory.tranq_dart -= 1`) without `setState`, so counts go stale until the next re-render; (c) decide whether arena torpor can lead to a tame, or taming stays expedition-only.
- Recommendation: adopt torpor (it is already the loop), fix (a) and (b), keep taming expedition-only.

### 3. Campaign → arena — bot quality, not the path

- GDD: liberate island sectors from the evil tribe (PvE campaign).
- Code: the path is built — `IslandSector` carries `enemySquad`, `threatLevel`, rewards, lore; `startSectorMission()` switches to the arena; the solo match loads the sector squad; a win liberates the sector. 12 sectors across 4 islands, first sector pre-liberated.
- Left: (a) the bot is primitive — `runAiTurn()` attacks with each unit's first ability if the closest player unit is in range, and **never moves**, so out-of-range AI units stand still; no ability choice, no focus targeting; (b) a campaign win double-awards — `handleExecuteAbility` calls `liberateSector()` directly *and* the match-over effect calls `recordMatchResult()`, which calls it again (rewards + 250 XP twice). Needs a guard in one of the two paths.
- Recommendation: bot quality (movement + ability choice) and the double-liberate guard are the next playable slice. PvP stays human-vs-human; no server-side vs-AI is needed for solo.

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
- Left: (a) `constants.ts` documents terrain effects the rules never implement — water "+1 AP" slowing, mud "−1 speed", bones "+5% defense" — and the arena never builds those tile types anyway; implement or cut the documented effects. (b) Island/terrain design — biome tile sets, per-sector maps (vs the one fixed arena), threat scaling.
- Recommendation: keep the fixed arena for PvP; design sector maps as arena variants for campaign. Decide (a) with the bot-quality slice — the bot needs terrain rules to be real before it can use them.

### 7. Magitek — spec the research side

- GDD: Magitek is a story mystery ("ancient technology source").
- Code: `MagitekAugment` (slots: weapon, carapace, neural, reactor; cost in magitekCores), equip/unequip with a 50% refund, Magitek Lab view. Current catalog is 5 augments: Cyber-Plasma Talons (4 cores), Kinetic Nanomesh Plating (5), Micro-Singularity Overdrive (6), Magitek Neural Uplink (4), Plasma Arc Emitter (7).
- Left: the research design — which augments exist, costs, unlock flow, how magitekCores are earned.
- Recommendation: short design pass once the economy numbers (gap 5) are adopted.

### 8. AI features — keep or cut

- GDD: no LLM features (only the removed Muse Sprite art note).
- Code: Gemini NPC dialogue (`/api/npc-dialogue`, `gemini-2.5-flash`, canned fallback) and AI match coaching (`/api/match-feedback`, structured JSON debrief + grade).
- Left: the keep-or-cut decision; if kept, a short spec (which NPCs, when coaching triggers, key-less fallback behavior is already built).
- Recommendation: keep — it's built, it degrades gracefully without a key, and it fits the "guides" theme. Decide with the name call.

### 9. Persistence and auth — cloud save is an open decision

- GDD: save/load system (§9).
- Code: localStorage only (`pt_player_name`, `pt_resources`, `pt_inventory`, `pt_dinos`, `pt_campaign_sectors`). Firebase was removed 2026-11-09 (see "Already adapted") — there is no cloud backend, no auth, no sign-in flow. The Firestore schema and rules are gone with it.
- Left: decide whether cloud save exists at all, and if so on what: Vercel KV (Redis), Vercel Postgres, Vercel Blob, or another backend. Also gate/remove `quickAddDemoResources()` before real play, and decide the localStorage → cloud migration if a backend is chosen.
- Recommendation: localStorage is fine for solo verification; decide cloud save when multiplayer design (gap 4) lands — it is a multiplayer dependency, not a solo one.

### 10. Combat fidelity — bugs found while reading

- **Class passives don't fire in server PvP only.** `use_ability` in `server.ts` calls `calculateDamage` / `calculateTorporDamage` without attacker/defender class, so Skewer pierce, Human +10%, Blade/Striker crit bonus, Hulk/Tank mitigation, and Crush/Siege torpor bonus are dead in real PvP matches. The solo path passes the classes (verified), and `rules.test.ts` covers the passives — the rules exist, the server call site drops them. Fix: pass the classes through.
- **Lobby list goes stale.** The client emits `get_rooms` on `rooms_updated`, but the server has no `get_rooms` handler — the list only refreshes on connect. Fix: add the handler.
- **Turn timer is tracked, not enforced.** `turnTimeLeft` resets to 45 on turn change, but no server-side countdown forces a turn over. Decide: enforce or drop the timer.
- **Campaign win double-awards (new).** Solo campaign win grants sector rewards + 250 XP twice — `liberateSector()` runs in both `handleExecuteAbility` and `recordMatchResult()`. Fix: guard one path.
- **Solo bot never moves (new).** Out-of-range AI units stand still — `runAiTurn()` has no movement step. Fix with the bot-quality slice (gap 3).

### 11. Name — Primordial vs Primal

- GDD and repo say **Primordial Tactics**; app metadata, the HTML title, and server strings (health endpoint, Gemini prompts, console log) say **Primal Tactics**.
- Left: pick one. The rename touches `package.json` (also still `react-example` v0.0.0), `index.html`, `metadata.json`, and the server strings.

### 12. Roadmap unification — three roadmaps, one plan

- GDD §8 (month-based, includes the FPS minigame as an eventual idea) and the `/api/roadmap` endpoint (Phase 1–4: Tactical Core → Tribe Alliances → Gene Splicing → Open Persistent World) disagree in phasing and content.
- Left: one roadmap. The endpoint's Phase 2–4 (guilds, ranked seasons, tournaments, co-op raids, open world) is a bigger scope claim than the GDD's — reconcile before it becomes the plan by default. Note the endpoint lives on the arena server, so it moves with the hosting decision (gap 14).

### 13. The truncated Special Feature

- GDD §2: "Unscaled difficulty with permanent alterations based…" — the sentence cuts off in v1.1 and was kept as-is in v1.2.
- Left: Brandon to finish the thought. (Is this permadeath? Persistent world changes? It reads like a core feature, not a footnote.)

### 14. Deployment — split decided (option A); arena host TBD

- Client: static Vite build, deploys to Vercel (install from `bun.lock`, build `vite build`, output `dist`).
- Arena server: `server.ts` is a persistent Socket.io process and cannot run on Vercel's serverless functions. Split wired 2026-11-09: the client reads the arena URL from `VITE_ARENA_URL` (`src/lib/api.ts` — unset = same-origin); the server allows the Vercel origin via `ARENA_CORS_ORIGIN` (Socket.io + REST) and honors `process.env.PORT`.
- Decided: **A split** — Vercel (client) + small always-on host (Fly.io / Render / Railway) for the arena server. **B managed realtime** and **C single host** rejected.
- Left: pick the arena host; set `VITE_ARENA_URL` in the Vercel dashboard and `ARENA_CORS_ORIGIN` + `GEMINI_API_KEY` on the host. Gemini endpoints stay on the arena server for now; they are stateless and can move to Vercel serverless functions later.
- **MVP note (2026-11-09): realtime multiplayer is NOT required for MVP — async multiplayer instead (long turn timer, notify the next player at end of turn). This may remove the need for a persistent Socket.io host entirely; the async turn design is an open item for the next session (see `docs/handoff.md`).**
- See `docs/architecture.md` — Deployment.

## Suggested order

1. Name + class taxonomy cleanup (cheap, unblocks the docs and UI copy).
2. Combat fidelity fixes (gap 10) — small, mechanical.
3. Bot quality + double-liberate guard (gap 3) — the next playable slice.
4. Taming details (gap 2) — torpor formula + inventory mutation fix.
5. Deployment split decided (gap 14); persistence decision (gap 9) still open — async multiplayer (MVP) makes persistence a first-class requirement, decide with the async turn design.
6. Balance pass + level curve (gap 5), then Magitek spec (gap 7).
7. Multiplayer design section + roadmap unification (gaps 4, 12).
