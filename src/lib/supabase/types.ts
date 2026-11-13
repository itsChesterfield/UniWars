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
      anhang: {
        Row: {
          datei_id: string | null
          erstellt_am: string
          id: string
          titel: string
          url: string
          user_id: string
          ziel_id: string
          ziel_typ: string
        }
        Insert: {
          datei_id?: string | null
          erstellt_am?: string
          id?: string
          titel: string
          url: string
          user_id?: string
          ziel_id: string
          ziel_typ: string
        }
        Update: {
          datei_id?: string | null
          erstellt_am?: string
          id?: string
          titel?: string
          url?: string
          user_id?: string
          ziel_id?: string
          ziel_typ?: string
        }
        Relationships: []
      }
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
      chat: {
        Row: {
          deadline_id: string | null
          erstellt_am: string
          erstellt_von: string | null
          id: string
          letzte_nachricht_am: string
          name: string | null
          typ: string
        }
        Insert: {
          deadline_id?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          letzte_nachricht_am?: string
          name?: string | null
          typ: string
        }
        Update: {
          deadline_id?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          letzte_nachricht_am?: string
          name?: string | null
          typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "deadline"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_meldung: {
        Row: {
          chat_id: string | null
          erstellt_am: string
          gemeldet_user_id: string
          grund: string
          id: string
          von_user_id: string
        }
        Insert: {
          chat_id?: string | null
          erstellt_am?: string
          gemeldet_user_id: string
          grund: string
          id?: string
          von_user_id?: string
        }
        Update: {
          chat_id?: string | null
          erstellt_am?: string
          gemeldet_user_id?: string
          grund?: string
          id?: string
          von_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_meldung_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chat"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_mitglied: {
        Row: {
          beigetreten_am: string
          chat_id: string
          user_id: string
          zuletzt_gelesen: string
        }
        Insert: {
          beigetreten_am?: string
          chat_id: string
          user_id: string
          zuletzt_gelesen?: string
        }
        Update: {
          beigetreten_am?: string
          chat_id?: string
          user_id?: string
          zuletzt_gelesen?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_mitglied_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chat"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_nachricht: {
        Row: {
          anhang: Json | null
          chat_id: string
          erstellt_am: string
          geloescht: boolean
          id: string
          text: string
          user_id: string | null
        }
        Insert: {
          anhang?: Json | null
          chat_id: string
          erstellt_am?: string
          geloescht?: boolean
          id?: string
          text?: string
          user_id?: string | null
        }
        Update: {
          anhang?: Json | null
          chat_id?: string
          erstellt_am?: string
          geloescht?: boolean
          id?: string
          text?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_nachricht_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chat"
            referencedColumns: ["id"]
          },
        ]
      }
      datei: {
        Row: {
          erstellt_am: string
          fach_id: string | null
          geaendert_am: string
          groesse: number
          id: string
          mime_typ: string
          name: string
          speicher_pfad: string
          user_id: string
        }
        Insert: {
          erstellt_am?: string
          fach_id?: string | null
          geaendert_am?: string
          groesse: number
          id?: string
          mime_typ: string
          name: string
          speicher_pfad: string
          user_id?: string
        }
        Update: {
          erstellt_am?: string
          fach_id?: string | null
          geaendert_am?: string
          groesse?: number
          id?: string
          mime_typ?: string
          name?: string
          speicher_pfad?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "datei_fach_id_fkey"
            columns: ["fach_id"]
            isOneToOne: false
            referencedRelation: "fach"
            referencedColumns: ["id"]
          },
        ]
      }
      deadline: {
        Row: {
          dauer_minuten: number | null
          erledigt: boolean
          extern_uid: string | null
          fach_id: string | null
          faellig_am: string
          id: string
          kategorie: Database["public"]["Enums"]["deadline_kategorie"]
          parent_deadline_id: string | null
          pruefung_id: string | null
          quelle: Database["public"]["Enums"]["quelle"]
          titel: string
          todo_id: string | null
          typ: Database["public"]["Enums"]["deadline_typ"]
          user_id: string
          wiederhol_regel: string | null
          zugewiesen_an: string | null
        }
        Insert: {
          dauer_minuten?: number | null
          erledigt?: boolean
          extern_uid?: string | null
          fach_id?: string | null
          faellig_am: string
          id?: string
          kategorie?: Database["public"]["Enums"]["deadline_kategorie"]
          parent_deadline_id?: string | null
          pruefung_id?: string | null
          quelle?: Database["public"]["Enums"]["quelle"]
          titel: string
          todo_id?: string | null
          typ?: Database["public"]["Enums"]["deadline_typ"]
          user_id: string
          wiederhol_regel?: string | null
          zugewiesen_an?: string | null
        }
        Update: {
          dauer_minuten?: number | null
          erledigt?: boolean
          extern_uid?: string | null
          fach_id?: string | null
          faellig_am?: string
          id?: string
          kategorie?: Database["public"]["Enums"]["deadline_kategorie"]
          parent_deadline_id?: string | null
          pruefung_id?: string | null
          quelle?: Database["public"]["Enums"]["quelle"]
          titel?: string
          todo_id?: string | null
          typ?: Database["public"]["Enums"]["deadline_typ"]
          user_id?: string
          wiederhol_regel?: string | null
          zugewiesen_an?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deadline_fach_id_fkey"
            columns: ["fach_id"]
            isOneToOne: false
            referencedRelation: "fach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadline_parent_deadline_id_fkey"
            columns: ["parent_deadline_id"]
            isOneToOne: false
            referencedRelation: "deadline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadline_pruefung_id_fkey"
            columns: ["pruefung_id"]
            isOneToOne: false
            referencedRelation: "pruefung"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadline_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todo"
            referencedColumns: ["id"]
          },
        ]
      }
      dokument: {
        Row: {
          erstellt_am: string
          fach_id: string | null
          geaendert_am: string
          id: string
          inhalt: Json
          klartext: string
          titel: string
          user_id: string
          woerter: number
        }
        Insert: {
          erstellt_am?: string
          fach_id?: string | null
          geaendert_am?: string
          id?: string
          inhalt?: Json
          klartext?: string
          titel?: string
          user_id?: string
          woerter?: number
        }
        Update: {
          erstellt_am?: string
          fach_id?: string | null
          geaendert_am?: string
          id?: string
          inhalt?: Json
          klartext?: string
          titel?: string
          user_id?: string
          woerter?: number
        }
        Relationships: [
          {
            foreignKeyName: "dokument_fach_id_fkey"
            columns: ["fach_id"]
            isOneToOne: false
            referencedRelation: "fach"
            referencedColumns: ["id"]
          },
        ]
      }
      einladung: {
        Row: {
          an_user_id: string
          beantwortet_am: string | null
          erstellt_am: string
          id: string
          status: Database["public"]["Enums"]["einladung_status"]
          von_user_id: string
          von_username: string | null
          ziel_faellig_am: string | null
          ziel_id: string
          ziel_titel: string
          ziel_typ: string
        }
        Insert: {
          an_user_id: string
          beantwortet_am?: string | null
          erstellt_am?: string
          id?: string
          status?: Database["public"]["Enums"]["einladung_status"]
          von_user_id: string
          von_username?: string | null
          ziel_faellig_am?: string | null
          ziel_id: string
          ziel_titel: string
          ziel_typ?: string
        }
        Update: {
          an_user_id?: string
          beantwortet_am?: string | null
          erstellt_am?: string
          id?: string
          status?: Database["public"]["Enums"]["einladung_status"]
          von_user_id?: string
          von_username?: string | null
          ziel_faellig_am?: string | null
          ziel_id?: string
          ziel_titel?: string
          ziel_typ?: string
        }
        Relationships: []
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
      kalender_eintrag: {
        Row: {
          google_event_id: string
          inhalt_hash: string
          quelle_id: string
          quelle_typ: string
          user_id: string
        }
        Insert: {
          google_event_id: string
          inhalt_hash: string
          quelle_id: string
          quelle_typ: string
          user_id?: string
        }
        Update: {
          google_event_id?: string
          inhalt_hash?: string
          quelle_id?: string
          quelle_typ?: string
          user_id?: string
        }
        Relationships: []
      }
      kalender_verbindung: {
        Row: {
          access_token: string | null
          access_token_ablauf: string | null
          anbieter: string
          erstellt_am: string
          kalender_id: string | null
          refresh_token: string
          user_id: string
          zuletzt_abgeglichen: string | null
        }
        Insert: {
          access_token?: string | null
          access_token_ablauf?: string | null
          anbieter?: string
          erstellt_am?: string
          kalender_id?: string | null
          refresh_token: string
          user_id?: string
          zuletzt_abgeglichen?: string | null
        }
        Update: {
          access_token?: string | null
          access_token_ablauf?: string | null
          anbieter?: string
          erstellt_am?: string
          kalender_id?: string | null
          refresh_token?: string
          user_id?: string
          zuletzt_abgeglichen?: string | null
        }
        Relationships: []
      }
      ki_nutzung: {
        Row: {
          einheit: string
          erfolgreich: boolean
          erstellt_am: string
          funktion: string
          id: string
          kontingent: string
          menge: number
          tokens_aus: number | null
          tokens_ein: number | null
          user_id: string
        }
        Insert: {
          einheit?: string
          erfolgreich?: boolean
          erstellt_am?: string
          funktion: string
          id?: string
          kontingent?: string
          menge?: number
          tokens_aus?: number | null
          tokens_ein?: number | null
          user_id: string
        }
        Update: {
          einheit?: string
          erfolgreich?: boolean
          erstellt_am?: string
          funktion?: string
          id?: string
          kontingent?: string
          menge?: number
          tokens_aus?: number | null
          tokens_ein?: number | null
          user_id?: string
        }
        Relationships: []
      }
      kk_karte: {
        Row: {
          box: number
          erstellt_am: string
          fehler: number
          geaendert_am: string
          id: string
          intervall_tage: number
          ki_erzeugt: boolean
          leichtigkeit: number
          naechste_abfrage: string
          rueckseite: string
          stapel_id: string
          user_id: string
          vorderseite: string
          wiederholungen: number
          zuletzt_gelernt: string | null
        }
        Insert: {
          box?: number
          erstellt_am?: string
          fehler?: number
          geaendert_am?: string
          id?: string
          intervall_tage?: number
          ki_erzeugt?: boolean
          leichtigkeit?: number
          naechste_abfrage?: string
          rueckseite: string
          stapel_id: string
          user_id?: string
          vorderseite: string
          wiederholungen?: number
          zuletzt_gelernt?: string | null
        }
        Update: {
          box?: number
          erstellt_am?: string
          fehler?: number
          geaendert_am?: string
          id?: string
          intervall_tage?: number
          ki_erzeugt?: boolean
          leichtigkeit?: number
          naechste_abfrage?: string
          rueckseite?: string
          stapel_id?: string
          user_id?: string
          vorderseite?: string
          wiederholungen?: number
          zuletzt_gelernt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kk_karte_stapel_id_fkey"
            columns: ["stapel_id"]
            isOneToOne: false
            referencedRelation: "kk_stapel"
            referencedColumns: ["id"]
          },
        ]
      }
      kk_stapel: {
        Row: {
          erstellt_am: string
          fach_id: string | null
          geaendert_am: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          erstellt_am?: string
          fach_id?: string | null
          geaendert_am?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          erstellt_am?: string
          fach_id?: string | null
          geaendert_am?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kk_stapel_fach_id_fkey"
            columns: ["fach_id"]
            isOneToOne: false
            referencedRelation: "fach"
            referencedColumns: ["id"]
          },
        ]
      }
      literatur_quelle: {
        Row: {
          abgerufen_am: string | null
          autoren: string
          datei_id: string | null
          erstellt_am: string
          fach_id: string | null
          geaendert_am: string
          id: string
          jahr: number
          ki_erzeugt: boolean
          notiz: string | null
          seiten: string | null
          titel: string
          typ: string
          url: string | null
          user_id: string
          verlag: string | null
        }
        Insert: {
          abgerufen_am?: string | null
          autoren: string
          datei_id?: string | null
          erstellt_am?: string
          fach_id?: string | null
          geaendert_am?: string
          id?: string
          jahr: number
          ki_erzeugt?: boolean
          notiz?: string | null
          seiten?: string | null
          titel: string
          typ: string
          url?: string | null
          user_id?: string
          verlag?: string | null
        }
        Update: {
          abgerufen_am?: string | null
          autoren?: string
          datei_id?: string | null
          erstellt_am?: string
          fach_id?: string | null
          geaendert_am?: string
          id?: string
          jahr?: number
          ki_erzeugt?: boolean
          notiz?: string | null
          seiten?: string | null
          titel?: string
          typ?: string
          url?: string | null
          user_id?: string
          verlag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "literatur_quelle_datei_id_fkey"
            columns: ["datei_id"]
            isOneToOne: false
            referencedRelation: "datei"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "literatur_quelle_fach_id_fkey"
            columns: ["fach_id"]
            isOneToOne: false
            referencedRelation: "fach"
            referencedColumns: ["id"]
          },
        ]
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
      mindmap: {
        Row: {
          daten: Json
          erstellt_am: string
          fach_id: string | null
          geaendert_am: string
          id: string
          ki_erzeugt: boolean
          name: string
          user_id: string
        }
        Insert: {
          daten?: Json
          erstellt_am?: string
          fach_id?: string | null
          geaendert_am?: string
          id?: string
          ki_erzeugt?: boolean
          name: string
          user_id?: string
        }
        Update: {
          daten?: Json
          erstellt_am?: string
          fach_id?: string | null
          geaendert_am?: string
          id?: string
          ki_erzeugt?: boolean
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mindmap_fach_id_fkey"
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
      nutzer_blockiert: {
        Row: {
          blockiert_id: string
          erstellt_am: string
          user_id: string
        }
        Insert: {
          blockiert_id: string
          erstellt_am?: string
          user_id?: string
        }
        Update: {
          blockiert_id?: string
          erstellt_am?: string
          user_id?: string
        }
        Relationships: []
      }
      notiz: {
        Row: {
          angepinnt: boolean
          erstellt_am: string
          fach_id: string | null
          geaendert_am: string
          id: string
          inhalt: string
          ki_erzeugt: boolean
          stundenplan_eintrag_id: string | null
          titel: string
          user_id: string
          vorlesung_datum: string | null
        }
        Insert: {
          angepinnt?: boolean
          erstellt_am?: string
          fach_id?: string | null
          geaendert_am?: string
          id?: string
          inhalt?: string
          ki_erzeugt?: boolean
          stundenplan_eintrag_id?: string | null
          titel?: string
          user_id?: string
          vorlesung_datum?: string | null
        }
        Update: {
          angepinnt?: boolean
          erstellt_am?: string
          fach_id?: string | null
          geaendert_am?: string
          id?: string
          inhalt?: string
          ki_erzeugt?: boolean
          stundenplan_eintrag_id?: string | null
          titel?: string
          user_id?: string
          vorlesung_datum?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notiz_fach_id_fkey"
            columns: ["fach_id"]
            isOneToOne: false
            referencedRelation: "fach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notiz_stundenplan_eintrag_id_fkey"
            columns: ["stundenplan_eintrag_id"]
            isOneToOne: false
            referencedRelation: "stundenplan_eintrag"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_markierung: {
        Row: {
          datei_id: string
          erstellt_am: string
          farbe: string
          geaendert_am: string
          id: string
          notiz: string | null
          rechtecke: Json
          seite: number
          text: string
          user_id: string
        }
        Insert: {
          datei_id: string
          erstellt_am?: string
          farbe?: string
          geaendert_am?: string
          id?: string
          notiz?: string | null
          rechtecke: Json
          seite: number
          text?: string
          user_id?: string
        }
        Update: {
          datei_id?: string
          erstellt_am?: string
          farbe?: string
          geaendert_am?: string
          id?: string
          notiz?: string | null
          rechtecke?: Json
          seite?: number
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_markierung_datei_id_fkey"
            columns: ["datei_id"]
            isOneToOne: false
            referencedRelation: "datei"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_stand: {
        Row: {
          datei_id: string
          geaendert_am: string
          lesezeichen: number[]
          letzte_seite: number
          user_id: string
        }
        Insert: {
          datei_id: string
          geaendert_am?: string
          lesezeichen?: number[]
          letzte_seite?: number
          user_id?: string
        }
        Update: {
          datei_id?: string
          geaendert_am?: string
          lesezeichen?: number[]
          letzte_seite?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_stand_datei_id_fkey"
            columns: ["datei_id"]
            isOneToOne: true
            referencedRelation: "datei"
            referencedColumns: ["id"]
          },
        ]
      }
      praesentation: {
        Row: {
          design: string
          erstellt_am: string
          fach_id: string | null
          folien: Json
          geaendert_am: string
          id: string
          ki_erzeugt: boolean
          titel: string
          user_id: string
        }
        Insert: {
          design?: string
          erstellt_am?: string
          fach_id?: string | null
          folien?: Json
          geaendert_am?: string
          id?: string
          ki_erzeugt?: boolean
          titel: string
          user_id?: string
        }
        Update: {
          design?: string
          erstellt_am?: string
          fach_id?: string | null
          folien?: Json
          geaendert_am?: string
          id?: string
          ki_erzeugt?: boolean
          titel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "praesentation_fach_id_fkey"
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
          dauer_minuten: number | null
          fach_id: string
          id: string
          raum: string | null
          status: Database["public"]["Enums"]["pruefung_status"]
          titel: string
          user_id: string
        }
        Insert: {
          datum: string
          dauer_minuten?: number | null
          fach_id: string
          id?: string
          raum?: string | null
          status?: Database["public"]["Enums"]["pruefung_status"]
          titel: string
          user_id: string
        }
        Update: {
          datum?: string
          dauer_minuten?: number | null
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
          ki_audio_einwilligung: string | null
          ki_einwilligung: string | null
          sichtbare_widgets: Json
          streak_count: number
          streak_freezes: number
          streak_last_active: string | null
          theme: Database["public"]["Enums"]["theme"]
          user_id: string
          username: string | null
          work_station: Json
        }
        Insert: {
          ki_audio_einwilligung?: string | null
          ki_einwilligung?: string | null
          sichtbare_widgets?: Json
          streak_count?: number
          streak_freezes?: number
          streak_last_active?: string | null
          theme?: Database["public"]["Enums"]["theme"]
          user_id: string
          username?: string | null
          work_station?: Json
        }
        Update: {
          ki_audio_einwilligung?: string | null
          ki_einwilligung?: string | null
          sichtbare_widgets?: Json
          streak_count?: number
          streak_freezes?: number
          streak_last_active?: string | null
          theme?: Database["public"]["Enums"]["theme"]
          user_id?: string
          username?: string | null
          work_station?: Json
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
      tabelle: {
        Row: {
          daten: Json
          erstellt_am: string
          fach_id: string | null
          geaendert_am: string
          id: string
          titel: string
          user_id: string
        }
        Insert: {
          daten?: Json
          erstellt_am?: string
          fach_id?: string | null
          geaendert_am?: string
          id?: string
          titel?: string
          user_id?: string
        }
        Update: {
          daten?: Json
          erstellt_am?: string
          fach_id?: string | null
          geaendert_am?: string
          id?: string
          titel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabelle_fach_id_fkey"
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
          faellig_am: string | null
          id: string
          parent_id: string | null
          prioritaet: Database["public"]["Enums"]["prioritaet"]
          titel: string
          user_id: string
          zugewiesen_an: string | null
        }
        Insert: {
          erledigt?: boolean
          erstellt_am?: string
          fach_id?: string | null
          faellig_am?: string | null
          id?: string
          parent_id?: string | null
          prioritaet?: Database["public"]["Enums"]["prioritaet"]
          titel: string
          user_id: string
          zugewiesen_an?: string | null
        }
        Update: {
          erledigt?: boolean
          erstellt_am?: string
          fach_id?: string | null
          faellig_am?: string | null
          id?: string
          parent_id?: string | null
          prioritaet?: Database["public"]["Enums"]["prioritaet"]
          titel?: string
          user_id?: string
          zugewiesen_an?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "todo_fach_id_fkey"
            columns: ["fach_id"]
            isOneToOne: false
            referencedRelation: "fach"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "todo"
            referencedColumns: ["id"]
          },
        ]
      }
      whiteboard: {
        Row: {
          daten: Json
          erstellt_am: string
          fach_id: string | null
          geaendert_am: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          daten?: Json
          erstellt_am?: string
          fach_id?: string | null
          geaendert_am?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          daten?: Json
          erstellt_am?: string
          fach_id?: string | null
          geaendert_am?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whiteboard_fach_id_fkey"
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
      benutzer_per_email: {
        Args: { p_email: string }
        Returns: { user_id: string; username: string }[]
      }
      chat_direkt_starten: { Args: { p_user_id: string }; Returns: string }
      chat_fuer_deadline: { Args: { p_deadline_id: string }; Returns: string }
      chat_gelesen: { Args: { p_chat_id: string }; Returns: undefined }
      chat_gruppe_erstellen: {
        Args: { p_name: string; p_user_ids: string[] }
        Returns: string
      }
      chat_mitglieder: {
        Args: { p_chat_id: string }
        Returns: { user_id: string; username: string }[]
      }
      chat_uebersicht: {
        Args: never
        Returns: {
          chat_id: string
          deadline_id: string | null
          letzte_nachricht: string | null
          letzte_nachricht_am: string
          mitglieder: number
          name: string | null
          partner_id: string | null
          typ: string
          ungelesen: number
        }[]
      }
      chat_ungelesen_gesamt: { Args: never; Returns: number }
      ki_kontingent_buchen: {
        Args: {
          p_einheit: string
          p_funktion: string
          p_kontingent: string
          p_limit: number
          p_menge: number
          p_zeitraum: string
        }
        Returns: string
      }
      ki_nutzung_abschliessen: {
        Args: { p_erfolgreich: boolean; p_id: string; p_tokens_aus: number; p_tokens_ein: number }
        Returns: undefined
      }
      ki_nutzung_buchen: { Args: { p_funktion: string; p_limit: number }; Returns: string }
      ist_blockiert: { Args: { p_a: string; p_b: string }; Returns: boolean }
      ist_chat_mitglied: { Args: { p_chat_id: string }; Returns: boolean }
      nachricht_loeschen: { Args: { p_id: string }; Returns: undefined }
      nachricht_senden: {
        Args: {
          p_anhang_id?: string
          p_anhang_typ?: string
          p_chat_id: string
          p_text: string
        }
        Returns: {
          anhang: Json | null
          chat_id: string
          erstellt_am: string
          geloescht: boolean
          id: string
          text: string
          user_id: string | null
        }
      }
      benachrichtigungen_fuer_faellige_deadlines: {
        Args: never
        Returns: undefined
      }
      benutzer_suchen: {
        Args: { suchtext: string }
        Returns: {
          user_id: string
          username: string
        }[]
      }
      deadline_mitglieder: {
        Args: { p_deadline_id: string }
        Returns: {
          ist_ersteller: boolean
          status: Database["public"]["Enums"]["einladung_status"]
          user_id: string
          username: string
        }[]
      }
      ist_ersteller: {
        Args: { p_user_id: string; p_ziel_id: string; p_ziel_typ: string }
        Returns: boolean
      }
      ist_mitglied: {
        Args: { p_ziel_id: string; p_ziel_typ: string }
        Returns: boolean
      }
      ist_username_verfuegbar: {
        Args: { p_username: string }
        Returns: boolean
      }
      notenschnitt: { Args: never; Returns: number }
      pruefung_mitglieder: {
        Args: { p_pruefung_id: string }
        Returns: {
          ist_ersteller: boolean
          status: Database["public"]["Enums"]["einladung_status"]
          user_id: string
          username: string
        }[]
      }
      todo_mitglieder: {
        Args: { p_todo_id: string }
        Returns: {
          ist_ersteller: boolean
          status: Database["public"]["Enums"]["einladung_status"]
          user_id: string
          username: string
        }[]
      }
      user_id_von_username: { Args: { p_username: string }; Returns: string }
    }
    Enums: {
      deadline_kategorie: "NORMAL" | "BAFOEG" | "SEMESTERBEITRAG"
      deadline_typ: "ABGABE" | "FRIST" | "SONSTIGE" | "TERMIN" | "GRUPPENARBEIT"
      einladung_status: "OFFEN" | "ANGENOMMEN" | "ABGELEHNT"
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
      deadline_typ: ["ABGABE", "FRIST", "SONSTIGE", "TERMIN", "GRUPPENARBEIT"],
      einladung_status: ["OFFEN", "ANGENOMMEN", "ABGELEHNT"],
      prioritaet: ["HOCH", "MITTEL", "NIEDRIG"],
      pruefung_status: ["ANSTEHEND", "BESTANDEN", "NICHT_BESTANDEN"],
      quelle: ["MANUELL", "EXTERN"],
      theme: ["HELL", "DUNKEL"],
      wochentag: ["MO", "DI", "MI", "DO", "FR", "SA", "SO"],
    },
  },
} as const
