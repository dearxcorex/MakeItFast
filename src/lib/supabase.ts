import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types for better TypeScript support
export interface Database {
  public: {
    Tables: {
      fm_station: {
        Row: {
          id: number
          name: string
          frequency: number
          latitude: number
          longitude: number
          city: string
          state: string
          genre: string
          description?: string
          website?: string
          transmitter_power: number
          created_at: string
          updated_at?: string
        }
        Insert: {
          id?: number
          name: string
          frequency: number
          latitude: number
          longitude: number
          city: string
          state: string
          genre: string
          description?: string
          website?: string
          transmitter_power: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          frequency?: number
          latitude?: number
          longitude?: number
          city?: string
          state?: string
          genre?: string
          description?: string
          website?: string
          transmitter_power?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export type FMStationRow = Database['public']['Tables']['fm_station']['Row']