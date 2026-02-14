// Reasoning Engine Types

export interface ExtractionField {
  value: string | number | null;
  confidence: number; // 0-1
  uncertainty_markers?: string[];
}

export interface ExtractedData {
  intent: ExtractionField;
  budget: ExtractionField;
  urgency: ExtractionField;
  location: ExtractionField;
  timeline: ExtractionField;
  motivation: ExtractionField;
  lead_type: ExtractionField;
  property_type?: ExtractionField;
  financing_discussed?: boolean;
}

export interface AlternativeRejected {
  strategy: string;
  reason: string;
}

export interface ReasoningResult {
  extracted: ExtractedData;
  reasoning: string;
  strategy: 'clarify' | 'qualify' | 'book_now' | 'nurture' | 'handoff' | 'provide_info';
  alternatives_rejected: AlternativeRejected[];
  readiness_score: number; // 0-100
  next_action: string;
  confidence: number; // 0-1
  response_to_user: string;
}

export interface LeadContext {
  lead_id?: string;
  call_id?: string;
  previous_messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  current_lead_data?: Partial<ExtractedData>;
}

// Vapi types
export interface VapiMessage {
  type: string;
  role?: string;
  transcript?: string;
  functionCall?: {
    name: string;
    parameters: Record<string, unknown>;
  };
  call?: {
    id: string;
    status: string;
  };
}
