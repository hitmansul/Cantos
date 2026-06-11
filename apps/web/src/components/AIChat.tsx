'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Bot,
  User,
  Loader2,
  CornerUpRight,
  Trash2,
  MessageSquare,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface FaqItem {
  question: string;
  asked_count: number;
}

const FALLBACK_QUESTIONS = [
  'Quais dados temos da Copa do Mundo?',
  'Média de escanteios da Copa do Mundo',
  'Odds de escanteios da Copa do Mundo',
  'Próximos jogos da Copa do Mundo',
  'Convocados do Brasil na Copa',
  'Como interpretar alertas de odds de escanteios?',
];

let msgCounter = 0;
function nextId() {
  msgCounter += 1;
  return String(msgCounter);
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-gradient-to-br from-emerald-500 to-green-600 text-white'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted text-foreground rounded-tl-sm'
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [faqsLoaded, setFaqsLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Fetch top FAQs on mount
  useEffect(() => {
    fetch('/api/faq')
      .then((r) => r.json())
      .then((data: { faqs: FaqItem[] }) => {
        setFaqs(data.faqs ?? []);
        setFaqsLoaded(true);
      })
      .catch(() => setFaqsLoaded(true));
  }, []);

  const suggestions = faqs.filter((faq) => /copa|mundial|escanteio|corner|odds?/i.test(faq.question)).slice(0, 6);
  const fallbackSuggestions = (suggestions.length >= 3 ? null : FALLBACK_QUESTIONS) && faqsLoaded ? FALLBACK_QUESTIONS : null;

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMessage: Message = {
        id: nextId(),
        role: 'user',
        content: text.trim(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);
      setError(null);

      try {
        const historyForApi = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: historyForApi }),
        });

        if (!res.ok) {
          const errData = (await res.json()) as { error?: string };
          throw new Error(errData.error ?? 'Erro desconhecido');
        }

        const data = (await res.json()) as { reply: string };

        const assistantMessage: Message = {
          id: nextId(),
          role: 'assistant',
          content: data.reply,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Refresh FAQs after sending (non-blocking)
        fetch('/api/faq')
          .then((r) => r.json())
          .then((d: { faqs: FaqItem[] }) => setFaqs(d.faqs ?? []))
          .catch(() => {});
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao enviar mensagem';
        setError(msg);
        console.error('AI chat error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">IA da Cantos</h2>
            <p className="text-xs text-muted-foreground">Análise inteligente de escanteios</p>
          </div>
        </div>
        {!isEmpty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            className="text-muted-foreground gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Limpar
          </Button>
        )}
      </div>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
                <Bot className="w-10 h-10 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Olá! Sou a IA da Cantos</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  Posso te ajudar com análises de escanteios, previsões, estatísticas e também
                  explicar como usar o app. Pergunte o que quiser!
                </p>
              </div>
              <div className="w-full max-w-lg space-y-2">
                {suggestions.length >= 3 && (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        Perguntas mais frequentes
                      </p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {suggestions.map((faq, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(faq.question)}
                          className="text-left text-sm px-4 py-3 rounded-xl border border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-muted-foreground hover:text-foreground group"
                        >
                          <div className="flex items-start gap-2">
                            <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-emerald-500 flex-shrink-0" />
                            <span className="flex-1">{faq.question}</span>
                          </div>
                          {faq.asked_count > 1 && (
                            <span className="mt-1 inline-block text-[10px] text-emerald-600 font-semibold">
                              {faq.asked_count}x perguntada
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {fallbackSuggestions && (
                  <>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">
                      Sugestões para começar
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {fallbackSuggestions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(q)}
                          className="text-left text-sm px-4 py-3 rounded-xl border border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-muted-foreground hover:text-foreground"
                        >
                          <MessageSquare className="w-3.5 h-3.5 inline mr-2 text-emerald-500" />
                          {q}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-400"
                      style={{ animation: 'aichat-bounce 1s infinite 0ms' }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-400"
                      style={{ animation: 'aichat-bounce 1s infinite 150ms' }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-400"
                      style={{ animation: 'aichat-bounce 1s infinite 300ms' }}
                    />
                  </div>
                </div>
              )}
              {error && (
                <div className="text-center">
                  <span className="text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full">
                    ⚠️ {error}
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-4">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre escanteios, ligas, como usar o app..."
                rows={1}
                className="w-full resize-none bg-muted rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 max-h-32"
                style={{ minHeight: '44px' }}
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="h-11 w-11 p-0 bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white rounded-xl flex-shrink-0"
            >
              {isLoading ? (
                <Loader2
                  className="w-4 h-4"
                  style={{ animation: 'aichat-spin 0.8s linear infinite' }}
                />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            <CornerUpRight className="w-3 h-3 inline mr-1 text-emerald-500" />
            IA da Cantos • perguntas de dados e manual do app • Enter para enviar
          </p>
        </div>
      </Card>

      <style jsx global>{`
        @keyframes aichat-bounce {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        @keyframes aichat-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
