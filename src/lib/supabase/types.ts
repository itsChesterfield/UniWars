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
      benachrichtigung: {
        Row: {
          erstellt_am: string
          gelesen: boolean
          id: string
          ref_id: string | null
          text: string
          user_id: string
        }
        Insert: {
          erstellt_am?: string
          gelesen?: boolean
          id?: string
          ref_id?: string | null
          text: string
          user_id: string
        }
        Update: {
          erstellt_am?: string
          gelesen?: boolean
          id?: string
          ref_id?: string | null
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      deadline: {
        Row: {
          erledigt: boolean
          extern_uid: string | null
          fach_id: string | null
          faellig_am: string
          id: string
          kategorie: Database["public"]["Enums"]["deadline_kategorie"]
          quelle: Database["public"]["Enums"]["quelle"]
          titel: string
          typ: Database["public"]["Enums"]["deadline_typ"]
          user_id: string
          wiederhol_regel: string | null
        }
        Insert: {
          erledigt?: boolean
          extern_uid?: string | null
          fach_id?: string | null
          faellig_am: string
          id?: string
          kategorie?: Database["public"]["Enums"]["deadline_kategorie"]
          quelle?: Database["public"]["Enums"]["quelle"]
          titel: string
          typ?: Database["public"]["Enums"]["deadline_typ"]
          user_id: string
          wiederhol_regel?: string | null
        }
        Update: {
          erledigt?: boolean
          extern_uid?: string | null
          fach_id?: string | null
          faellig_am?: string
          id?: string
          kategorie?: Database["public"]["Enums"]["deadline_kategorie"]
          quelle?: Database["public"]["Enums"]["quelle"]
          titel?: string
          typ?: Database["public"]["Enums"]["deadline_typ"]
          user_id?: string
          wiederhol_regel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deadline_fach_id_fkey"
            columns: ["fach_id"]
            isOneToOne: false
            referencedRelation: "fach"
            referencedColumns: ["id"]
          },
        ]
      }
      externer_feed: {
        Row: {
          aktiv: boolean
          id: string
          name: string
          url: string
          user_id: string
          zuletzt_synchronisiert: string | null
        }
        Insert: {
          aktiv?: boolean
          id?: string
          name: string
          url: string
          user_id: string
          zuletzt_synchronisiert?: string | null
        }
        Update: {
          aktiv?: boolean
          id?: string
          name?: string
          url?: string
          user_id?: string
          zuletzt_synchronisiert?: string | null
        }
        Relationships: []
      }
      fach: {
        Row: {
          aktiv: boolean
          anwesenheitspflicht: boolean
          ects: number | null
          erstellt_am: string
          farbe: string | null
          fehltage_genutzt: number
          id: string
          max_fehltage: number | null
          name: string
          semester: string | null
          user_id: string
        }
        Insert: {
          aktiv?: boolean
          anwesenheitspflicht?: boolean
          ects?: number | null
          erstellt_am?: string
          farbe?: string | null
          fehltage_genutzt?: number
          id?: string
          max_fehltage?: number | null
          name: string
          semester?: string | null
          user_id: string
        }
        Update: {
          aktiv?: boolean
          anwesenheitspflicht?: boolean
          ects?: number | null
          erstellt_am?: string
          farbe?: string | null
          fehltage_genutzt?: number
          id?: string
          max_fehltage?: number | null
          name?: string
          semester?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lern_session: {
        Row: {
          dauer_minuten: number
          fach_id: string | null
          id: string
          start: string
          user_id: string
        }
        Insert: {
          dauer_minuten: number
          fach_id?: string | null
          id?: string
          start: string
          user_id: string
        }
        Update: {
          dauer_minuten?: number
          fach_id?: string | null
          id?: string
          start?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lern_session_fach_id_fkey"
            columns: ["fach_id"]
            isOneToOne: false
            referencedRelation: "fach"
            referencedColumns: ["id"]
          },
        ]
      }
      note: {
        Row: {
          bestanden: boolean | null
          datum: string
          fach_id: string
          gewicht: number
          id: string
          titel: string
          user_id: string
          wert: number
        }
        Insert: {
          bestanden?: boolean | null
          datum?: string
          fach_id: string
          gewicht?: number
          id?: string
          titel: string
          user_id: string
          wert: number
        }
        Update: {
          bestanden?: boolean | null
          datum?: string
          fach_id?: string
          gewicht?: number
          id?: string
          titel?: string
          user_id?: string
          wert?: number
        }
        Relationships: [
          {
            foreignKeyName: "note_fach_id_fkey"
            columns: ["fach_id"]
            isOneToOne: false
            referencedRelation: "fach"
            referencedColumns: ["id"]
          },
        ]
      }
      pruefung: {
        Row: {
          datum: string
          fach_id: string
          id: string
          raum: string | null
          status: Database["public"]["Enums"]["pruefung_status"]
          titel: string
          user_id: string
        }
        Insert: {
          datum: string
          fach_id: string
          id?: string
          raum?: string | null
          status?: Database["public"]["Enums"]["pruefung_status"]
          titel: string
          user_id: string
        }
        Update: {
          datum?: string
          fach_id?: string
          id?: string
          raum?: string | null
          status?: Database["public"]["Enums"]["pruefung_status"]
          titel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pruefung_fach_id_fkey"
            columns: ["fach_id"]
            isOneToOne: false
            referencedRelation: "fach"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          sichtbare_widgets: Json
          streak_count: number
          streak_freezes: number
          streak_last_active: string | null
          theme: Database["public"]["Enums"]["theme"]
          user_id: string
        }
        Insert: {
          sichtbare_widgets?: Json
          streak_count?: number
          streak_freezes?: number
          streak_last_active?: string | null
          theme?: Database["public"]["Enums"]["theme"]
          user_id: string
        }
        Update: {
          sichtbare_widgets?: Json
          streak_count?: number
          streak_freezes?: number
          streak_last_active?: string | null
          theme?: Database["public"]["Enums"]["theme"]
          user_id?: string
        }
        Relationships: []
      }
      stundenplan_eintrag: {
        Row: {
          dozent: string | null
          end_zeit: string
          fach_id: string
          id: string
          raum: string | null
          start_zeit: string
          tag: Database["public"]["Enums"]["wochentag"]
          user_id: string
        }
        Insert: {
          dozent?: string | null
          end_zeit: string
          fach_id: string
          id?: string
          raum?: string | null
          start_zeit: string
          tag: Database["public"]["Enums"]["wochentag"]
          user_id: string
        }
        Update: {
          dozent?: string | null
          end_zeit?: string
          fach_id?: string
          id?: string
          raum?: string | null
          start_zeit?: string
          tag?: Database["public"]["Enums"]["wochentag"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stundenplan_eintrag_fach_id_fkey"
            columns: ["fach_id"]
            isOneToOne: false
            referencedRelation: "fach"
            referencedColumns: ["id"]
          },
        ]
      }
      todo: {
        Row: {
          erledigt: boolean
          erstellt_am: string
          fach_id: string | null
          id: string
          prioritaet: Database["public"]["Enums"]["prioritaet"]
          titel: string
          user_id: string
        }
        Insert: {
          erledigt?: boolean
          erstellt_am?: string
          fach_id?: string | null
          id?: string
          prioritaet?: Database["public"]["Enums"]["prioritaet"]
          titel: string
          user_id: string
        }
        Update: {
          erledigt?: boolean
          erstellt_am?: string
          fach_id?: string | null
          id?: string
          prioritaet?: Database["public"]["Enums"]["prioritaet"]
          titel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_fach_id_fkey"
            columns: ["fach_id"]
            isOneToOne: false
            referencedRelation: "fach"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      notenschnitt: { Args: never; Returns: number }
    }
    Enums: {
      deadline_kategorie: "NORMAL" | "BAFOEG" | "SEMESTERBEITRAG"
      deadline_typ: "ABGABE" | "FRIST" | "SONSTIGE"
      prioritaet: "HOCH" | "MITTEL" | "NIEDRIG"
      pruefung_status: "ANSTEHEND" | "BESTANDEN" | "NICHT_BESTANDEN"
      quelle: "MANUELL" | "EXTERN"
      theme: "HELL" | "DUNKEL"
      wochentag: "MO" | "DI" | "MI" | "DO" | "FR" | "SA" | "SO"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      deadline_kategorie: ["NORMAL", "BAFOEG", "SEMESTERBEITRAG"],
      deadline_typ: ["ABGABE", "FRIST", "SONSTIGE"],
      prioritaet: ["HOCH", "MITTEL", "NIEDRIG"],
      pruefung_status: ["ANSTEHEND", "BESTANDEN", "NICHT_BESTANDEN"],
      quelle: ["MANUELL", "EXTERN"],
      theme: ["HELL", "DUNKEL"],
      wochentag: ["MO", "DI", "MI", "DO", "FR", "SA", "SO"],
    },
  },
} as const
