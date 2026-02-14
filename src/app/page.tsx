import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="landing-page">
      <nav className="top-nav">
        <Link href="/" className="nav-logo">🏠 Premier Realty AI</Link>
        <div className="nav-links">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/call">Voice Agent</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">🏆 PTCG Hackathon 2026</div>
          <h1>AI-Powered<br />Real Estate Agent</h1>
          <p className="hero-subtitle">
            Voice-driven lead qualification with transparent AI reasoning,
            real-time CRM updates, and intelligent appointment booking.
          </p>
          <div className="hero-actions">
            <Link href="/call" className="btn-primary">
              📞 Start Voice Call
            </Link>
            <Link href="/dashboard" className="btn-secondary">
              View Dashboard →
            </Link>
          </div>
        </div>

        <div className="hero-features">
          <div className="feature-card">
            <div className="feature-icon">🧠</div>
            <h3>Transparent Reasoning</h3>
            <p>See exactly how the AI decides — confidence scores, strategy selection, and rejected alternatives on every interaction.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎙️</div>
            <h3>Voice-First Interface</h3>
            <p>Natural conversation via Vapi AI with real-time transcription and live reasoning trace sidebar.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Smart Lead Scoring</h3>
            <p>Weighted readiness score combining intent, urgency, budget, timeline, motivation, and location confidence.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🛡️</div>
            <h3>Graceful Fallbacks</h3>
            <p>Handles LLM timeouts, low confidence, and malicious input with transparent degradation strategies.</p>
          </div>
        </div>
      </section>

      <section className="tech-stack">
        <h2>Built With</h2>
        <div className="tech-grid">
          <div className="tech-item">
            <span className="tech-label">Voice</span>
            <span>Vapi AI + Deepgram + ElevenLabs</span>
          </div>
          <div className="tech-item">
            <span className="tech-label">LLM</span>
            <span>Groq (Llama 3.3 70B)</span>
          </div>
          <div className="tech-item">
            <span className="tech-label">Framework</span>
            <span>Next.js 14 (App Router)</span>
          </div>
          <div className="tech-item">
            <span className="tech-label">Database</span>
            <span>Supabase (PostgreSQL)</span>
          </div>
          <div className="tech-item">
            <span className="tech-label">Deploy</span>
            <span>Vercel</span>
          </div>
        </div>
      </section>
    </div>
  );
}
