# 🏠 Premier Realty AI — Intelligent Real Estate Voice Agent

> AI-powered voice agent for real estate lead qualification with **transparent reasoning**, real-time CRM, and intelligent appointment booking.
> 
> **Built for PTCG Hackathon 2026**

---

## 🎯 Problem Statement

Real estate agents waste 60%+ of their time on unqualified leads. Manual lead qualification is slow, inconsistent, and subjective. There's no transparency into WHY a lead was scored or routed a certain way.

**Premier Realty AI** solves this with an AI voice agent that:
- Conducts natural phone conversations with leads
- Extracts qualification data with **per-field confidence scores**
- Makes transparent, explainable decisions about lead routing
- Updates a real-time CRM dashboard automatically
- Handles failures gracefully with documented fallback strategies

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "Frontend (Next.js 14)"
        A[Landing Page] --> B[Voice Call Page]
        A --> C[CRM Dashboard]
        B <--> D[Vapi Web SDK]
        B <--> E[Reasoning Trace Panel]
        C --> F[Lead Pipeline View]
        C --> G[Lead Detail + Timeline]
    end

    subgraph "API Layer (Next.js API Routes)"
        H[/api/reason]
        I[/api/vapi/webhook]
        J[/api/leads]
        K[/api/appointments]
    end

    subgraph "AI Engine"
        L[Groq Llama 3.3 70B]
        M[Reasoning Pipeline]
        N[Call Summary Generator]
        O[Manager Summary Generator]
    end

    subgraph "Data Layer"
        P[(Supabase PostgreSQL)]
        Q[leads table]
        R[calls table]
        S[appointments table]
        T[reasoning_logs table]
    end

    D -->|STT/TTS| B
    B -->|User Input| H
    H --> M
    M --> L
    L --> M
    M -->|Store Decision| T
    M -->|Update Lead| Q
    I -->|End of Call| N
    N --> R
    G -->|Request| O
    P --> Q
    P --> R
    P --> S
    P --> T
```

---

## 🧠 AI Reasoning Engine (25 Points)

### Transparent Decision Making

Every user message triggers a structured reasoning pipeline:

1. **Extraction** — Pulls intent, budget, urgency, timeline, location, motivation with per-field confidence scores
2. **Uncertainty Detection** — Identifies hedging language ("around", "maybe", "not sure") and reduces confidence accordingly
3. **Strategy Classification** — Selects from 6 strategies: `clarify`, `qualify`, `book_now`, `nurture`, `handoff`, `provide_info`
4. **Alternative Rejection** — Documents WHY other strategies were rejected
5. **Readiness Scoring** — Weighted formula: intent(25%) + urgency(20%) + budget(20%) + timeline(15%) + motivation(10%) + location(10%)

### Example Reasoning Trace

```json
{
  "extracted": {
    "intent": { "value": "buy", "confidence": 0.92 },
    "budget": { "value": "$400K-$600K", "confidence": 0.68, "uncertainty_markers": ["around"] },
    "urgency": { "value": "high", "confidence": 0.85 },
    "timeline": { "value": "2-3 months", "confidence": 0.72 }
  },
  "reasoning": "Budget confidence 68% due to 'around' qualifier — need to confirm min/max range before scheduling showings. Intent and urgency are strong.",
  "strategy": "clarify",
  "alternatives_rejected": [
    { "strategy": "book_now", "reason": "Budget unclear at 68% — might show wrong price range" },
    { "strategy": "nurture", "reason": "Intent too strong (92%) to just nurture" }
  ],
  "readiness_score": 72,
  "confidence": 0.78
}
```

### Failure Handling (3 Cases)

| Failure | Detection | Response |
|---|---|---|
| **LLM Timeout** | ECONNREFUSED / timeout error | "I'm experiencing delays. Let me send you options via email." → Logs to reasoning_logs with `FALLBACK MODE` |
| **Low Confidence** | Confidence < 0.7 on critical fields | Asks clarifying question instead of acting on uncertain data |
| **JSON Parse Error** | SyntaxError from LLM response | Falls back to clarification mode, logs the parse failure |

---

## 🎙️ Voice Interface

- **Platform**: Vapi AI (Web SDK)
- **STT**: Deepgram Nova-2
- **TTS**: ElevenLabs
- **LLM**: Groq Llama 3.3 70B (via Vapi's model integration)

The agent persona is "Sarah from Premier Realty" — warm, professional, knowledgeable about the Austin, TX market.

### Features
- Real-time transcript display
- Live reasoning trace sidebar (see AI decisions as they happen)
- Call duration timer
- Automatic lead creation on call start
- CRM link on call end

---

## 📊 CRM Dashboard

- **Kanban Pipeline**: New → Contacted → Qualified → Appointment Set → Closed
- **Real-time Updates**: Supabase realtime subscriptions
- **Lead Cards**: Readiness score circles, intent/urgency bars, budget/location
- **Lead Detail Page**:
  - Full reasoning timeline with per-step strategy badges
  - Extracted data grid with confidence percentages
  - Call insights (summary, objections, risk flags, action items)
  - Manager summary generation (Groq-powered)
  - Appointment management

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router, TypeScript) | Modern React with API routes |
| Voice | Vapi AI (Web SDK) | Free tier, handles STT/TTS |
| LLM | Groq (Llama 3.3 70B) | Free, fast, structured output |
| Database | Supabase (PostgreSQL) | Free tier, realtime, RLS |
| Deployment | Vercel | Free tier, zero-config Next.js |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Vapi AI account (dashboard.vapi.ai)
- Groq API key (console.groq.com)
- Supabase project

### Installation

```bash
git clone https://github.com/Vishwa-247/PTCG-Project.git
cd ptcg-real-estate
npm install
```

### Environment Variables

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your_vapi_public_key
VAPI_PRIVATE_KEY=your_vapi_private_key
GROQ_API_KEY=your_groq_api_key
```

