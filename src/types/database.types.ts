export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      persons: {
        Row: {
          id: string
          employee_id: string | null
          name: string
          department: string | null
          card_number: string | null
          face_photo_url: string | null
          device_employee_no: number | null
          status: 'active' | 'inactive' | 'pending_sync'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id?: string | null
          name: string
          department?: string | null
          card_number?: string | null
          face_photo_url?: string | null
          device_employee_no?: number | null
          status?: 'active' | 'inactive' | 'pending_sync'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          employee_id?: string | null
          name?: string
          department?: string | null
          card_number?: string | null
          face_photo_url?: string | null
          device_employee_no?: number | null
          status?: 'active' | 'inactive' | 'pending_sync'
          created_at?: string
          updated_at?: string
        }
      }
      access_events: {
        Row: {
          id: string
          device_serial: string | null
          person_id: string | null
          employee_id: string | null
          event_time: string
          major: number | null
          minor: number | null
          event_type: string
          verify_mode: string | null
          raw_payload: Json | null
          synced_at: string
        }
        Insert: {
          id?: string
          device_serial?: string | null
          person_id?: string | null
          employee_id?: string | null
          event_time: string
          major?: number | null
          minor?: number | null
          event_type: string
          verify_mode?: string | null
          raw_payload?: Json | null
          synced_at?: string
        }
        Update: {
          id?: string
          device_serial?: string | null
          person_id?: string | null
          employee_id?: string | null
          event_time?: string
          major?: number | null
          minor?: number | null
          event_type?: string
          verify_mode?: string | null
          raw_payload?: Json | null
          synced_at?: string
        }
      }
      devices: {
        Row: {
          id: string
          name: string
          serial_number: string
          model: string | null
          ip_address: string | null
          firmware_version: string | null
          status: 'online' | 'offline' | 'unknown'
          last_seen_at: string | null
          location: string | null
          device_username: string | null
          device_password_encrypted: string | null
          sync_status: 'disconnected' | 'connecting' | 'syncing' | 'synced' | 'error'
          sync_error: string | null
          sync_last_at: string | null
          sync_events_count: number
          last_event_synced_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          serial_number: string
          model?: string | null
          ip_address?: string | null
          firmware_version?: string | null
          status?: 'online' | 'offline' | 'unknown'
          last_seen_at?: string | null
          location?: string | null
          device_username?: string | null
          device_password_encrypted?: string | null
          sync_status?: 'disconnected' | 'connecting' | 'syncing' | 'synced' | 'error'
          sync_error?: string | null
          sync_last_at?: string | null
          sync_events_count?: number
          last_event_synced_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          serial_number?: string
          model?: string | null
          ip_address?: string | null
          firmware_version?: string | null
          status?: 'online' | 'offline' | 'unknown'
          last_seen_at?: string | null
          location?: string | null
          device_username?: string | null
          device_password_encrypted?: string | null
          sync_status?: 'disconnected' | 'connecting' | 'syncing' | 'synced' | 'error'
          sync_error?: string | null
          sync_last_at?: string | null
          sync_events_count?: number
          last_event_synced_at?: string | null
          updated_at?: string
        }
      }
      sync_logs: {
        Row: {
          id: string
          device_id: string | null
          sync_type: string
          status: string
          events_processed: number | null
          error_message: string | null
          started_at: string
          completed_at: string | null
          duration_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          device_id?: string | null
          sync_type: string
          status: string
          events_processed?: number | null
          error_message?: string | null
          started_at?: string
          completed_at?: string | null
          duration_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          device_id?: string | null
          sync_type?: string
          status?: string
          events_processed?: number | null
          error_message?: string | null
          started_at?: string
          completed_at?: string | null
          duration_ms?: number | null
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          target_type: string | null
          target_id: string | null
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          target_type?: string | null
          target_id?: string | null
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          target_type?: string | null
          target_id?: string | null
          details?: Json | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'admin' | 'hr_operator' | 'supervisor' | 'technician'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'admin' | 'hr_operator' | 'supervisor' | 'technician'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'admin' | 'hr_operator' | 'supervisor' | 'technician'
          created_at?: string
          updated_at?: string
        }
      }
      door_commands: {
        Row: {
          id: string
          device_id: string | null
          device_serial: string | null
          door_no: number
          action: string
          status: string
          error_message: string | null
          requested_by: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          device_id?: string | null
          device_serial?: string | null
          door_no?: number
          action: string
          status?: string
          error_message?: string | null
          requested_by?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          device_id?: string | null
          device_serial?: string | null
          door_no?: number
          action?: string
          status?: string
          error_message?: string | null
          requested_by?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      person_status: 'active' | 'inactive' | 'pending_sync'
      device_status: 'online' | 'offline' | 'unknown'
      user_role: 'admin' | 'hr_operator' | 'supervisor' | 'technician'
    }
  }
}
