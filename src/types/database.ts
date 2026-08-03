export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type JobStatus = 'found' | 'interested' | 'dismissed'
export type ApplicationStatus =
  | 'interested'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'closed'
export type OutreachType = 'initial' | 'follow_up_1' | 'follow_up_2'
export type OutreachStatus = 'drafted' | 'sent' | 'skipped'
export type JobSource =
  | 'indeed'
  | 'ziprecruiter'
  | 'manual'
  | 'adzuna'
  | 'linkedin'
  | 'remoteok'
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'smartrecruiters'
export type OpportunityType =
  | 'job_lead'
  | 'contract'
  | 'freelance'
  | 'productized_service'
  | 'outreach'
  | 'recruiting'
  | 'marketplace'
export type OpportunityStatus =
  | 'active'
  | 'in_progress'
  | 'won'
  | 'dismissed'
  | 'expired'
export type DiscoveryLifecycleStatus = 'open' | 'unverified' | 'closed' | 'expired'
export type RemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown'

export type Database = {
  job_search: {
    Tables: {
      applications: {
        Row: {
          applied_at: string | null
          cover_note: string | null
          id: string
          job_id: string
          notes: string | null
          resume_version_id: string | null
          status: ApplicationStatus
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          cover_note?: string | null
          id?: string
          job_id: string
          notes?: string | null
          resume_version_id?: string | null
          status?: ApplicationStatus
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          cover_note?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          resume_version_id?: string | null
          status?: ApplicationStatus
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "canonical_job_sources"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "job_discovery_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      company_job_sources: {
        Row: {
          active_job_count: number
          api_base_url: string | null
          board_key: string
          careers_url: string | null
          company_id: string
          consecutive_failures: number
          created_at: string
          enabled: boolean
          etag: string | null
          id: string
          last_checked_at: string | null
          last_error: string | null
          last_error_at: string | null
          last_modified: string | null
          last_success_at: string | null
          metadata: Json
          poll_interval_minutes: number
          priority: number
          provider: string
          updated_at: string
        }
        Insert: {
          active_job_count?: number
          api_base_url?: string | null
          board_key: string
          careers_url?: string | null
          company_id: string
          consecutive_failures?: number
          created_at?: string
          enabled?: boolean
          etag?: string | null
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_modified?: string | null
          last_success_at?: string | null
          metadata?: Json
          poll_interval_minutes?: number
          priority?: number
          provider: string
          updated_at?: string
        }
        Update: {
          active_job_count?: number
          api_base_url?: string | null
          board_key?: string
          careers_url?: string | null
          company_id?: string
          consecutive_failures?: number
          created_at?: string
          enabled?: boolean
          etag?: string | null
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_modified?: string | null
          last_success_at?: string | null
          metadata?: Json
          poll_interval_minutes?: number
          priority?: number
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_job_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          id: string
          linkedin_url: string | null
          name: string
          source: string | null
          title: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          linkedin_url?: string | null
          name: string
          source?: string | null
          title?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          linkedin_url?: string | null
          name?: string
          source?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_run_steps: {
        Row: {
          company_job_source_id: string | null
          cursor: string | null
          discovery_run_id: string
          error: string | null
          http_status: number | null
          id: string
          merged_postings: number
          metadata: Json
          new_jobs: number
          page_number: number | null
          provider: string
          rate_limit_remaining: number | null
          request_finished_at: string | null
          request_started_at: string
          results_received: number
          retry_after_seconds: number | null
          search_profile_id: string | null
          search_profile_query_id: string | null
          status: string
          updated_jobs: number
        }
        Insert: {
          company_job_source_id?: string | null
          cursor?: string | null
          discovery_run_id: string
          error?: string | null
          http_status?: number | null
          id?: string
          merged_postings?: number
          metadata?: Json
          new_jobs?: number
          page_number?: number | null
          provider: string
          rate_limit_remaining?: number | null
          request_finished_at?: string | null
          request_started_at?: string
          results_received?: number
          retry_after_seconds?: number | null
          search_profile_id?: string | null
          search_profile_query_id?: string | null
          status?: string
          updated_jobs?: number
        }
        Update: {
          company_job_source_id?: string | null
          cursor?: string | null
          discovery_run_id?: string
          error?: string | null
          http_status?: number | null
          id?: string
          merged_postings?: number
          metadata?: Json
          new_jobs?: number
          page_number?: number | null
          provider?: string
          rate_limit_remaining?: number | null
          request_finished_at?: string | null
          request_started_at?: string
          results_received?: number
          retry_after_seconds?: number | null
          search_profile_id?: string | null
          search_profile_query_id?: string | null
          status?: string
          updated_jobs?: number
        }
        Relationships: [
          {
            foreignKeyName: "discovery_run_steps_company_job_source_id_fkey"
            columns: ["company_job_source_id"]
            isOneToOne: false
            referencedRelation: "company_job_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_run_steps_company_job_source_id_fkey"
            columns: ["company_job_source_id"]
            isOneToOne: false
            referencedRelation: "source_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_run_steps_discovery_run_id_fkey"
            columns: ["discovery_run_id"]
            isOneToOne: false
            referencedRelation: "discovery_run_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_run_steps_discovery_run_id_fkey"
            columns: ["discovery_run_id"]
            isOneToOne: false
            referencedRelation: "discovery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_run_steps_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "discovery_profile_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_run_steps_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "search_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_run_steps_search_profile_query_id_fkey"
            columns: ["search_profile_query_id"]
            isOneToOne: false
            referencedRelation: "search_profile_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_runs: {
        Row: {
          budget_snapshot: Json
          canonical_jobs_created: number
          canonical_jobs_updated: number
          created_at: string
          error_summary: string | null
          errors_count: number
          finished_at: string | null
          id: string
          jobs_closed: number
          jobs_reopened: number
          postings_fetched: number
          postings_merged: number
          providers_attempted: string[]
          requested_profile_id: string | null
          requests_used: number
          started_at: string
          status: string
          summary: Json
          trigger_type: string
        }
        Insert: {
          budget_snapshot?: Json
          canonical_jobs_created?: number
          canonical_jobs_updated?: number
          created_at?: string
          error_summary?: string | null
          errors_count?: number
          finished_at?: string | null
          id?: string
          jobs_closed?: number
          jobs_reopened?: number
          postings_fetched?: number
          postings_merged?: number
          providers_attempted?: string[]
          requested_profile_id?: string | null
          requests_used?: number
          started_at?: string
          status?: string
          summary?: Json
          trigger_type?: string
        }
        Update: {
          budget_snapshot?: Json
          canonical_jobs_created?: number
          canonical_jobs_updated?: number
          created_at?: string
          error_summary?: string | null
          errors_count?: number
          finished_at?: string | null
          id?: string
          jobs_closed?: number
          jobs_reopened?: number
          postings_fetched?: number
          postings_merged?: number
          providers_attempted?: string[]
          requested_profile_id?: string | null
          requests_used?: number
          started_at?: string
          status?: string
          summary?: Json
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_runs_requested_profile_id_fkey"
            columns: ["requested_profile_id"]
            isOneToOne: false
            referencedRelation: "discovery_profile_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_runs_requested_profile_id_fkey"
            columns: ["requested_profile_id"]
            isOneToOne: false
            referencedRelation: "search_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_scores: {
        Row: {
          application_effort_score: number
          company_priority_score: number
          compensation_score: number
          disqualifiers: string[]
          experience_score: number
          freshness_score: number
          hard_disqualified: boolean
          id: string
          industry_score: number
          job_id: string
          location_score: number
          overall_score: number
          reasons: Json
          responsibility_score: number
          scored_at: string
          scoring_config_id: string
          scoring_version: number
          search_profile_id: string
          seniority_score: number
          source_quality_score: number
          title_score: number
        }
        Insert: {
          application_effort_score?: number
          company_priority_score?: number
          compensation_score?: number
          disqualifiers?: string[]
          experience_score?: number
          freshness_score?: number
          hard_disqualified?: boolean
          id?: string
          industry_score?: number
          job_id: string
          location_score?: number
          overall_score: number
          reasons?: Json
          responsibility_score?: number
          scored_at?: string
          scoring_config_id: string
          scoring_version: number
          search_profile_id: string
          seniority_score?: number
          source_quality_score?: number
          title_score?: number
        }
        Update: {
          application_effort_score?: number
          company_priority_score?: number
          compensation_score?: number
          disqualifiers?: string[]
          experience_score?: number
          freshness_score?: number
          hard_disqualified?: boolean
          id?: string
          industry_score?: number
          job_id?: string
          location_score?: number
          overall_score?: number
          reasons?: Json
          responsibility_score?: number
          scored_at?: string
          scoring_config_id?: string
          scoring_version?: number
          search_profile_id?: string
          seniority_score?: number
          source_quality_score?: number
          title_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_scores_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "canonical_job_sources"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_scores_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_discovery_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_scores_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_scores_scoring_config_id_fkey"
            columns: ["scoring_config_id"]
            isOneToOne: false
            referencedRelation: "scoring_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_scores_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "discovery_profile_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_scores_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "search_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_source_postings: {
        Row: {
          apply_url: string | null
          canonical_match_confidence: number
          canonical_match_method: string
          company_job_source_id: string | null
          content_hash: string | null
          created_at: string
          etag: string | null
          external_id: string
          first_seen_at: string
          id: string
          is_primary: boolean
          job_id: string
          last_modified: string | null
          last_seen_at: string
          last_verified_at: string
          lifecycle_status: DiscoveryLifecycleStatus
          missed_snapshots: number
          posted_at: string | null
          raw_company_name: string
          raw_description: string | null
          raw_location: string | null
          raw_payload: Json
          raw_title: string
          removed_at: string | null
          search_profile_id: string | null
          source: JobSource
          source_url: string | null
          updated_at: string
        }
        Insert: {
          apply_url?: string | null
          canonical_match_confidence?: number
          canonical_match_method?: string
          company_job_source_id?: string | null
          content_hash?: string | null
          created_at?: string
          etag?: string | null
          external_id: string
          first_seen_at?: string
          id?: string
          is_primary?: boolean
          job_id: string
          last_modified?: string | null
          last_seen_at?: string
          last_verified_at?: string
          lifecycle_status?: DiscoveryLifecycleStatus
          missed_snapshots?: number
          posted_at?: string | null
          raw_company_name: string
          raw_description?: string | null
          raw_location?: string | null
          raw_payload?: Json
          raw_title: string
          removed_at?: string | null
          search_profile_id?: string | null
          source: JobSource
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          apply_url?: string | null
          canonical_match_confidence?: number
          canonical_match_method?: string
          company_job_source_id?: string | null
          content_hash?: string | null
          created_at?: string
          etag?: string | null
          external_id?: string
          first_seen_at?: string
          id?: string
          is_primary?: boolean
          job_id?: string
          last_modified?: string | null
          last_seen_at?: string
          last_verified_at?: string
          lifecycle_status?: DiscoveryLifecycleStatus
          missed_snapshots?: number
          posted_at?: string | null
          raw_company_name?: string
          raw_description?: string | null
          raw_location?: string | null
          raw_payload?: Json
          raw_title?: string
          removed_at?: string | null
          search_profile_id?: string | null
          source?: JobSource
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_source_postings_company_job_source_id_fkey"
            columns: ["company_job_source_id"]
            isOneToOne: false
            referencedRelation: "company_job_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_source_postings_company_job_source_id_fkey"
            columns: ["company_job_source_id"]
            isOneToOne: false
            referencedRelation: "source_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_source_postings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "canonical_job_sources"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_source_postings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_discovery_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_source_postings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_source_postings_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "discovery_profile_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_source_postings_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "search_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          canonical_key: string | null
          canonicalization_version: number
          closed_at: string | null
          company_id: string | null
          content_hash: string | null
          description: string | null
          description_changed_at: string | null
          effective_at: string | null
          employment_type: string | null
          external_id: string | null
          fetched_at: string
          first_seen_at: string | null
          fit_reasons: string[] | null
          fit_score: number | null
          id: string
          job_type: string | null
          last_seen_at: string | null
          last_verified_at: string | null
          lifecycle_status: DiscoveryLifecycleStatus
          location: string | null
          normalized_company: string | null
          normalized_location: string | null
          normalized_title: string | null
          posted_at: string | null
          preferred_source: JobSource | null
          remote: boolean | null
          remote_type: RemoteType | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          seniority: string | null
          source: JobSource
          source_count: number
          status: JobStatus
          title: string
          url: string | null
        }
        Insert: {
          canonical_key?: string | null
          canonicalization_version?: number
          closed_at?: string | null
          company_id?: string | null
          content_hash?: string | null
          description?: string | null
          description_changed_at?: string | null
          effective_at?: string | null
          employment_type?: string | null
          external_id?: string | null
          fetched_at?: string
          first_seen_at?: string | null
          fit_reasons?: string[] | null
          fit_score?: number | null
          id?: string
          job_type?: string | null
          last_seen_at?: string | null
          last_verified_at?: string | null
          lifecycle_status?: DiscoveryLifecycleStatus
          location?: string | null
          normalized_company?: string | null
          normalized_location?: string | null
          normalized_title?: string | null
          posted_at?: string | null
          preferred_source?: JobSource | null
          remote?: boolean | null
          remote_type?: RemoteType | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          seniority?: string | null
          source: JobSource
          source_count?: number
          status?: JobStatus
          title: string
          url?: string | null
        }
        Update: {
          canonical_key?: string | null
          canonicalization_version?: number
          closed_at?: string | null
          company_id?: string | null
          content_hash?: string | null
          description?: string | null
          description_changed_at?: string | null
          effective_at?: string | null
          employment_type?: string | null
          external_id?: string | null
          fetched_at?: string
          first_seen_at?: string | null
          fit_reasons?: string[] | null
          fit_score?: number | null
          id?: string
          job_type?: string | null
          last_seen_at?: string | null
          last_verified_at?: string | null
          lifecycle_status?: DiscoveryLifecycleStatus
          location?: string | null
          normalized_company?: string | null
          normalized_location?: string | null
          normalized_title?: string | null
          posted_at?: string | null
          preferred_source?: JobSource | null
          remote?: boolean | null
          remote_type?: RemoteType | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          seniority?: string | null
          source?: JobSource
          source_count?: number
          status?: JobStatus
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          action_url: string | null
          company_or_channel: string | null
          created_at: string
          description: string | null
          draft_pitch: string | null
          effort: string | null
          estimated_value: string | null
          fit_reasons: string[] | null
          fit_score: number | null
          id: string
          notes: string | null
          status: OpportunityStatus
          time_to_cash: string | null
          title: string
          type: OpportunityType
          updated_at: string
        }
        Insert: {
          action_url?: string | null
          company_or_channel?: string | null
          created_at?: string
          description?: string | null
          draft_pitch?: string | null
          effort?: string | null
          estimated_value?: string | null
          fit_reasons?: string[] | null
          fit_score?: number | null
          id?: string
          notes?: string | null
          status?: OpportunityStatus
          time_to_cash?: string | null
          title: string
          type: OpportunityType
          updated_at?: string
        }
        Update: {
          action_url?: string | null
          company_or_channel?: string | null
          created_at?: string
          description?: string | null
          draft_pitch?: string | null
          effort?: string | null
          estimated_value?: string | null
          fit_reasons?: string[] | null
          fit_score?: number | null
          id?: string
          notes?: string | null
          status?: OpportunityStatus
          time_to_cash?: string | null
          title?: string
          type?: OpportunityType
          updated_at?: string
        }
        Relationships: []
      }
      outreach_messages: {
        Row: {
          application_id: string
          contact_id: string | null
          created_at: string
          draft_body: string | null
          id: string
          scheduled_for: string | null
          sent_at: string | null
          status: OutreachStatus
          type: OutreachType
        }
        Insert: {
          application_id: string
          contact_id?: string | null
          created_at?: string
          draft_body?: string | null
          id?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: OutreachStatus
          type: OutreachType
        }
        Update: {
          application_id?: string
          contact_id?: string | null
          created_at?: string
          draft_body?: string | null
          id?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: OutreachStatus
          type?: OutreachType
        }
        Relationships: [
          {
            foreignKeyName: "outreach_messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_rate_budgets: {
        Row: {
          bucket_start: string
          bucket_type: string
          provider: string
          request_limit: number
          requests_used: number
          reserved_requests: number
          reset_at: string
          updated_at: string
        }
        Insert: {
          bucket_start: string
          bucket_type: string
          provider: string
          request_limit: number
          requests_used?: number
          reserved_requests?: number
          reset_at: string
          updated_at?: string
        }
        Update: {
          bucket_start?: string
          bucket_type?: string
          provider?: string
          request_limit?: number
          requests_used?: number
          reserved_requests?: number
          reset_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      resume_versions: {
        Row: {
          application_id: string
          content: string | null
          created_at: string
          docx_url: string | null
          id: string
        }
        Insert: {
          application_id: string
          content?: string | null
          created_at?: string
          docx_url?: string | null
          id?: string
        }
        Update: {
          application_id?: string
          content?: string | null
          created_at?: string
          docx_url?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resume_versions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_configs: {
        Row: {
          created_at: string
          enabled: boolean
          hard_rules: Json
          id: string
          search_profile_id: string
          thresholds: Json
          version: number
          weights: Json
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          hard_rules?: Json
          id?: string
          search_profile_id: string
          thresholds?: Json
          version?: number
          weights?: Json
        }
        Update: {
          created_at?: string
          enabled?: boolean
          hard_rules?: Json
          id?: string
          search_profile_id?: string
          thresholds?: Json
          version?: number
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "scoring_configs_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "discovery_profile_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_configs_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "search_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_profile_company_sources: {
        Row: {
          company_job_source_id: string
          enabled: boolean
          search_profile_id: string
          weight: number
        }
        Insert: {
          company_job_source_id: string
          enabled?: boolean
          search_profile_id: string
          weight?: number
        }
        Update: {
          company_job_source_id?: string
          enabled?: boolean
          search_profile_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "search_profile_company_sources_company_job_source_id_fkey"
            columns: ["company_job_source_id"]
            isOneToOne: false
            referencedRelation: "company_job_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_profile_company_sources_company_job_source_id_fkey"
            columns: ["company_job_source_id"]
            isOneToOne: false
            referencedRelation: "source_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_profile_company_sources_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "discovery_profile_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_profile_company_sources_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "search_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_profile_queries: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          last_new_job_count: number
          last_result_count: number
          last_run_at: string | null
          location: string | null
          priority: number
          provider: string
          query_text: string
          query_type: string
          search_profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_new_job_count?: number
          last_result_count?: number
          last_run_at?: string | null
          location?: string | null
          priority?: number
          provider: string
          query_text: string
          query_type?: string
          search_profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_new_job_count?: number
          last_result_count?: number
          last_run_at?: string | null
          location?: string | null
          priority?: number
          provider?: string
          query_text?: string
          query_type?: string
          search_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_profile_queries_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "discovery_profile_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_profile_queries_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "search_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_profiles: {
        Row: {
          country_code: string
          created_at: string
          description: string | null
          employment_types: string[]
          enabled: boolean
          excluded_companies: string[]
          excluded_terms: string[]
          id: string
          locations: string[]
          maximum_posting_age_days: number
          minimum_salary_cad: number | null
          name: string
          preferred_terms: string[]
          primary_titles: string[]
          priority: number
          remote_policy: string
          required_terms: string[]
          result_budget_per_run: number
          slug: string
          source_priority: Json
          title_aliases: string[]
          updated_at: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          description?: string | null
          employment_types?: string[]
          enabled?: boolean
          excluded_companies?: string[]
          excluded_terms?: string[]
          id?: string
          locations?: string[]
          maximum_posting_age_days?: number
          minimum_salary_cad?: number | null
          name: string
          preferred_terms?: string[]
          primary_titles?: string[]
          priority?: number
          remote_policy?: string
          required_terms?: string[]
          result_budget_per_run?: number
          slug: string
          source_priority?: Json
          title_aliases?: string[]
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          description?: string | null
          employment_types?: string[]
          enabled?: boolean
          excluded_companies?: string[]
          excluded_terms?: string[]
          id?: string
          locations?: string[]
          maximum_posting_age_days?: number
          minimum_salary_cad?: number | null
          name?: string
          preferred_terms?: string[]
          primary_titles?: string[]
          priority?: number
          remote_policy?: string
          required_terms?: string[]
          result_budget_per_run?: number
          slug?: string
          source_priority?: Json
          title_aliases?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      canonical_job_sources: {
        Row: {
          job_id: string | null
          preferred_source: string | null
          source_count: number | null
          sources: Json | null
        }
        Relationships: []
      }
      discovery_profile_summary: {
        Row: {
          company_source_count: number | null
          enabled: boolean | null
          id: string | null
          last_query_run_at: string | null
          matched_job_count: number | null
          name: string | null
          priority: number | null
          query_count: number | null
          slug: string | null
        }
        Relationships: []
      }
      discovery_run_summary: {
        Row: {
          budget_snapshot: Json | null
          canonical_jobs_created: number | null
          canonical_jobs_updated: number | null
          created_at: string | null
          error_summary: string | null
          errors_count: number | null
          failed_step_count: number | null
          finished_at: string | null
          id: string | null
          jobs_closed: number | null
          jobs_reopened: number | null
          postings_fetched: number | null
          postings_merged: number | null
          providers_attempted: string[] | null
          rate_limited_step_count: number | null
          requested_profile_id: string | null
          requests_used: number | null
          started_at: string | null
          status: string | null
          step_count: number | null
          summary: Json | null
          trigger_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_runs_requested_profile_id_fkey"
            columns: ["requested_profile_id"]
            isOneToOne: false
            referencedRelation: "discovery_profile_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_runs_requested_profile_id_fkey"
            columns: ["requested_profile_id"]
            isOneToOne: false
            referencedRelation: "search_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_discovery_feed: {
        Row: {
          best_profile_id: string | null
          best_profile_score: number | null
          canonical_key: string | null
          canonicalization_version: number | null
          closed_at: string | null
          company_id: string | null
          company_name: string | null
          content_hash: string | null
          corroborating_source_count: number | null
          description: string | null
          description_changed_at: string | null
          effective_at: string | null
          employment_type: string | null
          external_id: string | null
          fetched_at: string | null
          first_seen_at: string | null
          fit_reasons: string[] | null
          fit_score: number | null
          hard_disqualified: boolean | null
          id: string | null
          job_type: string | null
          last_seen_at: string | null
          last_verified_at: string | null
          lifecycle_status: string | null
          location: string | null
          normalized_company: string | null
          normalized_location: string | null
          normalized_title: string | null
          posted_at: string | null
          preferred_source: string | null
          remote: boolean | null
          remote_type: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          score_reasons: Json | null
          seniority: string | null
          source: string | null
          source_count: number | null
          status: string | null
          title: string | null
          url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_scores_search_profile_id_fkey"
            columns: ["best_profile_id"]
            isOneToOne: false
            referencedRelation: "discovery_profile_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_scores_search_profile_id_fkey"
            columns: ["best_profile_id"]
            isOneToOne: false
            referencedRelation: "search_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      source_health: {
        Row: {
          active_job_count: number | null
          board_key: string | null
          company_id: string | null
          company_name: string | null
          consecutive_failures: number | null
          enabled: boolean | null
          health: string | null
          id: string | null
          last_checked_at: string | null
          last_error: string | null
          last_error_at: string | null
          last_success_at: string | null
          priority: number | null
          provider: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_job_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      discovery_canonical_key: {
        Args: {
          apply_url?: string
          company_name: string
          job_location: string
          job_title: string
          posted_at: string
        }
        Returns: string
      }
      expire_stale_aggregator_postings: {
        Args: { p_max_age?: string; p_verified_at?: string }
        Returns: number
      }
      ingest_job_source_posting: {
        Args: {
          p_apply_url?: string
          p_company_job_source_id?: string
          p_company_name: string
          p_content_hash?: string
          p_description?: string
          p_employment_type?: string
          p_external_id: string
          p_location?: string
          p_posted_at?: string
          p_raw_payload?: Json
          p_remote?: boolean
          p_remote_type?: string
          p_salary_currency?: string
          p_salary_max?: number
          p_salary_min?: number
          p_search_profile_id?: string
          p_seniority?: string
          p_source: string
          p_source_url?: string
          p_title: string
          p_verified_at?: string
        }
        Returns: {
          ingest_action: string
          job_id: string
          source_posting_id: string
        }[]
      }
      mark_source_snapshot_complete: {
        Args: {
          p_company_job_source_id: string
          p_complete?: boolean
          p_observed_external_ids: string[]
          p_verified_at?: string
        }
        Returns: {
          closed_postings: number
          reopened_postings: number
        }[]
      }
      normalize_discovery_text: { Args: { value: string }; Returns: string }
      recompute_job_lifecycle: {
        Args: { target_job_id: string }
        Returns: undefined
      }
      reserve_provider_request: {
        Args: {
          p_bucket_start: string
          p_bucket_type: string
          p_manual?: boolean
          p_provider: string
          p_request_limit: number
          p_reserved_requests: number
          p_reset_at: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "job_search">]

export type Company = Database['job_search']['Tables']['companies']['Row']
export type Job = Database['job_search']['Tables']['jobs']['Row']
export type Application = Database['job_search']['Tables']['applications']['Row']
export type Contact = Database['job_search']['Tables']['contacts']['Row']
export type OutreachMessage = Database['job_search']['Tables']['outreach_messages']['Row']
export type Setting = Database['job_search']['Tables']['settings']['Row']
export type Opportunity = Database['job_search']['Tables']['opportunities']['Row']
export type SearchProfileRow = Database['job_search']['Tables']['search_profiles']['Row']
export type CompanyJobSourceRow = Database['job_search']['Tables']['company_job_sources']['Row']
export type JobSourcePostingRow = Database['job_search']['Tables']['job_source_postings']['Row']
export type JobScoreRow = Database['job_search']['Tables']['job_scores']['Row']
export type DiscoveryRunRow = Database['job_search']['Tables']['discovery_runs']['Row']

export type JobWithCompany = Job & {
  companies: Company | null
}

export type ApplicationWithJob = Application & {
  jobs: JobWithCompany
}


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
  job_search: {
    Enums: {},
  },
} as const

