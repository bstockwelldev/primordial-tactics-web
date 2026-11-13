// The in-game roadmap shown by the Roadmap modal. Static content, bundled with the client: it used to be
// served from the dev server only (`/api/roadmap`), so on production the modal was empty.
// The milestones are the owner's plan; the only edits so far corrected claims the code no longer matches.

export interface RoadmapPhase {
  phase: string;
  status: string;
  milestones: string[];
}

export const ROADMAP_PHASES: RoadmapPhase[] = [
  {
    phase: 'Phase 1: Tactical Core & Taming (Current Prototype)',
    status: 'Active / Live Prototype',
    milestones: [
      'Turn-based arena with an Action Point (AP) economy: solo skirmish, async PvP, and local pass & play co-op and versus',
      '5 Core Dinosaur Species: Velociraptor, Triceratops, Pteranodon, Ankylosaurus, Dilophosaurus',
      'Research-based evolution tree with 10 branch specializations (Deinonychus, Sky Titan, etc.)',
      'Prehistoric gathering, crafting system (Tranq Darts, Prime Kibble, Chitin Armor)',
      'Base building camp (Survivor Longhouse, Dino Enclosures, Gene Incubator, Smithy)',
    ],
  },
  {
    phase: 'Phase 2: Tribe Alliances & Base Defense Raids',
    status: 'Q3 Launch Target',
    milestones: [
      'Asynchronous Wild Predator Horde base attacks requiring automated dino pen defenders',
      'Tribe Guilds: Shared tribe gene vaults, co-op resource caravans, and shared encampments',
      'Ranked Competitive Seasons with Amber Leaderboards and seasonal dinosaur skins',
      'Sound FX, atmospheric primeval jungle ambient tracks, and visceral battle soundscapes',
    ],
  },
  {
    phase: 'Phase 3: Deep Gene Splicing & Apex Tournaments',
    status: 'Q4 Launch Target',
    milestones: [
      'Hybrid Dino Fusion: Combine raptor agility with ankylosaur carapace in the Gene Incubator',
      'Weekly 16-player bracket PvP tournaments with live spectator mode and wager stakes',
      'Titan Boss Expeditions: 4-player co-op raids against Spinosaurus and Tyrannosaurus Rex',
      'Native Mobile App wrappers for iOS & Android with push notifications for breeding cycles',
    ],
  },
  {
    phase: 'Phase 4: Open Persistent Prehistoric World',
    status: 'Next Year Expansion',
    milestones: [
      'Seamless hex-based continental map with territory control and resource node disputes',
      'Underwater and Subterranean biomes (Mosasaurus coastal bays, Megalodon trenches)',
      'Custom tournament rules creator and user-designed arena terrain editor',
    ],
  },
];
