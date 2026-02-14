import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/appointments - List all appointments
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, leads(name, phone, email)')
      .order('date', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ appointments: data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/appointments - Create appointment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lead_id, date, time_slot, property_address, notes } = body;

    if (!lead_id || !date || !time_slot) {
      return NextResponse.json(
        { error: 'lead_id, date, and time_slot are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        lead_id,
        date,
        time_slot,
        property_address: property_address || 'TBD',
        notes: notes || null,
        status: 'proposed',
      })
      .select()
      .single();

    if (error) throw error;

    // Update lead status
    await supabase.from('leads').update({
      status: 'appointment_set',
      next_action: `Showing: ${date} at ${time_slot}`,
    }).eq('id', lead_id);

    return NextResponse.json({ appointment: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// PATCH /api/appointments - Update appointment status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, date, time_slot } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (status) update.status = status;
    if (date) update.date = date;
    if (time_slot) update.time_slot = time_slot;

    const { data, error } = await supabase
      .from('appointments')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ appointment: data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
