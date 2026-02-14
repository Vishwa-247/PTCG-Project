import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateManagerSummary } from '@/lib/reasoning-engine';

// GET /api/leads/[id] - Get lead details with reasoning logs and calls
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Fetch reasoning logs
    const { data: reasoningLogs } = await supabase
      .from('reasoning_logs')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: true });

    // Fetch calls
    const { data: calls } = await supabase
      .from('calls')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false });

    // Fetch appointments
    const { data: appointments } = await supabase
      .from('appointments')
      .select('*')
      .eq('lead_id', id)
      .order('date', { ascending: true });

    return NextResponse.json({
      lead,
      reasoning_logs: reasoningLogs || [],
      calls: calls || [],
      appointments: appointments || [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// PATCH /api/leads/[id] - Update lead
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { data, error } = await supabase
      .from('leads')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ lead: data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/leads/[id] - Generate manager summary
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    const { data: reasoningLogs } = await supabase
      .from('reasoning_logs')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: true });

    const { data: calls } = await supabase
      .from('calls')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false });

    const summary = await generateManagerSummary(
      lead || {},
      reasoningLogs || [],
      calls || []
    );

    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
