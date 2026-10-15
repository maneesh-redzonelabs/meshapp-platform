import React, { useRef, useState } from 'react';
import { supportApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/apiClient';
import { Button } from '@/components/ui/Primitives';

interface ChatMessage {
  id: number;
  from: 'user' | 'bot';
  text: string;
}

let nextId = 1;

export default function HelpDeskTab() {
  const { show } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: nextId++, from: 'bot', text: 'Hi! I\'m the MeshApp Help Desk bot. Ask me about bookings, verification, billing, or anything else.' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { id: nextId++, from: 'user', text }]);
    setInput('');
    setSending(true);
    try {
      const res = await supportApi.botQuery(text);
      setMessages((m) => [
        ...m,
        {
          id: nextId++,
          from: 'bot',
          text: res.escalated ? `${res.reply}\n\nI've escalated this to a human agent via a support ticket.` : res.reply,
        },
      ]);
    } catch (err) {
      setMessages((m) => [...m, { id: nextId++, from: 'bot', text: 'Sorry, I could not reach the help desk service. Please try again shortly.' }]);
      show(err instanceof ApiError ? err.message : 'Help desk bot is unavailable.', 'error');
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    }
  }

  return (
    <div className="flex flex-col h-[70vh] max-w-2xl mx-auto bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-purple-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center">
          <i className="fa-solid fa-robot text-sm" />
        </div>
        <span className="font-bold text-purple-950 text-sm">Help Desk</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line ${
                m.from === 'user' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-900'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-purple-100 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type your question…"
          className="flex-1 bg-purple-50/70 border border-purple-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
        />
        <Button onClick={send} disabled={sending || !input.trim()} className="px-4">
          <i className="fa-solid fa-paper-plane" />
        </Button>
      </div>
    </div>
  );
}
