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
export type JobSource = 'indeed' | 'ziprecruiter' | 'manual' | 'adzuna'

export interface Database {
  public: {
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
          status: JobStatus
          fit_score?: number | null
          fit_reasons?: string[] | null
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
      }
    }
  }
}

export type Company = Database['public']['Tables']['companies']['Row']
export type Job = Database['public']['Tables']['jobs']['Row']
export type Application = Database['public']['Tables']['applications']['Row']
export type Contact = Database['public']['Tables']['contacts']['Row']
export type OutreachMessage = Database['public']['Tables']['outreach_messages']['Row']
export type Setting = Database['public']['Tables']['settings']['Row']

export type JobWithCompany = Job & {
  companies: Company | null
}

export type ApplicationWithJob = Application & {
  jobs: JobWithCompany
}
