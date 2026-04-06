import { supabaseAdmin } from '../lib/supabase';
import type { AuthMembership } from '../types/auth-context';
import { firstItem, getProfileName } from '../utils/posts.utils';
import { loadWallsByEvent, mapWallForMembership } from './walls.service';

type CommentRow = {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  event_memberships:
    | {
        id: string;
        role: string;
        profiles:
          | {
              first_name: string;
              last_name: string;
              display_name: string | null;
              profile_image_path: string | null;
            }
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
        profiles:
          | {
              first_name: string;
              last_name: string;
              display_name: string | null;
              profile_image_path: string | null;
            }
          | {
              first_name: string;
              last_name: string;
              display_name: string | null;
              profile_image_path: string | null;
            }[]
          | null;
      }[]
    | null;
};

const COMMENT_SELECT = `
  id,
  post_id,
  parent_comment_id,
  content,
  created_at,
  updated_at,
  event_memberships!post_comments_author_membership_id_fkey (
    id,
    role,
    profiles (
      first_name,
      last_name,
      display_name,
      profile_image_path
    )
  )
`;

const mapComment = (row: CommentRow) => {
  const membership = firstItem(row.event_memberships);
  const profile = firstItem(membership?.profiles);

  return {
    id: row.id,
    postId: row.post_id,
    parentCommentId: row.parent_comment_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    timestamp: new Date(row.created_at).getTime(),
    user: {
      id: membership?.id ?? 'unknown',
      name: getProfileName(profile),
      avatar:
        profile?.profile_image_path ??
        'https://ui-avatars.com/api/?name=Participante&background=E5E7EB&color=111827',
      role: membership?.role ?? 'DELEGADO',
    },
  };
};

const ensurePostAccess = async (params: {
  postId: string;
  eventId: string;
  membership: AuthMembership;
}) => {
  const { data: post, error } = await supabaseAdmin
    .from('posts')
    .select('id, event_id, wall_id')
    .eq('id', params.postId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!post || post.event_id !== params.eventId) {
    return {
      allowed: false,
      status: 404,
      error: 'Post no encontrado en este evento',
    };
  }

  const walls = await loadWallsByEvent(params.eventId);
  const matchedWall = walls.find((wall) => wall.id === post.wall_id);

  if (!matchedWall) {
    return {
      allowed: false,
      status: 404,
      error: 'Muro no encontrado',
    };
  }

  const wallView = mapWallForMembership(matchedWall, params.membership);

  if (!wallView.canAccess) {
    return {
      allowed: false,
      status: 403,
      error: 'No tienes acceso a los comentarios de este post',
    };
  }

  return {
    allowed: true as const,
  };
};

export const listCommentsByPost = async (params: {
  postId: string;
  eventId: string;
  membership: AuthMembership;
}) => {
  const access = await ensurePostAccess(params);

  if (!access.allowed) {
    return {
      status: access.status,
      body: { error: access.error },
    };
  }

  const { data, error } = await supabaseAdmin
    .from('post_comments')
    .select(COMMENT_SELECT)
    .eq('post_id', params.postId)
    .eq('status', 'VISIBLE')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return {
    status: 200,
    body: {
      comments: ((data ?? []) as CommentRow[]).map(mapComment),
    },
  };
};

export const createPostComment = async (params: {
  postId: string;
  eventId: string;
  membership: AuthMembership;
  content?: string;
  parentCommentId?: string | null;
}) => {
  const access = await ensurePostAccess(params);

  if (!access.allowed) {
    return {
      status: access.status,
      body: { error: access.error },
    };
  }

  const content = params.content?.trim();

  if (!content) {
    return {
      status: 400,
      body: { error: 'El comentario no puede estar vacio' },
    };
  }

  const parentCommentId = params.parentCommentId?.trim() || null;

  if (parentCommentId) {
    const { data: parent, error: parentError } = await supabaseAdmin
      .from('post_comments')
      .select('id, post_id, parent_comment_id')
      .eq('id', parentCommentId)
      .maybeSingle();

    if (parentError) {
      throw new Error(parentError.message);
    }

    if (!parent || parent.post_id !== params.postId) {
      return {
        status: 404,
        body: { error: 'Comentario padre no encontrado para este post' },
      };
    }

    if (parent.parent_comment_id) {
      return {
        status: 400,
        body: { error: 'Solo se permite un nivel de respuesta' },
      };
    }
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('post_comments')
    .insert({
      event_id: params.eventId,
      post_id: params.postId,
      author_membership_id: params.membership.id,
      parent_comment_id: parentCommentId,
      content,
      status: 'VISIBLE',
    })
    .select(COMMENT_SELECT)
    .single();

  if (error || !inserted) {
    return {
      status: 400,
      body: { error: error?.message ?? 'No se pudo crear el comentario' },
    };
  }

  return {
    status: 201,
    body: {
      comment: mapComment(inserted as CommentRow),
    },
  };
};
