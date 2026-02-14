import { NextRequest, NextResponse } from 'next/server';
import { analyzeInput } from '@/lib/reasoning-engine';
import { supabase } from '@/lib/supabase';
import { LeadContext } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_input, lead_id, call_id, conversation_history } = body;

    if (!user_input) {
      return NextResponse.json(
        { error: 'user_input is required' },
        { status: 400 }
      );
    }

    // Build context
    const context: LeadContext = {
      lead_id: lead_id || undefined,
      call_id: call_id || undefined,
      previous_messages: conversation_history || [],
      current_lead_data: undefined,
    };

    // Fetch existing lead data if we have a lead_id
    if (lead_id) {
      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', lead_id)
        .single();
      
      if (lead) {
        context.current_lead_data = {
          intent: { value: lead.lead_type, confidence: lead.intent_score / 10, uncertainty_markers: [] },
          budget: { value: lead.budget_range, confidence: 0.5, uncertainty_markers: [] },
          urgency: { value: 'medium', confidence: lead.urgency_score / 10, uncertainty_markers: [] },
          location: { value: lead.location, confidence: 0.5, uncertainty_markers: [] },
          timeline: { value: lead.timeline, confidence: 0.5, uncertainty_markers: [] },
          motivation: { value: lead.motivation, confidence: 0.5, uncertainty_markers: [] },
          lead_type: { value: lead.lead_type, confidence: 0.8, uncertainty_markers: [] },
        };
      }
    }

    // Run reasoning engine
    const result = await analyzeInput(user_input, context);

    // Store reasoning log
    const { data: logEntry, error: logError } = await supabase
      .from('reasoning_logs')
      .insert({
        lead_id: lead_id || null,
        call_id: call_id || null,
        user_input,
        extracted_data: result.extracted,
        reasoning: result.reasoning,
        strategy_chosen: result.strategy,
        alternatives_rejected: result.alternatives_rejected,
        confidence: result.confidence,
        action_taken: result.next_action,
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to store reasoning log:', logError);
    }

    // Update or create lead based on extracted data
    let updatedLeadId = lead_id;
    if (result.extracted.intent.confidence > 0.3) {
      const leadUpdate: Record<string, unknown> = {
        lead_type: typeof result.extracted.lead_type.value === 'string' ? result.extracted.lead_type.value : 'buyer',
        intent_score: Math.round(result.extracted.intent.confidence * 10),
        urgency_score: Math.round(result.extracted.urgency.confidence * 10),
        readiness_score: result.readiness_score,
        next_action: result.next_action,
        status: getStatusFromStrategy(result.strategy),
      };

      if (result.extracted.budget.value) leadUpdate.budget_range = result.extracted.budget.value;
      if (result.extracted.location.value) leadUpdate.location = result.extracted.location.value;
      if (result.extracted.timeline.value) leadUpdate.timeline = result.extracted.timeline.value;
      if (result.extracted.motivation.value) leadUpdate.motivation = result.extracted.motivation.value;

      if (lead_id) {
        await supabase.from('leads').update(leadUpdate).eq('id', lead_id);
      } else {
        const { data: newLead } = await supabase
          .from('leads')
          .insert({ ...leadUpdate, name: 'New Lead' })
          .select()
          .single();
        if (newLead) updatedLeadId = newLead.id;
      }
    }

    return NextResponse.json({
      success: true,
      result,
      lead_id: updatedLeadId,
      reasoning_log_id: logEntry?.id,
    });
  } catch (error) {
    console.error('Reasoning API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

function getStatusFromStrategy(strategy: string): string {
  switch (strategy) {
    case 'book_now': return 'appointment_set';
    case 'qualify': return 'qualified';
    case 'nurture':
    case 'provide_info':
    case 'clarify': return 'contacted';
    case 'handoff': return 'qualified';
    default: return 'new';
  }
}
