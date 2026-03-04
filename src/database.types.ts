export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs_2026_02: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_03: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_04: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_05: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_06: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_07: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      billing_accounts: {
        Row: {
          billing_status: string | null
          company_id: string
          created_at: string | null
          current_period_end: string | null
          id: string
          plan_tier: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          billing_status?: string | null
          company_id: string
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan_tier?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_status?: string | null
          company_id?: string
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan_tier?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_logs: {
        Row: {
          company_id: string
          created_at: string
          event_type: string
          id: string
          new_status: string | null
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          event_type: string
          id?: string
          new_status?: string | null
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          new_status?: string | null
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          billing_increment: number | null
          cancel_at_period_end: boolean
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_ends_at: string | null
          deleted_at: string | null
          grace_period_ends_at: string | null
          id: string
          name: string
          seat_count: number | null
          seat_limit: number | null
          settings: Json
          slug: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          subscription_tier: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_increment?: number | null
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_ends_at?: string | null
          deleted_at?: string | null
          grace_period_ends_at?: string | null
          id?: string
          name: string
          seat_count?: number | null
          seat_limit?: number | null
          settings?: Json
          slug: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          subscription_tier?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_increment?: number | null
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_ends_at?: string | null
          deleted_at?: string | null
          grace_period_ends_at?: string | null
          id?: string
          name?: string
          seat_count?: number | null
          seat_limit?: number | null
          settings?: Json
          slug?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          subscription_tier?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_usage_metrics: {
        Row: {
          active_users_count: number | null
          ai_requests_count: number | null
          company_id: string
          created_at: string
          id: string
          is_snapshot: boolean | null
          period_end: string
          period_start: string
          products_count: number | null
          storage_used_mb: number | null
        }
        Insert: {
          active_users_count?: number | null
          ai_requests_count?: number | null
          company_id: string
          created_at?: string
          id?: string
          is_snapshot?: boolean | null
          period_end: string
          period_start: string
          products_count?: number | null
          storage_used_mb?: number | null
        }
        Update: {
          active_users_count?: number | null
          ai_requests_count?: number | null
          company_id?: string
          created_at?: string
          id?: string
          is_snapshot?: boolean | null
          period_end?: string
          period_start?: string
          products_count?: number | null
          storage_used_mb?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_usage_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_actions_log: {
        Row: {
          action_type: string
          admin_email: string
          admin_role: string
          admin_user_id: string
          affected_company_id: string | null
          approved_at: string | null
          approved_by: string | null
          changes_made: Json | null
          executed_at: string
          id: string
          justification: string
          requires_approval: boolean | null
          support_ticket_id: string | null
        }
        Insert: {
          action_type: string
          admin_email: string
          admin_role: string
          admin_user_id: string
          affected_company_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          changes_made?: Json | null
          executed_at?: string
          id?: string
          justification: string
          requires_approval?: boolean | null
          support_ticket_id?: string | null
        }
        Update: {
          action_type?: string
          admin_email?: string
          admin_role?: string
          admin_user_id?: string
          affected_company_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          changes_made?: Json | null
          executed_at?: string
          id?: string
          justification?: string
          requires_approval?: boolean | null
          support_ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_actions_log_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_actions_log_affected_company_id_fkey"
            columns: ["affected_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_actions_log_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      material_batches: {
        Row: {
          area: number | null
          company_id: string
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          entry_mode: string | null
          id: string
          initial_quantity: number
          length: number | null
          material_id: string
          provider: string | null
          reference: string | null
          remaining_quantity: number
          unit_cost: number
          updated_at: string
          updated_by: string | null
          width: number | null
        }
        Insert: {
          area?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          entry_mode?: string | null
          id?: string
          initial_quantity: number
          length?: number | null
          material_id: string
          provider?: string | null
          reference?: string | null
          remaining_quantity: number
          unit_cost: number
          updated_at?: string
          updated_by?: string | null
          width?: number | null
        }
        Update: {
          area?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          entry_mode?: string | null
          id?: string
          initial_quantity?: number
          length?: number | null
          material_id?: string
          provider?: string | null
          reference?: string | null
          remaining_quantity?: number
          unit_cost?: number
          updated_at?: string
          updated_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_batches_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      product_movements: {
        Row: {
          company_id: string
          created_at: string
          id: string
          produced_with_debt: boolean | null
          product_id: string
          quantity: number
          reference: string | null
          type: Database["public"]["Enums"]["product_movement_type"]
          unit_cost: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          produced_with_debt?: boolean | null
          product_id: string
          quantity: number
          reference?: string | null
          type: Database["public"]["Enums"]["product_movement_type"]
          unit_cost?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          produced_with_debt?: boolean | null
          product_id?: string
          quantity?: number
          reference?: string | null
          type?: Database["public"]["Enums"]["product_movement_type"]
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          company_id: string
          cost_fifo: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          materials: Json | null
          name: string
          price: number
          reference: string | null
          status: string | null
          target_margin: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          cost_fifo?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          materials?: Json | null
          name: string
          price?: number
          reference?: string | null
          status?: string | null
          target_margin?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          cost_fifo?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          materials?: Json | null
          name?: string
          price?: number
          reference?: string | null
          status?: string | null
          target_margin?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_materials: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          provider: string | null
          status: string | null
          type: string | null
          unit: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          provider?: string | null
          status?: string | null
          type?: string | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          provider?: string | null
          status?: string | null
          type?: string | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          company_id: string
          created_at: string
          date: string
          deleted_at: string | null
          id: string
          material_id: string
          quantity: number
          reference: string | null
          type: string
          unit_cost: number
        }
        Insert: {
          batch_id?: string | null
          company_id: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          id?: string
          material_id: string
          quantity: number
          reference?: string | null
          type: string
          unit_cost: number
        }
        Update: {
          batch_id?: string | null
          company_id?: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          id?: string
          material_id?: string
          quantity?: number
          reference?: string | null
          type?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "material_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          company_id: string | null
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          status: string | null
          stripe_event_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string | null
          stripe_event_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string | null
          stripe_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          features: Json
          id: string
          is_active: boolean
          max_ai_requests_monthly: number
          max_products: number
          max_storage_mb: number
          max_users: number
          monthly_price_cents: number
          name: string
          slug: string
          stripe_monthly_price_id: string | null
          stripe_yearly_price_id: string | null
          updated_at: string
          yearly_price_cents: number
        }
        Insert: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_ai_requests_monthly?: number
          max_products?: number
          max_storage_mb?: number
          max_users?: number
          monthly_price_cents?: number
          name: string
          slug: string
          stripe_monthly_price_id?: string | null
          stripe_yearly_price_id?: string | null
          updated_at?: string
          yearly_price_cents?: number
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_ai_requests_monthly?: number
          max_products?: number
          max_storage_mb?: number
          max_users?: number
          monthly_price_cents?: number
          name?: string
          slug?: string
          stripe_monthly_price_id?: string | null
          stripe_yearly_price_id?: string | null
          updated_at?: string
          yearly_price_cents?: number
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          default_company_id: string | null
          email: string
          full_name: string | null
          id: string
          is_super_admin: boolean
          preferences: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_company_id?: string | null
          email: string
          full_name?: string | null
          id: string
          is_super_admin?: boolean
          preferences?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_company_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_super_admin?: boolean
          preferences?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_default_company_id_fkey"
            columns: ["default_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      platform_metrics: {
        Row: {
          active_tenants: number | null
          deleted_tenants: number | null
          mrr_estimate: number | null
          suspended_tenants: number | null
          total_tenants: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      beto_provision_tenant: {
        Args: {
          p_company_name: string
          p_company_slug: string
          p_user_id: string
          p_user_role?: string
        }
        Returns: Json
      }
      check_environment_capacity: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      company_subscription_status: { Args: { cid: string }; Returns: string }
      create_company_with_owner: {
        Args: { company_name: string; company_slug: string }
        Returns: Json
      }
      create_next_month_audit_partition: { Args: never; Returns: undefined }
      current_user_id: { Args: never; Returns: string }
      get_company_suspension_level: { Args: { cid: string }; Returns: string }
      get_suspension_level: {
        Args: { grace_period_ends_at: string; status: string }
        Returns: string
      }
      get_team_members: {
        Args: { p_company_id?: string }
        Returns: {
          company_id: string
          company_name: string
          confirmation_sent_at: string
          email: string
          full_name: string
          id: string
          invited_at: string
          is_active: boolean
          joined_at: string
          last_sign_in_at: string
          role: string
          user_id: string
        }[]
      }
      has_role_level: {
        Args: { cid: string; min_role: string }
        Returns: boolean
      }
      is_company_active: { Args: { cid: string }; Returns: boolean }
      is_company_member: { Args: { target_company: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_within_grace_period: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      user_companies: { Args: never; Returns: string[] }
      user_id: { Args: never; Returns: string }
      user_is_admin_or_manager: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      user_role_in_company: { Args: { cid: string }; Returns: string }
    }
    Enums: {
      product_movement_type: "ingreso_produccion" | "salida_venta" | "ajuste"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      product_movement_type: ["ingreso_produccion", "salida_venta", "ajuste"],
    },
  },
} as const
