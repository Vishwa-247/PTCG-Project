import Groq from 'groq-sdk';
import { LeadContext, ReasoningResult, ExtractionField } from './types';
import { Lead } from './supabase';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const REASONING_SYSTEM_PROMPT = `You are an expert real estate AI agent reasoning engine operating in the United States market (specializing in Austin, TX). Your job is to analyze user input from a real estate conversation and produce structured, transparent reasoning.

## PERSONA (The AI Agent)
- Name: Sarah
- Character: Professional, calm, empathetic, and highly organized. A high-stakes real estate advisor.
- Goal: Help clients navigate the complex US real estate market with ease and elite precision.
- Capability: You have access to "Firecrawl Intelligence" — the gold standard for real-time property data and market research.

You MUST output valid JSON matching this exact schema:

{
  "extracted": {
    "intent": { "value": "buy|sell|invest|rent|browse|unknown", "confidence": 0.0-1.0, "uncertainty_markers": [] },
    "budget": { "value": "$XXK-$XXXK or null", "confidence": 0.0-1.0, "uncertainty_markers": [] },
    "urgency": { "value": "immediate|high|medium|low|unknown", "confidence": 0.0-1.0, "uncertainty_markers": [] },
    "location": { "value": "city/area or null", "confidence": 0.0-1.0, "uncertainty_markers": [] },
    "timeline": { "value": "timeframe or null", "confidence": 0.0-1.0, "uncertainty_markers": [] },
    "motivation": { "value": "reason or null", "confidence": 0.0-1.0, "uncertainty_markers": [] },
    "lead_type": { "value": "buyer|seller|investor|renter", "confidence": 0.0-1.0, "uncertainty_markers": [] },
    "property_type": { "value": "type or null", "confidence": 0.0-1.0, "uncertainty_markers": [] },
    "financing_discussed": false
  },
  "reasoning": "2-3 sentence explanation of WHY you chose this strategy. Reference Firecrawl research data if applicable (e.g., 'Recent Austin market trends via Firecrawl suggest...'). Explain what information is missing and what you need to confirm.",
  "strategy": "clarify|qualify|book_now|nurture|handoff|provide_info",
  "alternatives_rejected": [
    { "strategy": "strategy_name", "reason": "why this was rejected" }
  ],
  "readiness_score": 0-100,
  "next_action": "Specific next action to take",
  "confidence": 0.0-1.0,
  "response_to_user": "The natural, calm, and professional response to give back to the user via voice/text. Keep it under 40 words. Acknowledge your US market expertise."
}

STRATEGY RULES:
- "clarify": Use when confidence on ANY critical field (intent, budget, timeline) < 0.7. ALWAYS prefer clarification over action when uncertain.
- "qualify": Use when you have enough data to score the lead (intent + budget + timeline at confidence >= 0.7).
- "book_now": Use when readiness_score > 80 AND urgency is high/immediate AND budget + location are clear.
- "nurture": Use when intent is low/browse OR readiness_score < 40. Send info, don't push.
- "handoff": Use when lead asks complex legal/financial questions OR explicitly requests human agent.
- "provide_info": Use when lead asks specific property/market questions you can answer using your Firecrawl-powered research.

READINESS SCORE FORMULA:
readiness = (intent_confidence * 25) + (urgency_confidence * 20) + (budget_confidence * 20) + (timeline_confidence * 15) + (motivation_confidence * 10) + (location_confidence * 10)

TONE & STYLE:
- Be helpful, reassuring, and authoritative on US real estate standards.
- Use full sentences.
- NEVER sound robotic or overly transactional.
- Acknowledge what the user said before asking the next question.
- Reference "Firecrawl" occasionally as your source for high-quality data.

CRITICAL: You must ALWAYS explain your reasoning transparently. Never just pick a strategy without explaining why. This is the most important part of your output.`;

