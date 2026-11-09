import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Users, X, Swords, Plus, Play, Shield, RefreshCw } from 'lucide-react';

export const MultiplayerLobbyModal: React.FC = () => {
  const {
    showLobbyModal,
    setShowLobbyModal,
    playerName,
    setPlayerName,
    socket,
    availableRooms,
    isConnected,
  } = useGame();

  const [customRoomName, setCustomRoomName] = useState('');
  const [isQueueing, setIsQueueing] = useState(false);

  if (!showLobbyModal) return null;

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !isConnected) return;

    socket.emit('create_room', {
      roomName: customRoomName.trim() || `Arena of ${playerName}`,
      playerName,
    });
    setCustomRoomName('');
  };

  const handleJoinRoom = (roomId: string) => {
    if (!socket || !isConnected) return;
    socket.emit('join_room', { roomId, playerName });
  };

  const handleQuickMatch = () => {
    if (!socket || !isConnected) return;
    setIsQueueing(true);
    socket.emit('quick_match', { playerName });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 bg-stone-950/90 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30">
              <Users className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-stone-100">
                Multiplayer Tactical Colosseum
              </h3>
              <p className="text-xs text-stone-400">
                Real-Time WebSocket Matchmaking & Competitive Arena Duels
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setShowLobbyModal(false);
              setIsQueueing(false);
            }}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Player Identifier */}
          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <label className="text-[11px] text-stone-400 uppercase font-bold block mb-1">
                Your Survivor Tag:
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-stone-200 text-sm font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Quick Match Action */}
            <button
              onClick={handleQuickMatch}
              disabled={!isConnected}
              className="px-6 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-orange-950/50 flex items-center gap-2 cursor-pointer"
            >
              <Swords className="w-4 h-4" />
              <span>{isQueueing ? 'Searching Rivals...' : 'Quick Matchmaking'}</span>
            </button>
          </div>

          {/* Create Room Form */}
          <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 space-y-3">
            <h4 className="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Establish Arena Room</span>
            </h4>

            <form onSubmit={handleCreateRoom} className="flex gap-2">
              <input
                type="text"
                value={customRoomName}
                onChange={(e) => setCustomRoomName(e.target.value)}
                placeholder="e.g. Jurassic High Ground, Apex Claw Duel"
                className="flex-1 px-3.5 py-2 rounded-xl bg-stone-900 border border-stone-700 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={!isConnected}
                className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-600/40 text-xs font-bold cursor-pointer transition-colors"
              >
                Host Arena
              </button>
            </form>
          </div>

          {/* Available Rooms List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                Live Colosseum Arenas
              </h4>
              <span className="text-xs text-stone-500">
                {availableRooms.length} Arena(s) Active
              </span>
            </div>

            {availableRooms.length === 0 ? (
              <div className="text-center py-8 rounded-xl bg-stone-950/40 border border-stone-800/60 text-xs text-stone-500 space-y-1">
                <p>No open rooms at this moment.</p>
                <p className="text-stone-400">Click Quick Match or Host an Arena to begin!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableRooms.map((room) => (
                  <div
                    key={room.roomId}
                    className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between gap-4 hover:border-amber-700/50 transition-colors"
                  >
                    <div>
                      <h5 className="font-bold text-stone-200 text-sm">{room.name}</h5>
                      <div className="flex items-center gap-2 text-xs text-stone-400 mt-0.5">
                        <span>Host: {room.hostName}</span>
                        <span>•</span>
                        <span>Players: {room.playerCount} / 2</span>
                        <span>•</span>
                        <span
                          className={`font-semibold ${
                            room.status === 'waiting' ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {room.status === 'waiting' ? 'Open for Challenger' : 'In Combat'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleJoinRoom(room.roomId)}
                      disabled={room.playerCount >= 2}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        room.playerCount < 2
                          ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                          : 'bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700'
                      }`}
                    >
                      {room.playerCount < 2 ? 'Join Arena' : 'Full'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
