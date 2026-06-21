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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bgm_tracks: {
        Row: {
          created_at: string
          id: string
          name: string
          room_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          room_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          room_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "bgm_tracks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      objects: {
        Row: {
          autoplay: boolean | null
          created_at: string
          crop_bottom: number | null
          crop_left: number | null
          crop_right: number | null
          crop_top: number | null
          current_variant_index: number | null
          display_name: string | null
          flip_x: boolean | null
          height: number | null
          id: string
          is_locked: boolean | null
          is_visible: boolean | null
          loop: boolean | null
          metadata: Json | null
          muted: boolean | null
          name: string
          object_category: string | null
          play_on_scene: boolean | null
          rotation: number | null
          scene_id: string
          type: string
          updated_at: string
          url: string
          variants: Json | null
          width: number | null
          x: number | null
          y: number | null
          z_index: number | null
        }
        Insert: {
          autoplay?: boolean | null
          created_at?: string
          crop_bottom?: number | null
          crop_left?: number | null
          crop_right?: number | null
          crop_top?: number | null
          current_variant_index?: number | null
          display_name?: string | null
          flip_x?: boolean | null
          height?: number | null
          id?: string
          is_locked?: boolean | null
          is_visible?: boolean | null
          loop?: boolean | null
          metadata?: Json | null
          muted?: boolean | null
          name?: string
          object_category?: string | null
          play_on_scene?: boolean | null
          rotation?: number | null
          scene_id: string
          type: string
          updated_at?: string
          url: string
          variants?: Json | null
          width?: number | null
          x?: number | null
          y?: number | null
          z_index?: number | null
        }
        Update: {
          autoplay?: boolean | null
          created_at?: string
          crop_bottom?: number | null
          crop_left?: number | null
          crop_right?: number | null
          crop_top?: number | null
          current_variant_index?: number | null
          display_name?: string | null
          flip_x?: boolean | null
          height?: number | null
          id?: string
          is_locked?: boolean | null
          is_visible?: boolean | null
          loop?: boolean | null
          metadata?: Json | null
          muted?: boolean | null
          name?: string
          object_category?: string | null
          play_on_scene?: boolean | null
          rotation?: number | null
          scene_id?: string
          type?: string
          updated_at?: string
          url?: string
          variants?: Json | null
          width?: number | null
          x?: number | null
          y?: number | null
          z_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      room_assets: {
        Row: {
          category: string
          created_at: string
          file_size: number | null
          id: string
          name: string
          room_id: string
          url: string
        }
        Insert: {
          category?: string
          created_at?: string
          file_size?: number | null
          id?: string
          name?: string
          room_id: string
          url: string
        }
        Update: {
          category?: string
          created_at?: string
          file_size?: number | null
          id?: string
          name?: string
          room_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_assets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          admin_id: string | null
          created_at: string
          current_scene_id: string | null
          id: string
          is_on_break: boolean
          name: string
          scenario: Json | null
          share_token: string | null
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          current_scene_id?: string | null
          id?: string
          is_on_break?: boolean
          name?: string
          scenario?: Json | null
          share_token?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          current_scene_id?: string | null
          id?: string
          is_on_break?: boolean
          name?: string
          scenario?: Json | null
          share_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_current_scene_id_fkey"
            columns: ["current_scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      scenes: {
        Row: {
          ambient_brightness: number
          ambient_color: string
          ambient_saturation: number
          background_blur: number
          background_brightness: number
          background_saturation: number
          background_url: string | null
          sub_background_url: string | null
          bgm_track_id: string | null
          created_at: string
          id: string
          name: string
          order_index: number | null
          room_id: string
          scene_effect: string
          updated_at: string
        }
        Insert: {
          ambient_brightness?: number
          ambient_color?: string
          ambient_saturation?: number
          background_blur?: number
          background_brightness?: number
          background_saturation?: number
          background_url?: string | null
          sub_background_url?: string | null
          bgm_track_id?: string | null
          created_at?: string
          id?: string
          name?: string
          order_index?: number | null
          room_id: string
          scene_effect?: string
          updated_at?: string
        }
        Update: {
          ambient_brightness?: number
          ambient_color?: string
          ambient_saturation?: number
          background_blur?: number
          background_brightness?: number
          background_saturation?: number
          background_url?: string | null
          sub_background_url?: string | null
          bgm_track_id?: string | null
          created_at?: string
          id?: string
          name?: string
          order_index?: number | null
          room_id?: string
          scene_effect?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenes_bgm_track_id_fkey"
            columns: ["bgm_track_id"]
            isOneToOne: false
            referencedRelation: "bgm_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      se_tracks: {
        Row: {
          created_at: string
          id: string
          name: string
          room_id: string
          url: string
          volume: number
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          room_id: string
          url: string
          volume?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          room_id?: string
          url?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "se_tracks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
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
    Enums: {},
  },
} as const
