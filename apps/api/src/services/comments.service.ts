import { supabaseAdmin } from '../lib/supabase';
import type { AuthMembership } from '../types/auth-context';
import { logAudit } from '../utils/audit.logger';
import { firstItem, getCommitteeLabel, getProfileName } from '../utils/posts.utils';
import { isAdminRole } from '../utils/rbac.utils';
import { loadWallsByEvent, mapWallForMembership } from './walls.service';

type CommentRow = {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  content: string;
  status: string;
  deleted_by_actor_type: 'AUTHOR' | 'ADMIN' | null;
  author_membership_id: string;
  created_at: string;
  updated_at: string;
  event_memberships:
    | {
        id: string;
        role: string;
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
  status,
  deleted_by_actor_type,
  author_membership_id,
  created_at,
  updated_at,
  event_memberships!post_comments_author_membership_id_fkey (
    id,
    role,
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
  )
`;

const buildDeletedMessage = (deletedByActorType: 'AUTHOR' | 'ADMIN' | null) => {
  if (deletedByActorType === 'ADMIN') {
    return 'Este comentario fue eliminado por un administrador.';
  }

  return 'Este comentario fue eliminado por el autor.';
};

const mapComment = (row: CommentRow, membership: AuthMembership) => {
  const commentAuthorMembership = firstItem(row.event_memberships);
  const profile = firstItem(commentAuthorMembership?.profiles);
  const authorCommittee = getCommitteeLabel(firstItem(commentAuthorMembership?.committees));
  const isDeleted = row.status === 'DELETED';

  return {
    id: row.id,
    postId: row.post_id,
    parentCommentId: row.parent_comment_id,
    content: isDeleted ? buildDeletedMessage(row.deleted_by_actor_type) : row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    timestamp: new Date(row.created_at).getTime(),
    isDeleted,
    deletedByActorType: row.deleted_by_actor_type,
    canDelete: isAdminRole(membership.role) || row.author_membership_id === membership.id,
    user: {
      id: commentAuthorMembership?.id ?? 'unknown',
      name: getProfileName(profile),
      committeeName: authorCommittee,
      avatar:
        profile?.profile_image_path ??
        'https://ui-avatars.com/api/?name=Participante&background=E5E7EB&color=111827',
      role: commentAuthorMembership?.role ?? 'DELEGADO',
    },
  };
};

type EnsurePostAccessResult =
  | {
      allowed: true;
      postStatus: string;
      wall: ReturnType<typeof mapWallForMembership>;
    }
  | {
      allowed: false;
      status: number;
      error: string;
    };

const ensurePostAccess = async (params: {
  postId: string;
  eventId: string;
  membership: AuthMembership;
}): Promise<EnsurePostAccessResult> => {
  const { data: post, error } = await supabaseAdmin
    .from('posts')
    .select('id, event_id, wall_id, status')
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
    postStatus: post.status,
    wall: wallView,
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
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const comments = ((data ?? []) as CommentRow[])
    .filter((comment) => comment.status === 'VISIBLE' || comment.status === 'DELETED')
    .map((comment) => mapComment(comment, params.membership));

  return {
    status: 200,
    body: {
      comments,
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

  if (access.postStatus === 'DELETED') {
    return {
      status: 400,
      body: { error: 'No puedes comentar en una publicacion eliminada' },
    };
  }

  if (access.wall.kind === 'announcements' && !access.wall.canPublish) {
    return {
      status: 403,
      body: { error: 'No tienes permisos para comentar en avisos' },
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

  await logAudit({
    eventId: params.eventId,
    membership: params.membership,
    actionType: 'CREATE_COMMENT',
    entityType: 'COMMENT',
    entityId: inserted.id,
    outcome: 'SUCCESS',
    reason: `Comentario creado en post ${params.postId}`,
  });

  return {
    status: 201,
    body: {
      comment: mapComment(inserted as CommentRow, params.membership),
    },
  };
};

export const deletePostComment = async (params: {
  postId: string;
  commentId: string;
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

  const { data: comment, error: commentError } = await supabaseAdmin
    .from('post_comments')
    .select('id, post_id, author_membership_id')
    .eq('id', params.commentId)
    .maybeSingle();

  if (commentError) {
    throw new Error(commentError.message);
  }

  if (!comment || comment.post_id !== params.postId) {
    return {
      status: 404,
      body: { error: 'Comentario no encontrado en este post' },
    };
  }

  const isAdmin = isAdminRole(params.membership.role);
  const isAuthor = comment.author_membership_id === params.membership.id;

  if (!isAdmin && !isAuthor) {
    return {
      status: 403,
      body: { error: 'No tienes permisos para eliminar este comentario' },
    };
  }

  const deletedByActorType = isAuthor ? 'AUTHOR' : 'ADMIN';

  const { data: updatedComment, error: updateError } = await supabaseAdmin
    .from('post_comments')
    .update({
      status: 'DELETED',
      deleted_by_actor_type: deletedByActorType,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', params.commentId)
    .select(COMMENT_SELECT)
    .single();

  if (updateError || !updatedComment) {
    return {
      status: 400,
      body: { error: updateError?.message ?? 'No se pudo eliminar el comentario' },
    };
  }

  await logAudit({
    eventId: params.eventId,
    membership: params.membership,
    actionType: 'DELETE_COMMENT',
    entityType: 'COMMENT',
    entityId: params.commentId,
    outcome: 'SUCCESS',
    reason: `Comentario eliminado por ${deletedByActorType} en post ${params.postId}`,
  });

  return {
    status: 200,
    body: {
      comment: mapComment(updatedComment as CommentRow, params.membership),
    },
  };
};
