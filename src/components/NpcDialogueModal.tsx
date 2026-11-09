import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { SURVIVOR_NPCS } from '../game/constants';
import { MessageSquare, X, Send, Sparkles, Bot, Shield, Dna, Compass } from 'lucide-react';

interface ChatMessage {
  sender: 'player' | 'npc';
  text: string;
}

export const NpcDialogueModal: React.FC = () => {
  const { activeNpcModal, setActiveNpcModal, playerLevel, tamedDinos } = useGame();
  const [selectedNpcId, setSelectedNpcId] = useState(activeNpcModal || 'chief_kaeda');
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({
    chief_kaeda: [
      {
        sender: 'npc',
        text: 'Watch the tall ferns, survivor. A raptor does not announce its kill until the sickle claw is at your throat.',
      },
    ],
    dr_thorne: [
      {
        sender: 'npc',
        text: 'Fascinating amber specimen! The genomic sequences inside these fossils can mutate our tamed specimens beyond their extinct limits.',
      },
    ],
    shaman_varek: [
      {
        sender: 'npc',
        text: 'The great thunder-lizards do not yield to brute strength alone; their spirit responds to harmony and narcotic balance.',
      },
    ],
  });
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!activeNpcModal) return null;

  const currentNpc = SURVIVOR_NPCS.find((n) => n.id === selectedNpcId) || SURVIVOR_NPCS[0];
  const activeChat = messages[currentNpc.id] || [];

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || userInput;
    if (!textToSend.trim() || isLoading) return;

    // Add player message
    setMessages((prev) => ({
      ...prev,
      [currentNpc.id]: [...(prev[currentNpc.id] || []), { sender: 'player', text: textToSend.trim() }],
    }));
    setUserInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/npc-dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npcId: currentNpc.id,
          userMessage: textToSend.trim(),
          context: {
            playerLevel,
            tamedCount: tamedDinos.length,
            currentBiome: 'Primeval Canopy Jungle',
          },
        }),
      });

      const data = await res.json();
      setMessages((prev) => ({
        ...prev,
        [currentNpc.id]: [
          ...(prev[currentNpc.id] || []),
          { sender: 'npc', text: data.reply || currentNpc.greeting },
        ],
      }));
    } catch (err) {
      console.error('Failed to communicate with NPC:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const sampleQuestions = [
    'How do I effectively tranquilize an Ankylosaurus?',
    'Which evolution branch is best for a Velociraptor?',
    'What tactical formation defeats high-armor tanks?',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <MessageSquare className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-100 text-base">Survivor Enclave Council</h3>
              <p className="text-xs text-stone-400">Dynamic AI-Powered NPC Guides & Tacticians</p>
            </div>
          </div>

          <button
            onClick={() => setActiveNpcModal(null)}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NPC Tabs */}
        <div className="flex border-b border-stone-800 bg-stone-950/40 p-2 gap-2 overflow-x-auto">
          {SURVIVOR_NPCS.map((npc) => {
            const isSelected = npc.id === selectedNpcId;
            return (
              <button
                key={npc.id}
                onClick={() => setSelectedNpcId(npc.id)}
                className={`px-3 py-2 rounded-xl text-left transition-all shrink-0 flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-amber-950/70 border-amber-500 text-amber-200'
                    : 'bg-stone-900 border-stone-800 hover:border-stone-700 text-stone-400'
                }`}
              >
                <div>
                  <div className="font-bold text-xs">{npc.name}</div>
                  <div className="text-[10px] text-stone-400">{npc.title}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Chat History */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-stone-950/60 min-h-[280px]">
          {activeChat.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.sender === 'player' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                  msg.sender === 'player'
                    ? 'bg-amber-600 text-white rounded-br-none shadow'
                    : 'bg-stone-800 text-stone-200 rounded-bl-none border border-stone-700/80 shadow'
                }`}
              >
                {msg.sender === 'npc' && (
                  <div className="font-bold text-[10px] text-amber-400 mb-0.5">
                    {currentNpc.name}
                  </div>
                )}
                {msg.text}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-stone-800 text-stone-400 rounded-2xl rounded-bl-none px-4 py-2 text-xs flex items-center gap-2 border border-stone-700">
                <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>{currentNpc.name} is thinking...</span>
              </div>
            </div>
          )}
        </div>

        {/* Suggested Quick Questions */}
        <div className="p-2.5 bg-stone-950/80 border-t border-stone-800 flex flex-wrap gap-1.5 text-[11px]">
          <span className="text-stone-500 font-medium py-1">Ask:</span>
          {sampleQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(q)}
              className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors border border-stone-700"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 bg-stone-900 border-t border-stone-800 flex gap-2"
        >
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={`Ask ${currentNpc.name} about tactics or taming...`}
            className="flex-1 px-3.5 py-2 rounded-xl bg-stone-950 border border-stone-700 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={isLoading || !userInput.trim()}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Consult</span>
          </button>
        </form>
      </div>
    </div>
  );
};