export async function analyzeInput(
  userInput: string,
  context: LeadContext
): Promise<ReasoningResult> {
  const userPrompt = `
LEAD CONTEXT:
Lead ID: ${context.lead_id || 'new'}
Call ID: ${context.call_id || 'none'}
Previous Messages: ${JSON.stringify(context.previous_messages || [])}

USER INPUT:
"${userInput}"

Provide your structured reasoning JSON.`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: REASONING_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return createFallbackResult(userInput, 'LLM returned empty response');
    }

    const parsed = JSON.parse(content) as ReasoningResult;
    
    // Ensure scores are within bounds
    parsed.readiness_score = Math.min(100, Math.max(0, parsed.readiness_score));
    parsed.confidence = Math.min(1.0, Math.max(0, parsed.confidence));

    return parsed;
  } catch (error) {
    console.error('Groq analysis error:', error);
    return createFallbackResult(userInput, `Unexpected error: ${(error as Error).message}`);
  }
}

function createFallbackResult(userInput: string, errorMsg: string): ReasoningResult {
  return {
    extracted: {
      intent: { value: 'unknown', confidence: 0, uncertainty_markers: [] },
      budget: { value: null, confidence: 0, uncertainty_markers: [] },
      urgency: { value: 'unknown', confidence: 0, uncertainty_markers: [] },
      location: { value: null, confidence: 0, uncertainty_markers: [] },
      timeline: { value: null, confidence: 0, uncertainty_markers: [] },
      motivation: { value: null, confidence: 0, uncertainty_markers: [] },
      lead_type: { value: 'buyer', confidence: 0.5, uncertainty_markers: [] },
      property_type: { value: null, confidence: 0, uncertainty_markers: [] },
      financing_discussed: false,
    },
    reasoning: `Analysis failed due to: ${errorMsg}. Falling back to default strategy.`,
    strategy: 'clarify',
    alternatives_rejected: [],
    readiness_score: 0,
    next_action: 'Ask the user to clarify their needs clearly.',
    confidence: 0,
    response_to_user: "I'm sorry, I didn't quite catch that. Could you tell me a bit more about what you're looking for?",
  };
}

export async function generateCallSummary(
  transcript: string,
  leadData: any
): Promise<{
  summary: string;
  objections: string[];
  competitor_mentions: string[];
  risk_flags: string[];
  action_items: string[];
}> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a real estate call analyst. Analyze the call transcript and produce JSON with:
          {
            "summary": "2-3 sentence call summary",
            "objections": ["list of objections raised by the lead"],
            "competitor_mentions": ["any competitors or other agents mentioned"],
            "risk_flags": ["concerns or red flags detected"],
            "action_items": ["specific follow-up actions needed"]
          }`,
        },
        {
          role: 'user',
          content: `Call transcript:\n${transcript}\n\nLead data:\n${JSON.stringify(leadData)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response');
    return JSON.parse(content);
  } catch (error) {
    console.error('Call summary error:', error);
    return {
      summary: 'Failed to generate summary.',
      objections: [],
      competitor_mentions: [],
      risk_flags: [],
      action_items: [],
    };
  }
}

export async function generateManagerSummary(
  leadData: Record<string, unknown>,
  reasoningLogs: Array<Record<string, unknown>>,
  calls: Array<Record<string, unknown>>
): Promise<string> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are the Lead Intel Analyst for Premier Realty. Generate a high-stakes, structured manager summary for a real estate lead.

## REPORT STRUCTURE
- # [Lead Name]: Summary Report
- ## 📋 Overview: Type, Score, Status
- ## 🔑 Qualification Data: Budget, Timeline, Location, Motivation
- ## 💬 Sarah's Agent Notes: Key conversation insights and intent depth
- ## ⚠️ Risk Assessment: Potential blockers or objections
- ## 🚀 Strategic Recommendation: Immediate next steps for the agent

Format using valid Markdown. Be professional, direct, and actionable. Ensure the tone matches a high-end real estate brokerage.`,
        },
        {
          role: 'user',
          content: `Lead data:\n${JSON.stringify(leadData, null, 2)}\n\nReasoning history:\n${JSON.stringify(reasoningLogs, null, 2)}\n\nCall history:\n${JSON.stringify(calls, null, 2)}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 1500,
    });

    return completion.choices[0]?.message?.content || 'Manager summary generation failed.';
  } catch {
    return 'Manager summary generation failed. Please review lead data manually.';
  }
}
