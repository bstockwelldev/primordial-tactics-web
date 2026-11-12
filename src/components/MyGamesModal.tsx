import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import { describeFailure, getGame, renamePlayer, timeLeft, GameSummary } from '../lib/asyncApi';
import { enablePush, getPushState, PushState } from '../lib/push';
import { ISLAND_CAMPAIGN_SECTORS } from '../game/constants';
import { SOLO_SAVE_KEY, SoloSave } from '../game/soloSave';
import { Users, X, Swords, Bell, Link2, Hourglass, Trophy, Plus, Cpu } from 'lucide-react';

const TURN_OPTIONS = [
  { hours: 8, label: '8 hours' },
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
];

const PUSH_COPY: Record<PushState, string> = {
  on: 'Turn notifications are on for this browser.',
  off: 'Get a notification when it is your turn, even with the game closed.',
  blocked: 'Notifications are blocked for this site. Allow them in your browser settings to turn this on.',
  unsupported: 'This browser does not support notifications. Your games still show here when it is your turn.',
  'needs-install': 'On iPhone and iPad, add this page to your Home Screen (Share → Add to Home Screen) to get turn notifications.',
  unconfigured: 'Notifications are not set up on this server yet. Your games still show here when it is your turn.',
};

export const MyGamesModal: React.FC = () => {
  const {
    showLobbyModal,
    setShowLobbyModal,
    playerName,
    setPlayerName,
    myPlayerId,
    isConnected,
    connectionError,
    myGames,
    openGames,
    refreshGames,
    createAsyncGame,
    joinAsyncGame,
    openAsyncGame,
    pendingInviteId,
    clearPendingInvite,
    setCurrentRoom,
    setActiveScreen,
    startSectorMission,
    clearActiveSectorMission,
    campaignSectors,
  } = useGame();

  const [visibility, setVisibility] = useState<'open' | 'invite'>('open');
  const [turnHours, setTurnHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [invite, setInvite] = useState<GameSummary | null>(null);
  const [push, setPush] = useState<PushState>('off');
  const [soloSave, setSoloSave] = useState<SoloSave | null>(null);
  const [nameDraft, setNameDraft] = useState(playerName);

  useEffect(() => {
    if (!showLobbyModal) return;
    setMessage(null);
    setNameDraft(playerName);
    refreshGames();
    getPushState().then(setPush);
    try {
      setSoloSave(JSON.parse(localStorage.getItem(SOLO_SAVE_KEY) || 'null'));
    } catch {
      setSoloSave(null);
    }
  }, [showLobbyModal]);

  // An invite link (?game=<id>) opens this screen with the game it points at.
  useEffect(() => {
    if (!showLobbyModal || !pendingInviteId || !myPlayerId) return;
    getGame(pendingInviteId).then((res) => {
      if (!res.ok) {
        setMessage(res.data.error || 'That invite link is not valid.');
        clearPendingInvite();
      } else if (res.data.preview) {
        setInvite(res.data.game as GameSummary);
      } else {
        clearPendingInvite(); // already one of my games: just open it
        openAsyncGame(pendingInviteId);
      }
    });
  }, [showLobbyModal, pendingInviteId, myPlayerId]);

  if (!showLobbyModal) return null;

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setMessage(await fn());
    setBusy(false);
  };

  const cleanDraft = nameDraft.replace(/\p{Cc}/gu, '').trim();
  const nameChanged = cleanDraft.length > 0 && cleanDraft !== playerName;

  const saveName = async () => {
    if (!nameChanged) return;
    setBusy(true);
    setPlayerName(cleanDraft);
    if (!myPlayerId) {
      setMessage('Name saved on this device. It will be used in games once you are connected.');
    } else {
      const res = await renamePlayer(cleanDraft);
      setMessage(res.ok ? `Your name is now ${cleanDraft}.` : describeFailure(res));
      if (res.ok) refreshGames();
    }
    setBusy(false);
  };

  const yourTurn = myGames.filter((g) => g.status === 'in_progress' && g.activePlayerId === myPlayerId);
  const theirTurn = myGames.filter((g) => g.status === 'in_progress' && g.activePlayerId !== myPlayerId);
  const waiting = myGames.filter((g) => g.status === 'waiting');
  const finished = myGames.filter((g) => g.status === 'completed');
  const opponent = (g: GameSummary) => (g.hostId === myPlayerId ? g.guestName : g.hostName) || 'Opponent';
  const inviteUrl = (id: string) => `${window.location.origin}/?game=${id}`;

  const copyInvite = async (id: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(id));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setMessage(`Copy this link: ${inviteUrl(id)}`);
    }
  };

  const resumeSolo = () => {
    if (!soloSave) return;
    setCurrentRoom(null);
    const sector = soloSave.sectorId ? campaignSectors.find((s) => s.id === soloSave.sectorId) : null;
    if (sector) startSectorMission(sector);
    else {
      clearActiveSectorMission();
      setActiveScreen('arena');
    }
    setShowLobbyModal(false);
  };

  const Section: React.FC<{ title: string; icon: React.ReactNode; count: number; children: React.ReactNode }> = ({ title, icon, count, children }) =>
    count === 0 ? null : (
      <section className="space-y-2">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-400">
          {icon}
          <span>{title}</span>
          <span className="text-stone-500">({count})</span>
        </h4>
        <div className="space-y-2">{children}</div>
      </section>
    );

  const row = 'flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-950/60 border border-stone-800';
  const primaryBtn = 'min-h-11 px-4 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 cursor-pointer';
  const quietBtn = 'min-h-11 px-3 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 cursor-pointer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 sm:p-5 bg-stone-950/90 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30">
              <Users className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-stone-100">My Games</h3>
              <p className="text-xs text-stone-400">Take your turn whenever you like. Each turn has a timer.</p>
            </div>
          </div>
          <button onClick={() => setShowLobbyModal(false)} aria-label="Close" className="p-2 rounded-lg text-stone-400 hover:text-stone-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
          {!isConnected && connectionError && (
            <div data-testid="connection-error" className="p-3 rounded-xl bg-red-950/40 border border-red-900/60 flex items-center justify-between gap-3">
              <p className="text-sm text-red-200">{connectionError} Solo play still works.</p>
              <button className={quietBtn} onClick={() => refreshGames()}>Retry</button>
            </div>
          )}
          <form
            className="flex flex-col sm:flex-row sm:items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveName();
            }}
          >
            <label className="flex-1 space-y-1 text-xs font-bold uppercase tracking-wider text-stone-400">
              Your name
              <input
                data-testid="player-name-input"
                value={nameDraft}
                maxLength={40}
                onChange={(e) => setNameDraft(e.target.value)}
                className="block w-full min-h-11 px-3 rounded-lg bg-stone-800 border border-stone-700 text-sm font-normal normal-case tracking-normal text-stone-100"
              />
            </label>
            <button type="submit" disabled={busy || !nameChanged} className={primaryBtn}>
              Save name
            </button>
          </form>
          {message && (
            <p role="alert" className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-sm text-amber-100 break-words">
              {message}
            </p>
          )}

          {invite && (
            <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-800/60 space-y-3">
              <p className="text-sm text-cyan-100">
                <strong>{invite.hostName}</strong> invited you to a match ({invite.turnHours}h per turn).
              </p>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  className={primaryBtn}
                  onClick={() =>
                    run(async () => {
                      const err = await joinAsyncGame(invite.id);
                      if (!err) {
                        setInvite(null);
                        clearPendingInvite();
                      }
                      return err;
                    })
                  }
                >
                  Accept challenge
                </button>
                <button
                  className={quietBtn}
                  onClick={() => {
                    setInvite(null);
                    clearPendingInvite();
                  }}
                >
                  Not now
                </button>
              </div>
            </div>
          )}

          <Section title="Your turn" icon={<Swords className="w-3.5 h-3.5 text-emerald-400" />} count={yourTurn.length}>
            {yourTurn.map((g) => (
              <div key={g.id} className={`${row} border-emerald-700/50`}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-100 truncate">vs {opponent(g)}</p>
                  <p className="text-xs text-stone-400">Turn {g.turnNumber} · {timeLeft(g.turnDeadline)} left</p>
                </div>
                <button className={primaryBtn} onClick={() => run(() => openAsyncGame(g.id))}>Play</button>
              </div>
            ))}
          </Section>

          <Section title="Waiting for opponent" icon={<Hourglass className="w-3.5 h-3.5 text-amber-400" />} count={theirTurn.length}>
            {theirTurn.map((g) => (
              <div key={g.id} className={row}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-100 truncate">vs {opponent(g)}</p>
                  <p className="text-xs text-stone-400">Turn {g.turnNumber} · they have {timeLeft(g.turnDeadline)}</p>
                </div>
                <button className={quietBtn} onClick={() => run(() => openAsyncGame(g.id))}>View</button>
              </div>
            ))}
          </Section>

          <Section title="Waiting for a challenger" icon={<Link2 className="w-3.5 h-3.5 text-cyan-400" />} count={waiting.length}>
            {waiting.map((g) => (
              <div key={g.id} className={row}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-100">{g.visibility === 'open' ? 'Open challenge' : 'Invite only'}</p>
                  <p className="text-xs text-stone-400">{g.turnHours}h per turn</p>
                </div>
                <button className={quietBtn} onClick={() => copyInvite(g.id)}>{copiedId === g.id ? 'Link copied' : 'Copy invite link'}</button>
              </div>
            ))}
          </Section>

          {soloSave && (
            <Section title="Solo (this device)" icon={<Cpu className="w-3.5 h-3.5 text-violet-400" />} count={1}>
              <div className={row}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-100 truncate">
                    {soloSave.sectorId
                      ? `Campaign: ${ISLAND_CAMPAIGN_SECTORS.find((s) => s.id === soloSave.sectorId)?.sectorName || 'mission'}`
                      : 'Skirmish vs AI'}
                  </p>
                  <p className="text-xs text-stone-400">Turn {soloSave.turn} · saved on this device</p>
                </div>
                <button className={quietBtn} onClick={resumeSolo}>Resume</button>
              </div>
            </Section>
          )}

          <section className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 space-y-3">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-400">
              <Plus className="w-3.5 h-3.5" /> New game
            </h4>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-stone-400 space-y-1">
                <span className="block">Opponent</span>
                <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'open' | 'invite')} className="min-h-11 px-3 rounded-lg bg-stone-800 border border-stone-700 text-sm text-stone-100">
                  <option value="open">Anyone (open challenge)</option>
                  <option value="invite">A friend (invite link)</option>
                </select>
              </label>
              <label className="text-xs text-stone-400 space-y-1">
                <span className="block">Time per turn</span>
                <select value={turnHours} onChange={(e) => setTurnHours(Number(e.target.value))} className="min-h-11 px-3 rounded-lg bg-stone-800 border border-stone-700 text-sm text-stone-100">
                  {TURN_OPTIONS.map((o) => (
                    <option key={o.hours} value={o.hours}>{o.label}</option>
                  ))}
                </select>
              </label>
              <button disabled={busy || !isConnected} className={primaryBtn} onClick={() => run(() => createAsyncGame(visibility, turnHours))}>
                Create game
              </button>
            </div>
            <p className="text-xs text-stone-500">Miss a turn and it passes to your opponent. Miss two in a row and you forfeit.</p>
          </section>

          <Section title="Open challenges" icon={<Users className="w-3.5 h-3.5 text-orange-400" />} count={openGames.length}>
            {openGames.map((g) => (
              <div key={g.id} className={row}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-100 truncate">{g.hostName}</p>
                  <p className="text-xs text-stone-400">{g.turnHours}h per turn</p>
                </div>
                <button disabled={busy} className={primaryBtn} onClick={() => run(() => joinAsyncGame(g.id))}>Join</button>
              </div>
            ))}
          </Section>

          <Section title="Finished" icon={<Trophy className="w-3.5 h-3.5 text-stone-400" />} count={finished.length}>
            {finished.map((g) => (
              <div key={g.id} className={row}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-100 truncate">vs {opponent(g)}</p>
                  <p className="text-xs text-stone-400">
                    {g.winnerId === myPlayerId ? 'Won' : g.winnerId ? 'Lost' : 'Draw'}
                    {g.endReason && g.endReason !== 'elimination' ? ` (${g.endReason})` : ''}
                  </p>
                </div>
                <button className={quietBtn} onClick={() => run(() => openAsyncGame(g.id))}>Review</button>
              </div>
            ))}
          </Section>

          <section className="flex items-start gap-3 p-3 rounded-xl bg-stone-950/60 border border-stone-800">
            <Bell className="w-4 h-4 mt-0.5 text-stone-400 shrink-0" />
            <p className="text-xs text-stone-300 flex-1">{PUSH_COPY[push]}</p>
            {push === 'off' && (
              <button className={quietBtn} onClick={() => enablePush().then(setPush)}>Turn on</button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
