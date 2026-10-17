export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      abuse_events: {
        Row: {
          count: number;
          endpoint: string | null;
          id: number;
          identifier: string;
          limit_value: number;
          meta: Json;
          reason: string;
          ts: string;
          window_seconds: number;
        };
        Insert: {
          count?: number;
          endpoint?: string | null;
          id?: number;
          identifier: string;
          limit_value?: number;
          meta?: Json;
          reason: string;
          ts?: string;
          window_seconds?: number;
        };
        Update: {
          count?: number;
          endpoint?: string | null;
          id?: number;
          identifier?: string;
          limit_value?: number;
          meta?: Json;
          reason?: string;
          ts?: string;
          window_seconds?: number;
        };
        Relationships: [];
      };
      bill_analyses: {
        Row: {
          bill_no: string;
          created_at: string;
          expires_at: string;
          id: string;
          payload: Json;
          source_url: string | null;
          state: string;
          text_hash: string;
          title: string | null;
        };
        Insert: {
          bill_no: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          payload: Json;
          source_url?: string | null;
          state: string;
          text_hash: string;
          title?: string | null;
        };
        Update: {
          bill_no?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          payload?: Json;
          source_url?: string | null;
          state?: string;
          text_hash?: string;
          title?: string | null;
        };
        Relationships: [];
      };
      bill_statuses: {
        Row: {
          bill_no: string;
          checked_at: string;
          last_action: string | null;
          last_action_date: string | null;
          state: string;
          status: string | null;
        };
        Insert: {
          bill_no: string;
          checked_at?: string;
          last_action?: string | null;
          last_action_date?: string | null;
          state: string;
          status?: string | null;
        };
        Update: {
          bill_no?: string;
          checked_at?: string;
          last_action?: string | null;
          last_action_date?: string | null;
          state?: string;
          status?: string | null;
        };
        Relationships: [];
      };
      bills: {
        Row: {
          bill_number: string;
          bill_text: string | null;
          created_at: string;
          id: string;
          impact_tags: Json;
          provisions: Json;
          source: string | null;
          source_url: string | null;
          state: string;
          status: string | null;
          summary: string | null;
          title: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          bill_number: string;
          bill_text?: string | null;
          created_at?: string;
          id?: string;
          impact_tags?: Json;
          provisions?: Json;
          source?: string | null;
          source_url?: string | null;
          state: string;
          status?: string | null;
          summary?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          bill_number?: string;
          bill_text?: string | null;
          created_at?: string;
          id?: string;
          impact_tags?: Json;
          provisions?: Json;
          source?: string | null;
          source_url?: string | null;
          state?: string;
          status?: string | null;
          summary?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      device_watchlist: {
        Row: {
          added_at: string;
          bill_no: string;
          device_id: string;
          state: string;
          title: string;
        };
        Insert: {
          added_at?: string;
          bill_no: string;
          device_id: string;
          state: string;
          title?: string;
        };
        Update: {
          added_at?: string;
          bill_no?: string;
          device_id?: string;
          state?: string;
          title?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          family_status: string | null;
          home_state: string | null;
          income_band: string | null;
          job_sector: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          family_status?: string | null;
          home_state?: string | null;
          income_band?: string | null;
          job_sector?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          family_status?: string | null;
          home_state?: string | null;
          income_band?: string | null;
          job_sector?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          count: number;
          identifier: string;
          window_end: string;
        };
        Insert: {
          count?: number;
          identifier: string;
          window_end: string;
        };
        Update: {
          count?: number;
          identifier?: string;
          window_end?: string;
        };
        Relationships: [];
      };
      shared_analyses: {
        Row: {
          author_id: string | null;
          bill_no: string;
          created_at: string;
          payload: Json;
          slug: string;
          source_url: string | null;
          state: string;
          title: string | null;
        };
        Insert: {
          author_id?: string | null;
          bill_no: string;
          created_at?: string;
          payload: Json;
          slug: string;
          source_url?: string | null;
          state: string;
          title?: string | null;
        };
        Update: {
          author_id?: string | null;
          bill_no?: string;
          created_at?: string;
          payload?: Json;
          slug?: string;
          source_url?: string | null;
          state?: string;
          title?: string | null;
        };
        Relationships: [];
      };
      trending_bills: {
        Row: {
          bill_no: string;
          rank: number;
          refreshed_at: string;
          state: string;
          title: string;
          url: string;
        };
        Insert: {
          bill_no: string;
          rank: number;
          refreshed_at?: string;
          state: string;
          title: string;
          url: string;
        };
        Update: {
          bill_no?: string;
          rank?: number;
          refreshed_at?: string;
          state?: string;
          title?: string;
          url?: string;
        };
        Relationships: [];
      };
      watchlist: {
        Row: {
          bill_no: string;
          created_at: string;
          id: string;
          last_action: string | null;
          last_action_date: string | null;
          last_status: string | null;
          state: string;
          status_changed_at: string | null;
          status_checked_at: string | null;
          title: string | null;
          user_id: string;
        };
        Insert: {
          bill_no: string;
          created_at?: string;
          id?: string;
          last_action?: string | null;
          last_action_date?: string | null;
          last_status?: string | null;
          state: string;
          status_changed_at?: string | null;
          status_checked_at?: string | null;
          title?: string | null;
          user_id: string;
        };
        Update: {
          bill_no?: string;
          created_at?: string;
          id?: string;
          last_action?: string | null;
          last_action_date?: string | null;
          last_status?: string | null;
          state?: string;
          status_changed_at?: string | null;
          status_checked_at?: string | null;
          title?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      bump_rate_limit: {
        Args: { _identifier: string; _limit: number; _window_seconds: number };
        Returns: {
          allowed: boolean;
          current_count: number;
          window_end: string;
        }[];
      };
      run_retention_cleanup: { Args: never; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
