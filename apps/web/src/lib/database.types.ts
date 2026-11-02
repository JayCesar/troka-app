export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      anuncio: {
        Row: {
          anunciante_id: string;
          assumido_em: string | null;
          assumido_por: string | null;
          atualizado_em: string;
          criado_em: string;
          expira_em: string;
          id: string;
          plantao_id: string;
          status: Database["public"]["Enums"]["status_anuncio"];
          urgencia: Database["public"]["Enums"]["urgencia"];
        };
        ComputedFields: never;
        Insert: {
          anunciante_id: string;
          assumido_em?: string | null;
          assumido_por?: string | null;
          atualizado_em?: string;
          criado_em?: string;
          expira_em: string;
          id?: string;
          plantao_id: string;
          status?: Database["public"]["Enums"]["status_anuncio"];
          urgencia: Database["public"]["Enums"]["urgencia"];
        };
        Update: {
          anunciante_id?: string;
          assumido_em?: string | null;
          assumido_por?: string | null;
          atualizado_em?: string;
          criado_em?: string;
          expira_em?: string;
          id?: string;
          plantao_id?: string;
          status?: Database["public"]["Enums"]["status_anuncio"];
          urgencia?: Database["public"]["Enums"]["urgencia"];
        };
        Relationships: [
          {
            foreignKeyName: "anuncio_anunciante_id_fkey";
            columns: ["anunciante_id"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anuncio_assumido_por_fkey";
            columns: ["assumido_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anuncio_plantao_id_fkey";
            columns: ["plantao_id"];
            isOneToOne: false;
            referencedRelation: "plantao";
            referencedColumns: ["id"];
          },
        ];
      };
      anuncio_motivo: {
        Row: {
          anuncio_id: string;
          categoria: Database["public"]["Enums"]["motivo_categoria"];
          texto: string | null;
        };
        ComputedFields: never;
        Insert: {
          anuncio_id: string;
          categoria: Database["public"]["Enums"]["motivo_categoria"];
          texto?: string | null;
        };
        Update: {
          anuncio_id?: string;
          categoria?: Database["public"]["Enums"]["motivo_categoria"];
          texto?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "anuncio_motivo_anuncio_id_fkey";
            columns: ["anuncio_id"];
            isOneToOne: true;
            referencedRelation: "anuncio";
            referencedColumns: ["id"];
          },
        ];
      };
      aviso: {
        Row: {
          criado_em: string;
          id: string;
          lido_em: string | null;
          link: string | null;
          perfil_id: string;
          texto: string;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          id?: string;
          lido_em?: string | null;
          link?: string | null;
          perfil_id: string;
          texto: string;
        };
        Update: {
          criado_em?: string;
          id?: string;
          lido_em?: string | null;
          link?: string | null;
          perfil_id?: string;
          texto?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aviso_perfil_id_fkey";
            columns: ["perfil_id"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
        ];
      };
      candidatura: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          id: string;
          plantao_id: string;
          profissional_id: string;
          status: Database["public"]["Enums"]["status_candidatura"];
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          plantao_id: string;
          profissional_id: string;
          status?: Database["public"]["Enums"]["status_candidatura"];
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          plantao_id?: string;
          profissional_id?: string;
          status?: Database["public"]["Enums"]["status_candidatura"];
        };
        Relationships: [
          {
            foreignKeyName: "candidatura_plantao_id_fkey";
            columns: ["plantao_id"];
            isOneToOne: false;
            referencedRelation: "plantao";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidatura_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
        ];
      };
      especialidade: {
        Row: {
          categoria: Database["public"]["Enums"]["categoria_profissional"];
          id: string;
          nome: string;
        };
        ComputedFields: never;
        Insert: {
          categoria: Database["public"]["Enums"]["categoria_profissional"];
          id?: string;
          nome: string;
        };
        Update: {
          categoria?: Database["public"]["Enums"]["categoria_profissional"];
          id?: string;
          nome?: string;
        };
        Relationships: [];
      };
      hospital: {
        Row: {
          criado_em: string;
          id: string;
          nome: string;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          id?: string;
          nome: string;
        };
        Update: {
          criado_em?: string;
          id?: string;
          nome?: string;
        };
        Relationships: [];
      };
      lista_confianca: {
        Row: {
          incluido_em: string;
          incluido_por: string;
          profissional_id: string;
          setor_id: string;
        };
        ComputedFields: never;
        Insert: {
          incluido_em?: string;
          incluido_por: string;
          profissional_id: string;
          setor_id: string;
        };
        Update: {
          incluido_em?: string;
          incluido_por?: string;
          profissional_id?: string;
          setor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lista_confianca_incluido_por_fkey";
            columns: ["incluido_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lista_confianca_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: true;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lista_confianca_setor_id_fkey";
            columns: ["setor_id"];
            isOneToOne: false;
            referencedRelation: "setor";
            referencedColumns: ["id"];
          },
        ];
      };
      perfil: {
        Row: {
          categoria: Database["public"]["Enums"]["categoria_profissional"] | null;
          conselho_numero: string | null;
          conselho_uf: string | null;
          criado_em: string;
          especialidade_id: string | null;
          hospital_id: string;
          id: string;
          nome: string;
          papel: Database["public"]["Enums"]["papel"];
          setor_id: string;
        };
        ComputedFields: never;
        Insert: {
          categoria?: Database["public"]["Enums"]["categoria_profissional"] | null;
          conselho_numero?: string | null;
          conselho_uf?: string | null;
          criado_em?: string;
          especialidade_id?: string | null;
          hospital_id: string;
          id: string;
          nome: string;
          papel: Database["public"]["Enums"]["papel"];
          setor_id: string;
        };
        Update: {
          categoria?: Database["public"]["Enums"]["categoria_profissional"] | null;
          conselho_numero?: string | null;
          conselho_uf?: string | null;
          criado_em?: string;
          especialidade_id?: string | null;
          hospital_id?: string;
          id?: string;
          nome?: string;
          papel?: Database["public"]["Enums"]["papel"];
          setor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "perfil_especialidade_id_categoria_fkey";
            columns: ["especialidade_id", "categoria"];
            isOneToOne: false;
            referencedRelation: "especialidade";
            referencedColumns: ["id", "categoria"];
          },
          {
            foreignKeyName: "perfil_hospital_id_fkey";
            columns: ["hospital_id"];
            isOneToOne: false;
            referencedRelation: "hospital";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "perfil_setor_id_hospital_id_fkey";
            columns: ["setor_id", "hospital_id"];
            isOneToOne: false;
            referencedRelation: "setor";
            referencedColumns: ["id", "hospital_id"];
          },
        ];
      };
      plantao: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          criado_por: string;
          especialidade_id: string;
          fim: string;
          hospital_id: string;
          id: string;
          inicio: string;
          profissional_id: string | null;
          setor_id: string;
          status: string | null;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          criado_por: string;
          especialidade_id: string;
          fim: string;
          hospital_id: string;
          id?: string;
          inicio: string;
          profissional_id?: string | null;
          setor_id: string;
          status?: never;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string;
          especialidade_id?: string;
          fim?: string;
          hospital_id?: string;
          id?: string;
          inicio?: string;
          profissional_id?: string | null;
          setor_id?: string;
          status?: never;
        };
        Relationships: [
          {
            foreignKeyName: "plantao_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plantao_especialidade_id_fkey";
            columns: ["especialidade_id"];
            isOneToOne: false;
            referencedRelation: "especialidade";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plantao_hospital_id_fkey";
            columns: ["hospital_id"];
            isOneToOne: false;
            referencedRelation: "hospital";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plantao_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "perfil";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plantao_setor_id_hospital_id_fkey";
            columns: ["setor_id", "hospital_id"];
            isOneToOne: false;
            referencedRelation: "setor";
            referencedColumns: ["id", "hospital_id"];
          },
        ];
      };
      setor: {
        Row: {
          criado_em: string;
          hospital_id: string;
          id: string;
          nome: string;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          hospital_id: string;
          id?: string;
          nome: string;
        };
        Update: {
          criado_em?: string;
          hospital_id?: string;
          id?: string;
          nome?: string;
        };
        Relationships: [
          {
            foreignKeyName: "setor_hospital_id_fkey";
            columns: ["hospital_id"];
            isOneToOne: false;
            referencedRelation: "hospital";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      anunciar: {
        Args: {
          p_motivo_categoria?: Database["public"]["Enums"]["motivo_categoria"];
          p_motivo_texto?: string;
          p_plantao_id: string;
          p_urgencia: Database["public"]["Enums"]["urgencia"];
        };
        Returns: {
          anunciante_id: string;
          assumido_em: string | null;
          assumido_por: string | null;
          atualizado_em: string;
          criado_em: string;
          expira_em: string;
          id: string;
          plantao_id: string;
          status: Database["public"]["Enums"]["status_anuncio"];
          urgencia: Database["public"]["Enums"]["urgencia"];
        };
        SetofOptions: {
          from: "*";
          to: "anuncio";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      aprovar_candidatura: {
        Args: { p_candidatura_id: string };
        Returns: {
          atualizado_em: string;
          criado_em: string;
          id: string;
          plantao_id: string;
          profissional_id: string;
          status: Database["public"]["Enums"]["status_candidatura"];
        };
        SetofOptions: {
          from: "*";
          to: "candidatura";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      aprovar_troca: {
        Args: { p_anuncio_id: string };
        Returns: {
          anunciante_id: string;
          assumido_em: string | null;
          assumido_por: string | null;
          atualizado_em: string;
          criado_em: string;
          expira_em: string;
          id: string;
          plantao_id: string;
          status: Database["public"]["Enums"]["status_anuncio"];
          urgencia: Database["public"]["Enums"]["urgencia"];
        };
        SetofOptions: {
          from: "*";
          to: "anuncio";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      assumir_anuncio: {
        Args: { p_anuncio_id: string };
        Returns: {
          anunciante_id: string;
          assumido_em: string | null;
          assumido_por: string | null;
          atualizado_em: string;
          criado_em: string;
          expira_em: string;
          id: string;
          plantao_id: string;
          status: Database["public"]["Enums"]["status_anuncio"];
          urgencia: Database["public"]["Enums"]["urgencia"];
        };
        SetofOptions: {
          from: "*";
          to: "anuncio";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      candidatar: {
        Args: { p_plantao_id: string };
        Returns: {
          atualizado_em: string;
          criado_em: string;
          id: string;
          plantao_id: string;
          profissional_id: string;
          status: Database["public"]["Enums"]["status_candidatura"];
        };
        SetofOptions: {
          from: "*";
          to: "candidatura";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      criar_plantao: {
        Args: {
          p_especialidade_id: string;
          p_fim: string;
          p_inicio: string;
          p_profissional_id?: string;
        };
        Returns: {
          atualizado_em: string;
          criado_em: string;
          criado_por: string;
          especialidade_id: string;
          fim: string;
          hospital_id: string;
          id: string;
          inicio: string;
          profissional_id: string | null;
          setor_id: string;
          status: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "plantao";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      definir_confianca: {
        Args: { p_confiavel: boolean; p_profissional_id: string };
        Returns: undefined;
      };
      desistir_anuncio: {
        Args: { p_anuncio_id: string };
        Returns: {
          anunciante_id: string;
          assumido_em: string | null;
          assumido_por: string | null;
          atualizado_em: string;
          criado_em: string;
          expira_em: string;
          id: string;
          plantao_id: string;
          status: Database["public"]["Enums"]["status_anuncio"];
          urgencia: Database["public"]["Enums"]["urgencia"];
        };
        SetofOptions: {
          from: "*";
          to: "anuncio";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      desistir_candidatura: {
        Args: { p_candidatura_id: string };
        Returns: {
          atualizado_em: string;
          criado_em: string;
          id: string;
          plantao_id: string;
          profissional_id: string;
          status: Database["public"]["Enums"]["status_candidatura"];
        };
        SetofOptions: {
          from: "*";
          to: "candidatura";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      editar_plantao: {
        Args: {
          p_especialidade_id: string;
          p_fim: string;
          p_id: string;
          p_inicio: string;
          p_profissional_id?: string;
        };
        Returns: {
          atualizado_em: string;
          criado_em: string;
          criado_por: string;
          especialidade_id: string;
          fim: string;
          hospital_id: string;
          id: string;
          inicio: string;
          profissional_id: string | null;
          setor_id: string;
          status: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "plantao";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      equipe_do_setor: {
        Args: Record<PropertyKey, never>;
        Returns: {
          categoria: Database["public"]["Enums"]["categoria_profissional"];
          confiavel: boolean;
          especialidade: string;
          id: string;
          nome: string;
        }[];
      };
      marcar_avisos_lidos: { Args: Record<PropertyKey, never>; Returns: undefined };
      minhas_solicitacoes: {
        Args: Record<PropertyKey, never>;
        Returns: {
          anunciante: string;
          especialidade: string;
          fim: string;
          id: string;
          inicio: string;
          plantao_id: string;
          tipo: string;
        }[];
      };
      ofertas_para_mim: {
        Args: Record<PropertyKey, never>;
        Returns: {
          anunciante: string;
          anuncio_id: string;
          especialidade: string;
          expira_em: string;
          fim: string;
          inicio: string;
          ja_candidatei: boolean;
          motivos: string[];
          plantao_id: string;
          tipo: string;
          urgencia: Database["public"]["Enums"]["urgencia"];
        }[];
      };
      pendencias_do_setor: {
        Args: Record<PropertyKey, never>;
        Returns: {
          anunciante: string;
          especialidade: string;
          fim: string;
          id: string;
          inicio: string;
          motivos: string[];
          plantao_id: string;
          solicitado_em: string;
          solicitante: string;
          tipo: string;
          urgencia: Database["public"]["Enums"]["urgencia"];
        }[];
      };
      recusar_candidatura: {
        Args: { p_candidatura_id: string };
        Returns: {
          atualizado_em: string;
          criado_em: string;
          id: string;
          plantao_id: string;
          profissional_id: string;
          status: Database["public"]["Enums"]["status_candidatura"];
        };
        SetofOptions: {
          from: "*";
          to: "candidatura";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      recusar_troca: {
        Args: { p_anuncio_id: string };
        Returns: {
          anunciante_id: string;
          assumido_em: string | null;
          assumido_por: string | null;
          atualizado_em: string;
          criado_em: string;
          expira_em: string;
          id: string;
          plantao_id: string;
          status: Database["public"]["Enums"]["status_anuncio"];
          urgencia: Database["public"]["Enums"]["urgencia"];
        };
        SetofOptions: {
          from: "*";
          to: "anuncio";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      remover_plantao: { Args: { p_id: string }; Returns: undefined };
    };
    Enums: {
      categoria_profissional: "medico" | "enfermeiro";
      motivo_categoria: "saude" | "pessoal" | "outro";
      papel: "profissional" | "gestor";
      status_anuncio: "aberto" | "pendente" | "aprovado" | "recusado" | "cancelado" | "expirado";
      status_candidatura: "pendente" | "aprovada" | "recusada" | "desistida" | "cancelada";
      urgencia: "normal" | "urgente";
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      categoria_profissional: ["medico", "enfermeiro"],
      motivo_categoria: ["saude", "pessoal", "outro"],
      papel: ["profissional", "gestor"],
      status_anuncio: ["aberto", "pendente", "aprovado", "recusado", "cancelado", "expirado"],
      status_candidatura: ["pendente", "aprovada", "recusada", "desistida", "cancelada"],
      urgencia: ["normal", "urgente"],
    },
  },
} as const;
