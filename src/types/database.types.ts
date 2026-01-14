// Database types matching Supabase schema

export type TripStatus = 'draft' | 'in_progress' | 'finalized';
export type TripSource = 'gps' | 'manual' | 'import';
export type DocType = 'receipt' | 'settlement' | 'ratecon' | 'maintenance' | 'other';
export type ParsedStatus = 'pending' | 'parsed' | 'failed';
export type TxnType = 'income' | 'expense';
export type TxnCategory =
  | 'fuel'
  | 'maintenance'
  | 'tolls'
  | 'scales'
  | 'insurance'
  | 'parking'
  | 'food'
  | 'other'
  | 'settlement_deductions';
export type TxnSource = 'document_ai' | 'manual' | 'import' | 'bank_sync';
export type ExportType = 'ifta' | 'tax_pack';
export type ExportStatus = 'queued' | 'ready' | 'failed';
export type JurisdictionMethod = 'gps' | 'manual_adjust' | 'import';

export interface Profile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  home_state: string | null;
  timezone: string | null;
  mc_number: string | null;
  dot_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  user_id: string;
  status: TripStatus;
  started_at: string;
  ended_at: string | null;
  loaded: boolean;
  notes: string | null;
  auto_miles_total: number | null;
  manual_miles_total: number | null;
  source: TripSource;
  created_at: string;
  updated_at: string;
}

export interface TripPoint {
  id: number;
  trip_id: string;
  ts: string;
  lat: number;
  lng: number;
  speed: number | null;
  accuracy_m: number | null;
  jurisdiction: string | null;
}

export interface JurisdictionMiles {
  id: number;
  trip_id: string;
  jurisdiction: string;
  miles: number;
  confidence: number | null;
  method: JurisdictionMethod;
}

export interface Document {
  id: string;
  user_id: string;
  trip_id: string | null;
  type: DocType;
  storage_path: string;
  uploaded_at: string;
  parsed_status: ParsedStatus;
  vendor: string | null;
  document_date: string | null;
  total_amount: number | null;
  currency: string | null;
  raw_text: string | null;
  extraction_json: ExtractionResult | null;
}

export interface Transaction {
  id: string;
  user_id: string;
  trip_id: string | null;
  type: TxnType;
  category: TxnCategory;
  amount: number;
  date: string;
  vendor: string | null;
  source: TxnSource;
  document_id: string | null;
  description: string | null;
  gallons: number | null;
  jurisdiction: string | null;
  created_at: string;
  updated_at: string;
}

export interface Export {
  id: string;
  user_id: string;
  type: ExportType;
  period_start: string;
  period_end: string;
  status: ExportStatus;
  storage_path: string | null;
  error_message: string | null;
  created_at: string;
}

// AI Extraction schemas
export interface ReceiptExtraction {
  vendor: string | null;
  date: string | null;
  total: number | null;
  currency: string | null;
  category_guess: TxnCategory | null;
  fuel_gallons: number | null;
  fuel_price_per_gallon: number | null;
  state_hint: string | null;
  confidence: Record<string, number>;
}

export interface SettlementDeduction {
  description: string;
  amount: number;
}

export interface SettlementExtraction {
  carrier: string | null;
  period_start: string | null;
  period_end: string | null;
  gross_pay: number | null;
  net_pay: number | null;
  deductions: SettlementDeduction[];
  load_refs: string[];
  confidence: Record<string, number>;
}

export type ExtractionResult = ReceiptExtraction | SettlementExtraction;

// Database insert/update types
export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'>;
export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at'>>;

export type TripInsert = Omit<Trip, 'id' | 'created_at' | 'updated_at'>;
export type TripUpdate = Partial<Omit<Trip, 'id' | 'user_id' | 'created_at'>>;

export type TripPointInsert = Omit<TripPoint, 'id'>;
export type TransactionInsert = Omit<Transaction, 'id' | 'created_at' | 'updated_at'>;
export type TransactionUpdate = Partial<Omit<Transaction, 'id' | 'user_id' | 'created_at'>>;

export type DocumentInsert = Omit<Document, 'id' | 'uploaded_at'>;
export type DocumentUpdate = Partial<Omit<Document, 'id' | 'user_id' | 'uploaded_at'>>;