### Database Setup

Run the migration in your Supabase SQL editor (creates `leads`, `calls`, `appointments`, `reasoning_logs` tables with RLS and realtime).

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🧪 Test Cases

### Test Case 1: Happy Path — Qualified Buyer
**Input**: "Hi, I'm looking to buy a 3-bedroom house in Mueller, Austin. Budget is around $500K. Need to move within 2 months."
**Expected**: High readiness (70+), strategy `qualify` or `book_now`, budget extracted with uncertainty marker "around"

### Test Case 2: Vague Browser
**Input**: "Just looking around, not sure what I want yet"
**Expected**: Low readiness (<30), strategy `nurture`, all confidence scores low, no booking attempt

### Test Case 3: Budget Uncertainty
**Input**: "Maybe somewhere between 300 and 500 thousand, not really sure"
**Expected**: Budget confidence < 0.7, strategy `clarify`, clarifying question about budget range

### Test Case 4: Handoff Request
**Input**: "I need to talk to someone about the contract terms and closing costs"
**Expected**: Strategy `handoff`, reasoning mentions legal/financial complexity

### Test Case 5: LLM Failure
**Trigger**: Disconnect internet or set invalid GROQ_API_KEY
**Expected**: Fallback response, reasoning_logs entry with `FALLBACK MODE`, system doesn't crash

---

## 📏 Evaluation Metrics

| Metric | Measurement | Target |
|---|---|---|
| Reasoning Transparency | % of decisions with documented reasoning | 100% |
| Confidence Accuracy | Fields with uncertainty markers get confidence < 0.8 | > 90% |
| Strategy Correctness | Correct strategy for test scenarios | > 80% |
| Failure Recovery | System recovers gracefully from 3 failure types | 3/3 |
| CRM Update Accuracy | Lead data matches extracted fields after call | > 95% |
| Response Latency | Time from user input to AI response | < 3s |

---

## 🛡️ Responsible AI

### Transparency
- Every AI decision is logged with full reasoning traces
- Users can see WHY the AI made each decision
- Confidence scores prevent overconfident actions on uncertain data

### Bias Mitigation
- No demographic data collected or used in scoring
- Readiness score based purely on expressed intent, budget, timeline
- All qualification criteria are explicit and documented

### Privacy
- No voice recordings stored (Vapi handles this)
- Transcripts stored in secure Supabase with RLS
- No data shared with third parties beyond LLM providers

### Human Oversight
- `handoff` strategy ensures complex cases go to human agents
- Manager summary feature keeps humans in the loop
- All AI decisions are reviewable through the CRM

### Limitations
- See Limitations section below

---

## ⚠️ Limitations

1. **No real property data** — Agent can discuss market trends but doesn't have actual MLS listings
2. **English only** — STT and LLM are English-focused
3. **Demo-scale database** — No production-grade auth; uses open RLS policies
4. **Single-threaded reasoning** — Each message processed independently; no long-term memory across calls
5. **Voice quality depends on network** — Browser microphone + internet quality affects STT accuracy
6. **Confidence calibration** — Groq's confidence scores are LLM-estimated, not statistically calibrated
7. **No payment processing** — Cannot handle deposits or financial transactions
8. **Austin market only** — Agent's domain knowledge is limited to Austin, TX

---

## 📁 Project Structure

```
ptcg-real-estate/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── reason/route.ts       # AI reasoning endpoint
│   │   │   ├── vapi/webhook/route.ts  # Vapi webhook handler
│   │   │   ├── leads/route.ts         # Lead CRUD
│   │   │   ├── leads/[id]/route.ts    # Lead detail + manager summary
│   │   │   └── appointments/route.ts  # Appointment management
│   │   ├── call/page.tsx              # Voice agent + reasoning sidebar
│   │   ├── dashboard/
│   │   │   ├── page.tsx               # Kanban lead pipeline
│   │   │   └── leads/[id]/page.tsx    # Lead detail + reasoning timeline
│   │   ├── page.tsx                   # Landing page
│   │   ├── layout.tsx                 # Root layout
│   │   └── globals.css                # Design system
│   └── lib/
│       ├── reasoning-engine.ts        # Core AI pipeline
│       ├── supabase.ts                # DB client + types
│       └── types.ts                   # TypeScript interfaces
├── .env.local                         # API keys (not in repo)
└── package.json
```

---

## 👤 Author

**Vishwa Teja Thouti** — PTCG Hackathon 2026

---

## 📄 License

MIT
