'use client';

import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import Vapi from '@vapi-ai/web';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sun, Moon, Mic, MicOff, Search, Brain, MessageSquare } from 'lucide-react';

interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface ReasoningEntry {
  strategy: string;
  confidence: number;
  readiness_score: number;
  reasoning: string;
  next_action: string;
  timestamp: Date;
}

export default function CallPage() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [reasoningTrace, setReasoningTrace] = useState<ReasoningEntry[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  const vapiRef = useRef<Vapi | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const listenersSetRef = useRef(false);

  // Initialize theme
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (publicKey) {
      vapiRef.current = new Vapi(publicKey);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      vapiRef.current?.stop();
    };
  }, []);

  const runReasoningEngine = async (userInput: string, currentHistory?: TranscriptEntry[]): Promise<string | null> => {
    try {
      const historyToUse = currentHistory || transcript;
      const res = await fetch('/api/reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_input: userInput,
          lead_id: leadId,
          conversation_history: historyToUse.map((t) => ({
            role: t.role,
            content: t.text,
          })),
        }),
      });

      const data = await res.json();
      if (data.success && data.result) {
        setReasoningTrace((prev) => [
          ...prev,
          {
            strategy: data.result.strategy,
            confidence: data.result.confidence,
            readiness_score: data.result.readiness_score,
            reasoning: data.result.reasoning,
            next_action: data.result.next_action,
            timestamp: new Date(),
          },
        ]);
        if (data.lead_id) setLeadId(data.lead_id);
        return data.result.response_to_user || null;
      }
      return null;
    } catch (err) {
      console.error('Reasoning engine error:', err);
      return null;
    }
  };

  const setupVapiListeners = useCallback(() => {
    const vapi = vapiRef.current;
    if (!vapi || listenersSetRef.current) return;
    listenersSetRef.current = true;

    vapi.on('call-start', () => {
      setIsCallActive(true);
      setIsConnecting(false);
      setError(null);
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    });

    vapi.on('call-end', () => {
      setIsCallActive(false);
      setIsConnecting(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });

    vapi.on('message', (message) => {
      if (message.type === 'transcript' && message.transcriptType === 'final') {
        const isUser = message.role === 'user';
        const newEntry: TranscriptEntry = {
          role: isUser ? 'user' : 'assistant',
          text: message.transcript,
          timestamp: new Date(),
        };

        setTranscript((prev) => {
          const updated = [...prev, newEntry];
          if (isUser) {
            runReasoningEngine(message.transcript, updated);
          }
          return updated;
        });
      }
      if (message.type === 'speech-update') {
        console.log('[Vapi speech]', message);
      }
    });

    vapi.on('error', (err) => {
      console.error('Vapi error:', err);
      setError('Voice connection error. You can still type messages below.');
      setIsConnecting(false);
      setIsCallActive(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });
  }, [leadId]); // Add dependencies as needed

  const handleTextSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = textInput.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setTextInput('');

    // Create lead if none exists
    let currentLeadId = leadId;
    if (!currentLeadId) {
      try {
        const leadRes = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Text Chat Lead' }),
        });
        const leadData = await leadRes.json();
        if (leadData.lead) {
          currentLeadId = leadData.lead.id;
          setLeadId(currentLeadId);
        }
      } catch (err) {
        console.error('Failed to create lead:', err);
      }
    }

    // Add user message to transcript
    const userMessage: TranscriptEntry = { role: 'user', text, timestamp: new Date() };
    setTranscript((prev) => [...prev, userMessage]);

    // Run reasoning engine and get AI response
    // Pass history including the message just added
    const aiResponse = await runReasoningEngine(text, [...transcript, userMessage]);

    // Add AI response to transcript
    setTranscript((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: aiResponse || "I'm processing that — check the reasoning trace panel for details.",
        timestamp: new Date(),
      },
    ]);

    setIsSending(false);
  };

  const startCall = async () => {
    const vapi = vapiRef.current;
    if (!vapi) {
      setError('Vapi not initialized. Check NEXT_PUBLIC_VAPI_PUBLIC_KEY in .env.local');
      return;
    }

    setIsConnecting(true);
    setTranscript([]);
    setReasoningTrace([]);
    setCallDuration(0);
    setError(null);
    setupVapiListeners();

    // Create lead for this call
    try {
      const leadRes = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Incoming Caller' }),
      });
      const leadData = await leadRes.json();
      if (leadData.lead) setLeadId(leadData.lead.id);
    } catch (err) {
      console.error('Failed to create lead:', err);
    }

    try {
      await vapi.start({
        name: 'Premier Realty AI Agent',
        model: {
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: `You are Sarah, a professional and authoritative AI real estate advisor at Premier Realty, specializing in the United States market (Austin, TX focus). 

## PERSONA
- Personality: Calm, elite professional, empathetic, and highly organized. 
- Tone: Natural, poised, and conversational. You sound like a top-performing US agent.
- Intelligence: You have access to "Firecrawl Research" for the most accurate, real-time USA property data.

## GOAL
- Your goal is to navigate the complex US real estate landscape for the client.
- Gather key details (budget, location, timeline, motivation) naturally.
- Answer questions with authoritative confidence based on Firecrawl data.

## MARKET INFO
- Region: Austin, TX Metro (including Round Rock, Cedar Park, West Lake Hills).
- Context: US standards for financing (FHA, Conventional), escrow, and appraisal.

## RULES
- Acknowledge their specific needs before proceeding.
- If uncertainty arises, use your "Firecrawl" capabilities to provide researched insights.
- Keep responses concise (under 50 words).`,
            },
          ],
        },
        voice: {
          provider: '11labs',
          voiceId: '21m00Tcm4TlvDq8ikWAM',
        },
        firstMessage:
          "Hi there! This is Sarah from Premier Realty. Thanks for reaching out. Are you looking to buy, sell, or just exploring what's available in the Austin area?",
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: 'en',
        },
        server: typeof window !== 'undefined'
          ? { url: `${window.location.origin}/api/vapi/webhook` }
          : undefined,
      });
    } catch (err) {
      console.error('Failed to start call:', err);
      setError(
        `Failed to start voice call: ${(err as Error).message}. You can still type messages below.`
      );
      setIsConnecting(false);
    }
  };

  const endCall = () => {
    vapiRef.current?.stop();
    setIsCallActive(false);
    setIsConnecting(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getStrategyColor = (strategy: string) => {
    const colors: Record<string, string> = {
      book_now: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      qualify: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      clarify: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      nurture: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
      handoff: 'bg-red-500/20 text-red-400 border-red-500/30',
      provide_info: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    };
    return colors[strategy] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            🏠 Premier Realty AI
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link href="/call">Voice Agent</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Main layout */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 lg:flex-row lg:p-6">
        {/* Left: Call Interface */}
        <div className="flex flex-1 flex-col gap-4 min-w-0">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">AI Voice Agent</CardTitle>
              <p className="text-sm text-muted-foreground">
                Talk to Sarah via voice or type your messages below
              </p>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                  ⚠️ {error}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {!isCallActive && !isConnecting ? (
                  <Button onClick={startCall} className="gap-2">
                    <Mic className="h-4 w-4" /> Start Voice Call
                  </Button>
                ) : isConnecting ? (
                  <Button disabled className="gap-2">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                    Connecting Mic...
                  </Button>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="outline" className="gap-2 border-emerald-500/50 py-1.5 text-emerald-400">
                      <Mic className="h-3 w-3" />
                      LIVE — {formatDuration(callDuration)}
                    </Badge>
                    <Button variant="destructive" size="sm" onClick={endCall}>
                      End Call
                    </Button>
                  </div>
                )}
                <Badge variant="secondary" className="text-xs">
                  {isCallActive ? <Brain className="mr-1 h-3 w-3" /> : <MessageSquare className="mr-1 h-3 w-3" />}
                  {isCallActive ? 'Voice + Text (Firecrawl Active)' : 'Text Mode (High-Res Reasoning)'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Transcript */}
          <Card className="flex flex-1 flex-col border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Conversation</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ScrollArea className="flex-1 pr-4" style={{ minHeight: '300px', maxHeight: '50vh' }}>
                {transcript.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <p className="mb-2">💬 Type a message below to start chatting with the AI agent</p>
                    <p className="text-xs text-muted-foreground/60">
                      Or click &quot;Start Voice Call&quot; to talk via microphone
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transcript.map((entry, i) => (
                      <div
                        key={i}
                        className={`flex gap-3 ${
                          entry.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                            entry.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          <span className="mb-1 block text-xs font-medium opacity-70">
                            {entry.role === 'user' ? '🧑 You' : '🤖 Sarah'}
                          </span>
                          {entry.text}
                        </div>
                      </div>
                    ))}
                    <div ref={transcriptEndRef} />
                  </div>
                )}
              </ScrollArea>

              <Separator className="my-3" />

              {/* Text Input — ALWAYS available */}
              <form onSubmit={handleTextSubmit} className="flex gap-2">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={isSending ? 'AI is thinking...' : 'Type a message to Sarah...'}
                  disabled={isSending}
                  className="flex-1"
                  autoFocus
                />
                <Button type="submit" disabled={isSending || !textInput.trim()}>
                  {isSending ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    'Send'
                  )}
                </Button>
              </form>

              {leadId && (
                <div className="mt-3">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/leads/${leadId}`}>
                      View Lead in CRM →
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Center/Right: Reasoning Trace */}
        <div className="w-full lg:w-[400px] lg:shrink-0">
          <Card className="sticky top-20 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                🧠 AI Reasoning Trace
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Real-time decisions, confidence scores & strategy
              </p>
            </CardHeader>
            <CardContent>
              <ScrollArea style={{ maxHeight: '65vh' }}>
                {reasoningTrace.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <p>Reasoning traces appear as the conversation progresses.</p>
                    <p className="mt-2 text-xs opacity-60">
                      Each message triggers the AI to extract intent, score confidence, and decide strategy.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reasoningTrace.map((entry, i) => (
                      <div key={i} className="rounded-lg border border-border/50 bg-muted/30 p-4">
                        {/* Header */}
                        <div className="mb-3 flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${getStrategyColor(entry.strategy)}`}
                          >
                            {entry.strategy.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(entry.confidence * 100)}% confident
                          </Badge>
                        </div>

                        {/* Readiness bar */}
                        <div className="mb-3">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Readiness</span>
                            <span className={`font-semibold ${getScoreColor(entry.readiness_score)}`}>
                              {entry.readiness_score}/100
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full transition-all ${getScoreBarColor(entry.readiness_score)}`}
                              style={{ width: `${entry.readiness_score}%` }}
                            />
                          </div>
                        </div>

                        {/* Reasoning */}
                        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
                          {entry.reasoning}
                        </p>

                        {/* Next action */}
                        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs">
                          <span className="font-medium text-foreground">Next →</span>{' '}
                          <span className="text-muted-foreground">{entry.next_action}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
