import { NextRequest, NextResponse } from 'next/server';
import { analyzeInput, generateCallSummary } from '@/lib/reasoning-engine';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ received: true });
    }

    switch (message.type) {
      case 'function-call': {
        return await handleFunctionCall(message);
      }

      case 'status-update': {
        console.log(`Vapi call ${message.call?.id}: ${message.status}`);
        return NextResponse.json({ received: true });
      }

      case 'end-of-call-report': {
        return await handleEndOfCall(message);
      }

      case 'transcript': {
        console.log(`[${message.role}]: ${message.transcript}`);
        return NextResponse.json({ received: true });
      }

      default:
        return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error('Vapi webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleFunctionCall(message: Record<string, unknown>) {
  const functionCall = message.functionCall as { name: string; parameters: Record<string, unknown> } | undefined;
  if (!functionCall) {
    return NextResponse.json({ error: 'No function call data' }, { status: 400 });
  }

  const { name, parameters } = functionCall;

  switch (name) {
    case 'process_lead_input': {
      const { user_input, lead_id, call_id, conversation_history } = parameters as {
        user_input: string;
        lead_id?: string;
        call_id?: string;
        conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      };

      const result = await analyzeInput(user_input, {
        lead_id,
        call_id,
        previous_messages: conversation_history || [],
      });

      // Store reasoning log
      await supabase.from('reasoning_logs').insert({
        lead_id: lead_id || null,
        call_id: call_id || null,
        user_input,
        extracted_data: result.extracted,
        reasoning: result.reasoning,
        strategy_chosen: result.strategy,
        alternatives_rejected: result.alternatives_rejected,
        confidence: result.confidence,
        action_taken: result.next_action,
      });

      // Update lead if exists
      if (lead_id && result.extracted.intent.confidence > 0.3) {
        await supabase.from('leads').update({
          intent_score: Math.round(result.extracted.intent.confidence * 10),
          urgency_score: Math.round(result.extracted.urgency.confidence * 10),
          readiness_score: result.readiness_score,
          next_action: result.next_action,
          budget_range: result.extracted.budget.value?.toString() || undefined,
          location: result.extracted.location.value?.toString() || undefined,
          timeline: result.extracted.timeline.value?.toString() || undefined,
          motivation: result.extracted.motivation.value?.toString() || undefined,
        }).eq('id', lead_id);
      }

      return NextResponse.json({
        result: {
          strategy: result.strategy,
          response: result.response_to_user,
          readiness_score: result.readiness_score,
          next_action: result.next_action,
        }
      });
    }

    case 'book_appointment': {
      const { lead_id, date, time_slot, property_address } = parameters as {
        lead_id: string;
        date: string;
        time_slot: string;
        property_address?: string;
      };

      const { data: appointment } = await supabase
        .from('appointments')
        .insert({
          lead_id,
          date,
          time_slot,
          property_address: property_address || 'TBD',
          status: 'proposed',
        })
        .select()
        .single();

      if (lead_id) {
        await supabase.from('leads').update({
          status: 'appointment_set',
          next_action: `Appointment: ${date} at ${time_slot}`,
        }).eq('id', lead_id);
      }

      return NextResponse.json({
        result: {
          success: true,
          appointment_id: appointment?.id,
          message: `Appointment proposed for ${date} at ${time_slot}`,
        }
      });
    }

    case 'get_available_slots': {
      // Return mock slots for demo
      const { date } = parameters as { date: string };
      const slots = [
        '9:00 AM', '10:00 AM', '11:00 AM',
        '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'
      ];
      return NextResponse.json({ result: { date, available_slots: slots } });
    }

    default:
      return NextResponse.json({ error: `Unknown function: ${name}` }, { status: 400 });
  }
}

async function handleEndOfCall(message: Record<string, unknown>) {
  const call = message.call as Record<string, unknown> | undefined;
  if (!call) return NextResponse.json({ received: true });

  const vapiCallId = call.id as string;
  const transcript = (message.transcript as string) || '';
  const durationSeconds = (message.durationSeconds as number) || 0;

  // Find existing call record or create one
  const { data: existingCall } = await supabase
    .from('calls')
    .select('*')
    .eq('vapi_call_id', vapiCallId)
    .single();

  // Generate call summary using Groq
  const insights = await generateCallSummary(transcript, {});

  if (existingCall) {
    await supabase.from('calls').update({
      transcript,
      duration_seconds: durationSeconds,
      summary: insights.summary,
      objections: insights.objections,
      competitor_mentions: insights.competitor_mentions,
      risk_flags: insights.risk_flags,
      action_items: insights.action_items,
    }).eq('id', existingCall.id);
  } else {
    await supabase.from('calls').insert({
      vapi_call_id: vapiCallId,
      transcript,
      duration_seconds: durationSeconds,
      summary: insights.summary,
      objections: insights.objections,
      competitor_mentions: insights.competitor_mentions,
      risk_flags: insights.risk_flags,
      action_items: insights.action_items,
    });
  }

  return NextResponse.json({ received: true });
}
