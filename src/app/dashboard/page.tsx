'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, Lead } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sun, Moon } from 'lucide-react';

const STATUS_ORDER = ['new', 'contacted', 'qualified', 'appointment_set', 'closed'] as const;
const STATUS_LABELS: Record<string, string> = {
  new: '🆕 New',
  contacted: '📞 Contacted',
  qualified: '✅ Qualified',
  appointment_set: '📅 Booked',
  closed: '🏁 Closed',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'border-zinc-500/50',
  contacted: 'border-blue-500/50',
  qualified: 'border-emerald-500/50',
  appointment_set: 'border-amber-500/50',
  closed: 'border-violet-500/50',
};

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
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

  const fetchLeads = async () => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false });
    if (data) setLeads(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-red-400';
  };

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const leadsByStatus = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = leads.filter((l) => l.status === status);
    return acc;
  }, {} as Record<string, Lead[]>);

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
            <Button variant="default" size="sm" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/call">Voice Agent</Link>
            </Button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Lead Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              {leads.length} total leads • Real-time updates enabled
            </p>
          </div>
          <Button asChild>
            <Link href="/call">📞 New Call</Link>
          </Button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-muted-foreground">Loading leads...</div>
        ) : leads.length === 0 ? (
          <div className="py-20 text-center">
            <h2 className="text-xl font-semibold">No leads yet</h2>
            <p className="mt-2 text-muted-foreground">Start a voice call to create your first lead</p>
            <Button className="mt-4" asChild>
              <Link href="/call">Start First Call</Link>
            </Button>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUS_ORDER.map((status) => (
              <div key={status} className="min-w-[250px] flex-1">
                <div className={`mb-3 flex items-center justify-between border-b-2 pb-2 ${STATUS_COLORS[status]}`}>
                  <span className="text-sm font-medium">{STATUS_LABELS[status]}</span>
                  <Badge variant="secondary" className="text-xs">
                    {leadsByStatus[status].length}
                  </Badge>
                </div>

                <ScrollArea style={{ maxHeight: '70vh' }}>
                  <div className="space-y-2">
                    {leadsByStatus[status].map((lead) => (
                      <Link key={lead.id} href={`/dashboard/leads/${lead.id}`}>
                        <Card className="cursor-pointer border-border/40 bg-card/60 transition-all hover:border-border hover:bg-card">
                          <CardContent className="p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-sm font-medium">{lead.name || 'Unknown'}</span>
                              <Badge variant="outline" className="text-xs">
                                {lead.lead_type}
                              </Badge>
                            </div>

                            <div className="mb-2 flex items-center gap-3">
                              <div className={`text-2xl font-bold ${getScoreColor(lead.readiness_score)}`}>
                                {lead.readiness_score}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="w-12 text-muted-foreground">Intent</span>
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-blue-500"
                                      style={{ width: `${lead.intent_score * 10}%` }}
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="w-12 text-muted-foreground">Urgency</span>
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-red-500"
                                      style={{ width: `${lead.urgency_score * 10}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {lead.budget && (
                              <p className="text-xs text-muted-foreground">💰 {lead.budget}</p>
                            )}
                            {lead.location && (
                              <p className="text-xs text-muted-foreground">📍 {lead.location}</p>
                            )}
                            {lead.next_action && (
                              <p className="mt-1 text-xs font-medium text-blue-400">
                                → {lead.next_action}
                              </p>
                            )}

                            <p className="mt-2 text-xs text-muted-foreground/60">
                              {getTimeSince(lead.updated_at)}
                            </p>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
