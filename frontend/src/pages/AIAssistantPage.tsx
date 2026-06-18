import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, Send, TrendingUp, AlertOctagon, User } from 'lucide-react';
import api from '../api/client';

interface Message { role: 'user' | 'assistant'; content: string; time: string; }

const SUGGESTIONS = [
  'Which materials are below reorder level?',
  'Show me the procurement summary for this month',
  'What materials should I reorder now?',
  'Which vendor has the best performance score?',
  'Predict stock shortages for next month',
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your Stores & Inventory AI Assistant. I have real-time access to your inventory data and can help with stock analysis, procurement recommendations, and demand forecasting. How can I help you today?',
      time: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: predictions } = useQuery({
    queryKey: ['ai-predictions'],
    queryFn: () => api.get('/ai/predictions').then(r => r.data),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setMessages(prev => [...prev, { role: 'user', content: msg, time: new Date().toLocaleTimeString() }]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', { message: msg });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.data.reply,
        time: new Date().toLocaleTimeString(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I could not process your request. Please check your OpenAI API configuration.',
        time: new Date().toLocaleTimeString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="w-6 h-6 text-primary-700" /> AI Assistant</h1>
        <p className="text-gray-500 text-sm mt-1">Powered by GPT-4 with real-time inventory data</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat */}
        <div className="lg:col-span-2 card flex flex-col h-[600px]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'assistant' ? 'bg-primary-100' : 'bg-gray-200'}`}>
                  {m.role === 'assistant' ? <Bot className="w-4 h-4 text-primary-700" /> : <User className="w-4 h-4 text-gray-600" />}
                </div>
                <div className={`max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'assistant'
                      ? 'bg-gray-100 text-gray-800 rounded-tl-none'
                      : 'bg-primary-700 text-white rounded-tr-none'
                  }`}>
                    {m.content}
                  </div>
                  <span className="text-xs text-gray-400">{m.time}</span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary-700" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          <div className="flex flex-wrap gap-2 mb-3">
            {SUGGESTIONS.slice(0, 3).map(s => (
              <button key={s} onClick={() => sendMessage(s)}
                className="text-xs px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full hover:bg-primary-100 transition-colors border border-primary-200">
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Ask about inventory, stock levels, procurement..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={loading}
            />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
              className="btn-primary px-4">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Predictions Panel */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary-700" /> 30-Day Forecast
            </h3>
            <div className="space-y-3">
              {(predictions?.data?.predictions || []).slice(0, 6).map((p: {
                material_name: string; daily_avg_consumption: string; projected_30_day_need: string; unit: string;
              }) => (
                <div key={p.material_name} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-800">{p.material_name}</p>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Daily avg: {p.daily_avg_consumption} {p.unit}</span>
                    <span className="font-semibold text-primary-700">Need: {p.projected_30_day_need} {p.unit}</span>
                  </div>
                </div>
              ))}
              {!(predictions?.data?.predictions?.length) && (
                <p className="text-gray-400 text-sm text-center py-4">Insufficient issue data for predictions</p>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <AlertOctagon className="w-4 h-4 text-warning-500" /> Quick Ask
            </h3>
            <div className="space-y-2">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="w-full text-left text-sm px-3 py-2 bg-gray-50 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-colors text-gray-700">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
