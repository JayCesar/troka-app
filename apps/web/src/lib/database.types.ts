
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "especialidade": {
                  Row: {
                    "categoria": Database["public"]['Enums']["categoria_profissional"],"id": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "categoria": Database["public"]['Enums']["categoria_profissional"],"id"?: string,"nome": string
                  }
                  Update: {
                    "categoria"?: Database["public"]['Enums']["categoria_profissional"],"id"?: string,"nome"?: string
                  }
                  Relationships: [
                    
                  ]
                },"hospital": {
                  Row: {
                    "criado_em": string,"id": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"id"?: string,"nome": string
                  }
                  Update: {
                    "criado_em"?: string,"id"?: string,"nome"?: string
                  }
                  Relationships: [
                    
                  ]
                },"perfil": {
                  Row: {
                    "categoria": Database["public"]['Enums']["categoria_profissional"] | null,"conselho_numero": string | null,"conselho_uf": string | null,"criado_em": string,"especialidade_id": string | null,"hospital_id": string,"id": string,"nome": string,"papel": Database["public"]['Enums']["papel"],"setor_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "categoria"?: Database["public"]['Enums']["categoria_profissional"] | null,"conselho_numero"?: string | null,"conselho_uf"?: string | null,"criado_em"?: string,"especialidade_id"?: string | null,"hospital_id": string,"id": string,"nome": string,"papel": Database["public"]['Enums']["papel"],"setor_id": string
                  }
                  Update: {
                    "categoria"?: Database["public"]['Enums']["categoria_profissional"] | null,"conselho_numero"?: string | null,"conselho_uf"?: string | null,"criado_em"?: string,"especialidade_id"?: string | null,"hospital_id"?: string,"id"?: string,"nome"?: string,"papel"?: Database["public"]['Enums']["papel"],"setor_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "perfil_especialidade_id_categoria_fkey"
      columns: ["especialidade_id","categoria"]
isOneToOne: false
      referencedRelation: "especialidade"
      referencedColumns: ["id","categoria"]
    },{
      foreignKeyName: "perfil_hospital_id_fkey"
      columns: ["hospital_id"]
isOneToOne: false
      referencedRelation: "hospital"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "perfil_setor_id_hospital_id_fkey"
      columns: ["setor_id","hospital_id"]
isOneToOne: false
      referencedRelation: "setor"
      referencedColumns: ["id","hospital_id"]
    }
                  ]
                },"setor": {
                  Row: {
                    "criado_em": string,"hospital_id": string,"id": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"hospital_id": string,"id"?: string,"nome": string
                  }
                  Update: {
                    "criado_em"?: string,"hospital_id"?: string,"id"?: string,"nome"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "setor_hospital_id_fkey"
      columns: ["hospital_id"]
isOneToOne: false
      referencedRelation: "hospital"
      referencedColumns: ["id"]
    }
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
            "categoria_profissional": "medico"|"enfermeiro","papel": "profissional"|"gestor"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "categoria_profissional": ["medico", "enfermeiro"],"papel": ["profissional", "gestor"]
          }
        }
} as const
