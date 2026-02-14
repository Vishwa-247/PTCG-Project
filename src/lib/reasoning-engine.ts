import Groq from 'groq-sdk';
import { ReasoningResult, LeadContext, ExtractedData } from './types';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const REASONING_SYSTEM_PROMPT = `You are an expert real estate AI agent reasoning engine. Your job is to analyze user input from a real estate conversation and produce structured, transparent reasoning.

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
  "reasoning": "2-3 sentence explanation of WHY you chose this strategy. Reference specific confidence scores and uncertainty markers. Explain what information is missing and what you need to confirm.",
  "strategy": "clarify|qualify|book_now|nurture|handoff|provide_info",
  "alternatives_rejected": [
    { "strategy": "strategy_name", "reason": "why this was rejected" }
  ],
  "readiness_score": 0-100,
  "next_action": "Specific next action to take",
  "confidence": 0.0-1.0,
  "response_to_user": "The natural response to give back to the user via voice"
}

STRATEGY RULES:
- "clarify": Use when confidence on ANY critical field (intent, budget, timeline) < 0.7. ALWAYS prefer clarification over action when uncertain.
- "qualify": Use when you have enough data to score the lead (intent + budget + timeline at confidence >= 0.7).
- "book_now": Use when readiness_score > 80 AND urgency is high/immediate AND budget + location are clear.
- "nurture": Use when intent is low/browse OR readiness_score < 40. Send info, don't push.
- "handoff": Use when lead asks complex legal/financial questions OR explicitly requests human agent.
- "provide_info": Use when lead asks specific property/market questions you can answer.

READINESS SCORE FORMULA:
readiness = (intent_confidence * 25) + (urgency_confidence * 20) + (budget_confidence * 20) + (timeline_confidence * 15) + (motivation_confidence * 10) + (location_confidence * 10)

UNCERTAINTY MARKERS to detect: "maybe", "around", "roughly", "not sure", "possibly", "about", "somewhere", "I think", "kind of", "sort of", hedging language, vague quantifiers.

CRITICAL: You must ALWAYS explain your reasoning transparently. Never just pick a strategy without explaining why. This is the most important part of your output.`;

export async function analyzeInput(
  userInput: string,
  context: LeadContext
): Promise<ReasoningResult> {
  const conversationHistory = context.previous_messages
    .map((m) => `${m.role === 'user' ? 'Lead' : 'Agent'}: ${m.content}`)
    .join('\n');

  const existingData = context.current_lead_data
    ? `\nExisting lead data from previous turns:\n${JSON.stringify(context.current_lead_data, null, 2)}`
    : '';

  const userPrompt = `Analyze this user input from a real estate conversation:

CONVERSATION HISTORY:
${conversationHistory || '(First message in conversation)'}
${existingData}

LATEST USER INPUT: "${userInput}"

Produce the structured reasoning JSON. Be thorough in your reasoning explanation.`;

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
    
    // Validate and clamp scores
    parsed.readiness_score = Math.max(0, Math.min(100, Math.round(parsed.readiness_score)));
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));
    
    return parsed;
  } catch (error) {
    console.error('Reasoning engine error:', error);
    
    if (error instanceof SyntaxError) {
      return createFallbackResult(userInput, 'Failed to parse LLM response as JSON');
    }
    
    if ((error as Error).message?.includes('timeout') || (error as Error).message?.includes('ECONNREFUSED')) {
      return createFallbackResult(userInput, 'LLM service timeout - degrading to async mode');
    }
    
    return createFallbackResult(userInput, `Unexpected error: ${(error as Error).message}`);
  }
}

function createFallbackResult(userInput: string, errorReason: string): ReasoningResult {
  return {
    extracted: {
      intent: { value: 'unknown', confidence: 0, uncertainty_markers: [] },
      budget: { value: null, confidence: 0, uncertainty_markers: [] },
      urgency: { value: 'unknown', confidence: 0, uncertainty_markers: [] },
      location: { value: null, confidence: 0, uncertainty_markers: [] },
      timeline: { value: null, confidence: 0, uncertainty_markers: [] },
      motivation: { value: null, confidence: 0, uncertainty_markers: [] },
      lead_type: { value: 'buyer', confidence: 0, uncertainty_markers: [] },
      property_type: { value: null, confidence: 0, uncertainty_markers: [] },
      financing_discussed: false,
    },
    reasoning: `FALLBACK MODE: ${errorReason}. Unable to process input normally. Gracefully degrading to clarification mode to avoid incorrect actions.`,
    strategy: 'clarify',
    alternatives_rejected: [
      { strategy: 'qualify', reason: 'Cannot qualify without successful analysis' },
      { strategy: 'book_now', reason: 'Cannot book without confirmed data' },
    ],
    readiness_score: 0,
    next_action: 'Ask user to repeat or clarify their request',
    confidence: 0,
    response_to_user: "I'm sorry, I didn't quite catch that. Could you tell me more about what you're looking for in real estate? Are you looking to buy, sell, or invest?",
  };
}

export function calculateReadinessScore(extracted: ExtractedData): number {
  const weights = {
    intent: 0.25,
    urgency: 0.20,
    budget: 0.20,
    timeline: 0.15,
    motivation: 0.10,
    location: 0.10,
  };

  const score =
    (extracted.intent.confidence * weights.intent +
      extracted.urgency.confidence * weights.urgency +
      extracted.budget.confidence * weights.budget +
      extracted.timeline.confidence * weights.timeline +
      extracted.motivation.confidence * weights.motivation +
      extracted.location.confidence * weights.location) *
    100;

  return Math.round(Math.max(0, Math.min(100, score)));
}

export async function generateCallSummary(
  transcript: string,
  leadData: Record<string, unknown>
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
  } catch {
    return {
      summary: 'Call summary generation failed. Review transcript manually.',
      objections: [],
      competitor_mentions: [],
      risk_flags: ['Summary generation error'],
      action_items: ['Review call transcript manually'],
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
          content: `You are a real estate sales manager's AI assistant. Generate a concise, actionable summary report for the manager about a lead. Include:
1. Lead overview (name, type, readiness score)
2. Key qualification data (budget, timeline, location, motivation)  
3. Conversation highlights and decisions made
4. Risk assessment
5. Recommended next steps
Format as a clean, readable report. Be direct and actionable.`,
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
