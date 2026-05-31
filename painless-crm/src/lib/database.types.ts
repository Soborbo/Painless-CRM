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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          after: Json | null
          before: Json | null
          company_id: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          after?: Json | null
          before?: Json | null
          company_id: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          city: string
          company_id: string
          country: string
          created_at: string
          dedup_key: string | null
          deleted_at: string | null
          geocoded_at: string | null
          id: string
          latitude: number | null
          line1: string
          line2: string | null
          longitude: number | null
          postcode: string
          updated_at: string
          version: number
        }
        Insert: {
          city: string
          company_id: string
          country?: string
          created_at?: string
          dedup_key?: string | null
          deleted_at?: string | null
          geocoded_at?: string | null
          id?: string
          latitude?: number | null
          line1: string
          line2?: string | null
          longitude?: number | null
          postcode: string
          updated_at?: string
          version?: number
        }
        Update: {
          city?: string
          company_id?: string
          country?: string
          created_at?: string
          dedup_key?: string | null
          deleted_at?: string | null
          geocoded_at?: string | null
          id?: string
          latitude?: number | null
          line1?: string
          line2?: string | null
          longitude?: number | null
          postcode?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_codes: {
        Row: {
          active: boolean | null
          affiliate_id: string
          code: string
          company_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          active?: boolean | null
          affiliate_id: string
          code: string
          company_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          active?: boolean | null
          affiliate_id?: string
          code?: string
          company_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_codes_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          active: boolean | null
          address_id: string | null
          commission_config: Json | null
          commission_type: string | null
          commission_value: number | null
          company_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          type: string | null
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean | null
          address_id?: string | null
          commission_config?: Json | null
          commission_type?: string | null
          commission_value?: number | null
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          type?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean | null
          address_id?: string | null
          commission_config?: Json | null
          commission_type?: string | null
          commission_value?: number | null
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          type?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      attributions: {
        Row: {
          affiliate_code: string | null
          affiliate_id: string | null
          attributed_at: string | null
          campaign: string | null
          company_id: string
          customer_id: string | null
          fbclid: string | null
          gclid: string | null
          id: string
          job_id: string | null
          landing_page: string | null
          source: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          affiliate_code?: string | null
          affiliate_id?: string | null
          attributed_at?: string | null
          campaign?: string | null
          company_id: string
          customer_id?: string | null
          fbclid?: string | null
          gclid?: string | null
          id?: string
          job_id?: string | null
          landing_page?: string | null
          source?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          affiliate_code?: string | null
          affiliate_id?: string | null
          attributed_at?: string | null
          campaign?: string | null
          company_id?: string
          customer_id?: string | null
          fbclid?: string | null
          gclid?: string | null
          id?: string
          job_id?: string | null
          landing_page?: string | null
          source?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attributions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_queue: {
        Row: {
          company_id: string
          created_at: string | null
          error_message: string | null
          id: string
          payload: Json | null
          processed_at: string | null
          result: string | null
          rule_id: string
          scheduled_for: string
          trigger_event: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          result?: string | null
          rule_id: string
          scheduled_for: string
          trigger_event: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          result?: string | null
          rule_id?: string
          scheduled_for?: string
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_queue_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_config: Json
          action_type: string | null
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by_id: string | null
          delay_seconds: number | null
          id: string
          last_run_at: string | null
          name: string
          run_count: number | null
          trigger_event: string
          trigger_filters: Json | null
        }
        Insert: {
          action_config: Json
          action_type?: string | null
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by_id?: string | null
          delay_seconds?: number | null
          id?: string
          last_run_at?: string | null
          name: string
          run_count?: number | null
          trigger_event: string
          trigger_filters?: Json | null
        }
        Update: {
          action_config?: Json
          action_type?: string | null
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by_id?: string | null
          delay_seconds?: number | null
          id?: string
          last_run_at?: string | null
          name?: string
          run_count?: number | null
          trigger_event?: string
          trigger_filters?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_overrides: {
        Row: {
          applied_at: string | null
          applied_by_id: string | null
          company_id: string
          date: string
          forced_band: string | null
          id: string
          reason: string
        }
        Insert: {
          applied_at?: string | null
          applied_by_id?: string | null
          company_id: string
          date: string
          forced_band?: string | null
          id?: string
          reason: string
        }
        Update: {
          applied_at?: string | null
          applied_by_id?: string | null
          company_id?: string
          date?: string
          forced_band?: string | null
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "capacity_overrides_applied_by_id_fkey"
            columns: ["applied_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_overrides_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_records: {
        Row: {
          affiliate_id: string
          amount_pence: number
          approved_at: string | null
          company_id: string
          created_at: string | null
          id: string
          invoice_id: string | null
          job_id: string
          paid_at: string | null
          status: string | null
        }
        Insert: {
          affiliate_id: string
          amount_pence: number
          approved_at?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          job_id: string
          paid_at?: string | null
          status?: string | null
        }
        Update: {
          affiliate_id?: string
          amount_pence?: number
          approved_at?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          job_id?: string
          paid_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_records_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_records_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_records_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      complaints: {
        Row: {
          assigned_to_id: string | null
          company_id: string
          created_at: string | null
          customer_id: string
          deleted_at: string | null
          description: string
          escalated_at: string | null
          id: string
          job_id: string
          resolution_notes: string | null
          resolved_at: string | null
          severity: string | null
          severity_self_assessed: string | null
          sla_first_response_at: string | null
          sla_first_response_due_at: string | null
          source: string | null
          status: string | null
          updated_at: string
          version: number
        }
        Insert: {
          assigned_to_id?: string | null
          company_id: string
          created_at?: string | null
          customer_id: string
          deleted_at?: string | null
          description: string
          escalated_at?: string | null
          id?: string
          job_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string | null
          severity_self_assessed?: string | null
          sla_first_response_at?: string | null
          sla_first_response_due_at?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          assigned_to_id?: string | null
          company_id?: string
          created_at?: string | null
          customer_id?: string
          deleted_at?: string | null
          description?: string
          escalated_at?: string | null
          id?: string
          job_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string | null
          severity_self_assessed?: string | null
          sla_first_response_at?: string | null
          sla_first_response_due_at?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "complaints_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cubic_sheet_items: {
        Row: {
          company_id: string
          cubic_ft_each: number
          cubic_ft_total: number | null
          dismantle_required: boolean | null
          fragile: boolean | null
          id: string
          item: string
          notes: string | null
          quantity: number | null
          room: string | null
          survey_id: string
        }
        Insert: {
          company_id: string
          cubic_ft_each: number
          cubic_ft_total?: number | null
          dismantle_required?: boolean | null
          fragile?: boolean | null
          id?: string
          item: string
          notes?: string | null
          quantity?: number | null
          room?: string | null
          survey_id: string
        }
        Update: {
          company_id?: string
          cubic_ft_each?: number
          cubic_ft_total?: number | null
          dismantle_required?: boolean | null
          fragile?: boolean | null
          id?: string
          item?: string
          notes?: string | null
          quantity?: number | null
          room?: string | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cubic_sheet_items_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_consents: {
        Row: {
          company_id: string
          consent_state: boolean
          consent_type: string
          customer_id: string
          id: string
          ip_address: unknown
          recorded_at: string
          source_url: string | null
          user_agent: string | null
        }
        Insert: {
          company_id: string
          consent_state: boolean
          consent_type: string
          customer_id: string
          id?: string
          ip_address?: unknown
          recorded_at?: string
          source_url?: string | null
          user_agent?: string | null
        }
        Update: {
          company_id?: string
          consent_state?: boolean
          consent_type?: string
          customer_id?: string
          id?: string
          ip_address?: unknown
          recorded_at?: string
          source_url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_consents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_consents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          is_billing: boolean | null
          is_primary: boolean | null
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_billing?: boolean | null
          is_primary?: boolean | null
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_billing?: boolean | null
          is_primary?: boolean | null
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_relationships: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          from_customer_id: string
          id: string
          notes: string | null
          relationship_type: string
          to_customer_id: string
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          from_customer_id: string
          id?: string
          notes?: string | null
          relationship_type: string
          to_customer_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          from_customer_id?: string
          id?: string
          notes?: string | null
          relationship_type?: string
          to_customer_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_relationships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_relationships_from_customer_id_fkey"
            columns: ["from_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_relationships_to_customer_id_fkey"
            columns: ["to_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_signoffs: {
        Row: {
          collected_by_worker_id: string | null
          company_id: string
          customer_email_confirmed_at: string | null
          customer_id: string
          deleted_at: string | null
          device_lat: number | null
          device_lng: number | null
          feedback_text: string | null
          id: string
          internal_rating_1_5: number | null
          ip_address: unknown
          job_id: string
          satisfaction_score: number | null
          signature_data_url: string
          signed_at: string | null
          updated_at: string
          user_agent: string | null
          version: number
        }
        Insert: {
          collected_by_worker_id?: string | null
          company_id: string
          customer_email_confirmed_at?: string | null
          customer_id: string
          deleted_at?: string | null
          device_lat?: number | null
          device_lng?: number | null
          feedback_text?: string | null
          id?: string
          internal_rating_1_5?: number | null
          ip_address?: unknown
          job_id: string
          satisfaction_score?: number | null
          signature_data_url: string
          signed_at?: string | null
          updated_at?: string
          user_agent?: string | null
          version?: number
        }
        Update: {
          collected_by_worker_id?: string | null
          company_id?: string
          customer_email_confirmed_at?: string | null
          customer_id?: string
          deleted_at?: string | null
          device_lat?: number | null
          device_lng?: number | null
          feedback_text?: string | null
          id?: string
          internal_rating_1_5?: number | null
          ip_address?: unknown
          job_id?: string
          satisfaction_score?: number | null
          signature_data_url?: string
          signed_at?: string | null
          updated_at?: string
          user_agent?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_signoffs_collected_by_worker_id_fkey"
            columns: ["collected_by_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_signoffs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_signoffs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          acquisition_campaign: string | null
          acquisition_source: string | null
          affiliate_id: string | null
          company_id: string
          company_name: string | null
          created_at: string
          created_by_id: string | null
          customer_type: string
          date_of_birth: string | null
          deleted_at: string | null
          first_contact_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
          marketing_consent: boolean | null
          marketing_consent_at: string | null
          notes: string | null
          payment_terms_days: number | null
          primary_address_id: string | null
          primary_email: string | null
          primary_phone: string | null
          updated_at: string
          updated_by_id: string | null
          vat_number: string | null
          version: number
        }
        Insert: {
          acquisition_campaign?: string | null
          acquisition_source?: string | null
          affiliate_id?: string | null
          company_id: string
          company_name?: string | null
          created_at?: string
          created_by_id?: string | null
          customer_type: string
          date_of_birth?: string | null
          deleted_at?: string | null
          first_contact_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          marketing_consent?: boolean | null
          marketing_consent_at?: string | null
          notes?: string | null
          payment_terms_days?: number | null
          primary_address_id?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          updated_at?: string
          updated_by_id?: string | null
          vat_number?: string | null
          version?: number
        }
        Update: {
          acquisition_campaign?: string | null
          acquisition_source?: string | null
          affiliate_id?: string | null
          company_id?: string
          company_name?: string | null
          created_at?: string
          created_by_id?: string | null
          customer_type?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          first_contact_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          marketing_consent?: boolean | null
          marketing_consent_at?: string | null
          notes?: string | null
          payment_terms_days?: number | null
          primary_address_id?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          updated_at?: string
          updated_by_id?: string | null
          vat_number?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "customers_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_primary_address_id_fkey"
            columns: ["primary_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_updated_by_id_fkey"
            columns: ["updated_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      damage_claims: {
        Row: {
          auto_escalated: boolean | null
          company_id: string
          created_at: string | null
          deleted_at: string | null
          description: string
          estimated_value_pence: number | null
          id: string
          insurance_claim_ref: string | null
          job_id: string
          payout_pence: number | null
          photos: Json | null
          repeat_claim_flag: boolean | null
          reported_by_customer: boolean | null
          reported_by_worker_id: string | null
          resolved_at: string | null
          status: string | null
          updated_at: string
          version: number
        }
        Insert: {
          auto_escalated?: boolean | null
          company_id: string
          created_at?: string | null
          deleted_at?: string | null
          description: string
          estimated_value_pence?: number | null
          id?: string
          insurance_claim_ref?: string | null
          job_id: string
          payout_pence?: number | null
          photos?: Json | null
          repeat_claim_flag?: boolean | null
          reported_by_customer?: boolean | null
          reported_by_worker_id?: string | null
          resolved_at?: string | null
          status?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          auto_escalated?: boolean | null
          company_id?: string
          created_at?: string | null
          deleted_at?: string | null
          description?: string
          estimated_value_pence?: number | null
          id?: string
          insurance_claim_ref?: string | null
          job_id?: string
          payout_pence?: number | null
          photos?: Json | null
          repeat_claim_flag?: boolean | null
          reported_by_customer?: boolean | null
          reported_by_worker_id?: string | null
          resolved_at?: string | null
          status?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "damage_claims_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_claims_reported_by_worker_id_fkey"
            columns: ["reported_by_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      data_export_log: {
        Row: {
          company_id: string
          exported_at: string
          exported_by_id: string | null
          filters: Json
          format: string
          id: number
          ip_address: unknown
          resource: string
          row_count: number
          user_agent: string | null
        }
        Insert: {
          company_id: string
          exported_at?: string
          exported_by_id?: string | null
          filters?: Json
          format?: string
          id?: number
          ip_address?: unknown
          resource: string
          row_count: number
          user_agent?: string | null
        }
        Update: {
          company_id?: string
          exported_at?: string
          exported_by_id?: string | null
          filters?: Json
          format?: string
          id?: number
          ip_address?: unknown
          resource?: string
          row_count?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_export_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_export_log_exported_by_id_fkey"
            columns: ["exported_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_debit_mandates: {
        Row: {
          account_holder_name: string | null
          account_last4: string | null
          bank_name: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          company_id: string
          customer_id: string
          deleted_at: string | null
          gocardless_mandate_id: string
          id: string
          set_up_at: string | null
          status: string | null
          storage_rental_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          account_holder_name?: string | null
          account_last4?: string | null
          bank_name?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          company_id: string
          customer_id: string
          deleted_at?: string | null
          gocardless_mandate_id: string
          id?: string
          set_up_at?: string | null
          status?: string | null
          storage_rental_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          account_holder_name?: string | null
          account_last4?: string | null
          bank_name?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          company_id?: string
          customer_id?: string
          deleted_at?: string | null
          gocardless_mandate_id?: string
          id?: string
          set_up_at?: string | null
          status?: string | null
          storage_rental_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "direct_debit_mandates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_debit_mandates_storage_rental_id_fkey"
            columns: ["storage_rental_id"]
            isOneToOne: false
            referencedRelation: "storage_rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          company_id: string
          deleted_at: string | null
          document_type: string
          expires_at: string | null
          file_name: string
          file_size_bytes: number
          id: string
          is_customer_visible: boolean
          mime_type: string
          notes: string | null
          parent_customer_id: string | null
          parent_invoice_id: string | null
          parent_job_id: string | null
          parent_quote_id: string | null
          sha256: string | null
          storage_path: string
          uploaded_at: string
          uploaded_by_customer: boolean
          uploaded_by_id: string | null
          version: number
        }
        Insert: {
          company_id: string
          deleted_at?: string | null
          document_type: string
          expires_at?: string | null
          file_name: string
          file_size_bytes: number
          id?: string
          is_customer_visible?: boolean
          mime_type: string
          notes?: string | null
          parent_customer_id?: string | null
          parent_invoice_id?: string | null
          parent_job_id?: string | null
          parent_quote_id?: string | null
          sha256?: string | null
          storage_path: string
          uploaded_at?: string
          uploaded_by_customer?: boolean
          uploaded_by_id?: string | null
          version?: number
        }
        Update: {
          company_id?: string
          deleted_at?: string | null
          document_type?: string
          expires_at?: string | null
          file_name?: string
          file_size_bytes?: number
          id?: string
          is_customer_visible?: boolean
          mime_type?: string
          notes?: string | null
          parent_customer_id?: string | null
          parent_invoice_id?: string | null
          parent_job_id?: string | null
          parent_quote_id?: string | null
          sha256?: string | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by_customer?: boolean
          uploaded_by_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_parent_customer_id_fkey"
            columns: ["parent_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_parent_quote_id_fkey"
            columns: ["parent_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_id_fkey"
            columns: ["uploaded_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          active: boolean | null
          body_html_template: string | null
          body_template: string
          category: string | null
          company_id: string
          created_at: string | null
          created_by_id: string | null
          id: string
          name: string
          subject_template: string
          updated_at: string | null
          variables_schema: Json | null
        }
        Insert: {
          active?: boolean | null
          body_html_template?: string | null
          body_template: string
          category?: string | null
          company_id: string
          created_at?: string | null
          created_by_id?: string | null
          id?: string
          name: string
          subject_template: string
          updated_at?: string | null
          variables_schema?: Json | null
        }
        Update: {
          active?: boolean | null
          body_html_template?: string | null
          body_template?: string
          category?: string | null
          company_id?: string
          created_at?: string | null
          created_by_id?: string | null
          id?: string
          name?: string
          subject_template?: string
          updated_at?: string | null
          variables_schema?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credential_access_log: {
        Row: {
          accessed_at: string | null
          accessed_by_id: string | null
          company_id: string
          credential_id: string
          id: number
          ip_address: unknown
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string | null
          accessed_by_id?: string | null
          company_id: string
          credential_id: string
          id?: number
          ip_address?: unknown
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string | null
          accessed_by_id?: string | null
          company_id?: string
          credential_id?: string
          id?: number
          ip_address?: unknown
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_credential_access_log_accessed_by_id_fkey"
            columns: ["accessed_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_credential_access_log_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "integration_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          access_token_encrypted: string | null
          company_id: string
          connected_at: string | null
          connected_by_id: string | null
          created_at: string | null
          deleted_at: string | null
          disconnected_at: string | null
          disconnected_reason: string | null
          expires_at: string | null
          external_account_id: string | null
          external_account_name: string | null
          id: string
          last_refresh_at: string | null
          last_used_at: string | null
          metadata: Json | null
          provider: string
          refresh_failure_count: number
          refresh_token_encrypted: string | null
          scopes: string[] | null
          status: string
          updated_at: string | null
          version: number
        }
        Insert: {
          access_token_encrypted?: string | null
          company_id: string
          connected_at?: string | null
          connected_by_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          disconnected_at?: string | null
          disconnected_reason?: string | null
          expires_at?: string | null
          external_account_id?: string | null
          external_account_name?: string | null
          id?: string
          last_refresh_at?: string | null
          last_used_at?: string | null
          metadata?: Json | null
          provider: string
          refresh_failure_count?: number
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          status?: string
          updated_at?: string | null
          version?: number
        }
        Update: {
          access_token_encrypted?: string | null
          company_id?: string
          connected_at?: string | null
          connected_by_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          disconnected_at?: string | null
          disconnected_reason?: string | null
          expires_at?: string | null
          external_account_id?: string | null
          external_account_name?: string | null
          id?: string
          last_refresh_at?: string | null
          last_used_at?: string | null
          metadata?: Json | null
          provider?: string
          refresh_failure_count?: number
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          status?: string
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_credentials_connected_by_id_fkey"
            columns: ["connected_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          company_id: string
          deleted_at: string | null
          description: string
          id: string
          invoice_id: string
          line_total_pence: number
          quantity: number
          sort_order: number | null
          unit_price_pence: number
          updated_at: string
          vat_rate: number | null
          version: number
        }
        Insert: {
          company_id: string
          deleted_at?: string | null
          description: string
          id?: string
          invoice_id: string
          line_total_pence: number
          quantity?: number
          sort_order?: number | null
          unit_price_pence: number
          updated_at?: string
          vat_rate?: number | null
          version?: number
        }
        Update: {
          company_id?: string
          deleted_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          line_total_pence?: number
          quantity?: number
          sort_order?: number | null
          unit_price_pence?: number
          updated_at?: string
          vat_rate?: number | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_outstanding_pence: number | null
          amount_paid_pence: number | null
          company_id: string
          created_at: string | null
          created_by_id: string | null
          customer_id: string
          deleted_at: string | null
          due_at: string | null
          email_message_id: string | null
          email_opened_at: string | null
          email_sent_at: string | null
          id: string
          invoice_number: string
          issued_at: string | null
          job_id: string | null
          status: string | null
          storage_rental_id: string | null
          subtotal_pence: number
          total_pence: number
          type: string | null
          updated_at: string | null
          vat_pence: number
          version: number | null
          xero_id: string | null
          xero_sync_error: string | null
          xero_synced_at: string | null
        }
        Insert: {
          amount_outstanding_pence?: number | null
          amount_paid_pence?: number | null
          company_id: string
          created_at?: string | null
          created_by_id?: string | null
          customer_id: string
          deleted_at?: string | null
          due_at?: string | null
          email_message_id?: string | null
          email_opened_at?: string | null
          email_sent_at?: string | null
          id?: string
          invoice_number: string
          issued_at?: string | null
          job_id?: string | null
          status?: string | null
          storage_rental_id?: string | null
          subtotal_pence: number
          total_pence: number
          type?: string | null
          updated_at?: string | null
          vat_pence?: number
          version?: number | null
          xero_id?: string | null
          xero_sync_error?: string | null
          xero_synced_at?: string | null
        }
        Update: {
          amount_outstanding_pence?: number | null
          amount_paid_pence?: number | null
          company_id?: string
          created_at?: string | null
          created_by_id?: string | null
          customer_id?: string
          deleted_at?: string | null
          due_at?: string | null
          email_message_id?: string | null
          email_opened_at?: string | null
          email_sent_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string | null
          job_id?: string | null
          status?: string | null
          storage_rental_id?: string | null
          subtotal_pence?: number
          total_pence?: number
          type?: string | null
          updated_at?: string | null
          vat_pence?: number
          version?: number | null
          xero_id?: string | null
          xero_sync_error?: string | null
          xero_synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_storage_rental_id_fkey"
            columns: ["storage_rental_id"]
            isOneToOne: false
            referencedRelation: "storage_rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      job_addresses: {
        Row: {
          access_notes: string | null
          address_id: string
          company_id: string
          deleted_at: string | null
          floor: number | null
          has_lift: boolean | null
          has_parking: boolean | null
          id: string
          job_id: string
          property_type: string | null
          role: string
          sequence: number | null
          updated_at: string
          version: number
        }
        Insert: {
          access_notes?: string | null
          address_id: string
          company_id: string
          deleted_at?: string | null
          floor?: number | null
          has_lift?: boolean | null
          has_parking?: boolean | null
          id?: string
          job_id: string
          property_type?: string | null
          role: string
          sequence?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          access_notes?: string | null
          address_id?: string
          company_id?: string
          deleted_at?: string | null
          floor?: number | null
          has_lift?: boolean | null
          has_parking?: boolean | null
          id?: string
          job_id?: string
          property_type?: string | null
          role?: string
          sequence?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_addresses_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_addresses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assignments: {
        Row: {
          company_id: string
          created_at: string | null
          date: string
          deleted_at: string | null
          id: string
          job_id: string
          notes: string | null
          role: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          updated_at: string
          vehicle_id: string | null
          version: number
          worker_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          date: string
          deleted_at?: string | null
          id?: string
          job_id: string
          notes?: string | null
          role?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          updated_at?: string
          vehicle_id?: string | null
          version?: number
          worker_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          date?: string
          deleted_at?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          role?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          updated_at?: string
          vehicle_id?: string | null
          version?: number
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      job_sheets: {
        Row: {
          actual_cubic_ft: number | null
          actual_hours: number
          company_id: string
          complications_encountered: string | null
          customer_satisfaction_score: number | null
          damage_details: string | null
          damage_reported: boolean | null
          deleted_at: string | null
          id: string
          job_id: string
          materials_used: Json | null
          submitted_at: string | null
          updated_at: string
          version: number
          worker_id: string
        }
        Insert: {
          actual_cubic_ft?: number | null
          actual_hours: number
          company_id: string
          complications_encountered?: string | null
          customer_satisfaction_score?: number | null
          damage_details?: string | null
          damage_reported?: boolean | null
          deleted_at?: string | null
          id?: string
          job_id: string
          materials_used?: Json | null
          submitted_at?: string | null
          updated_at?: string
          version?: number
          worker_id: string
        }
        Update: {
          actual_cubic_ft?: number | null
          actual_hours?: number
          company_id?: string
          complications_encountered?: string | null
          customer_satisfaction_score?: number | null
          damage_details?: string | null
          damage_reported?: boolean | null
          deleted_at?: string | null
          id?: string
          job_id?: string
          materials_used?: Json | null
          submitted_at?: string | null
          updated_at?: string
          version?: number
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_sheets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheets_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      job_status_history: {
        Row: {
          changed_at: string
          changed_by_id: string | null
          company_id: string
          from_stage: Database["public"]["Enums"]["job_stage"] | null
          from_sub_status: string | null
          id: string
          job_id: string
          reason: string | null
          to_stage: Database["public"]["Enums"]["job_stage"]
          to_sub_status: string | null
        }
        Insert: {
          changed_at?: string
          changed_by_id?: string | null
          company_id: string
          from_stage?: Database["public"]["Enums"]["job_stage"] | null
          from_sub_status?: string | null
          id?: string
          job_id: string
          reason?: string | null
          to_stage: Database["public"]["Enums"]["job_stage"]
          to_sub_status?: string | null
        }
        Update: {
          changed_at?: string
          changed_by_id?: string | null
          company_id?: string
          from_stage?: Database["public"]["Enums"]["job_stage"] | null
          from_sub_status?: string | null
          id?: string
          job_id?: string
          reason?: string | null
          to_stage?: Database["public"]["Enums"]["job_stage"]
          to_sub_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_status_history_changed_by_id_fkey"
            columns: ["changed_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_status_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_tags: {
        Row: {
          added_at: string
          added_by_id: string | null
          company_id: string
          id: string
          job_id: string
          tag: string
        }
        Insert: {
          added_at?: string
          added_by_id?: string | null
          company_id: string
          id?: string
          job_id: string
          tag: string
        }
        Update: {
          added_at?: string
          added_by_id?: string | null
          company_id?: string
          id?: string
          job_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_tags_added_by_id_fkey"
            columns: ["added_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_tags_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          accepted_at: string | null
          acquisition_source: string | null
          actual_crew_cost_pence: number | null
          actual_van_cost_pence: number | null
          affiliate_id: string | null
          assigned_to_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          company_id: string
          completed_at: string | null
          confirmed_at: string | null
          contacted_at: string | null
          created_at: string
          created_by_id: string | null
          customer_id: string
          dead_at: string | null
          decline_reason: string | null
          declined_at: string | null
          deleted_at: string | null
          deposit_refund_decision: string | null
          enquiry_at: string | null
          estimated_cubic_ft: number | null
          estimated_distance_miles: number | null
          estimated_hours: number | null
          first_response_at: string | null
          first_response_due_at: string | null
          id: string
          in_progress_at: string | null
          invoiced_at: string | null
          job_number: string
          move_date: string | null
          notes: string | null
          paid_at: string | null
          parent_job_id: string | null
          passthrough_costs_pence: number | null
          primary_contact_id: string | null
          profit_review_completed_at: string | null
          profit_review_completed_by_id: string | null
          profit_review_status: string
          quote_total_pence: number | null
          quoted_at: string | null
          stage: Database["public"]["Enums"]["job_stage"]
          sub_status: string | null
          survey_at: string | null
          surveyor_id: string | null
          updated_at: string
          updated_by_id: string | null
          version: number
        }
        Insert: {
          accepted_at?: string | null
          acquisition_source?: string | null
          actual_crew_cost_pence?: number | null
          actual_van_cost_pence?: number | null
          affiliate_id?: string | null
          assigned_to_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          company_id: string
          completed_at?: string | null
          confirmed_at?: string | null
          contacted_at?: string | null
          created_at?: string
          created_by_id?: string | null
          customer_id: string
          dead_at?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          deleted_at?: string | null
          deposit_refund_decision?: string | null
          enquiry_at?: string | null
          estimated_cubic_ft?: number | null
          estimated_distance_miles?: number | null
          estimated_hours?: number | null
          first_response_at?: string | null
          first_response_due_at?: string | null
          id?: string
          in_progress_at?: string | null
          invoiced_at?: string | null
          job_number: string
          move_date?: string | null
          notes?: string | null
          paid_at?: string | null
          parent_job_id?: string | null
          passthrough_costs_pence?: number | null
          primary_contact_id?: string | null
          profit_review_completed_at?: string | null
          profit_review_completed_by_id?: string | null
          profit_review_status?: string
          quote_total_pence?: number | null
          quoted_at?: string | null
          stage?: Database["public"]["Enums"]["job_stage"]
          sub_status?: string | null
          survey_at?: string | null
          surveyor_id?: string | null
          updated_at?: string
          updated_by_id?: string | null
          version?: number
        }
        Update: {
          accepted_at?: string | null
          acquisition_source?: string | null
          actual_crew_cost_pence?: number | null
          actual_van_cost_pence?: number | null
          affiliate_id?: string | null
          assigned_to_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          company_id?: string
          completed_at?: string | null
          confirmed_at?: string | null
          contacted_at?: string | null
          created_at?: string
          created_by_id?: string | null
          customer_id?: string
          dead_at?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          deleted_at?: string | null
          deposit_refund_decision?: string | null
          enquiry_at?: string | null
          estimated_cubic_ft?: number | null
          estimated_distance_miles?: number | null
          estimated_hours?: number | null
          first_response_at?: string | null
          first_response_due_at?: string | null
          id?: string
          in_progress_at?: string | null
          invoiced_at?: string | null
          job_number?: string
          move_date?: string | null
          notes?: string | null
          paid_at?: string | null
          parent_job_id?: string | null
          passthrough_costs_pence?: number | null
          primary_contact_id?: string | null
          profit_review_completed_at?: string | null
          profit_review_completed_by_id?: string | null
          profit_review_status?: string
          quote_total_pence?: number | null
          quoted_at?: string | null
          stage?: Database["public"]["Enums"]["job_stage"]
          sub_status?: string | null
          survey_at?: string | null
          surveyor_id?: string | null
          updated_at?: string
          updated_by_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "jobs_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_profit_review_completed_by_id_fkey"
            columns: ["profit_review_completed_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_surveyor_id_fkey"
            columns: ["surveyor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_updated_by_id_fkey"
            columns: ["updated_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          body_html: string | null
          channel: string | null
          company_id: string
          created_at: string | null
          customer_id: string | null
          delivered_at: string | null
          direction: string | null
          from_address: string | null
          id: string
          in_reply_to_message_id: string | null
          job_id: string | null
          opened_at: string | null
          provider: string | null
          provider_message_id: string | null
          raw_payload: Json | null
          replied_at: string | null
          sent_at: string | null
          sent_by_user_id: string | null
          status: string | null
          subject: string | null
          template_id: string | null
          thread_id: string | null
          to_address: string | null
        }
        Insert: {
          body: string
          body_html?: string | null
          channel?: string | null
          company_id: string
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          direction?: string | null
          from_address?: string | null
          id?: string
          in_reply_to_message_id?: string | null
          job_id?: string | null
          opened_at?: string | null
          provider?: string | null
          provider_message_id?: string | null
          raw_payload?: Json | null
          replied_at?: string | null
          sent_at?: string | null
          sent_by_user_id?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
          thread_id?: string | null
          to_address?: string | null
        }
        Update: {
          body?: string
          body_html?: string | null
          channel?: string | null
          company_id?: string
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          direction?: string | null
          from_address?: string | null
          id?: string
          in_reply_to_message_id?: string | null
          job_id?: string | null
          opened_at?: string | null
          provider?: string | null
          provider_message_id?: string | null
          raw_payload?: Json | null
          replied_at?: string | null
          sent_at?: string | null
          sent_by_user_id?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
          thread_id?: string | null
          to_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_in_reply_to_message_id_fkey"
            columns: ["in_reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sent_by_user_id_fkey"
            columns: ["sent_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string
          body_html: string | null
          category: string | null
          company_id: string
          created_at: string | null
          created_by_id: string | null
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_customer_visible: boolean
          mentions: string[] | null
          parent_id: string
          parent_type: string | null
          pinned: boolean | null
          updated_at: string
          version: number
        }
        Insert: {
          body: string
          body_html?: string | null
          category?: string | null
          company_id: string
          created_at?: string | null
          created_by_id?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_customer_visible?: boolean
          mentions?: string[] | null
          parent_id: string
          parent_type?: string | null
          pinned?: boolean | null
          updated_at?: string
          version?: number
        }
        Update: {
          body?: string
          body_html?: string | null
          category?: string | null
          company_id?: string
          created_at?: string | null
          created_by_id?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_customer_visible?: boolean
          mentions?: string[] | null
          parent_id?: string
          parent_type?: string | null
          pinned?: boolean | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notes_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channels: Json | null
          company_id: string
          email_digest_enabled: boolean | null
          email_digest_time: string | null
          push_enabled: boolean | null
          push_subscriptions: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channels?: Json | null
          company_id: string
          email_digest_enabled?: boolean | null
          email_digest_time?: string | null
          push_enabled?: boolean | null
          push_subscriptions?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channels?: Json | null
          company_id?: string
          email_digest_enabled?: boolean | null
          email_digest_time?: string | null
          push_enabled?: boolean | null
          push_subscriptions?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          company_id: string
          created_at: string | null
          delivered_channels: string[] | null
          id: string
          link_url: string | null
          priority: string | null
          read_at: string | null
          recipient_user_id: string
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string | null
          delivered_channels?: string[] | null
          id?: string
          link_url?: string | null
          priority?: string | null
          read_at?: string | null
          recipient_user_id: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string | null
          delivered_channels?: string[] | null
          id?: string
          link_url?: string | null
          priority?: string | null
          read_at?: string | null
          recipient_user_id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      offline_conversion_uploads: {
        Row: {
          click_id: string | null
          company_id: string
          conversion_currency: string | null
          conversion_type: string | null
          conversion_value_pence: number
          created_at: string | null
          id: string
          job_id: string
          network: string | null
          retry_count: number | null
          upload_response: Json | null
          upload_status: string | null
          uploaded_at: string | null
        }
        Insert: {
          click_id?: string | null
          company_id: string
          conversion_currency?: string | null
          conversion_type?: string | null
          conversion_value_pence: number
          created_at?: string | null
          id?: string
          job_id: string
          network?: string | null
          retry_count?: number | null
          upload_response?: Json | null
          upload_status?: string | null
          uploaded_at?: string | null
        }
        Update: {
          click_id?: string | null
          company_id?: string
          conversion_currency?: string | null
          conversion_type?: string | null
          conversion_value_pence?: number
          created_at?: string | null
          id?: string
          job_id?: string
          network?: string | null
          retry_count?: number | null
          upload_response?: Json | null
          upload_status?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offline_conversion_uploads_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          allocated_at: string
          allocated_by_id: string | null
          allocation_type: string
          amount_pence: number
          company_id: string
          created_at: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          payment_id: string
          reverses_allocation_id: string | null
        }
        Insert: {
          allocated_at?: string
          allocated_by_id?: string | null
          allocation_type: string
          amount_pence: number
          company_id: string
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_id: string
          reverses_allocation_id?: string | null
        }
        Update: {
          allocated_at?: string
          allocated_by_id?: string | null
          allocation_type?: string
          amount_pence?: number
          company_id?: string
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_id?: string
          reverses_allocation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_allocated_by_id_fkey"
            columns: ["allocated_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_reverses_allocation_id_fkey"
            columns: ["reverses_allocation_id"]
            isOneToOne: false
            referencedRelation: "payment_allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_pence: number
          company_id: string
          created_at: string | null
          created_by_id: string | null
          customer_id: string
          deleted_at: string | null
          id: string
          method: string | null
          notes: string | null
          occurred_at: string
          reference: string | null
          source: string | null
          updated_at: string | null
          updated_by_id: string | null
          version: number
          xero_id: string | null
        }
        Insert: {
          amount_pence: number
          company_id: string
          created_at?: string | null
          created_by_id?: string | null
          customer_id: string
          deleted_at?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          occurred_at: string
          reference?: string | null
          source?: string | null
          updated_at?: string | null
          updated_by_id?: string | null
          version?: number
          xero_id?: string | null
        }
        Update: {
          amount_pence?: number
          company_id?: string
          created_at?: string | null
          created_by_id?: string | null
          customer_id?: string
          deleted_at?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          occurred_at?: string
          reference?: string | null
          source?: string | null
          updated_at?: string | null
          updated_by_id?: string | null
          version?: number
          xero_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_updated_by_id_fkey"
            columns: ["updated_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_calls: {
        Row: {
          called_number: string | null
          caller_number: string | null
          company_id: string
          created_at: string | null
          customer_id: string | null
          direction: string | null
          duration_seconds: number | null
          id: string
          job_id: string | null
          next_action: string | null
          next_action_completed_at: string | null
          next_action_completed_by_id: string | null
          next_action_due_at: string | null
          notes: string | null
          occurred_at: string
          outcome: string | null
          recording_url: string | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          called_number?: string | null
          caller_number?: string | null
          company_id: string
          created_at?: string | null
          customer_id?: string | null
          direction?: string | null
          duration_seconds?: number | null
          id?: string
          job_id?: string | null
          next_action?: string | null
          next_action_completed_at?: string | null
          next_action_completed_by_id?: string | null
          next_action_due_at?: string | null
          notes?: string | null
          occurred_at: string
          outcome?: string | null
          recording_url?: string | null
          source?: string | null
          user_id?: string | null
        }
        Update: {
          called_number?: string | null
          caller_number?: string | null
          company_id?: string
          created_at?: string | null
          customer_id?: string | null
          direction?: string | null
          duration_seconds?: number | null
          id?: string
          job_id?: string | null
          next_action?: string | null
          next_action_completed_at?: string | null
          next_action_completed_by_id?: string | null
          next_action_due_at?: string | null
          notes?: string | null
          occurred_at?: string
          outcome?: string | null
          recording_url?: string | null
          source?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_calls_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_calls_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          category: string | null
          company_id: string
          deleted_at: string | null
          id: string
          job_id: string
          notes: string | null
          taken_at: string | null
          thumbnail_url: string | null
          updated_at: string
          uploaded_at: string | null
          uploaded_by_user_id: string | null
          uploaded_by_worker_id: string | null
          url: string
          version: number
        }
        Insert: {
          category?: string | null
          company_id: string
          deleted_at?: string | null
          id?: string
          job_id: string
          notes?: string | null
          taken_at?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by_user_id?: string | null
          uploaded_by_worker_id?: string | null
          url: string
          version?: number
        }
        Update: {
          category?: string | null
          company_id?: string
          deleted_at?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          taken_at?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by_user_id?: string | null
          uploaded_by_worker_id?: string | null
          url?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_uploaded_by_worker_id_fkey"
            columns: ["uploaded_by_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      presence: {
        Row: {
          company_id: string
          entity_id: string
          entity_type: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          entity_id: string
          entity_type: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          entity_id?: string
          entity_type?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presence_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_versions: {
        Row: {
          capacity_bands: Json | null
          company_id: string
          complications: Json
          created_at: string
          created_by_id: string | null
          crew_hourly_rate_pence: number
          deleted_at: string | null
          distance_bands: Json
          dynamic_pricing_enabled: boolean | null
          effective_from: string
          effective_to: string | null
          id: string
          margin_matrix: Json
          modulation_sources: string[] | null
          notes: string | null
          pass_through_config: Json
          quote_validity_days: number | null
          size_categories: Json
          updated_at: string
          van_hourly_rate_pence: number
          version: number
          version_label: string
        }
        Insert: {
          capacity_bands?: Json | null
          company_id: string
          complications: Json
          created_at?: string
          created_by_id?: string | null
          crew_hourly_rate_pence: number
          deleted_at?: string | null
          distance_bands: Json
          dynamic_pricing_enabled?: boolean | null
          effective_from: string
          effective_to?: string | null
          id?: string
          margin_matrix: Json
          modulation_sources?: string[] | null
          notes?: string | null
          pass_through_config: Json
          quote_validity_days?: number | null
          size_categories: Json
          updated_at?: string
          van_hourly_rate_pence: number
          version?: number
          version_label: string
        }
        Update: {
          capacity_bands?: Json | null
          company_id?: string
          complications?: Json
          created_at?: string
          created_by_id?: string | null
          crew_hourly_rate_pence?: number
          deleted_at?: string | null
          distance_bands?: Json
          dynamic_pricing_enabled?: boolean | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          margin_matrix?: Json
          modulation_sources?: string[] | null
          notes?: string | null
          pass_through_config?: Json
          quote_validity_days?: number | null
          size_categories?: Json
          updated_at?: string
          van_hourly_rate_pence?: number
          version?: number
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_versions_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_acceptances: {
        Row: {
          acceptance_token: string
          accepted_at: string
          company_id: string
          consents: Json | null
          customer_id: string
          id: string
          ip_address: unknown
          notes: string | null
          quote_id: string
          signature_image_url: string | null
          user_agent: string | null
          variant_id: string | null
        }
        Insert: {
          acceptance_token: string
          accepted_at?: string
          company_id: string
          consents?: Json | null
          customer_id: string
          id?: string
          ip_address: unknown
          notes?: string | null
          quote_id: string
          signature_image_url?: string | null
          user_agent?: string | null
          variant_id?: string | null
        }
        Update: {
          acceptance_token?: string
          accepted_at?: string
          company_id?: string
          consents?: Json | null
          customer_id?: string
          id?: string
          ip_address?: unknown
          notes?: string | null
          quote_id?: string
          signature_image_url?: string | null
          user_agent?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_acceptances_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_acceptances_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_acceptances_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "quote_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_variants: {
        Row: {
          company_id: string
          description: string | null
          display_order: number | null
          id: string
          quote_id: string
          total_pence: number
          variant_label: string
        }
        Insert: {
          company_id: string
          description?: string | null
          display_order?: number | null
          id?: string
          quote_id: string
          total_pence: number
          variant_label: string
        }
        Update: {
          company_id?: string
          description?: string | null
          display_order?: number | null
          id?: string
          quote_id?: string
          total_pence?: number
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_variants_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          breakdown: Json | null
          company_id: string
          complications: string[] | null
          created_at: string
          created_by_id: string | null
          deleted_at: string | null
          distance_miles: number | null
          id: string
          job_id: string
          notes: string | null
          pdf_url: string | null
          pricing_snapshot: Json
          pricing_version_id: string
          sent_at: string | null
          size_code: string | null
          status: string | null
          total_pence: number
          updated_at: string
          valid_until: string
          version: number
        }
        Insert: {
          breakdown?: Json | null
          company_id: string
          complications?: string[] | null
          created_at?: string
          created_by_id?: string | null
          deleted_at?: string | null
          distance_miles?: number | null
          id?: string
          job_id: string
          notes?: string | null
          pdf_url?: string | null
          pricing_snapshot: Json
          pricing_version_id: string
          sent_at?: string | null
          size_code?: string | null
          status?: string | null
          total_pence: number
          updated_at?: string
          valid_until: string
          version?: number
        }
        Update: {
          breakdown?: Json | null
          company_id?: string
          complications?: string[] | null
          created_at?: string
          created_by_id?: string | null
          deleted_at?: string | null
          distance_miles?: number | null
          id?: string
          job_id?: string
          notes?: string | null
          pdf_url?: string | null
          pricing_snapshot?: Json
          pricing_version_id?: string
          sent_at?: string | null
          size_code?: string | null
          status?: string | null
          total_pence?: number
          updated_at?: string
          valid_until?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_pricing_version_id_fkey"
            columns: ["pricing_version_id"]
            isOneToOne: false
            referencedRelation: "pricing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      review_requests: {
        Row: {
          channel: string | null
          clicked_at: string | null
          company_id: string
          complaints_link_clicked_at: string | null
          customer_id: string
          deleted_at: string | null
          followup_count: number
          google_review_link_clicked_at: string | null
          id: string
          internal_rating_1_5: number | null
          nudge_count: number | null
          responded_at: string | null
          review_left_at: string | null
          review_url: string | null
          sent_at: string | null
          signoff_id: string
          status: string | null
          updated_at: string
          version: number
        }
        Insert: {
          channel?: string | null
          clicked_at?: string | null
          company_id: string
          complaints_link_clicked_at?: string | null
          customer_id: string
          deleted_at?: string | null
          followup_count?: number
          google_review_link_clicked_at?: string | null
          id?: string
          internal_rating_1_5?: number | null
          nudge_count?: number | null
          responded_at?: string | null
          review_left_at?: string | null
          review_url?: string | null
          sent_at?: string | null
          signoff_id: string
          status?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          channel?: string | null
          clicked_at?: string | null
          company_id?: string
          complaints_link_clicked_at?: string | null
          customer_id?: string
          deleted_at?: string | null
          followup_count?: number
          google_review_link_clicked_at?: string | null
          id?: string
          internal_rating_1_5?: number | null
          nudge_count?: number | null
          responded_at?: string | null
          review_left_at?: string | null
          review_url?: string | null
          sent_at?: string | null
          signoff_id?: string
          status?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_signoff_id_fkey"
            columns: ["signoff_id"]
            isOneToOne: false
            referencedRelation: "customer_signoffs"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          brand_color: string | null
          business_hours: Json | null
          company_id: string
          default_currency: string | null
          default_deposit_percent: number | null
          default_locale: string | null
          default_quote_validity_days: number | null
          default_timezone: string | null
          deleted_at: string | null
          feature_flags: Json | null
          ico_registration: string | null
          logo_url: string | null
          updated_at: string
          vat_number: string | null
          version: number
        }
        Insert: {
          brand_color?: string | null
          business_hours?: Json | null
          company_id: string
          default_currency?: string | null
          default_deposit_percent?: number | null
          default_locale?: string | null
          default_quote_validity_days?: number | null
          default_timezone?: string | null
          deleted_at?: string | null
          feature_flags?: Json | null
          ico_registration?: string | null
          logo_url?: string | null
          updated_at?: string
          vat_number?: string | null
          version?: number
        }
        Update: {
          brand_color?: string | null
          business_hours?: Json | null
          company_id?: string
          default_currency?: string | null
          default_deposit_percent?: number | null
          default_locale?: string | null
          default_quote_validity_days?: number | null
          default_timezone?: string | null
          deleted_at?: string | null
          feature_flags?: Json | null
          ico_registration?: string | null
          logo_url?: string | null
          updated_at?: string
          vat_number?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          active: boolean | null
          body_template: string
          company_id: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          body_template: string
          company_id: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          body_template?: string
          company_id?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      storage_containers: {
        Row: {
          company_id: string
          container_code: string
          deleted_at: string | null
          id: string
          monthly_rate_pence: number
          notes: string | null
          size_cubic_ft: number | null
          status: string | null
          storage_site_id: string
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          container_code: string
          deleted_at?: string | null
          id?: string
          monthly_rate_pence: number
          notes?: string | null
          size_cubic_ft?: number | null
          status?: string | null
          storage_site_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          container_code?: string
          deleted_at?: string | null
          id?: string
          monthly_rate_pence?: number
          notes?: string | null
          size_cubic_ft?: number | null
          status?: string | null
          storage_site_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "storage_containers_storage_site_id_fkey"
            columns: ["storage_site_id"]
            isOneToOne: false
            referencedRelation: "storage_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_rentals: {
        Row: {
          company_id: string
          created_at: string | null
          customer_id: string
          deleted_at: string | null
          end_date: string | null
          id: string
          monthly_rate_pence: number
          notes: string | null
          start_date: string
          status: string | null
          storage_container_id: string
          updated_at: string | null
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string | null
          customer_id: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          monthly_rate_pence: number
          notes?: string | null
          start_date: string
          status?: string | null
          storage_container_id: string
          updated_at?: string | null
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string | null
          customer_id?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          monthly_rate_pence?: number
          notes?: string | null
          start_date?: string
          status?: string | null
          storage_container_id?: string
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "storage_rentals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_rentals_storage_container_id_fkey"
            columns: ["storage_container_id"]
            isOneToOne: false
            referencedRelation: "storage_containers"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_sites: {
        Row: {
          active: boolean | null
          address_id: string
          company_id: string
          created_at: string | null
          id: string
          name: string
          notes: string | null
          total_containers: number | null
        }
        Insert: {
          active?: boolean | null
          address_id: string
          company_id: string
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          total_containers?: number | null
        }
        Update: {
          active?: boolean | null
          address_id?: string
          company_id?: string
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          total_containers?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "storage_sites_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_sites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          ai_analysis: Json | null
          company_id: string
          completed_at: string | null
          complications: Json | null
          created_at: string | null
          cubic_ft_ai_estimate: number | null
          cubic_ft_confidence: string | null
          cubic_ft_estimate: number | null
          deleted_at: string | null
          id: string
          job_id: string
          notes_for_customer: string | null
          notes_internal: string | null
          scheduled_at: string | null
          source_video_url: string | null
          survey_type: string | null
          surveyor_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          ai_analysis?: Json | null
          company_id: string
          completed_at?: string | null
          complications?: Json | null
          created_at?: string | null
          cubic_ft_ai_estimate?: number | null
          cubic_ft_confidence?: string | null
          cubic_ft_estimate?: number | null
          deleted_at?: string | null
          id?: string
          job_id: string
          notes_for_customer?: string | null
          notes_internal?: string | null
          scheduled_at?: string | null
          source_video_url?: string | null
          survey_type?: string | null
          surveyor_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          ai_analysis?: Json | null
          company_id?: string
          completed_at?: string | null
          complications?: Json | null
          created_at?: string | null
          cubic_ft_ai_estimate?: number | null
          cubic_ft_confidence?: string | null
          cubic_ft_estimate?: number | null
          deleted_at?: string | null
          id?: string
          job_id?: string
          notes_for_customer?: string | null
          notes_internal?: string | null
          scheduled_at?: string | null
          source_video_url?: string | null
          survey_type?: string | null
          surveyor_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "surveys_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_surveyor_id_fkey"
            columns: ["surveyor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          company_id: string
          created_at: string | null
          deleted_at: string | null
          distance_from_job_address_m: number | null
          flagged: boolean | null
          gps_accuracy_m: number | null
          gps_lat: number | null
          gps_lng: number | null
          id: string
          job_id: string
          notes: string | null
          occurred_at: string
          type: string | null
          updated_at: string
          version: number
          worker_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          deleted_at?: string | null
          distance_from_job_address_m?: number | null
          flagged?: boolean | null
          gps_accuracy_m?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          job_id: string
          notes?: string | null
          occurred_at: string
          type?: string | null
          updated_at?: string
          version?: number
          worker_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          deleted_at?: string | null
          distance_from_job_address_m?: number | null
          flagged?: boolean | null
          gps_accuracy_m?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          job_id?: string
          notes?: string | null
          occurred_at?: string
          type?: string | null
          updated_at?: string
          version?: number
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by_id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by_id: string
          role: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_invited_by_id_fkey"
            columns: ["invited_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active: boolean
          auth_id: string
          company_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_id: string
          company_id: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          role: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_id?: string
          company_id?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_assignments: {
        Row: {
          company_id: string
          created_at: string | null
          daily_reviewer_id: string | null
          date: string
          driver_id: string | null
          id: string
          notes: string | null
          vehicle_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          daily_reviewer_id?: string | null
          date: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          vehicle_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          daily_reviewer_id?: string | null
          date?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_assignments_daily_reviewer_id_fkey"
            columns: ["daily_reviewer_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_checks: {
        Row: {
          company_id: string
          dashboard_photo_url: string | null
          date: string
          defects_noted: string | null
          deleted_at: string | null
          fuel_level: number | null
          id: string
          job_id: string | null
          mileage: number | null
          signature_data_url: string | null
          submitted_at: string | null
          updated_at: string
          vehicle_id: string
          version: number
          walk_around_clear: boolean | null
          worker_id: string
        }
        Insert: {
          company_id: string
          dashboard_photo_url?: string | null
          date: string
          defects_noted?: string | null
          deleted_at?: string | null
          fuel_level?: number | null
          id?: string
          job_id?: string | null
          mileage?: number | null
          signature_data_url?: string | null
          submitted_at?: string | null
          updated_at?: string
          vehicle_id: string
          version?: number
          walk_around_clear?: boolean | null
          worker_id: string
        }
        Update: {
          company_id?: string
          dashboard_photo_url?: string | null
          date?: string
          defects_noted?: string | null
          deleted_at?: string | null
          fuel_level?: number | null
          id?: string
          job_id?: string | null
          mileage?: number | null
          signature_data_url?: string | null
          submitted_at?: string | null
          updated_at?: string
          vehicle_id?: string
          version?: number
          walk_around_clear?: boolean | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_checks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_checks_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_checks_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean | null
          capacity_cubic_ft: number | null
          company_id: string
          compliance_alerts_enabled: boolean | null
          created_at: string
          deleted_at: string | null
          id: string
          insurance_due: string | null
          monthly_cost_pence: number | null
          mot_due: string | null
          next_service_due: string | null
          registration: string
          tax_due: string | null
          type: string | null
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean | null
          capacity_cubic_ft?: number | null
          company_id: string
          compliance_alerts_enabled?: boolean | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          insurance_due?: string | null
          monthly_cost_pence?: number | null
          mot_due?: string | null
          next_service_due?: string | null
          registration: string
          tax_due?: string | null
          type?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean | null
          capacity_cubic_ft?: number | null
          company_id?: string
          compliance_alerts_enabled?: boolean | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          insurance_due?: string | null
          monthly_cost_pence?: number | null
          mot_due?: string | null
          next_service_due?: string | null
          registration?: string
          tax_due?: string | null
          type?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          company_id: string | null
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          received_at: string | null
          result: string | null
          source: string
        }
        Insert: {
          company_id?: string | null
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          received_at?: string | null
          result?: string | null
          source: string
        }
        Update: {
          company_id?: string | null
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string | null
          result?: string | null
          source?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          body_template: string
          category: string | null
          company_id: string
          created_at: string | null
          id: string
          language: string | null
          meta_template_id: string | null
          meta_template_status: string | null
          name: string
          variables_schema: Json | null
        }
        Insert: {
          body_template: string
          category?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          language?: string | null
          meta_template_id?: string | null
          meta_template_status?: string | null
          name: string
          variables_schema?: Json | null
        }
        Update: {
          body_template?: string
          category?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          language?: string | null
          meta_template_id?: string | null
          meta_template_status?: string | null
          name?: string
          variables_schema?: Json | null
        }
        Relationships: []
      }
      worker_availability: {
        Row: {
          available: boolean
          company_id: string
          date: string
          id: string
          notes: string | null
          submitted_at: string | null
          worker_id: string
        }
        Insert: {
          available: boolean
          company_id: string
          date: string
          id?: string
          notes?: string | null
          submitted_at?: string | null
          worker_id: string
        }
        Update: {
          available?: boolean
          company_id?: string
          date?: string
          id?: string
          notes?: string | null
          submitted_at?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_availability_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string
          hourly_rate_pence: number | null
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
          version: number
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name: string
          hourly_rate_pence?: number | null
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          hourly_rate_pence?: number | null
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      payments_with_balance: {
        Row: {
          amount_pence: number | null
          company_id: string | null
          created_at: string | null
          created_by_id: string | null
          customer_id: string | null
          deleted_at: string | null
          id: string | null
          method: string | null
          notes: string | null
          occurred_at: string | null
          reference: string | null
          source: string | null
          unallocated_pence: number | null
          updated_at: string | null
          updated_by_id: string | null
          version: number | null
          xero_id: string | null
        }
        Insert: {
          amount_pence?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by_id?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          id?: string | null
          method?: string | null
          notes?: string | null
          occurred_at?: string | null
          reference?: string | null
          source?: string | null
          unallocated_pence?: never
          updated_at?: string | null
          updated_by_id?: string | null
          version?: number | null
          xero_id?: string | null
        }
        Update: {
          amount_pence?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by_id?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          id?: string | null
          method?: string | null
          notes?: string | null
          occurred_at?: string | null
          reference?: string | null
          source?: string | null
          unallocated_pence?: never
          updated_at?: string | null
          updated_by_id?: string | null
          version?: number | null
          xero_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_updated_by_id_fkey"
            columns: ["updated_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_user_company_id: { Args: never; Returns: string }
      customer_lifetime_value: {
        Args: { p_customer_id: string }
        Returns: number
      }
      find_duplicate_candidates: {
        Args: { p_email?: string; p_phone?: string; p_postcode?: string }
        Returns: {
          acquisition_campaign: string | null
          acquisition_source: string | null
          affiliate_id: string | null
          company_id: string
          company_name: string | null
          created_at: string
          created_by_id: string | null
          customer_type: string
          date_of_birth: string | null
          deleted_at: string | null
          first_contact_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
          marketing_consent: boolean | null
          marketing_consent_at: string | null
          notes: string | null
          payment_terms_days: number | null
          primary_address_id: string | null
          primary_email: string | null
          primary_phone: string | null
          updated_at: string
          updated_by_id: string | null
          vat_number: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      job_stage:
        | "lead"
        | "contacted"
        | "survey_scheduled"
        | "quoted"
        | "accepted"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "invoiced"
        | "paid"
        | "declined"
        | "dead"
        | "cancelled"
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
      job_stage: [
        "lead",
        "contacted",
        "survey_scheduled",
        "quoted",
        "accepted",
        "confirmed",
        "in_progress",
        "completed",
        "invoiced",
        "paid",
        "declined",
        "dead",
        "cancelled",
      ],
    },
  },
} as const

