/**
 * Database types for the `public` schema, written to match the format of
 * `supabase gen types typescript`. Keep in sync with supabase/migrations.
 * Regenerate against a running database with `npm run db:types`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "archived";
type ProjectCategory = "general" | "automation" | "game" | "saas" | "ai_agent";
type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
type PriorityLevel = "low" | "medium" | "high" | "critical";
type AutomationTrigger = "manual" | "schedule" | "webhook" | "event";
type AutomationStatus = "draft" | "ready" | "paused";

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          status: ProjectStatus;
          category: ProjectCategory;
          priority: PriorityLevel;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name: string;
          description?: string | null;
          status?: ProjectStatus;
          category?: ProjectCategory;
          priority?: PriorityLevel;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          status?: ProjectStatus;
          category?: ProjectCategory;
          priority?: PriorityLevel;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          owner_id: string;
          title: string;
          description: string | null;
          status: TaskStatus;
          priority: PriorityLevel;
          due_date: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          owner_id?: string;
          title: string;
          description?: string | null;
          status?: TaskStatus;
          priority?: PriorityLevel;
          due_date?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          owner_id?: string;
          title?: string;
          description?: string | null;
          status?: TaskStatus;
          priority?: PriorityLevel;
          due_date?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_project_owner_fkey";
            columns: ["project_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      automations: {
        Row: {
          id: string;
          owner_id: string;
          project_id: string | null;
          name: string;
          description: string | null;
          trigger_type: AutomationTrigger;
          trigger_notes: string | null;
          n8n_workflow_id: string | null;
          status: AutomationStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          project_id?: string | null;
          name: string;
          description?: string | null;
          trigger_type?: AutomationTrigger;
          trigger_notes?: string | null;
          n8n_workflow_id?: string | null;
          status?: AutomationStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          project_id?: string | null;
          name?: string;
          description?: string | null;
          trigger_type?: AutomationTrigger;
          trigger_notes?: string | null;
          n8n_workflow_id?: string | null;
          status?: AutomationStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "automations_project_owner_fkey";
            columns: ["project_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      activity_logs: {
        Row: {
          id: number;
          owner_id: string;
          actor_id: string | null;
          entity_type: "project" | "task" | "automation";
          entity_id: string;
          action: "created" | "updated" | "status_changed" | "deleted";
          summary: string;
          metadata: Json;
          created_at: string;
        };
        // Written by database triggers only; users have no insert/update grants.
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      project_overview: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          status: ProjectStatus;
          category: ProjectCategory;
          priority: PriorityLevel;
          due_date: string | null;
          created_at: string;
          updated_at: string;
          task_total: number;
          task_done: number;
          task_blocked: number;
          task_overdue: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      command_center_summary: {
        Args: never;
        Returns: Json;
      };
    };
    Enums: {
      project_status: ProjectStatus;
      project_category: ProjectCategory;
      task_status: TaskStatus;
      priority_level: PriorityLevel;
      automation_trigger: AutomationTrigger;
      automation_status: AutomationStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
