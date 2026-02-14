'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ReasoningLog, Lead, Call, Appointment } from '@/lib/supabase';

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
  const [activeTab, setActiveTab] = useState<'reasoning' | 'calls' | 'appointments'>('reasoning');

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

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) return <div className="loading-full">Loading lead details...</div>;
  if (!data) return <div className="loading-full">Lead not found</div>;

  const { lead, reasoning_logs, calls, appointments } = data;

  return (
    <div className="lead-detail-page">
      <nav className="top-nav">
        <Link href="/" className="nav-logo">🏠 Premier Realty AI</Link>
        <div className="nav-links">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/call">Voice Agent</Link>
        </div>
      </nav>

      <div className="lead-detail-layout">
        {/* Left: Lead Profile */}
        <aside className="lead-profile">
          <Link href="/dashboard" className="back-link">← Back to Pipeline</Link>

          <div className="profile-header">
            <div className="avatar">{(lead.name || '?')[0].toUpperCase()}</div>
            <h1>{lead.name || 'Unknown'}</h1>
            <span className="type-badge">{lead.lead_type}</span>
          </div>

          <div className="readiness-display">
            <div className="big-score" style={{ color: getScoreColor(lead.readiness_score) }}>
              {lead.readiness_score}
            </div>
            <span>Readiness Score</span>
          </div>

          <div className="score-breakdown">
            <div className="score-item">
              <span>Intent</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${lead.intent_score * 10}%`, backgroundColor: '#3b82f6' }} />
              </div>
              <span>{lead.intent_score}/10</span>
            </div>
            <div className="score-item">
              <span>Urgency</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${lead.urgency_score * 10}%`, backgroundColor: '#ef4444' }} />
              </div>
              <span>{lead.urgency_score}/10</span>
            </div>
          </div>

          <div className="profile-details">
            {lead.budget_range && <div className="detail-row"><span>💰 Budget</span><span>{lead.budget_range}</span></div>}
            {lead.location && <div className="detail-row"><span>📍 Location</span><span>{lead.location}</span></div>}
            {lead.timeline && <div className="detail-row"><span>📅 Timeline</span><span>{lead.timeline}</span></div>}
            {lead.motivation && <div className="detail-row"><span>💡 Motivation</span><span>{lead.motivation}</span></div>}
            {lead.next_action && <div className="detail-row next-action"><span>→ Next</span><span>{lead.next_action}</span></div>}
          </div>

          <button
            className="summary-btn"
            onClick={generateSummary}
            disabled={generating}
          >
            {generating ? 'Generating...' : '📋 Generate Manager Summary'}
          </button>

          {managerSummary && (
            <div className="manager-summary">
              <h3>Manager Summary</h3>
              <pre>{managerSummary}</pre>
            </div>
          )}
        </aside>

        {/* Right: Tabs */}
        <main className="lead-content">
          <div className="tab-bar">
            <button className={activeTab === 'reasoning' ? 'active' : ''} onClick={() => setActiveTab('reasoning')}>
              🧠 Reasoning Trace ({reasoning_logs.length})
            </button>
            <button className={activeTab === 'calls' ? 'active' : ''} onClick={() => setActiveTab('calls')}>
              📞 Calls ({calls.length})
            </button>
            <button className={activeTab === 'appointments' ? 'active' : ''} onClick={() => setActiveTab('appointments')}>
              📅 Appointments ({appointments.length})
            </button>
          </div>

          {activeTab === 'reasoning' && (
            <div className="reasoning-timeline">
              {reasoning_logs.length === 0 ? (
                <div className="empty-tab">No reasoning logs yet</div>
              ) : (
                reasoning_logs.map((log, i) => (
                  <div key={log.id} className="timeline-card">
                    <div className="timeline-dot" style={{ backgroundColor: getStrategyColor(log.strategy_chosen) }} />
                    <div className="timeline-connector" />

                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="step-number">Step {i + 1}</span>
                        <span className="strategy-badge" style={{ backgroundColor: getStrategyColor(log.strategy_chosen) }}>
                          {log.strategy_chosen.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="confidence">
                          {Math.round(log.confidence * 100)}% confidence
                        </span>
                      </div>

                      <div className="input-section">
                        <strong>User said:</strong>
                        <p className="user-input">"{log.user_input}"</p>
                      </div>

                      <div className="extracted-section">
                        <strong>Extracted Data:</strong>
                        <div className="extracted-grid">
                          {Object.entries(log.extracted_data as Record<string, { value: unknown; confidence: number }>).map(([key, val]) => {
                            if (typeof val !== 'object' || !val || !('confidence' in val)) return null;
                            return (
                              <div key={key} className="extracted-item">
                                <span className="key">{key}</span>
                                <span className="value">{String(val.value || '—')}</span>
                                <span className="conf" style={{ color: val.confidence >= 0.7 ? '#10b981' : val.confidence >= 0.4 ? '#f59e0b' : '#ef4444' }}>
                                  {Math.round(val.confidence * 100)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="reasoning-section">
                        <strong>Reasoning:</strong>
                        <p>{log.reasoning}</p>
                      </div>

                      {log.alternatives_rejected.length > 0 && (
                        <div className="alternatives-section">
                          <strong>Alternatives Rejected:</strong>
                          <ul>
                            {log.alternatives_rejected.map((alt, j) => (
                              <li key={j}>
                                <span className="alt-strategy">{alt.strategy}</span>: {alt.reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="action-section">
                        <strong>Action:</strong> {log.action_taken}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'calls' && (
            <div className="calls-list">
              {calls.length === 0 ? (
                <div className="empty-tab">No calls recorded yet</div>
              ) : (
                calls.map((call) => (
                  <div key={call.id} className="call-card">
                    <div className="call-card-header">
                      <span>{call.direction === 'inbound' ? '📥' : '📤'} {call.direction} call</span>
                      <span>{call.duration_seconds}s</span>
                      <span>{new Date(call.created_at).toLocaleString()}</span>
                    </div>
                    {call.summary && <p className="call-summary">{call.summary}</p>}
                    {call.objections && (call.objections as string[]).length > 0 && (
                      <div className="call-tags">
                        <strong>Objections:</strong>
                        {(call.objections as string[]).map((o, i) => <span key={i} className="tag objection">{o}</span>)}
                      </div>
                    )}
                    {call.risk_flags && (call.risk_flags as string[]).length > 0 && (
                      <div className="call-tags">
                        <strong>Risk Flags:</strong>
                        {(call.risk_flags as string[]).map((f, i) => <span key={i} className="tag risk">{f}</span>)}
                      </div>
                    )}
                    {call.action_items && (call.action_items as string[]).length > 0 && (
                      <div className="call-tags">
                        <strong>Action Items:</strong>
                        {(call.action_items as string[]).map((a, i) => <span key={i} className="tag action">{a}</span>)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="appointments-list">
              {appointments.length === 0 ? (
                <div className="empty-tab">No appointments yet</div>
              ) : (
                appointments.map((apt) => (
                  <div key={apt.id} className="appointment-card">
                    <div className="apt-status" data-status={apt.status}>{apt.status}</div>
                    <div className="apt-details">
                      <span>📅 {apt.date}</span>
                      <span>🕐 {apt.time_slot}</span>
                      {apt.property_address && <span>📍 {apt.property_address}</span>}
                    </div>
                    {apt.notes && <p className="apt-notes">{apt.notes}</p>}
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
