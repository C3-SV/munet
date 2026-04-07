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

export type PostRow = {
  id: string;
  author_membership_id: string;
  post_type: string;
  content: string;
  title: string | null;
  status: string;
  deleted_by_actor_type: 'AUTHOR' | 'ADMIN' | null;
  created_at: string;
  updated_at: string;
  event_memberships:
    | {
        id: string;
        role: string;
        delegation_name: string | null;
        institution_name: string | null;
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

export const POST_SELECT = `
  id,
  author_membership_id,
  post_type,
  content,
  title,
  status,
  deleted_by_actor_type,
  created_at,
  updated_at,
  event_memberships!posts_author_membership_id_fkey (
    id,
    role,
    delegation_name,
    institution_name,
    committee_id,
    committees (
      name,
      code
    ),
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
