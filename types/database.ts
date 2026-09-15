export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          domain: string | null
          company_type: string | null
          employee_count_range: string | null
          source: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          domain?: string | null
          company_type?: string | null
          employee_count_range?: string | null
          source?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          domain?: string | null
          company_type?: string | null
          employee_count_range?: string | null
          source?: string
          created_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          id: string
          user_id: string
          platform: string
          board_token: string
          title: string
          company: string
          company_id: string | null
          company_logo: string | null
          location: string | null
          salary_min: number | null
          salary_max: number | null
          salary_disclosed: boolean
          job_type: string | null
          experience_level: string | null
          employment_type: string | null
          work_mode: string | null
          description: string | null
          tags: Json
          match_score: number | null
          embedding: unknown | null
          job_url: string
          classified_at: string | null
          source_url: string | null
          applied_status: string
          saved_status: boolean
          fetched_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          platform: string
          board_token: string
          title: string
          company: string
          company_id?: string | null
          company_logo?: string | null
          location?: string | null
          salary_min?: number | null
          salary_max?: number | null
          salary_disclosed?: boolean
          job_type?: string | null
          experience_level?: string | null
          employment_type?: string | null
          work_mode?: string | null
          description?: string | null
          tags?: Json
          match_score?: number | null
          embedding?: unknown | null
          job_url: string
          classified_at?: string | null
          source_url?: string | null
          applied_status?: string
          saved_status?: boolean
          fetched_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          platform?: string
          board_token?: string
          title?: string
          company?: string
          company_id?: string | null
          company_logo?: string | null
          location?: string | null
          salary_min?: number | null
          salary_max?: number | null
          salary_disclosed?: boolean
          job_type?: string | null
          experience_level?: string | null
          employment_type?: string | null
          work_mode?: string | null
          description?: string | null
          tags?: Json
          match_score?: number | null
          embedding?: unknown | null
          job_url?: string
          classified_at?: string | null
          source_url?: string | null
          applied_status?: string
          saved_status?: boolean
          fetched_at?: string
          created_at?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          company: string | null
          created_at: string
          id: string
          job_title: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          id?: string
          job_title: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          id?: string
          job_title?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean
          phone: string | null
          location: string | null
          summary: string | null
          skills: Json
          work_experience: Json
          education: Json
          projects: Json
          certifications: Json
          links: Json
          career_preferences: Json
          achievements: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          onboarding_completed?: boolean
          phone?: string | null
          location?: string | null
          summary?: string | null
          skills?: Json
          work_experience?: Json
          education?: Json
          projects?: Json
          certifications?: Json
          links?: Json
          career_preferences?: Json
          achievements?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          phone?: string | null
          location?: string | null
          summary?: string | null
          skills?: Json
          work_experience?: Json
          education?: Json
          projects?: Json
          certifications?: Json
          links?: Json
          career_preferences?: Json
          achievements?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resumes: {
        Row: {
          id: string
          user_id: string
          file_name: string
          file_path: string
          file_url: string | null
          file_size: number
          content_type: string
          parsed_data: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          file_path: string
          file_url?: string | null
          file_size?: number
          content_type?: string
          parsed_data?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_name?: string
          file_path?: string
          file_url?: string | null
          file_size?: number
          content_type?: string
          parsed_data?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>]

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
