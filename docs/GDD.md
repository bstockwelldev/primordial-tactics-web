# Primordial Tactics — Game Design Document v1.2 (cleaned)

> Derived from v1.1 (by Muse). Cleanup 2026-11-09, per Brandon's direction: **this GDD is the guide for mechanics and theme, not technical structure.** Unity 3D / C# sections were removed, not rewritten — technical structure lives in the repo (`bstockwelldev/primordial-tactics-web`), which is authoritative for implementation. Duplicates merged; AI-chat residue and dangling footnote markers dropped. Nothing design-related was silently deleted: open questions are listed in Appendix A.

## 1. Game Overview

- **Brief Description:** Primordial Tactics is an exciting tactical RPG that blends turn-based combat, strategic battles, and a unique world populated with dinosaurs.
- **Genre:** Tactical RPG
- **Target Audience:** Fans of strategy and RPG games, aged 13 and above
- **Game Flow Summary:** Players lead a character and their companions in a series of tactical battles to liberate islands from an evil tribe. They will manage resources, upgrade units, and engage in thrilling hunts.

## 2. Gameplay and Mechanics

- **Game Progression:** The game follows a Fight → Survive → Strengthen → Repeat loop. Players engage in tactical battles, manage resources and equipment at their base, and enhance their units for upcoming fights.
- **Mechanics:** The game features turn-based battles with units that have unique abilities. The terrain impacts movement and strategy, and battles involve a balance of offense and defense. Resource gathering and management, base facility upgrades, crafting and tech research, and unit growth are key elements of the game.
- **Special Features:** Unscaled difficulty with permanent alterations based *[incomplete in v1.1 — the sentence cuts off there]*
- **Unit classes (from the v1.1 design sketch):** Blade, Skewer, Crush, Hulk, Human. *[OPEN: the code implements Striker / Tank / Siege / Controller instead — a mapping decision is needed; see Appendix A.]*

## 3. Story, Setting, and Character

- **Game World:** The game is set in a unique world full of islands, each with its own culture and climate, where dinosaurs and humans co-exist.
- **Characters:** Players assume the role of a hero and their partner dinosaur, and they assemble a team of capable allies along the journey.
- **Story and Progression:** The hero sets out to thwart an evil tribe's ambitions, traverses diverse islands, and uncovers the mystery of Magitek, an ancient technology source.

## 4. Art Style and Visuals

- **Art Style:** A vibrant and detailed style that captures the diverse environments, distinct cultures, intriguing characters, and fascinating dinosaurs.
- **Character and Creature Design:** Unique and visually appealing designs for different classes of units and dinosaurs, influenced by their origins and combat roles.
- **Visual Effects:** Particle effects for combat animations, visual cues, and environmental effects.

## 5. Technical Note

This GDD does not specify technical structure. The implementation lives in the repo: web/React stack (React 19, Vite, Tailwind, Firebase/Firestore, Express + Socket.io server on Bun), browser-based, with eventual seamless multiplayer. The v1.1 sections on Unity 3D, C#, Scenes, Prefabs, GameObjects, and scripts were removed under this rule.

## 6. User Interface (UI)

- **Main Menu:** Buttons for 'Start', 'Options', and 'Quit'. 'Start' leads to the game scene, 'Options' leads to a settings menu, and 'Quit' exits the game.
- **Combat UI:** A panel will cover the top/bottom of the screen providing information like unit stats, turn order, and available actions. Units can be selected to display a list of their abilities as buttons on the side of the screen.
- **Base Management UI:** Players will navigate facilities, manage resources, and oversee unit upgrades through an interactive interface.
- **Screen map (as built in the repo):** Base Camp, Island Campaign, Magitek Lab, Taming Expedition, Evolution Tree, Tactical Arena.

## 7. Art Pipeline

AI-generated sprites from text prompts are an option for producing unit and creature art — e.g., many dinosaur variations by species, or character sprites by class — and quality depends on prompt clarity and descriptiveness. (The Unity Editor integration described in v1.1 does not apply to the web stack.)

## 8. Development Roadmap

- **Concept and Design (2-3 months):** Detailed GDD, concept art, and visual design.
- **Tactical Combat Prototype (3-4 months):** Build the grid-based map system and turn-based combat mechanics.
- **Base Management and Crafting Prototype (3-4 months):** Implement resource gathering, crafting system, and facility interactions.
- **First-Person Shooter Minigame Integration and Gameplay Refinement (2-3 months):** Integrate FPS mechanics and creature encounters, refine user interface. *[Decided 2026-11-09: kept as an eventual roadmap idea, later phase — stays part of the tactical RPG experience.]*
- **Finalization and Polish (2-3 months):** Enhance audio and visuals, polish UI, comprehensive playtesting and iteration.
- **Presentation and Collaboration Preparation (1-2 months):** Prepare gameplay showcase, presentation materials, and collaboration proposal.
- **Presentation and Future Planning (1-2 months):** Deliver presentation, gather feedback, and develop future plans and roadmap.

*(v1.1 §16's four-phase framing — Prototype / Alpha / Beta / Release — is merged here; the phases above are the working plan.)*

## 9. Additional Considerations

- Careful balancing of unit abilities and combat mechanics to ensure challenging yet fair gameplay.
- Consistent testing and player feedback to refine game mechanics and UI.
- Implementation of saving and loading system to allow players to save their progress.
- Accessibility features for a wider range of players including colorblind modes, adjustable text sizes, and remappable controls.
- **Modularity:** The game's design should strive for modularity, particularly in unit design, AI behavior, and levels. This will allow for easier testing and iteration during development.

## Appendix A. Open design questions (not decided by this cleanup)

- **FPS minigame phase:** decided 2026-11-09 — kept as an eventual roadmap idea (later phase), part of the tactical RPG experience.
- **Unit classes:** GDD says Blade / Skewer / Crush / Hulk / Human; the code implements Striker / Tank / Siege / Controller. Needs a mapping decision — adopt the GDD taxonomy in code, or amend the GDD to the code's roles.
- **Torpor / taming:** the code implements a torpor system (tranq to tame); the GDD mentions taming and hunts but specifies no torpor mechanic. Adopt it into the design or remove it from code?
- **Multiplayer:** the GDD describes a single-player campaign; the repo is multiplayer-first and the locked direction is eventual seamless multiplayer. Needs a multiplayer design section (future work, not this cleanup).
- **AI features:** Gemini NPC guides and AI coaching existed in the scaffold but not in the GDD. **Cut 2026-11-13** (owner decision): they only ran on the local dev server and did nothing on production.
- **Name:** **Primordial Tactics** (decided 2026-11-13; the app metadata was renamed from "Primal Tactics" to match).
- **Primordia Survival relation:** is this the digital sibling of Brandon's board-game prototype, or a separate project? Unconfirmed — shared rules/lore must not be assumed.
