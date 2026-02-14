'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Vapi from '@vapi-ai/web';
import Link from 'next/link';

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
  const vapiRef = useRef<Vapi | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (publicKey) {
      vapiRef.current = new Vapi(publicKey);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const setupVapiListeners = useCallback(() => {
    const vapi = vapiRef.current;
    if (!vapi) return;

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
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });

    vapi.on('message', (message) => {
      if (message.type === 'transcript' && message.transcriptType === 'final') {
        setTranscript((prev) => [
          ...prev,
          {
            role: message.role === 'user' ? 'user' : 'assistant',
            text: message.transcript,
            timestamp: new Date(),
          },
        ]);

        // If it's a user message, also run our reasoning engine
        if (message.role === 'user' && message.transcript) {
          runReasoningEngine(message.transcript);
        }
      }
    });

    vapi.on('error', (err) => {
      console.error('Vapi error:', err);
      setError('Voice connection error. Please try again.');
      setIsConnecting(false);
      setIsCallActive(false);
    });
  }, []);

  const runReasoningEngine = async (userInput: string) => {
    try {
      const res = await fetch('/api/reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_input: userInput,
          lead_id: leadId,
          conversation_history: transcript.map((t) => ({
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
      }
    } catch (err) {
      console.error('Reasoning engine error:', err);
    }
  };

  const startCall = async () => {
    const vapi = vapiRef.current;
    if (!vapi) {
      setError('Vapi not initialized. Check your API key.');
      return;
    }

    setIsConnecting(true);
    setTranscript([]);
    setReasoningTrace([]);
    setCallDuration(0);
    setError(null);

    setupVapiListeners();

    try {
      // Create a new lead for this call
      const leadRes = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Incoming Caller' }),
      });
      const leadData = await leadRes.json();
      if (leadData.lead) setLeadId(leadData.lead.id);

      // Start Vapi call with inline assistant config
      await vapi.start({
        model: {
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: `You are Sarah, a professional and friendly AI real estate agent at Premier Realty. Your role is to help potential buyers and sellers with their real estate needs.

## PERSONALITY
- Warm, professional, and knowledgeable
- Keep responses concise (under 30 words when possible)
- Use natural conversational speech patterns
- Address concerns empathetically

## CONVERSATION FLOW
1. Greet the caller and ask how you can help
2. Identify if they want to buy, sell, invest, or rent
3. Gather key qualification info:
   - Budget range
   - Preferred location/neighborhood
   - Timeline (when they need to move)
   - Property type (beds, baths, features)
   - Motivation (why they're looking)
4. Based on readiness, either:
   - Schedule a property viewing (high readiness)
   - Offer to send listings (medium readiness)
   - Provide market information (low readiness/browsing)

## DOMAIN EXPERTISE
- Know Austin, TX real estate market well
- Average home price: $450K-$600K
- Hot neighborhoods: Mueller, East Austin, South Congress, Domain
- Common financing: conventional, FHA, VA loans
- Current market: competitive, multiple offers common

## IMPORTANT RULES
- NEVER make up specific property listings or prices
- If asked about specific listings, say you'll email details
- For legal/contract questions, refer to human agent
- If the caller seems ready (clear budget, timeline, location), offer to schedule a showing
- Always end with a clear next step`,
            },
          ],
        },
        voice: {
          provider: '11labs',
          voiceId: '21m00Tcm4TlvDq8ikWAM',
        },
        firstMessage: "Hi, this is Sarah from Premier Realty! Thanks for reaching out. Are you looking to buy, sell, or just explore what's available in the market?",
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: 'en',
        },
      });
    } catch (err) {
      console.error('Failed to start call:', err);
      setError('Failed to start call. Please check your API key and try again.');
      setIsConnecting(false);
    }
  };

  const endCall = () => {
    vapiRef.current?.stop();
    setIsCallActive(false);
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
    switch (strategy) {
      case 'book_now': return '#10b981';
      case 'qualify': return '#3b82f6';
      case 'clarify': return '#f59e0b';
      case 'nurture': return '#8b5cf6';
      case 'handoff': return '#ef4444';
      case 'provide_info': return '#06b6d4';
      default: return '#6b7280';
    }
  };

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  return (
    <div className="call-page">
      <nav className="top-nav">
        <Link href="/" className="nav-logo">🏠 Premier Realty AI</Link>
        <div className="nav-links">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/call" className="active">Voice Agent</Link>
        </div>
      </nav>

      <main className="call-layout">
        {/* Left: Call Interface */}
        <section className="call-panel">
          <div className="call-header">
            <h1>AI Voice Agent</h1>
            <p>Browser-based voice conversation with Sarah, your AI real estate assistant</p>
          </div>

          {error && (
            <div className="error-banner">
              ⚠️ {error}
            </div>
          )}

          <div className="call-controls">
            {!isCallActive && !isConnecting ? (
              <button className="call-btn start" onClick={startCall}>
                <span className="call-icon">📞</span>
                Start Call
              </button>
            ) : isConnecting ? (
              <button className="call-btn connecting" disabled>
                <span className="pulse-dot" />
                Connecting...
              </button>
            ) : (
              <div className="active-call">
                <div className="call-timer">
                  <span className="live-dot" />
                  LIVE — {formatDuration(callDuration)}
                </div>
                <button className="call-btn end" onClick={endCall}>
                  End Call
                </button>
              </div>
            )}
          </div>

          {/* Transcript */}
          <div className="transcript-panel">
            <h3>Transcript</h3>
            <div className="transcript-list">
              {transcript.length === 0 ? (
                <p className="empty-state">Start a call to see the live transcript...</p>
              ) : (
                transcript.map((entry, i) => (
                  <div key={i} className={`transcript-entry ${entry.role}`}>
                    <span className="role-badge">
                      {entry.role === 'user' ? '🧑 Lead' : '🤖 Sarah'}
                    </span>
                    <p>{entry.text}</p>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          {leadId && (
            <Link href={`/dashboard/leads/${leadId}`} className="view-lead-btn">
              View Lead in CRM →
            </Link>
          )}
        </section>

        {/* Right: Reasoning Trace (THE 25-POINT PANEL) */}
        <section className="reasoning-panel">
          <h2>🧠 AI Reasoning Trace</h2>
          <p className="reasoning-subtitle">
            Real-time decisions, confidence scores & strategy explanations
          </p>

          {reasoningTrace.length === 0 ? (
            <div className="empty-reasoning">
              <p>Reasoning traces will appear here as the conversation progresses...</p>
              <p className="hint">Each user message triggers the AI reasoning engine to extract intent, score confidence, and decide the next strategy.</p>
            </div>
          ) : (
            <div className="reasoning-list">
              {reasoningTrace.map((entry, i) => (
                <div key={i} className="reasoning-card">
                  <div className="reasoning-header">
                    <span
                      className="strategy-badge"
                      style={{ backgroundColor: getStrategyColor(entry.strategy) }}
                    >
                      {entry.strategy.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="confidence-badge">
                      {Math.round(entry.confidence * 100)}% confident
                    </span>
                  </div>

                  <div className="readiness-bar">
                    <label>Readiness Score</label>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${entry.readiness_score}%`,
                          backgroundColor:
                            entry.readiness_score > 70
                              ? '#10b981'
                              : entry.readiness_score > 40
                              ? '#f59e0b'
                              : '#ef4444',
                        }}
                      />
                    </div>
                    <span className="score-value">{entry.readiness_score}/100</span>
                  </div>

                  <div className="reasoning-text">
                    <strong>Reasoning:</strong>
                    <p>{entry.reasoning}</p>
                  </div>

                  <div className="next-action">
                    <strong>Next Action:</strong> {entry.next_action}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
