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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      article_relations: {
        Row: {
          article_id: string
          position: number
          related_id: string
        }
        Insert: {
          article_id: string
          position?: number
          related_id: string
        }
        Update: {
          article_id?: string
          position?: number
          related_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_relations_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_relations_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_tags: {
        Row: {
          article_id: string
          tag_id: string
        }
        Insert: {
          article_id: string
          tag_id: string
        }
        Update: {
          article_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_tags_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          author_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          draft_data: Json
          excerpt: string | null
          featured_asset_id: string | null
          id: string
          issue_no: string | null
          published_at: string | null
          published_data: Json | null
          reading_minutes: number | null
          scheduled_for: string | null
          slug: string
          status: string
          subtitle: string | null
          template: string
          template_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          author_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          draft_data?: Json
          excerpt?: string | null
          featured_asset_id?: string | null
          id?: string
          issue_no?: string | null
          published_at?: string | null
          published_data?: Json | null
          reading_minutes?: number | null
          scheduled_for?: string | null
          slug: string
          status?: string
          subtitle?: string | null
          template?: string
          template_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          author_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          draft_data?: Json
          excerpt?: string | null
          featured_asset_id?: string | null
          id?: string
          issue_no?: string | null
          published_at?: string | null
          published_data?: Json | null
          reading_minutes?: number | null
          scheduled_for?: string | null
          slug?: string
          status?: string
          subtitle?: string | null
          template?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_featured_asset_id_fkey"
            columns: ["featured_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      authors: {
        Row: {
          avatar_id: string | null
          bio: string | null
          created_at: string
          id: string
          links: Json
          name: string
          role: string | null
          slug: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_id?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          links?: Json
          name: string
          role?: string | null
          slug: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_id?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          links?: Json
          name?: string
          role?: string | null
          slug?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authors_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          created_by: string | null
          draft_data: Json
          hero_asset_id: string | null
          id: string
          intro: string | null
          name: string
          position: number
          published_at: string | null
          published_data: Json | null
          slug: string
          status: string
          template_id: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          draft_data?: Json
          hero_asset_id?: string | null
          id?: string
          intro?: string | null
          name: string
          position?: number
          published_at?: string | null
          published_data?: Json | null
          slug: string
          status?: string
          template_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          draft_data?: Json
          hero_asset_id?: string | null
          id?: string
          intro?: string | null
          name?: string
          position?: number
          published_at?: string | null
          published_data?: Json | null
          slug?: string
          status?: string
          template_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_hero_asset_id_fkey"
            columns: ["hero_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_field_mappings: {
        Row: {
          created_at: string
          fallback: string | null
          id: string
          is_required: boolean
          source_id: string
          source_path: string
          target_field: string
          transform: string | null
        }
        Insert: {
          created_at?: string
          fallback?: string | null
          id?: string
          is_required?: boolean
          source_id: string
          source_path: string
          target_field: string
          transform?: string | null
        }
        Update: {
          created_at?: string
          fallback?: string | null
          id?: string
          is_required?: boolean
          source_id?: string
          source_path?: string
          target_field?: string
          transform?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_field_mappings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "product_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      import_items: {
        Row: {
          action: string
          content_hash: string | null
          created_at: string
          diff: Json | null
          error: string | null
          external_id: string | null
          id: string
          job_id: string
          normalised_payload: Json | null
          product_id: string | null
          raw_payload: Json | null
          status: string
        }
        Insert: {
          action: string
          content_hash?: string | null
          created_at?: string
          diff?: Json | null
          error?: string | null
          external_id?: string | null
          id?: string
          job_id: string
          normalised_payload?: Json | null
          product_id?: string | null
          raw_payload?: Json | null
          status?: string
        }
        Update: {
          action?: string
          content_hash?: string | null
          created_at?: string
          diff?: Json | null
          error?: string | null
          external_id?: string | null
          id?: string
          job_id?: string
          normalised_payload?: Json | null
          product_id?: string | null
          raw_payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          created_count: number
          error_summary: string | null
          failed_count: number
          finished_at: string | null
          id: string
          requested_by: string | null
          source_id: string
          started_at: string | null
          status: string
          total_count: number
          trigger: string
          unchanged_count: number
          updated_count: number
        }
        Insert: {
          created_at?: string
          created_count?: number
          error_summary?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          requested_by?: string | null
          source_id: string
          started_at?: string | null
          status?: string
          total_count?: number
          trigger?: string
          unchanged_count?: number
          updated_count?: number
        }
        Update: {
          created_at?: string
          created_count?: number
          error_summary?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          requested_by?: string | null
          source_id?: string
          started_at?: string | null
          status?: string
          total_count?: number
          trigger?: string
          unchanged_count?: number
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "product_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          detail: Json
          error: string | null
          finished_at: string | null
          id: string
          job_key: string
          started_at: string
          status: string
        }
        Insert: {
          detail?: Json
          error?: string | null
          finished_at?: string | null
          id?: string
          job_key: string
          started_at?: string
          status: string
        }
        Update: {
          detail?: Json
          error?: string | null
          finished_at?: string | null
          id?: string
          job_key?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      media_asset_tags: {
        Row: {
          asset_id: string
          tag_id: string
        }
        Insert: {
          asset_id: string
          tag_id: string
        }
        Update: {
          asset_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_asset_tags_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_asset_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "media_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt_text: string | null
          bucket: string
          byte_size: number
          caption: string | null
          checksum: string | null
          created_at: string
          created_by: string | null
          credit: string | null
          duration_ms: number | null
          external_url: string | null
          file_name: string
          focal_point: Json
          folder_id: string | null
          height: number | null
          id: string
          kind: string
          mime_type: string
          placeholder: string | null
          search_vector: unknown
          storage_path: string
          title: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          bucket?: string
          byte_size?: number
          caption?: string | null
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          credit?: string | null
          duration_ms?: number | null
          external_url?: string | null
          file_name: string
          focal_point?: Json
          folder_id?: string | null
          height?: number | null
          id?: string
          kind: string
          mime_type: string
          placeholder?: string | null
          search_vector?: unknown
          storage_path: string
          title?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          bucket?: string
          byte_size?: number
          caption?: string | null
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          credit?: string | null
          duration_ms?: number | null
          external_url?: string | null
          file_name?: string
          focal_point?: Json
          folder_id?: string | null
          height?: number | null
          id?: string
          kind?: string
          mime_type?: string
          placeholder?: string | null
          search_vector?: unknown
          storage_path?: string
          title?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "media_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      media_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "media_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      media_tags: {
        Row: {
          id: string
          label: string
          slug: string
        }
        Insert: {
          id?: string
          label: string
          slug: string
        }
        Update: {
          id?: string
          label?: string
          slug?: string
        }
        Relationships: []
      }
      media_usages: {
        Row: {
          asset_id: string
          created_at: string
          entity_id: string
          entity_type: string
          field_path: string | null
          id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          field_path?: string | null
          id?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          field_path?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_usages_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          created_at: string
          id: string
          label: string
          link_type: string
          menu_id: string
          options: Json
          parent_id: string | null
          position: number
          target_id: string | null
          updated_at: string
          url: string | null
          visibility: Json
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          link_type?: string
          menu_id: string
          options?: Json
          parent_id?: string | null
          position?: number
          target_id?: string | null
          updated_at?: string
          url?: string | null
          visibility?: Json
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          link_type?: string
          menu_id?: string
          options?: Json
          parent_id?: string | null
          position?: number
          target_id?: string | null
          updated_at?: string
          url?: string | null
          visibility?: Json
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          id: string
          key: string
          location: string | null
          name: string
          published_at: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          location?: string | null
          name: string
          published_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          location?: string | null
          name?: string
          published_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      form_submissions: {
        Row: {
          created_at: string
          form_key: string
          id: string
          page_path: string | null
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          form_key: string
          id?: string
          page_path?: string | null
          payload: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          form_key?: string
          id?: string
          page_path?: string | null
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pages: {
        Row: {
          created_at: string
          created_by: string | null
          draft_data: Json
          id: string
          is_system: boolean
          published_at: string | null
          published_data: Json | null
          scheduled_for: string | null
          slug: string
          status: string
          template_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          draft_data?: Json
          id?: string
          is_system?: boolean
          published_at?: string | null
          published_data?: Json | null
          scheduled_for?: string | null
          slug: string
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          draft_data?: Json
          id?: string
          is_system?: boolean
          published_at?: string | null
          published_data?: Json | null
          scheduled_for?: string | null
          slug?: string
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pattern_categories: {
        Row: {
          id: string
          label: string
          position: number
          slug: string
        }
        Insert: {
          id?: string
          label: string
          position?: number
          slug: string
        }
        Update: {
          id?: string
          label?: string
          position?: number
          slug?: string
        }
        Relationships: []
      }
      patterns: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          draft_data: Json
          id: string
          key: string
          name: string
          preview_asset_id: string | null
          published_at: string | null
          published_data: Json | null
          status: string
          sync_mode: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          draft_data?: Json
          id?: string
          key: string
          name: string
          preview_asset_id?: string | null
          published_at?: string | null
          published_data?: Json | null
          status?: string
          sync_mode?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          draft_data?: Json
          id?: string
          key?: string
          name?: string
          preview_asset_id?: string | null
          published_at?: string | null
          published_data?: Json | null
          status?: string
          sync_mode?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "patterns_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "pattern_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patterns_preview_asset_id_fkey"
            columns: ["preview_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          description: string | null
          key: string
          resource: string
        }
        Insert: {
          action: string
          description?: string | null
          key: string
          resource: string
        }
        Update: {
          action?: string
          description?: string | null
          key?: string
          resource?: string
        }
        Relationships: []
      }
      preview_sessions: {
        Row: {
          context: Json
          created_at: string
          created_by: string | null
          device: string
          entity_id: string | null
          entity_type: string
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          context?: Json
          created_at?: string
          created_by?: string | null
          device?: string
          entity_id?: string | null
          entity_type: string
          expires_at?: string
          id?: string
          token: string
        }
        Update: {
          context?: Json
          created_at?: string
          created_by?: string | null
          device?: string
          entity_id?: string | null
          entity_type?: string
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: []
      }
      product_collection_items: {
        Row: {
          collection_id: string
          position: number
          product_id: string
        }
        Insert: {
          collection_id: string
          position?: number
          product_id: string
        }
        Update: {
          collection_id?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "product_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_collection_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          position: number
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_media: {
        Row: {
          asset_id: string
          position: number
          product_id: string
          role: string
        }
        Insert: {
          asset_id: string
          position?: number
          product_id: string
          role?: string
        }
        Update: {
          asset_id?: string
          position?: number
          product_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sources: {
        Row: {
          config: Json
          created_at: string
          credentials_ref: string | null
          enabled: boolean
          id: string
          kind: string
          last_status: string | null
          last_synced_at: string | null
          name: string
          sync_schedule: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          credentials_ref?: string | null
          enabled?: boolean
          id?: string
          kind: string
          last_status?: string | null
          last_synced_at?: string | null
          name: string
          sync_schedule?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          credentials_ref?: string | null
          enabled?: boolean
          id?: string
          kind?: string
          last_status?: string | null
          last_synced_at?: string | null
          name?: string
          sync_schedule?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          availability: string
          created_at: string
          external_id: string | null
          id: string
          options: Json
          position: number
          price_pence: number | null
          product_id: string
          sku: string | null
          stock: number
          title: string
          updated_at: string
        }
        Insert: {
          availability?: string
          created_at?: string
          external_id?: string | null
          id?: string
          options?: Json
          position?: number
          price_pence?: number | null
          product_id: string
          sku?: string | null
          stock?: number
          title: string
          updated_at?: string
        }
        Update: {
          availability?: string
          created_at?: string
          external_id?: string | null
          id?: string
          options?: Json
          position?: number
          price_pence?: number | null
          product_id?: string
          sku?: string | null
          stock?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          affiliate: Json
          availability: string
          badges: string[]
          blurb: string | null
          cat: string | null
          cat_label: string | null
          compare_at_pence: number | null
          content_hash: string | null
          created_at: string
          created_by: string | null
          currency: string
          draft_data: Json
          external_id: string | null
          fulfilment: string
          id: string
          material: string | null
          name: string
          position: number
          price_pence: number
          published_at: string | null
          published_data: Json | null
          sku: string | null
          slug: string
          source_id: string | null
          specs: Json
          status: string
          stock: number
          story: string | null
          track_inventory: boolean
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          affiliate?: Json
          availability?: string
          badges?: string[]
          blurb?: string | null
          cat?: string | null
          cat_label?: string | null
          compare_at_pence?: number | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          draft_data?: Json
          external_id?: string | null
          fulfilment?: string
          id?: string
          material?: string | null
          name: string
          position?: number
          price_pence?: number
          published_at?: string | null
          published_data?: Json | null
          sku?: string | null
          slug: string
          source_id?: string | null
          specs?: Json
          status?: string
          stock?: number
          story?: string | null
          track_inventory?: boolean
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          affiliate?: Json
          availability?: string
          badges?: string[]
          blurb?: string | null
          cat?: string | null
          cat_label?: string | null
          compare_at_pence?: number | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          draft_data?: Json
          external_id?: string | null
          fulfilment?: string
          id?: string
          material?: string | null
          name?: string
          position?: number
          price_pence?: number
          published_at?: string | null
          published_data?: Json | null
          sku?: string | null
          slug?: string
          source_id?: string | null
          specs?: Json
          status?: string
          stock?: number
          story?: string | null
          track_inventory?: boolean
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "product_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_member: boolean
          member_since: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_member?: boolean
          member_since?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_member?: boolean
          member_since?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      publish_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          from_version: number | null
          id: string
          note: string | null
          to_version: number | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          from_version?: number | null
          id?: string
          note?: string | null
          to_version?: number | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          from_version?: number | null
          id?: string
          note?: string | null
          to_version?: number | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      redirects: {
        Row: {
          created_at: string
          from_path: string
          id: string
          status_code: number
          to_path: string
        }
        Insert: {
          created_at?: string
          from_path: string
          id?: string
          status_code?: number
          to_path: string
        }
        Update: {
          created_at?: string
          from_path?: string
          id?: string
          status_code?: number
          to_path?: string
        }
        Relationships: []
      }
      revisions: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          entity_id: string
          entity_type: string
          id: string
          label: string | null
          note: string | null
          reason: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: Json
          entity_id: string
          entity_type: string
          id?: string
          label?: string | null
          note?: string | null
          reason?: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          entity_id?: string
          entity_type?: string
          id?: string
          label?: string | null
          note?: string | null
          reason?: string
          version?: number
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_key: string
          role_key: string
        }
        Insert: {
          permission_key: string
          role_key: string
        }
        Update: {
          permission_key?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          is_system: boolean
          key: string
          label: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_system?: boolean
          key: string
          label: string
        }
        Update: {
          created_at?: string
          description?: string | null
          is_system?: boolean
          key?: string
          label?: string
        }
        Relationships: []
      }
      scheduled_jobs: {
        Row: {
          created_at: string
          cron: string
          enabled: boolean
          id: string
          key: string
          kind: string
          last_run_at: string | null
          next_run_at: string | null
          payload: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          cron: string
          enabled?: boolean
          id?: string
          key: string
          kind: string
          last_run_at?: string | null
          next_run_at?: string | null
          payload?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          cron?: string
          enabled?: boolean
          id?: string
          key?: string
          kind?: string
          last_run_at?: string | null
          next_run_at?: string | null
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      tags: {
        Row: {
          id: string
          label: string
          slug: string
        }
        Insert: {
          id?: string
          label: string
          slug: string
        }
        Update: {
          id?: string
          label?: string
          slug?: string
        }
        Relationships: []
      }
      template_assignments: {
        Row: {
          content_type: string | null
          created_at: string
          entry_id: string | null
          id: string
          priority: number
          scope: string
          taxonomy_slug: string | null
          template_id: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          entry_id?: string | null
          id?: string
          priority?: number
          scope: string
          taxonomy_slug?: string | null
          template_id: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          entry_id?: string | null
          id?: string
          priority?: number
          scope?: string
          taxonomy_slug?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          draft_data: Json
          id: string
          is_global: boolean
          key: string
          kind: string
          locked: boolean
          name: string
          published_at: string | null
          published_data: Json | null
          status: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          draft_data?: Json
          id?: string
          is_global?: boolean
          key: string
          kind: string
          locked?: boolean
          name: string
          published_at?: string | null
          published_data?: Json | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          draft_data?: Json
          id?: string
          is_global?: boolean
          key?: string
          kind?: string
          locked?: boolean
          name?: string
          published_at?: string | null
          published_data?: Json | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      theme_settings: {
        Row: {
          created_at: string
          draft_data: Json
          id: string
          key: string
          name: string
          published_at: string | null
          published_data: Json | null
          status: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          draft_data?: Json
          id?: string
          key?: string
          name?: string
          published_at?: string | null
          published_data?: Json | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          draft_data?: Json
          id?: string
          key?: string
          name?: string
          published_at?: string | null
          published_data?: Json | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role_key: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role_key: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      autosave_document: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: number
      }
      document_table: { Args: { p_entity_type: string }; Returns: string }
      has_permission: { Args: { permission: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      publish_document: {
        Args: { p_entity_id: string; p_entity_type: string; p_note?: string }
        Returns: number
      }
      purge_expired_preview_sessions: { Args: never; Returns: number }
      rate_limit_hit: {
        Args: { p_key: string; p_limit: number; p_window: string }
        Returns: boolean
      }
      replace_feed_mappings: {
        Args: { p_mappings: Json; p_source_id: string }
        Returns: undefined
      }
      resolve_preview: {
        Args: { p_token: string }
        Returns: {
          data: Json
          device: string
          entity_id: string
          entity_type: string
          expires_at: string
          context: Json
        }[]
      }
      rollback_document: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_note?: string
          p_version: number
        }
        Returns: number
      }
      run_due_publishes: {
        Args: { p_limit?: number }
        Returns: {
          category_slug: string
          entity_id: string
          entity_type: string
          slug: string
          version: number
        }[]
      }
      schedulable_document_table: {
        Args: { p_entity_type: string }
        Returns: string
      }
      schedule_document: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_note?: string
          p_when: string
        }
        Returns: number
      }
      snapshot_document: {
        Args: { p_entity_id: string; p_entity_type: string; p_label?: string }
        Returns: number
      }
      unpublish_document: {
        Args: { p_entity_id: string; p_entity_type: string; p_note?: string }
        Returns: number
      }
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
