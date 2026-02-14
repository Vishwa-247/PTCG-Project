'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ReasoningLog, Lead, Call, Appointment } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sun, Moon, Brain, Phone, Calendar, ArrowLeft, MoreVertical, LayoutDashboard } from 'lucide-react';

interface LeadDetailData {
  lead: Lead;
  reasoning_logs: ReasoningLog[];
  calls: Call[];
  appointments: Appointment[];
}

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<LeadDetailData | null>(null);
  const [managerSummary, setManagerSummary] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

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
    fetchLeadDetail();
  }, [id]);

  const fetchLeadDetail = async () => {
    const res = await fetch(`/api/leads/${id}`);
    if (res.ok) {
      const result = await res.json();
      setData(result);
    }
    setLoading(false);
  };

  const generateSummary = async () => {
    setGenerating(true);
    const res = await fetch(`/api/leads/${id}`, { method: 'POST' });
    if (res.ok) {
      const result = await res.json();
      setManagerSummary(result.summary);
    }
    setGenerating(false);
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

  const getBarColor = (score: number) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading lead details...
      </div>
    );
  if (!data)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Lead not found
      </div>
    );

  const { lead, reasoning_logs, calls, appointments } = data;

  return (
    <div className="min-h-screen bg-background">
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
            <Button variant="ghost" size="sm" asChild>
              <Link href="/call">Voice Agent</Link>
            </Button>
          </div>
        </div>
      </nav>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
        {/* Left: Profile */}
        <aside className="w-full shrink-0 space-y-4 lg:w-[300px]">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">← Back to Pipeline</Link>
          </Button>

          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {(lead.name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <h1 className="text-lg font-bold">{lead.name || 'Unknown'}</h1>
                  <Badge variant="outline" className="text-xs">
                    {lead.lead_type}
                  </Badge>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Readiness Score */}
              <div className="mb-4 text-center">
                <div className={`text-4xl font-extrabold ${getScoreColor(lead.readiness_score)}`}>
                  {lead.readiness_score}
                </div>
                <p className="text-xs text-muted-foreground">Readiness Score</p>
              </div>

              {/* Score breakdown */}
              <div className="space-y-2">
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">Intent</span>
                    <span>{lead.intent_score}/10</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${lead.intent_score * 10}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">Urgency</span>
                    <span>{lead.urgency_score}/10</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${lead.urgency_score * 10}%` }} />
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Details */}
              <div className="space-y-2 text-sm">
                {lead.budget && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">💰 Budget</span>
                    <span>{lead.budget}</span>
                  </div>
                )}
                {lead.location && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">📍 Location</span>
                    <span>{lead.location}</span>
                  </div>
                )}
                {lead.timeline && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">📅 Timeline</span>
                    <span>{lead.timeline}</span>
                  </div>
                )}
                {lead.motivation && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">💡 Motivation</span>
                    <span>{lead.motivation}</span>
                  </div>
                )}
                {lead.next_action && (
                  <div className="mt-2 rounded-md bg-blue-500/10 px-3 py-2 text-xs text-blue-400">
                    → {lead.next_action}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Button onClick={generateSummary} disabled={generating} className="w-full" variant="outline">
            {generating ? 'Generating...' : '📋 Generate Manager Summary'}
          </Button>

          {managerSummary && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Manager Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {managerSummary}
                </div>
              </CardContent>
            </Card>
          )}
        </aside>

        {/* Right: Tabs */}
        <main className="flex-1">
          <Tabs defaultValue="reasoning">
            <TabsList className="mb-4">
              <TabsTrigger value="reasoning">🧠 Reasoning ({reasoning_logs.length})</TabsTrigger>
              <TabsTrigger value="calls">📞 Calls ({calls.length})</TabsTrigger>
              <TabsTrigger value="appointments">📅 Appointments ({appointments.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="reasoning">
              <ScrollArea style={{ maxHeight: '75vh' }}>
                {reasoning_logs.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    No reasoning logs yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reasoning_logs.map((log, i) => (
                      <Card key={log.id} className="border-border/40">
                        <CardContent className="p-4">
                          {/* Header */}
                          <div className="mb-3 flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
                            <Badge variant="outline" className={`text-xs ${getStrategyColor(log.strategy_chosen)}`}>
                              {log.strategy_chosen.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {Math.round(log.confidence * 100)}%
                            </Badge>
                          </div>

                          {/* User input */}
                          <div className="mb-3 rounded-md bg-muted/50 px-3 py-2">
                            <span className="text-xs font-medium text-muted-foreground">User said:</span>
                            <p className="mt-1 text-sm italic">&ldquo;{log.user_input}&rdquo;</p>
                          </div>

                          {/* Extracted data */}
                          <div className="mb-3">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">Extracted Data:</p>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(
                                log.extracted_data as Record<string, { value: unknown; confidence: number }>
                              ).map(([key, val]) => {
                                if (typeof val !== 'object' || !val || !('confidence' in val)) return null;
                                const confColor =
                                  val.confidence >= 0.7
                                    ? 'text-emerald-400'
                                    : val.confidence >= 0.4
                                    ? 'text-amber-400'
                                    : 'text-red-400';
                                return (
                                  <div key={key} className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1.5 text-xs">
                                    <span className="text-muted-foreground">{key}</span>
                                    <span className="font-medium">{String(val.value || '—')}</span>
                                    <span className={`font-semibold ${confColor}`}>
                                      {Math.round(val.confidence * 100)}%
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Reasoning */}
                          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{log.reasoning}</p>

                          {/* Alternatives */}
                          {log.alternatives_rejected.length > 0 && (
                            <div className="mb-3">
                              <p className="mb-1 text-xs font-medium text-muted-foreground">Alternatives Rejected:</p>
                              <ul className="space-y-1">
                                {log.alternatives_rejected.map((alt, j) => (
                                  <li key={j} className="text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">{alt.strategy}</span>: {alt.reason}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Action */}
                          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs">
                            <span className="font-medium">Action:</span>{' '}
                            <span className="text-muted-foreground">{log.action_taken}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="calls">
              {calls.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">No calls recorded yet</div>
              ) : (
                <div className="space-y-3">
                  {calls.map((call) => (
                    <Card key={call.id} className="border-border/40">
                      <CardContent className="p-4">
                        <div className="mb-2 flex items-center gap-3 text-sm">
                          <span>{call.direction === 'inbound' ? '📥' : '📤'}</span>
                          <span className="font-medium">{call.direction} call</span>
                          <Badge variant="secondary" className="text-xs">{call.duration_seconds}s</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(call.created_at).toLocaleString()}
                          </span>
                        </div>
                        {call.summary && <p className="mb-2 text-sm text-muted-foreground">{call.summary}</p>}
                        {call.objections && (call.objections as string[]).length > 0 && (
                          <div className="mb-1 flex flex-wrap items-center gap-1">
                            <span className="text-xs font-medium">Objections:</span>
                            {(call.objections as string[]).map((o, i) => (
                              <Badge key={i} variant="outline" className="border-amber-500/30 text-xs text-amber-400">
                                {o}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {call.risk_flags && (call.risk_flags as string[]).length > 0 && (
                          <div className="mb-1 flex flex-wrap items-center gap-1">
                            <span className="text-xs font-medium">Risks:</span>
                            {(call.risk_flags as string[]).map((f, i) => (
                              <Badge key={i} variant="outline" className="border-red-500/30 text-xs text-red-400">
                                {f}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {call.action_items && (call.action_items as string[]).length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-xs font-medium">Actions:</span>
                            {(call.action_items as string[]).map((a, i) => (
                              <Badge key={i} variant="outline" className="border-blue-500/30 text-xs text-blue-400">
                                {a}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="appointments">
              {appointments.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">No appointments yet</div>
              ) : (
                <div className="space-y-3">
                  {appointments.map((apt) => (
                    <Card key={apt.id} className="border-border/40">
                      <CardContent className="flex items-center gap-4 p-4">
                        <Badge
                          variant={apt.status === 'confirmed' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {apt.status}
                        </Badge>
                        <div className="flex items-center gap-3 text-sm">
                          <span>📅 {apt.date}</span>
                          <span>🕐 {apt.time_slot}</span>
                          {apt.property_address && <span>📍 {apt.property_address}</span>}
                        </div>
                        {apt.notes && (
                          <p className="text-xs text-muted-foreground">{apt.notes}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
