export interface Lead {
  id: number
  phone: string
  name: string
  address?: string
  business_name?: string
  source: 'google_maps' | 'kommo' | 'google_ads' | 'mercadolibre'
  status: 'new' | 'contacted' | 'responded' | 'converted'
  kommo_lead_id?: string
  created_at: string
}

export interface Listing {
  id: number
  ml_id: string
  title: string
  description?: string
  original_title: string
  original_description?: string
  ai_suggested_title?: string
  ai_suggested_description?: string
  ai_improvements?: string
  status: 'pending' | 'approved' | 'rejected' | 'synced'
  price: number
  available_quantity?: number
  thumbnail?: string
  permalink?: string
  created_at: string
}

export interface DashboardStats {
  total_leads: number
  contacted_leads: number
  converted_leads: number
  total_listings: number
  pending_optimizations: number
  messages_today: number
}

export interface Message {
  id: number
  phone: string
  direction: 'in' | 'out'
  content: string
  template_name?: string
  status: string
  created_at: string
}
