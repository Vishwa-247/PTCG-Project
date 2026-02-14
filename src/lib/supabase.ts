import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase instance (used in React components)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our database tables
export interface Lead {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  lead_type: 'buyer' | 'seller' | 'investor' | 'renter' | string;
  status: string;
  budget: string | null;
  location: string | null;
  urgency: string | null;
  timeline: string | null;
  motivation: string | null;
  intent_score: number;
  urgency_score: number;
  readiness_score: number;
  next_action: string | null;
  last_contact_at?: string;
  manager_summary?: string;
  created_at: string;
  updated_at: string;
}

export interface Call {
  id: string;
  lead_id: string;
  vapi_call_id: string | null;
  direction: 'inbound' | 'outbound';
  duration_seconds: number;
  transcript: string | null;
  summary: string | null;
  objections: string[];
  competitor_mentions: string[];
  risk_flags: string[];
  action_items: string[];
  created_at: string;
}

export interface Appointment {
  id: string;
  lead_id: string;
  date: string;
  time_slot: string;
  property_address: string | null;
  status: 'proposed' | 'confirmed' | 'rescheduled' | 'cancelled';
  notes: string | null;
  created_at: string;
}

export interface ReasoningLog {
  id: string;
  lead_id: string;
  call_id: string | null;
  user_input: string;
  extracted_data: Record<string, unknown>;
  reasoning: string;
  strategy_chosen: string;
  alternatives_rejected: Array<{ strategy: string; reason: string }>;
  confidence: number;
  action_taken: string | null;
  created_at: string;
}
