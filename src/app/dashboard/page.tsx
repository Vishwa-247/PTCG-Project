'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, Lead } from '@/lib/supabase';

const STATUS_ORDER = ['new', 'contacted', 'qualified', 'appointment_set', 'closed'] as const;
const STATUS_LABELS: Record<string, string> = {
  new: '🆕 New',
  contacted: '📞 Contacted',
  qualified: '✅ Qualified',
  appointment_set: '📅 Appointment Set',
  closed: '🏁 Closed',
};

const STATUS_COLORS: Record<string, string> = {
  new: '#6b7280',
  contacted: '#3b82f6',
  qualified: '#10b981',
  appointment_set: '#f59e0b',
  closed: '#8b5cf6',
};

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

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

    // Real-time subscription
    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          fetchLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
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
    <div className="dashboard-page">
      <nav className="top-nav">
        <Link href="/" className="nav-logo">🏠 Premier Realty AI</Link>
        <div className="nav-links">
          <Link href="/dashboard" className="active">Dashboard</Link>
          <Link href="/call">Voice Agent</Link>
        </div>
      </nav>

      <header className="dashboard-header">
        <div>
          <h1>Lead Pipeline</h1>
          <p>{leads.length} total leads • Real-time updates enabled</p>
        </div>
        <Link href="/call" className="new-call-btn">
          📞 New Call
        </Link>
      </header>

      {loading ? (
        <div className="loading-state">Loading leads...</div>
      ) : leads.length === 0 ? (
        <div className="empty-dashboard">
          <h2>No leads yet</h2>
          <p>Start a voice call to create your first lead</p>
          <Link href="/call" className="new-call-btn">Start First Call</Link>
        </div>
      ) : (
        <div className="pipeline">
          {STATUS_ORDER.map((status) => (
            <div key={status} className="pipeline-column">
              <div
                className="column-header"
                style={{ borderBottomColor: STATUS_COLORS[status] }}
              >
                <span>{STATUS_LABELS[status]}</span>
                <span className="count">{leadsByStatus[status].length}</span>
              </div>

              <div className="column-cards">
                {leadsByStatus[status].map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/dashboard/leads/${lead.id}`}
                    className="lead-card"
                  >
                    <div className="card-top">
                      <span className="lead-name">{lead.name || 'Unknown'}</span>
                      <span className="lead-type-badge">{lead.lead_type}</span>
                    </div>

                    <div className="card-score">
                      <div className="score-circle" style={{ borderColor: getScoreColor(lead.readiness_score) }}>
                        <span style={{ color: getScoreColor(lead.readiness_score) }}>
                          {lead.readiness_score}
                        </span>
                      </div>
                      <div className="score-details">
                        <div className="score-row">
                          <span>Intent</span>
                          <div className="mini-bar">
                            <div style={{ width: `${lead.intent_score * 10}%`, backgroundColor: '#3b82f6' }} />
                          </div>
                        </div>
                        <div className="score-row">
                          <span>Urgency</span>
                          <div className="mini-bar">
                            <div style={{ width: `${lead.urgency_score * 10}%`, backgroundColor: '#ef4444' }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {lead.budget_range && (
                      <div className="card-detail">💰 {lead.budget_range}</div>
                    )}
                    {lead.location && (
                      <div className="card-detail">📍 {lead.location}</div>
                    )}
                    {lead.next_action && (
                      <div className="card-action">→ {lead.next_action}</div>
                    )}

                    <div className="card-footer">
                      {getTimeSince(lead.updated_at)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
