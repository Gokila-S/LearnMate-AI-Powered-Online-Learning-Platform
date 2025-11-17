import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sendAIChat } from '../../services/aiService';

// Floating AI Tutor chat widget
// Minimal local state, no global store dependency besides optional user prop

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: 'Hi! I\'m your AI Tutor. Ask me anything about this course or the current lesson.'
};

export default function ChatWidget({ user, courseTitle, lessonTitle }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
  };

  useEffect(() => { if (open) scrollToBottom(); }, [open, messages.length]);

  const ask = useCallback(async () => {
    if (!input.trim() || loading) return;
    const newMsg = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setLoading(true);
    setError(null);
    try {
      const contextIntro = `Course: ${courseTitle || 'Unknown'}\nLesson: ${lessonTitle || 'N/A'}\nUser: ${user?.name || 'Student'}\n`;
      const history = messages.filter(m => m.role !== 'system').slice(-8); // last 8 turns
      const reply = await sendAIChat([
        { role: 'system', content: contextIntro },
        ...history,
        newMsg
      ]);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e.message || 'Failed to get reply');
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, user, courseTitle, lessonTitle]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  return (
    <div className="fixed z-50 bottom-4 right-4 flex flex-col items-end space-y-2">
      {open && (
        <div className="w-80 h-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-fade-in">
          <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-1.657 0-3 2-3s2 1.343 2 3-1 3-2 3-2 1.343-2 3m0-6c0-1.657 0-3-2-3s-2 1.343-2 3 1 3 2 3 2 1.343 2 3m-9-3a9 9 0 1118 0 9 9 0 01-18 0z"/></svg>
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">AI Tutor</p>
                <p className="text-[10px] opacity-80 -mt-0.5">Powered by OpenAI</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/20 focus:outline-none">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 text-sm bg-gradient-to-b from-gray-50 to-white" aria-live="polite">
            {messages.map((m,i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 shadow text-[13px] whitespace-pre-wrap leading-relaxed ${m.role==='user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'}`}>{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center space-x-2 text-gray-500 text-xs">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:150ms]" />
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:300ms]" />
                <span>Thinking...</span>
              </div>
            )}
            {error && <div className="text-xs text-red-600">{error}</div>}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={(e)=>{e.preventDefault(); ask();}} className="p-2 border-t bg-white">
            <div className="flex items-end space-x-2">
              <textarea
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={handleKey}
                className="flex-1 resize-none rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 px-2 py-2 text-sm max-h-24"
                placeholder="Ask a question..."
                rows={1}
                disabled={loading}
              />
              <button type="submit" disabled={!input.trim() || loading} className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l14-7-7 14-2-5-5-2z"/></svg>
              </button>
            </div>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen(o=>!o)}
        aria-label="Toggle AI Tutor chat"
        className="relative w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-blue-300"
      >
        {open ? (
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        ) : (
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v6a2 2 0 01-2 2h-3l-4 6z"/></svg>
        )}
      </button>
    </div>
  );
}
