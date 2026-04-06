/**
 * Representa un muro tal como viene desde Supabase.
 * Puede ser un muro general, de avisos o asociado a un comité.
 */
export type WallRecord = {
  id: string;
  event_id: string;
  name: string;
  wall_type: string;
  committee_id: string | null;
  committees:
    | {
        name: string | null;
        code: string | null;
      }
    | {
        name: string | null;
        code: string | null;
      }[]
    | null;
};

/**
 * Representa un post crudo traído desde Supabase.
 * Incluye relaciones anidadas con membership, profile y tags de comité.
 */
export type PostRow = {
  id: string;
  content: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  event_memberships:
    | {
        id: string;
        role: string;
        delegation_name: string | null;
        institution_name: string | null;
        profiles:
          | {
              first_name: string;
              last_name: string;
              display_name: string | null;
              profile_image_path: string | null;
            }[]
          | null;
      }
    | {
        id: string;
        role: string;
        delegation_name: string | null;
        institution_name: string | null;
        profiles:
          | {
              first_name: string;
              last_name: string;
              display_name: string | null;
              profile_image_path: string | null;
            }[]
          | null;
      }[]
    | null;
  post_committee_tags:
    | {
        committee_id: string;
        committees:
          | {
              name: string | null;
              code: string | null;
            }
          | {
              name: string | null;
              code: string | null;
            }[]
          | null;
      }[]
    | null;
};

/**
 * Campos que se seleccionan al consultar posts.
 * Se deja en una constante para reutilizarla en listados y creación.
 */
export const POST_SELECT = `
  id,
  content,
  title,
  created_at,
  updated_at,
  event_memberships!posts_author_membership_id_fkey (
    id,
    role,
    delegation_name,
    institution_name,
    profiles (
      first_name,
      last_name,
      display_name,
      profile_image_path
    )
  ),
  post_committee_tags (
    committee_id,
    committees (
      name,
      code
    )
  )
`;