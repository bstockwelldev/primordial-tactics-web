// Feature flags. The default is "simple mode": everything below is off, so a new player sees a
// guided battle and a short mission list. Nothing is removed; testers switch things back on with
// a URL such as `?ff=all` or `?ff=online,taming`. The choice is remembered in localStorage
// (`pt_ff`); `?ff=none` clears it. No backend involved. Reload to apply a change.

export const FLAG_NAMES = ['base', 'creatures', 'magitek', 'online', 'localModes', 'hud', 'arenaPro', 'fullCampaign'] as const;
export type FlagName = (typeof FLAG_NAMES)[number];
export type Flags = Record<FlagName, boolean>;

export const FLAGS_STORAGE_KEY = 'pt_ff';

/** Friendly names a tester might type, mapped to the flag they switch on. */
const ALIASES: Record<string, FlagName[]> = {
  taming: ['creatures'],
  evolution: ['creatures'],
  multiplayer: ['online'],
  pvp: ['online'],
  coop: ['localModes'],
  versus: ['localModes'],
  buddy: ['localModes'],
  resources: ['hud'],
  roadmap: ['hud'],
  scanner: ['arenaPro'],
  chat: ['arenaPro'],
  campaign: ['fullCampaign'],
};

const allOff = (): Flags => Object.fromEntries(FLAG_NAMES.map((n) => [n, false])) as Flags;
const allOn = (): Flags => Object.fromEntries(FLAG_NAMES.map((n) => [n, true])) as Flags;

/** Parses a `?ff=` value. Returns null when the value is `none`/`reset` (clear the override). */
function parseList(value: string): Flags | null {
  const names = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.some((n) => n === 'none' || n === 'reset')) return null;
  const flags = allOff();
  for (const name of names) {
    if (name === 'all') return allOn();
    if ((FLAG_NAMES as readonly string[]).includes(name)) flags[name as FlagName] = true;
    else for (const f of ALIASES[name] ?? []) flags[f] = true;
  }
  return flags;
}

export interface FlagResolution {
  flags: Flags;
  /** What to write to localStorage: a string to remember, null to clear, undefined to leave alone. */
  persist: string | null | undefined;
}

/**
 * Pure resolver. `search` is `location.search`; `stored` is the saved `pt_ff` value (or null).
 * A `?game=` invite link switches `online` on for that visit only, so invites keep working.
 */
export function resolveFlags(search: string, stored: string | null): FlagResolution {
  const params = new URLSearchParams(search);
  const fromUrl = params.get('ff');
  let flags = allOff();
  let persist: string | null | undefined;

  if (fromUrl !== null) {
    const parsed = parseList(fromUrl);
    if (parsed === null) persist = null;
    else {
      flags = parsed;
      persist = fromUrl;
    }
  } else if (stored) {
    flags = parseList(stored) ?? allOff();
  }

  if (params.get('game')) flags = { ...flags, online: true };
  return { flags, persist };
}

function readStored(): string | null {
  try {
    return localStorage.getItem(FLAGS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function load(): Flags {
  if (typeof window === 'undefined') return allOff();
  const { flags, persist } = resolveFlags(window.location.search, readStored());
  try {
    if (persist === null) localStorage.removeItem(FLAGS_STORAGE_KEY);
    else if (persist !== undefined) localStorage.setItem(FLAGS_STORAGE_KEY, persist);
  } catch {
    /* storage blocked: the URL still applies for this load */
  }
  const on = FLAG_NAMES.filter((n) => flags[n]);
  console.info(`[flags] on: ${on.length ? on.join(', ') : 'none (simple mode)'}`);
  return flags;
}

export const FLAGS: Flags = load();
