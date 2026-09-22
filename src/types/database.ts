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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      investment_scenarios: {
        Row: {
          id: string
          organization_id: string
          name: string
          input: Json
          selected_method: string
          schema_version: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          input: Json
          selected_method?: string
          schema_version?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          input?: Json
          selected_method?: string
          schema_version?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_scenarios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_role: Database["public"]["Enums"]["app_role"] | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_data: Json | null
          occurred_at: string
          old_data: Json | null
          organization_id: string | null
          request_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          organization_id?: string | null
          request_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          organization_id?: string | null
          request_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_type: string | null
          archived_at: string | null
          available_balance_cents: number | null
          balance_as_of: string | null
          connection_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          current_balance_cents: number | null
          iban_hash: string | null
          iban_last4: string | null
          id: string
          is_primary: boolean
          organization_id: string
          property_id: string | null
          provider_account_ref: string | null
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
        }
        Insert: {
          account_name: string
          account_type?: string | null
          archived_at?: string | null
          available_balance_cents?: number | null
          balance_as_of?: string | null
          connection_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_balance_cents?: number | null
          iban_hash?: string | null
          iban_last4?: string | null
          id?: string
          is_primary?: boolean
          organization_id: string
          property_id?: string | null
          provider_account_ref?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_type?: string | null
          archived_at?: string | null
          available_balance_cents?: number | null
          balance_as_of?: string | null
          connection_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_balance_cents?: number | null
          iban_hash?: string | null
          iban_last4?: string | null
          id?: string
          is_primary?: boolean
          organization_id?: string
          property_id?: string | null
          provider_account_ref?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_connections: {
        Row: {
          consent_expires_at: string | null
          created_at: string
          created_by: string | null
          error_code: string | null
          error_message: string | null
          id: string
          last_synced_at: string | null
          mode: string
          organization_id: string
          provider: string
          provider_connection_ref: string | null
          revoked_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          consent_expires_at?: string | null
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          mode?: string
          organization_id: string
          provider: string
          provider_connection_ref?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          consent_expires_at?: string | null
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          mode?: string
          organization_id?: string
          provider?: string
          provider_connection_ref?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount_cents: number
          bank_account_id: string
          bank_code: string | null
          booked_on: string
          counterparty_iban_hash: string | null
          counterparty_iban_last4: string | null
          counterparty_name: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          imported_at: string
          is_ignored: boolean
          match_status: Database["public"]["Enums"]["match_status"]
          organization_id: string
          provider_transaction_ref: string | null
          raw_data: Json
          remittance_information: string | null
          updated_at: string
          value_on: string | null
        }
        Insert: {
          amount_cents: number
          bank_account_id: string
          bank_code?: string | null
          booked_on: string
          counterparty_iban_hash?: string | null
          counterparty_iban_last4?: string | null
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          imported_at?: string
          is_ignored?: boolean
          match_status?: Database["public"]["Enums"]["match_status"]
          organization_id: string
          provider_transaction_ref?: string | null
          raw_data?: Json
          remittance_information?: string | null
          updated_at?: string
          value_on?: string | null
        }
        Update: {
          amount_cents?: number
          bank_account_id?: string
          bank_code?: string | null
          booked_on?: string
          counterparty_iban_hash?: string | null
          counterparty_iban_last4?: string | null
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          imported_at?: string
          is_ignored?: boolean
          match_status?: Database["public"]["Enums"]["match_status"]
          organization_id?: string
          provider_transaction_ref?: string | null
          raw_data?: Json
          remittance_information?: string | null
          updated_at?: string
          value_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_tenant_id: string | null
          author_user_id: string | null
          body: string
          created_at: string
          created_by: string | null
          edited_at: string | null
          id: string
          is_internal: boolean
          maintenance_request_id: string | null
          organization_id: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          author_tenant_id?: string | null
          author_user_id?: string | null
          body: string
          created_at?: string
          created_by?: string | null
          edited_at?: string | null
          id?: string
          is_internal?: boolean
          maintenance_request_id?: string | null
          organization_id: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          author_tenant_id?: string | null
          author_user_id?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          edited_at?: string | null
          id?: string
          is_internal?: boolean
          maintenance_request_id?: string | null
          organization_id?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_tenant_id_fkey"
            columns: ["author_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          created_by: string | null
          id: string
          last_read_at: string | null
          notifications_enabled: boolean
          organization_id: string
          participant_role: string
          tenant_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_read_at?: string | null
          notifications_enabled?: boolean
          organization_id: string
          participant_role: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_read_at?: string | null
          notifications_enabled?: boolean
          organization_id?: string
          participant_role?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          archived_at: string | null
          assigned_member_id: string | null
          category: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          is_internal: boolean
          last_message_at: string | null
          lease_id: string | null
          organization_id: string
          priority: Database["public"]["Enums"]["priority_level"]
          property_id: string | null
          status: string
          subject: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assigned_member_id?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_internal?: boolean
          last_message_at?: string | null
          lease_id?: string | null
          organization_id: string
          priority?: Database["public"]["Enums"]["priority_level"]
          property_id?: string | null
          status?: string
          subject: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assigned_member_id?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_internal?: boolean
          last_message_at?: string | null
          lease_id?: string | null
          organization_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          property_id?: string | null
          status?: string
          subject?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_member_id_fkey"
            columns: ["assigned_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      depreciation_assets: {
        Row: {
          acquisition_cost_cents: number
          acquisition_date: string
          annual_rate: number | null
          archived_at: string | null
          asset_type: string
          basis_as_of: string | null
          calculation_method: string
          created_at: string
          created_by: string | null
          depreciable_basis_cents: number
          explanation: string
          id: string
          land_share_cents: number
          manual_adjustment_cents: number
          manual_annual_depreciation_cents: number | null
          name: string
          opening_accumulated_depreciation_cents: number | null
          opening_remaining_basis_cents: number | null
          organization_id: string
          property_id: string
          source_document_id: string | null
          source_type: string
          tax_year_id: string | null
          updated_at: string
          use_start_date: string
          useful_life_years: number | null
        }
        Insert: {
          acquisition_cost_cents: number
          acquisition_date: string
          annual_rate?: number | null
          archived_at?: string | null
          asset_type?: string
          basis_as_of?: string | null
          calculation_method?: string
          created_at?: string
          created_by?: string | null
          depreciable_basis_cents: number
          explanation: string
          id?: string
          land_share_cents?: number
          manual_adjustment_cents?: number
          manual_annual_depreciation_cents?: number | null
          name: string
          opening_accumulated_depreciation_cents?: number | null
          opening_remaining_basis_cents?: number | null
          organization_id: string
          property_id: string
          source_document_id?: string | null
          source_type?: string
          tax_year_id?: string | null
          updated_at?: string
          use_start_date: string
          useful_life_years?: number | null
        }
        Update: {
          acquisition_cost_cents?: number
          acquisition_date?: string
          annual_rate?: number | null
          archived_at?: string | null
          asset_type?: string
          basis_as_of?: string | null
          calculation_method?: string
          created_at?: string
          created_by?: string | null
          depreciable_basis_cents?: number
          explanation?: string
          id?: string
          land_share_cents?: number
          manual_adjustment_cents?: number
          manual_annual_depreciation_cents?: number | null
          name?: string
          opening_accumulated_depreciation_cents?: number | null
          opening_remaining_basis_cents?: number | null
          organization_id?: string
          property_id?: string
          source_document_id?: string | null
          source_type?: string
          tax_year_id?: string | null
          updated_at?: string
          use_start_date?: string
          useful_life_years?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "depreciation_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_assets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_assets_source_document_v2_fkey"
            columns: ["organization_id", "source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "depreciation_assets_tax_year_id_fkey"
            columns: ["tax_year_id"]
            isOneToOne: false
            referencedRelation: "tax_years"
            referencedColumns: ["id"]
          },
        ]
      }
      document_extractions: {
        Row: {
          confidence: number | null
          created_at: string
          created_by: string | null
          document_id: string
          duplicate_of_document_id: string | null
          error_code: string | null
          error_message: string | null
          extracted_address: Json | null
          extracted_currency: string | null
          extracted_fields: Json
          extracted_invoice_date: string | null
          extracted_invoice_number: string | null
          extracted_service_date: string | null
          extracted_vendor_name: string | null
          gross_amount_cents: number | null
          id: string
          net_amount_cents: number | null
          organization_id: string
          provider: string
          provider_version: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["sync_status"]
          tax_amount_cents: number | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          document_id: string
          duplicate_of_document_id?: string | null
          error_code?: string | null
          error_message?: string | null
          extracted_address?: Json | null
          extracted_currency?: string | null
          extracted_fields?: Json
          extracted_invoice_date?: string | null
          extracted_invoice_number?: string | null
          extracted_service_date?: string | null
          extracted_vendor_name?: string | null
          gross_amount_cents?: number | null
          id?: string
          net_amount_cents?: number | null
          organization_id: string
          provider: string
          provider_version?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["sync_status"]
          tax_amount_cents?: number | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          duplicate_of_document_id?: string | null
          error_code?: string | null
          error_message?: string | null
          extracted_address?: Json | null
          extracted_currency?: string | null
          extracted_fields?: Json
          extracted_invoice_date?: string | null
          extracted_invoice_number?: string | null
          extracted_service_date?: string | null
          extracted_vendor_name?: string | null
          gross_amount_cents?: number | null
          id?: string
          net_amount_cents?: number | null
          organization_id?: string
          provider?: string
          provider_version?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["sync_status"]
          tax_amount_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_extractions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_extractions_duplicate_of_document_id_fkey"
            columns: ["duplicate_of_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_extractions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_links: {
        Row: {
          conversation_id: string | null
          created_at: string
          created_by: string | null
          document_id: string
          expense_entry_id: string | null
          id: string
          income_entry_id: string | null
          lease_id: string | null
          link_type: string
          loan_id: string | null
          maintenance_request_id: string | null
          message_id: string | null
          organization_id: string
          property_id: string | null
          renovation_item_id: string | null
          renovation_project_id: string | null
          rent_claim_id: string | null
          task_id: string | null
          tenant_id: string | null
          tenant_visible: boolean
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          expense_entry_id?: string | null
          id?: string
          income_entry_id?: string | null
          lease_id?: string | null
          link_type?: string
          loan_id?: string | null
          maintenance_request_id?: string | null
          message_id?: string | null
          organization_id: string
          property_id?: string | null
          renovation_item_id?: string | null
          renovation_project_id?: string | null
          rent_claim_id?: string | null
          task_id?: string | null
          tenant_id?: string | null
          tenant_visible?: boolean
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          expense_entry_id?: string | null
          id?: string
          income_entry_id?: string | null
          lease_id?: string | null
          link_type?: string
          loan_id?: string | null
          maintenance_request_id?: string | null
          message_id?: string | null
          organization_id?: string
          property_id?: string | null
          renovation_item_id?: string | null
          renovation_project_id?: string | null
          rent_claim_id?: string | null
          task_id?: string | null
          tenant_id?: string | null
          tenant_visible?: boolean
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_links_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_expense_entry_id_fkey"
            columns: ["expense_entry_id"]
            isOneToOne: false
            referencedRelation: "expense_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_income_entry_id_fkey"
            columns: ["income_entry_id"]
            isOneToOne: false
            referencedRelation: "income_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_renovation_item_id_fkey"
            columns: ["renovation_item_id"]
            isOneToOne: false
            referencedRelation: "renovation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_renovation_project_id_fkey"
            columns: ["renovation_project_id"]
            isOneToOne: false
            referencedRelation: "renovation_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_rent_claim_id_fkey"
            columns: ["rent_claim_id"]
            isOneToOne: false
            referencedRelation: "rent_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          document_date: string | null
          document_type: string
          id: string
          lease_id: string | null
          mime_type: string
          ocr_status: Database["public"]["Enums"]["sync_status"]
          organization_id: string
          original_file_name: string
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          property_id: string | null
          retention_until: string | null
          review_status: Database["public"]["Enums"]["document_review_status"]
          sha256: string | null
          size_bytes: number
          storage_bucket: string
          storage_path: string
          tenant_visible: boolean
          title: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          document_date?: string | null
          document_type?: string
          id?: string
          lease_id?: string | null
          mime_type: string
          ocr_status?: Database["public"]["Enums"]["sync_status"]
          organization_id: string
          original_file_name: string
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          property_id?: string | null
          retention_until?: string | null
          review_status?: Database["public"]["Enums"]["document_review_status"]
          sha256?: string | null
          size_bytes: number
          storage_bucket?: string
          storage_path: string
          tenant_visible?: boolean
          title?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          document_date?: string | null
          document_type?: string
          id?: string
          lease_id?: string | null
          mime_type?: string
          ocr_status?: Database["public"]["Enums"]["sync_status"]
          organization_id?: string
          original_file_name?: string
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          property_id?: string | null
          retention_until?: string | null
          review_status?: Database["public"]["Enums"]["document_review_status"]
          sha256?: string | null
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          tenant_visible?: boolean
          title?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          archived_at: string | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_capitalizable_default: boolean
          is_cash_effective_default: boolean
          is_recoverable_default: boolean
          is_system: boolean
          is_tax_relevant_default: boolean
          name: string
          organization_id: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_capitalizable_default?: boolean
          is_cash_effective_default?: boolean
          is_recoverable_default?: boolean
          is_system?: boolean
          is_tax_relevant_default?: boolean
          name: string
          organization_id: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_capitalizable_default?: boolean
          is_cash_effective_default?: boolean
          is_recoverable_default?: boolean
          is_system?: boolean
          is_tax_relevant_default?: boolean
          name?: string
          organization_id?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_entries: {
        Row: {
          amount_cents: number
          archived_at: string | null
          bank_transaction_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          document_status: Database["public"]["Enums"]["document_review_status"]
          entry_date: string
          id: string
          is_capitalizable: boolean
          is_cash_effective: boolean
          is_deductible: boolean | null
          is_interest: boolean
          is_principal: boolean
          is_recoverable: boolean
          is_tax_relevant: boolean | null
          net_amount_cents: number | null
          notes: string | null
          organization_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          property_id: string
          service_date: string | null
          tax_amount_cents: number | null
          tax_year: number | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          archived_at?: string | null
          bank_transaction_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          document_status?: Database["public"]["Enums"]["document_review_status"]
          entry_date: string
          id?: string
          is_capitalizable?: boolean
          is_cash_effective?: boolean
          is_deductible?: boolean | null
          is_interest?: boolean
          is_principal?: boolean
          is_recoverable?: boolean
          is_tax_relevant?: boolean | null
          net_amount_cents?: number | null
          notes?: string | null
          organization_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          property_id: string
          service_date?: string | null
          tax_amount_cents?: number | null
          tax_year?: number | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          archived_at?: string | null
          bank_transaction_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          document_status?: Database["public"]["Enums"]["document_review_status"]
          entry_date?: string
          id?: string
          is_capitalizable?: boolean
          is_cash_effective?: boolean
          is_deductible?: boolean | null
          is_interest?: boolean
          is_principal?: boolean
          is_recoverable?: boolean
          is_tax_relevant?: boolean | null
          net_amount_cents?: number | null
          notes?: string | null
          organization_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          property_id?: string
          service_date?: string | null
          tax_amount_cents?: number | null
          tax_year?: number | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_entries_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      income_entries: {
        Row: {
          amount_cents: number
          archived_at: string | null
          bank_transaction_id: string | null
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description: string
          entry_date: string
          id: string
          lease_id: string | null
          notes: string | null
          organization_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          property_id: string
          tax_relevant: boolean | null
          tax_year: number | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          archived_at?: string | null
          bank_transaction_id?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          entry_date: string
          id?: string
          lease_id?: string | null
          notes?: string | null
          organization_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          property_id: string
          tax_relevant?: boolean | null
          tax_year?: number | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          archived_at?: string | null
          bank_transaction_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          entry_date?: string
          id?: string
          lease_id?: string | null
          notes?: string | null
          organization_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          property_id?: string
          tax_relevant?: boolean | null
          tax_year?: number | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_entries_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          configuration: Json
          connected_at: string | null
          connected_by: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          external_account_ref: string | null
          id: string
          integration_type: string
          last_synced_at: string | null
          mode: string
          organization_id: string
          provider: string
          revoked_at: string | null
          scopes: string[]
          secret_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          configuration?: Json
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          external_account_ref?: string | null
          id?: string
          integration_type: string
          last_synced_at?: string | null
          mode?: string
          organization_id: string
          provider: string
          revoked_at?: string | null
          scopes?: string[]
          secret_reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          configuration?: Json
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          external_account_ref?: string | null
          id?: string
          integration_type?: string
          last_synced_at?: string | null
          mode?: string
          organization_id?: string
          provider?: string
          revoked_at?: string | null
          scopes?: string[]
          secret_reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_logs: {
        Row: {
          created_at: string
          created_by: string | null
          cursor_value: string | null
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          integration_connection_id: string
          metadata: Json
          organization_id: string
          records_created: number
          records_failed: number
          records_received: number
          records_updated: number
          started_at: string | null
          status: Database["public"]["Enums"]["sync_status"]
          sync_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cursor_value?: string | null
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          integration_connection_id: string
          metadata?: Json
          organization_id: string
          records_created?: number
          records_failed?: number
          records_received?: number
          records_updated?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_status"]
          sync_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cursor_value?: string | null
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          integration_connection_id?: string
          metadata?: Json
          organization_id?: string
          records_created?: number
          records_failed?: number
          records_received?: number
          records_updated?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_status"]
          sync_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_logs_integration_connection_id_fkey"
            columns: ["integration_connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          property_restricted: boolean
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          tenant_id: string | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          organization_id: string
          property_restricted?: boolean
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          tenant_id?: string | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          property_restricted?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          tenant_id?: string | null
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_tenants: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          lease_id: string
          occupancy_ends_on: string | null
          occupancy_starts_on: string | null
          organization_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          lease_id: string
          occupancy_ends_on?: string | null
          occupancy_starts_on?: string | null
          organization_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          lease_id?: string
          occupancy_ends_on?: string | null
          occupancy_starts_on?: string | null
          organization_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_tenants_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_tenants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          ancillary_charge_type: string
          ancillary_prepayment_cents: number
          archived_at: string | null
          cold_rent_cents: number
          created_at: string
          created_by: string | null
          deposit_cents: number
          deposit_paid_cents: number
          deposit_status: Database["public"]["Enums"]["payment_status"]
          due_day: number
          ends_on: string | null
          id: string
          lease_number: string | null
          notice_period_months: number
          organization_id: string
          other_rent_cents: number
          parking_rent_cents: number
          starts_on: string
          status: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          ancillary_charge_type?: string
          ancillary_prepayment_cents?: number
          archived_at?: string | null
          cold_rent_cents: number
          created_at?: string
          created_by?: string | null
          deposit_cents?: number
          deposit_paid_cents?: number
          deposit_status?: Database["public"]["Enums"]["payment_status"]
          due_day?: number
          ends_on?: string | null
          id?: string
          lease_number?: string | null
          notice_period_months?: number
          organization_id: string
          other_rent_cents?: number
          parking_rent_cents?: number
          starts_on: string
          status?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          ancillary_charge_type?: string
          ancillary_prepayment_cents?: number
          archived_at?: string | null
          cold_rent_cents?: number
          created_at?: string
          created_by?: string | null
          deposit_cents?: number
          deposit_paid_cents?: number
          deposit_status?: Database["public"]["Enums"]["payment_status"]
          due_day?: number
          ends_on?: string | null
          id?: string
          lease_number?: string | null
          notice_period_months?: number
          organization_id?: string
          other_rent_cents?: number
          parking_rent_cents?: number
          starts_on?: string
          status?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_payments: {
        Row: {
          bank_transaction_id: string | null
          created_at: string
          created_by: string | null
          due_date: string
          fees_cents: number
          id: string
          interest_cents: number
          is_special_repayment: boolean
          loan_id: string
          organization_id: string
          paid_on: string | null
          payment_cents: number
          principal_cents: number
          remaining_balance_cents: number | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          bank_transaction_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date: string
          fees_cents?: number
          id?: string
          interest_cents: number
          is_special_repayment?: boolean
          loan_id: string
          organization_id: string
          paid_on?: string | null
          payment_cents: number
          principal_cents: number
          remaining_balance_cents?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          bank_transaction_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string
          fees_cents?: number
          id?: string
          interest_cents?: number
          is_special_repayment?: boolean
          loan_id?: string
          organization_id?: string
          paid_on?: string | null
          payment_cents?: number
          principal_cents?: number
          remaining_balance_cents?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_payments_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          annual_special_repayment_limit_cents: number | null
          archived_at: string | null
          created_at: string
          created_by: string | null
          current_balance_cents: number
          disbursed_on: string | null
          financing_cost_cents: number
          fixed_rate_until: string | null
          id: string
          initial_repayment_rate: number | null
          lender_name: string
          loan_number: string | null
          loan_type: string
          maturity_date: string | null
          monthly_payment_cents: number
          nominal_interest_rate: number
          notes: string | null
          organization_id: string
          original_principal_cents: number
          property_id: string
          status: string
          updated_at: string
        }
        Insert: {
          annual_special_repayment_limit_cents?: number | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          current_balance_cents: number
          disbursed_on?: string | null
          financing_cost_cents?: number
          fixed_rate_until?: string | null
          id?: string
          initial_repayment_rate?: number | null
          lender_name: string
          loan_number?: string | null
          loan_type?: string
          maturity_date?: string | null
          monthly_payment_cents: number
          nominal_interest_rate: number
          notes?: string | null
          organization_id: string
          original_principal_cents: number
          property_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          annual_special_repayment_limit_cents?: number | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          current_balance_cents?: number
          disbursed_on?: string | null
          financing_cost_cents?: number
          fixed_rate_until?: string | null
          id?: string
          initial_repayment_rate?: number | null
          lender_name?: string
          loan_number?: string | null
          loan_type?: string
          maturity_date?: string | null
          monthly_payment_cents?: number
          nominal_interest_rate?: number
          notes?: string | null
          organization_id?: string
          original_principal_cents?: number
          property_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_request_internal_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          maintenance_request_id: string
          notes: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          maintenance_request_id: string
          notes: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          maintenance_request_id?: string
          notes?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_request_internal_notes_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: true
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_request_internal_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          archived_at: string | null
          assigned_member_id: string | null
          category: string
          conversation_id: string | null
          created_at: string
          created_by: string | null
          description: string
          desired_date: string | null
          id: string
          lease_id: string | null
          organization_id: string
          priority: Database["public"]["Enums"]["priority_level"]
          property_id: string
          reported_at: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          tenant_id: string | null
          tenant_visible_notes: string | null
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assigned_member_id?: string | null
          category?: string
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          desired_date?: string | null
          id?: string
          lease_id?: string | null
          organization_id: string
          priority?: Database["public"]["Enums"]["priority_level"]
          property_id: string
          reported_at?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tenant_id?: string | null
          tenant_visible_notes?: string | null
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assigned_member_id?: string | null
          category?: string
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          desired_date?: string | null
          id?: string
          lease_id?: string | null
          organization_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          property_id?: string
          reported_at?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tenant_id?: string | null
          tenant_visible_notes?: string | null
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_assigned_member_id_fkey"
            columns: ["assigned_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_reserves: {
        Row: {
          as_of_date: string
          assumptions: Json
          calculation_basis: string | null
          created_at: string
          created_by: string | null
          current_balance_cents: number
          id: string
          monthly_contribution_cents: number
          organization_id: string
          property_id: string
          target_balance_cents: number | null
          updated_at: string
        }
        Insert: {
          as_of_date: string
          assumptions?: Json
          calculation_basis?: string | null
          created_at?: string
          created_by?: string | null
          current_balance_cents?: number
          id?: string
          monthly_contribution_cents?: number
          organization_id: string
          property_id: string
          target_balance_cents?: number | null
          updated_at?: string
        }
        Update: {
          as_of_date?: string
          assumptions?: Json
          calculation_basis?: string | null
          created_at?: string
          created_by?: string | null
          current_balance_cents?: number
          id?: string
          monthly_contribution_cents?: number
          organization_id?: string
          property_id?: string
          target_balance_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_reserves_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_reserves_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      market_rent_comparisons: {
        Row: {
          assumptions: Json
          created_at: string
          created_by: string | null
          current_cents_per_sqm: number | null
          data_date: string
          id: string
          is_demo_data: boolean
          maximum_cents_per_sqm: number | null
          median_cents_per_sqm: number
          minimum_cents_per_sqm: number | null
          organization_id: string
          potential_monthly_rent_cents: number | null
          property_id: string
          source_name: string
          source_type: string
          source_url: string | null
          uncertainty_note: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          assumptions?: Json
          created_at?: string
          created_by?: string | null
          current_cents_per_sqm?: number | null
          data_date: string
          id?: string
          is_demo_data?: boolean
          maximum_cents_per_sqm?: number | null
          median_cents_per_sqm: number
          minimum_cents_per_sqm?: number | null
          organization_id: string
          potential_monthly_rent_cents?: number | null
          property_id: string
          source_name: string
          source_type: string
          source_url?: string | null
          uncertainty_note: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          assumptions?: Json
          created_at?: string
          created_by?: string | null
          current_cents_per_sqm?: number | null
          data_date?: string
          id?: string
          is_demo_data?: boolean
          maximum_cents_per_sqm?: number | null
          median_cents_per_sqm?: number
          minimum_cents_per_sqm?: number | null
          organization_id?: string
          potential_monthly_rent_cents?: number | null
          property_id?: string
          source_name?: string
          source_type?: string
          source_url?: string | null
          uncertainty_note?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_rent_comparisons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_rent_comparisons_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_rent_comparisons_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_tenant_id: string | null
          author_user_id: string | null
          body: string
          conversation_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_internal_note: boolean
          organization_id: string
          sent_at: string
          updated_at: string
        }
        Insert: {
          author_tenant_id?: string | null
          author_user_id?: string | null
          body: string
          conversation_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_internal_note?: boolean
          organization_id: string
          sent_at?: string
          updated_at?: string
        }
        Update: {
          author_tenant_id?: string | null
          author_user_id?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_internal_note?: boolean
          organization_id?: string
          sent_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_tenant_id_fkey"
            columns: ["author_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          created_at: string
          created_by: string | null
          dismissed_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          notification_type: string
          organization_id: string
          priority: Database["public"]["Enums"]["priority_level"]
          read_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body: string
          created_at?: string
          created_by?: string | null
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          notification_type: string
          organization_id: string
          priority?: Database["public"]["Enums"]["priority_level"]
          read_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          notification_type?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          read_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      optimization_insights: {
        Row: {
          created_at: string
          created_by: string | null
          dismissed_at: string | null
          dismissed_by: string | null
          estimated_impact_cents: number | null
          explanation: string
          id: string
          insight_type: string
          next_review: string | null
          organization_id: string
          priority: Database["public"]["Enums"]["priority_level"]
          property_id: string | null
          responsible_member_id: string | null
          source_snapshot: Json
          status: string
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          estimated_impact_cents?: number | null
          explanation: string
          id?: string
          insight_type: string
          next_review?: string | null
          organization_id: string
          priority?: Database["public"]["Enums"]["priority_level"]
          property_id?: string | null
          responsible_member_id?: string | null
          source_snapshot?: Json
          status?: string
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          estimated_impact_cents?: number | null
          explanation?: string
          id?: string
          insight_type?: string
          next_review?: string | null
          organization_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          property_id?: string | null
          responsible_member_id?: string | null
          source_snapshot?: Json
          status?: string
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimization_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_insights_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_insights_responsible_member_id_fkey"
            columns: ["responsible_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_insights_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_deletion_requests: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          requested_at: string
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          requested_at?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          requested_at?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_deletion_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invited_by: string | null
          is_property_restricted: boolean
          joined_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invited_by?: string | null
          is_property_restricted?: boolean
          joined_at?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invited_by?: string | null
          is_property_restricted?: boolean
          joined_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          archived_at: string | null
          city: string | null
          country_code: string
          created_at: string
          created_by: string | null
          default_currency: string
          demo_seeded_at: string | null
          house_number: string | null
          id: string
          kind: Database["public"]["Enums"]["organization_kind"]
          name: string
          owner_user_id: string
          postal_code: string | null
          retention_days: number | null
          settings: Json
          street: string | null
          tax_year_start_month: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          default_currency?: string
          demo_seeded_at?: string | null
          house_number?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["organization_kind"]
          name: string
          owner_user_id: string
          postal_code?: string | null
          retention_days?: number | null
          settings?: Json
          street?: string | null
          tax_year_start_month?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          default_currency?: string
          demo_seeded_at?: string | null
          house_number?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["organization_kind"]
          name?: string
          owner_user_id?: string
          postal_code?: string | null
          retention_days?: number | null
          settings?: Json
          street?: string | null
          tax_year_start_month?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          locale: string
          onboarding_completed_at: string | null
          phone: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          locale?: string
          onboarding_completed_at?: string | null
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          locale?: string
          onboarding_completed_at?: string | null
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          acquisition_costs_cents: number
          annual_insurance_cost_cents: number
          annual_management_cost_cents: number
          annual_non_recoverable_cost_cents: number
          annual_property_tax_cents: number
          archived_at: string | null
          broker_fee_cents: number
          building_purchase_price_cents: number | null
          building_value_cents: number | null
          city: string
          construction_year: number | null
          country_code: string
          created_at: string
          created_by: string | null
          current_market_value_cents: number | null
          energy_consumption_kwh_sqm: number | null
          energy_rating: string | null
          expected_monthly_rent_cents: number | null
          house_number: string | null
          id: string
          land_area_sqm: number | null
          land_ownership_share: number
          land_registry_fee_cents: number
          land_value_cents: number | null
          latitude: number | null
          longitude: number | null
          market_value_source: string | null
          market_value_status: string
          name: string
          notary_fee_cents: number
          notes: string | null
          organization_id: string
          other_acquisition_costs_cents: number
          postal_code: string
          property_mode: string
          property_type: string
          purchase_date: string | null
          purchase_price_cents: number | null
          real_estate_transfer_tax_cents: number
          real_estate_transfer_tax_rate: number | null
          rentable_area_sqm: number | null
          standard_land_value_cents_per_sqm: number | null
          status: Database["public"]["Enums"]["record_status"]
          street: string
          total_acquisition_cost_cents: number | null
          total_area_sqm: number | null
          unit_count: number | null
          updated_at: string
        }
        Insert: {
          acquisition_costs_cents?: number
          annual_insurance_cost_cents?: number
          annual_management_cost_cents?: number
          annual_non_recoverable_cost_cents?: number
          annual_property_tax_cents?: number
          archived_at?: string | null
          broker_fee_cents?: number
          building_purchase_price_cents?: number | null
          building_value_cents?: number | null
          city: string
          construction_year?: number | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          current_market_value_cents?: number | null
          energy_consumption_kwh_sqm?: number | null
          energy_rating?: string | null
          expected_monthly_rent_cents?: number | null
          house_number?: string | null
          id?: string
          land_area_sqm?: number | null
          land_ownership_share?: number
          land_registry_fee_cents?: number
          land_value_cents?: number | null
          latitude?: number | null
          longitude?: number | null
          market_value_source?: string | null
          market_value_status?: string
          name: string
          notary_fee_cents?: number
          notes?: string | null
          organization_id: string
          other_acquisition_costs_cents?: number
          postal_code: string
          property_mode?: string
          property_type?: string
          purchase_date?: string | null
          purchase_price_cents?: number | null
          real_estate_transfer_tax_cents?: number
          real_estate_transfer_tax_rate?: number | null
          rentable_area_sqm?: number | null
          standard_land_value_cents_per_sqm?: number | null
          status?: Database["public"]["Enums"]["record_status"]
          street: string
          total_acquisition_cost_cents?: number | null
          total_area_sqm?: number | null
          unit_count?: number | null
          updated_at?: string
        }
        Update: {
          acquisition_costs_cents?: number
          annual_insurance_cost_cents?: number
          annual_management_cost_cents?: number
          annual_non_recoverable_cost_cents?: number
          annual_property_tax_cents?: number
          archived_at?: string | null
          broker_fee_cents?: number
          building_purchase_price_cents?: number | null
          building_value_cents?: number | null
          city?: string
          construction_year?: number | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          current_market_value_cents?: number | null
          energy_consumption_kwh_sqm?: number | null
          energy_rating?: string | null
          expected_monthly_rent_cents?: number | null
          house_number?: string | null
          id?: string
          land_area_sqm?: number | null
          land_ownership_share?: number
          land_registry_fee_cents?: number
          land_value_cents?: number | null
          latitude?: number | null
          longitude?: number | null
          market_value_source?: string | null
          market_value_status?: string
          name?: string
          notary_fee_cents?: number
          notes?: string | null
          organization_id?: string
          other_acquisition_costs_cents?: number
          postal_code?: string
          property_mode?: string
          property_type?: string
          purchase_date?: string | null
          purchase_price_cents?: number | null
          real_estate_transfer_tax_cents?: number
          real_estate_transfer_tax_rate?: number | null
          rentable_area_sqm?: number | null
          standard_land_value_cents_per_sqm?: number | null
          status?: Database["public"]["Enums"]["record_status"]
          street?: string
          total_acquisition_cost_cents?: number | null
          total_area_sqm?: number | null
          unit_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_assignments: {
        Row: {
          can_manage_documents: boolean
          can_manage_messages: boolean
          can_manage_tasks: boolean
          created_at: string
          created_by: string | null
          id: string
          member_id: string
          organization_id: string
          property_id: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          can_manage_documents?: boolean
          can_manage_messages?: boolean
          can_manage_tasks?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          member_id: string
          organization_id: string
          property_id: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          can_manage_documents?: boolean
          can_manage_messages?: boolean
          can_manage_tasks?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string
          organization_id?: string
          property_id?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_assignments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      renovation_items: {
        Row: {
          actual_cost_cents: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          estimated_unit_cost_cents: number
          id: string
          organization_id: string
          quantity: number
          quote_vendor: string | null
          renovation_project_id: string
          status: Database["public"]["Enums"]["task_status"]
          unit: string
          updated_at: string
        }
        Insert: {
          actual_cost_cents?: number
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          estimated_unit_cost_cents?: number
          id?: string
          organization_id: string
          quantity?: number
          quote_vendor?: string | null
          renovation_project_id: string
          status?: Database["public"]["Enums"]["task_status"]
          unit?: string
          updated_at?: string
        }
        Update: {
          actual_cost_cents?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          estimated_unit_cost_cents?: number
          id?: string
          organization_id?: string
          quantity?: number
          quote_vendor?: string | null
          renovation_project_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renovation_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renovation_items_renovation_project_id_fkey"
            columns: ["renovation_project_id"]
            isOneToOne: false
            referencedRelation: "renovation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      renovation_projects: {
        Row: {
          actual_cost_cents: number
          actual_end_date: string | null
          actual_start_date: string | null
          archived_at: string | null
          condition_rating: number | null
          contingency_rate: number
          created_at: string
          created_by: string | null
          description: string | null
          estimated_cost_cents: number
          expected_lifetime_years: number | null
          expected_monthly_rent_increase_cents: number | null
          expected_value_increase_cents: number | null
          id: string
          name: string
          organization_id: string
          planned_end_date: string | null
          planned_start_date: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          property_id: string
          responsible_member_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          actual_cost_cents?: number
          actual_end_date?: string | null
          actual_start_date?: string | null
          archived_at?: string | null
          condition_rating?: number | null
          contingency_rate?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_cost_cents?: number
          expected_lifetime_years?: number | null
          expected_monthly_rent_increase_cents?: number | null
          expected_value_increase_cents?: number | null
          id?: string
          name: string
          organization_id: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          property_id: string
          responsible_member_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_cost_cents?: number
          actual_end_date?: string | null
          actual_start_date?: string | null
          archived_at?: string | null
          condition_rating?: number | null
          contingency_rate?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_cost_cents?: number
          expected_lifetime_years?: number | null
          expected_monthly_rent_increase_cents?: number | null
          expected_value_increase_cents?: number | null
          id?: string
          name?: string
          organization_id?: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          property_id?: string
          responsible_member_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renovation_projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renovation_projects_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renovation_projects_responsible_member_id_fkey"
            columns: ["responsible_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renovation_projects_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_claims: {
        Row: {
          amount_cents: number | null
          ancillary_cents: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          claim_month: string
          cold_rent_cents: number
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          lease_id: string
          notes: string | null
          organization_id: string
          other_cents: number
          paid_cents: number
          parking_cents: number
          rent_schedule_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_cents?: number | null
          ancillary_cents?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          claim_month: string
          cold_rent_cents?: number
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          lease_id: string
          notes?: string | null
          organization_id: string
          other_cents?: number
          paid_cents?: number
          parking_cents?: number
          rent_schedule_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number | null
          ancillary_cents?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          claim_month?: string
          cold_rent_cents?: number
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          lease_id?: string
          notes?: string | null
          organization_id?: string
          other_cents?: number
          paid_cents?: number
          parking_cents?: number
          rent_schedule_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_claims_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_claims_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_claims_rent_schedule_id_fkey"
            columns: ["rent_schedule_id"]
            isOneToOne: false
            referencedRelation: "rent_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_payments: {
        Row: {
          allocation_status: string
          amount_cents: number
          bank_transaction_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          paid_on: string
          rent_claim_id: string
          updated_at: string
        }
        Insert: {
          allocation_status?: string
          amount_cents: number
          bank_transaction_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          paid_on: string
          rent_claim_id: string
          updated_at?: string
        }
        Update: {
          allocation_status?: string
          amount_cents?: number
          bank_transaction_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          paid_on?: string
          rent_claim_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_payments_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_organization_claim_fkey"
            columns: ["organization_id", "rent_claim_id"]
            isOneToOne: false
            referencedRelation: "rent_claims"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "rent_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_rent_claim_id_fkey"
            columns: ["rent_claim_id"]
            isOneToOne: false
            referencedRelation: "rent_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_schedules: {
        Row: {
          ancillary_charge_type: string
          ancillary_prepayment_cents: number
          cold_rent_cents: number
          created_at: string
          created_by: string | null
          due_day: number
          id: string
          lease_id: string
          organization_id: string
          other_rent_cents: number
          parking_rent_cents: number
          reason: string | null
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          ancillary_charge_type?: string
          ancillary_prepayment_cents?: number
          cold_rent_cents: number
          created_at?: string
          created_by?: string | null
          due_day?: number
          id?: string
          lease_id: string
          organization_id: string
          other_rent_cents?: number
          parking_rent_cents?: number
          reason?: string | null
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          ancillary_charge_type?: string
          ancillary_prepayment_cents?: number
          cold_rent_cents?: number
          created_at?: string
          created_by?: string | null
          due_day?: number
          id?: string
          lease_id?: string
          organization_id?: string
          other_rent_cents?: number
          parking_rent_cents?: number
          reason?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rent_schedules_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived_at: string | null
          category: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          maintenance_request_id: string | null
          organization_id: string
          priority: Database["public"]["Enums"]["priority_level"]
          property_id: string | null
          recurrence_rule: string | null
          reminder_at: string | null
          responsible_member_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          tenant_id: string | null
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          maintenance_request_id?: string | null
          organization_id: string
          priority?: Database["public"]["Enums"]["priority_level"]
          property_id?: string | null
          recurrence_rule?: string | null
          reminder_at?: string | null
          responsible_member_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tenant_id?: string | null
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          maintenance_request_id?: string | null
          organization_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          property_id?: string | null
          recurrence_rule?: string | null
          reminder_at?: string | null
          responsible_member_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tenant_id?: string | null
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_responsible_member_id_fkey"
            columns: ["responsible_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_assumptions: {
        Row: {
          amount_cents: number | null
          assumption_key: string
          boolean_value: boolean | null
          created_at: string
          created_by: string | null
          explanation: string
          id: string
          is_user_confirmed: boolean
          numeric_value: number | null
          organization_id: string
          property_id: string | null
          source: string | null
          tax_year_id: string
          text_value: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number | null
          assumption_key: string
          boolean_value?: boolean | null
          created_at?: string
          created_by?: string | null
          explanation: string
          id?: string
          is_user_confirmed?: boolean
          numeric_value?: number | null
          organization_id: string
          property_id?: string | null
          source?: string | null
          tax_year_id: string
          text_value?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number | null
          assumption_key?: string
          boolean_value?: boolean | null
          created_at?: string
          created_by?: string | null
          explanation?: string
          id?: string
          is_user_confirmed?: boolean
          numeric_value?: number | null
          organization_id?: string
          property_id?: string | null
          source?: string | null
          tax_year_id?: string
          text_value?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_assumptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_assumptions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_assumptions_tax_year_id_fkey"
            columns: ["tax_year_id"]
            isOneToOne: false
            referencedRelation: "tax_years"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_calculation_snapshots: {
        Row: {
          assumed_tax_rate: number
          calculated_for_user_id: string | null
          calculation_input: Json
          calculation_version: string
          cashflow_after_tax_cents: number
          cashflow_before_tax_cents: number
          created_at: string
          created_by: string | null
          depreciation_cents: number
          disclaimer: string
          estimated_tax_effect_cents: number
          estimated_taxable_result_cents: number
          id: string
          interest_cents: number
          operating_expenses_cents: number
          organization_id: string
          other_deductible_cents: number
          period_end: string
          period_start: string
          property_id: string | null
          rental_income_cents: number
          tax_year_id: string
          updated_at: string
        }
        Insert: {
          assumed_tax_rate?: number
          calculated_for_user_id?: string | null
          calculation_input: Json
          calculation_version: string
          cashflow_after_tax_cents?: number
          cashflow_before_tax_cents?: number
          created_at?: string
          created_by?: string | null
          depreciation_cents?: number
          disclaimer: string
          estimated_tax_effect_cents?: number
          estimated_taxable_result_cents?: number
          id?: string
          interest_cents?: number
          operating_expenses_cents?: number
          organization_id: string
          other_deductible_cents?: number
          period_end: string
          period_start: string
          property_id?: string | null
          rental_income_cents?: number
          tax_year_id: string
          updated_at?: string
        }
        Update: {
          assumed_tax_rate?: number
          calculated_for_user_id?: string | null
          calculation_input?: Json
          calculation_version?: string
          cashflow_after_tax_cents?: number
          cashflow_before_tax_cents?: number
          created_at?: string
          created_by?: string | null
          depreciation_cents?: number
          disclaimer?: string
          estimated_tax_effect_cents?: number
          estimated_taxable_result_cents?: number
          id?: string
          interest_cents?: number
          operating_expenses_cents?: number
          organization_id?: string
          other_deductible_cents?: number
          period_end?: string
          period_start?: string
          property_id?: string | null
          rental_income_cents?: number
          tax_year_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_calculation_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_calculation_snapshots_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_calculation_snapshots_tax_year_id_fkey"
            columns: ["tax_year_id"]
            isOneToOne: false
            referencedRelation: "tax_years"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_profiles: {
        Row: {
          assessment_type: string
          assumed_taxable_income_cents: number | null
          calculation_mode: string
          calculations_enabled: boolean
          church_tax_enabled: boolean
          church_tax_rate: number | null
          created_at: string
          created_by: string | null
          disclaimer_accepted_at: string | null
          effective_tax_rate: number | null
          id: string
          marginal_tax_rate: number | null
          organization_id: string
          other_taxable_income_cents: number | null
          rental_inputs_confirmed_at: string | null
          solidarity_surcharge_enabled: boolean
          solidarity_surcharge_rate: number | null
          tariff_version: string | null
          tariff_year: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assessment_type?: string
          assumed_taxable_income_cents?: number | null
          calculation_mode?: string
          calculations_enabled?: boolean
          church_tax_enabled?: boolean
          church_tax_rate?: number | null
          created_at?: string
          created_by?: string | null
          disclaimer_accepted_at?: string | null
          effective_tax_rate?: number | null
          id?: string
          marginal_tax_rate?: number | null
          organization_id: string
          other_taxable_income_cents?: number | null
          rental_inputs_confirmed_at?: string | null
          solidarity_surcharge_enabled?: boolean
          solidarity_surcharge_rate?: number | null
          tariff_version?: string | null
          tariff_year?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assessment_type?: string
          assumed_taxable_income_cents?: number | null
          calculation_mode?: string
          calculations_enabled?: boolean
          church_tax_enabled?: boolean
          church_tax_rate?: number | null
          created_at?: string
          created_by?: string | null
          disclaimer_accepted_at?: string | null
          effective_tax_rate?: number | null
          id?: string
          marginal_tax_rate?: number | null
          organization_id?: string
          other_taxable_income_cents?: number | null
          rental_inputs_confirmed_at?: string | null
          solidarity_surcharge_enabled?: boolean
          solidarity_surcharge_rate?: number | null
          tariff_version?: string | null
          tariff_year?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_years: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          organization_id: string
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          organization_id: string
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          organization_id?: string
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_years_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_internal_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string
          organization_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes: string
          organization_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string
          organization_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_internal_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_internal_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          organization_id: string
          tenant_id: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          organization_id: string
          tenant_id: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          organization_id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          archived_at: string | null
          city: string | null
          company_name: string | null
          country_code: string
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string | null
          house_number: string | null
          id: string
          last_name: string | null
          organization_id: string
          phone: string | null
          postal_code: string | null
          status: Database["public"]["Enums"]["record_status"]
          street: string | null
          tenant_type: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          city?: string | null
          company_name?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          house_number?: string | null
          id?: string
          last_name?: string | null
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          street?: string | null
          tenant_type?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          city?: string | null
          company_name?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          house_number?: string | null
          id?: string
          last_name?: string | null
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          street?: string | null
          tenant_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_matches: {
        Row: {
          bank_transaction_id: string
          confidence: number | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          expense_entry_id: string | null
          explanation: string
          id: string
          income_entry_id: string | null
          organization_id: string
          rejected_at: string | null
          rejected_by: string | null
          rent_claim_id: string | null
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
        }
        Insert: {
          bank_transaction_id: string
          confidence?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          expense_entry_id?: string | null
          explanation: string
          id?: string
          income_entry_id?: string | null
          organization_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          rent_claim_id?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
        }
        Update: {
          bank_transaction_id?: string
          confidence?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          expense_entry_id?: string | null
          explanation?: string
          id?: string
          income_entry_id?: string | null
          organization_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rent_claim_id?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_matches_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_matches_expense_entry_id_fkey"
            columns: ["expense_entry_id"]
            isOneToOne: false
            referencedRelation: "expense_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_matches_income_entry_id_fkey"
            columns: ["income_entry_id"]
            isOneToOne: false
            referencedRelation: "income_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_matches_rent_claim_id_fkey"
            columns: ["rent_claim_id"]
            isOneToOne: false
            referencedRelation: "rent_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          address_addition: string | null
          ancillary_charge_type: string
          ancillary_prepayment_cents: number
          archived_at: string | null
          area_sqm: number | null
          created_at: string
          created_by: string | null
          deposit_target_cents: number
          floor: string | null
          id: string
          organization_id: string
          other_rent_cents: number
          parking_rent_cents: number
          property_id: string
          rooms: number | null
          status: string
          target_cold_rent_cents: number
          unit_number: string
          unit_type: string
          updated_at: string
          vacancy_since: string | null
        }
        Insert: {
          address_addition?: string | null
          ancillary_charge_type?: string
          ancillary_prepayment_cents?: number
          archived_at?: string | null
          area_sqm?: number | null
          created_at?: string
          created_by?: string | null
          deposit_target_cents?: number
          floor?: string | null
          id?: string
          organization_id: string
          other_rent_cents?: number
          parking_rent_cents?: number
          property_id: string
          rooms?: number | null
          status?: string
          target_cold_rent_cents?: number
          unit_number: string
          unit_type?: string
          updated_at?: string
          vacancy_since?: string | null
        }
        Update: {
          address_addition?: string | null
          ancillary_charge_type?: string
          ancillary_prepayment_cents?: number
          archived_at?: string | null
          area_sqm?: number | null
          created_at?: string
          created_by?: string | null
          deposit_target_cents?: number
          floor?: string | null
          id?: string
          organization_id?: string
          other_rent_cents?: number
          parking_rent_cents?: number
          property_id?: string
          rooms?: number | null
          status?: string
          target_cold_rent_cents?: number
          unit_number?: string
          unit_type?: string
          updated_at?: string
          vacancy_since?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      valuations: {
        Row: {
          assumptions: Json
          confidence: number | null
          created_at: string
          created_by: string | null
          early_repayment_cost_cents: number | null
          expected_sale_cost_cents: number | null
          gross_yield: number | null
          id: string
          market_value_cents: number
          net_yield: number | null
          organization_id: string
          property_id: string
          source_name: string | null
          source_type: string
          source_url: string | null
          updated_at: string
          valued_on: string
        }
        Insert: {
          assumptions?: Json
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          early_repayment_cost_cents?: number | null
          expected_sale_cost_cents?: number | null
          gross_yield?: number | null
          id?: string
          market_value_cents: number
          net_yield?: number | null
          organization_id: string
          property_id: string
          source_name?: string | null
          source_type: string
          source_url?: string | null
          updated_at?: string
          valued_on: string
        }
        Update: {
          assumptions?: Json
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          early_repayment_cost_cents?: number | null
          expected_sale_cost_cents?: number | null
          gross_yield?: number | null
          id?: string
          market_value_cents?: number
          net_yield?: number | null
          organization_id?: string
          property_id?: string
          source_name?: string | null
          source_type?: string
          source_url?: string | null
          updated_at?: string
          valued_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "valuations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { raw_token: string }; Returns: string }
      cancel_organization_deletion: {
        Args: { p_organization_id: string; p_request_id: string }
        Returns: boolean
      }
      cancel_rent_claim: {
        Args: { p_reason: string; p_rent_claim_id: string }
        Returns: string
      }
      complete_onboarding: { Args: { p_payload: Json }; Returns: string }
      complete_onboarding_v2: {
        Args: { p_legacy_payload: Json; p_payload: Json }
        Returns: string
      }
      confirm_transaction_match: {
        Args: { p_match_id: string }
        Returns: string
      }
      create_organization_with_owner: {
        Args: {
          p_address: Json
          p_currency?: string
          p_name: string
          p_organization_type: string
          p_tax_year?: number
        }
        Returns: string
      }
      create_staff_tenant_conversation: {
        Args: {
          p_body: string
          p_category: string
          p_lease_id: string
          p_organization_id: string
          p_priority: Database["public"]["Enums"]["priority_level"]
          p_subject: string
        }
        Returns: string
      }
      create_tenant_lease: {
        Args: { p_organization_id: string; p_payload: Json }
        Returns: Json
      }
      create_tenant_portal_conversation: {
        Args: {
          p_body: string
          p_category: string
          p_lease_id: string
          p_organization_id: string
          p_subject: string
        }
        Returns: string
      }
      create_tenant_portal_maintenance_request: {
        Args: {
          p_category: string
          p_description: string
          p_lease_id: string
          p_organization_id: string
          p_title: string
        }
        Returns: string
      }
      create_valuation: {
        Args: {
          p_market_value_cents: number
          p_organization_id: string
          p_property_id: string
          p_source_name: string
          p_source_type: string
          p_valued_on: string
        }
        Returns: string
      }
      finalize_onboarding_v2: {
        Args: { p_organization_id: string; p_payload: Json }
        Returns: string
      }
      generate_monthly_rent_claims: {
        Args: { p_organization_id: string; p_period: string }
        Returns: number
      }
      get_tenant_portal_context: {
        Args: { p_organization_id: string }
        Returns: {
          ancillary_prepayment_cents: number
          cold_rent_cents: number
          lease_ends_on: string
          lease_id: string
          lease_starts_on: string
          lease_status: string
          occupancy_ends_on: string
          occupancy_starts_on: string
          other_rent_cents: number
          parking_rent_cents: number
          property_city: string
          property_house_number: string
          property_id: string
          property_name: string
          property_postal_code: string
          property_street: string
          tenant_id: string
          unit_id: string
          unit_number: string
        }[]
      }
      reply_staff_conversation: {
        Args: {
          p_body: string
          p_conversation_id: string
          p_internal_note?: boolean
          p_organization_id: string
        }
        Returns: string
      }
      reply_tenant_portal_conversation: {
        Args: {
          p_body: string
          p_conversation_id: string
          p_organization_id: string
        }
        Returns: string
      }
      request_organization_deletion: {
        Args: { p_organization_id: string; p_organization_name: string }
        Returns: string
      }
      resume_portfolio_onboarding: {
        Args: { p_organization_id: string; p_payload: Json }
        Returns: string
      }
      resume_portfolio_onboarding_v2: {
        Args: {
          p_legacy_payload: Json
          p_organization_id: string
          p_payload: Json
        }
        Returns: string
      }
      review_document_expense: {
        Args: {
          p_document_id: string
          p_organization_id: string
          p_payload: Json
        }
        Returns: string
      }
      seed_demo_organization: {
        Args: { p_organization_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "property_manager"
        | "accounting"
        | "employee"
        | "tenant"
      document_review_status:
        | "complete"
        | "missing"
        | "unreadable"
        | "unclear_assignment"
        | "review_required"
        | "reviewed"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      match_status: "unmatched" | "suggested" | "confirmed" | "rejected"
      membership_status: "invited" | "active" | "suspended"
      organization_kind: "private_person" | "company"
      payment_status: "open" | "partial" | "paid" | "overpaid" | "cancelled"
      priority_level: "low" | "medium" | "high" | "urgent"
      record_status: "draft" | "active" | "inactive" | "archived"
      sync_status: "pending" | "running" | "succeeded" | "failed" | "partial"
      task_status: "open" | "in_progress" | "blocked" | "done" | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "owner",
        "admin",
        "property_manager",
        "accounting",
        "employee",
        "tenant",
      ],
      document_review_status: [
        "complete",
        "missing",
        "unreadable",
        "unclear_assignment",
        "review_required",
        "reviewed",
      ],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      match_status: ["unmatched", "suggested", "confirmed", "rejected"],
      membership_status: ["invited", "active", "suspended"],
      organization_kind: ["private_person", "company"],
      payment_status: ["open", "partial", "paid", "overpaid", "cancelled"],
      priority_level: ["low", "medium", "high", "urgent"],
      record_status: ["draft", "active", "inactive", "archived"],
      sync_status: ["pending", "running", "succeeded", "failed", "partial"],
      task_status: ["open", "in_progress", "blocked", "done", "cancelled"],
    },
  },
} as const
