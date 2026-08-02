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
export type OpportunityType =
  | 'job_lead'
  | 'contract'
  | 'freelance'
  | 'productized_service'
  | 'outreach'
  | 'recruiting'
  | 'marketplace'
export type OpportunityStatus = 'active' | 'in_progress' | 'won' | 'dismissed' | 'expired'

export interface Database {
  job_search: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          domain: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          domain?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          domain?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          id: string
          source: JobSource
          external_id: string | null
          title: string
          company_id: string | null
          location: string | null
          remote: boolean | null
          job_type: string | null
          description: string | null
          url: string | null
          posted_at: string | null
          fetched_at: string
          effective_at: string
          status: JobStatus
          fit_score: number | null
          fit_reasons: string[] | null
        }
        Insert: {
          id?: string
          source: JobSource
          external_id?: string | null
          title: string
          company_id?: string | null
          location?: string | null
          remote?: boolean | null
          job_type?: string | null
          description?: string | null
          url?: string | null
          posted_at?: string | null
          fetched_at?: string
          status?: JobStatus
          fit_score?: number | null
          fit_reasons?: string[] | null
        }
        Update: {
          id?: string
          source?: JobSource
          external_id?: string | null
          title?: string
          company_id?: string | null
          location?: string | null
          remote?: boolean | null
          job_type?: string | null
          description?: string | null
          url?: string | null
          posted_at?: string | null
          fetched_at?: string
          status?: JobStatus
          fit_score?: number | null
          fit_reasons?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: 'jobs_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      applications: {
        Row: {
          id: string
          job_id: string
          status: ApplicationStatus
          applied_at: string | null
          resume_version_id: string | null
          cover_note: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          status?: ApplicationStatus
          applied_at?: string | null
          resume_version_id?: string | null
          cover_note?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          status?: ApplicationStatus
          applied_at?: string | null
          resume_version_id?: string | null
          cover_note?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'applications_job_id_fkey'
            columns: ['job_id']
            isOneToOne: true
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'applications_resume_version_id_fkey'
            columns: ['resume_version_id']
            isOneToOne: false
            referencedRelation: 'resume_versions'
            referencedColumns: ['id']
          },
        ]
      }
      resume_versions: {
        Row: {
          id: string
          application_id: string
          content: string | null
          docx_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          application_id: string
          content?: string | null
          docx_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          application_id?: string
          content?: string | null
          docx_url?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resume_versions_application_id_fkey'
            columns: ['application_id']
            isOneToOne: false
            referencedRelation: 'applications'
            referencedColumns: ['id']
          },
        ]
      }
      contacts: {
        Row: {
          id: string
          company_id: string
          name: string
          title: string | null
          email: string | null
          linkedin_url: string | null
          source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          title?: string | null
          email?: string | null
          linkedin_url?: string | null
          source?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          title?: string | null
          email?: string | null
          linkedin_url?: string | null
          source?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contacts_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      outreach_messages: {
        Row: {
          id: string
          application_id: string
          contact_id: string | null
          type: OutreachType
          draft_body: string | null
          status: OutreachStatus
          scheduled_for: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          application_id: string
          contact_id?: string | null
          type: OutreachType
          draft_body?: string | null
          status?: OutreachStatus
          scheduled_for?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          application_id?: string
          contact_id?: string | null
          type?: OutreachType
          draft_body?: string | null
          status?: OutreachStatus
          scheduled_for?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'outreach_messages_application_id_fkey'
            columns: ['application_id']
            isOneToOne: false
            referencedRelation: 'applications'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'outreach_messages_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
        ]
      }
      settings: {
        Row: {
          id: string
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Json
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          id: string
          type: OpportunityType
          title: string
          description: string | null
          company_or_channel: string | null
          estimated_value: string | null
          effort: string | null
          time_to_cash: string | null
          fit_score: number | null
          fit_reasons: string[] | null
          status: OpportunityStatus
          action_url: string | null
          draft_pitch: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: OpportunityType
          title: string
          description?: string | null
          company_or_channel?: string | null
          estimated_value?: string | null
          effort?: string | null
          time_to_cash?: string | null
          fit_score?: number | null
          fit_reasons?: string[] | null
          status?: OpportunityStatus
          action_url?: string | null
          draft_pitch?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: OpportunityType
          title?: string
          description?: string | null
          company_or_channel?: string | null
          estimated_value?: string | null
          effort?: string | null
          time_to_cash?: string | null
          fit_score?: number | null
          fit_reasons?: string[] | null
          status?: OpportunityStatus
          action_url?: string | null
          draft_pitch?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

export type Company = Database['job_search']['Tables']['companies']['Row']
export type Job = Database['job_search']['Tables']['jobs']['Row']
export type Application = Database['job_search']['Tables']['applications']['Row']
export type Contact = Database['job_search']['Tables']['contacts']['Row']
export type OutreachMessage = Database['job_search']['Tables']['outreach_messages']['Row']
export type Setting = Database['job_search']['Tables']['settings']['Row']
export type Opportunity = Database['job_search']['Tables']['opportunities']['Row']

export type JobWithCompany = Job & {
  companies: Company | null
}

export type ApplicationWithJob = Application & {
  jobs: JobWithCompany
}
