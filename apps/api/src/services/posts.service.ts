import type { AuthMembership } from '../types/auth-context';
import { supabaseAdmin } from '../lib/supabase';
import { POST_SELECT, type PostRow } from '../types/posts.types';
import { findWallBySlug, mapPost } from '../utils/posts.utils';
import { isAdminRole } from '../utils/rbac.utils';
import { loadWallsByEvent, mapWallForMembership } from './walls.service';

const normalizePost = (post: PostRow, membership: AuthMembership) => {
  const isAdmin = isAdminRole(membership.role);
  const mapped = mapPost(post);

  return {
    ...mapped,
    canDelete: isAdmin || post.author_membership_id === membership.id,
  };
};

export const getPostsByWall = async (params: {
  muro?: string;
  eventId: string;
  membership: AuthMembership;
}) => {
  const muro = params.muro ?? 'general';

  const walls = await loadWallsByEvent(params.eventId);
  const matchedWall = findWallBySlug(walls, muro);

  if (!matchedWall) {
    return {
      status: 404,
      body: { error: 'Muro no encontrado' },
    };
  }

  const wallView = mapWallForMembership(matchedWall, params.membership);

  if (!wallView.canAccess) {
    return {
      status: 403,
      body: { error: 'No tienes acceso a este muro', wall: wallView },
    };
  }

  const { data: posts, error: postsError } = await supabaseAdmin
    .from('posts')
    .select(POST_SELECT)
    .eq('wall_id', matchedWall.id)
    .order('created_at', { ascending: false });

  if (postsError) {
    throw new Error(postsError.message);
  }

  const normalizedPosts = ((posts ?? []) as PostRow[])
    .filter((post) => post.status === 'VISIBLE' || post.status === 'DELETED')
    .map((post) => normalizePost(post, params.membership));

  return {
    status: 200,
    body: {
      wall: wallView,
      posts: normalizedPosts,
    },
  };
};

export const createPostService = async (payload: {
  muro?: string;
  content?: string;
  eventId: string;
  membership: AuthMembership;
}) => {
  const { muro = 'general', content, membership, eventId } = payload;

  if (!content?.trim()) {
    return {
      status: 400,
      body: { error: 'El contenido es obligatorio' },
    };
  }

  const walls = await loadWallsByEvent(eventId);
  const matchedWall = findWallBySlug(walls, String(muro));

  if (!matchedWall) {
    return {
      status: 404,
      body: { error: 'Muro no encontrado' },
    };
  }

  const wallView = mapWallForMembership(matchedWall, membership);

  if (!wallView.canAccess) {
    return {
      status: 403,
      body: { error: 'No tienes acceso a este muro' },
    };
  }

  if (!wallView.canPublish) {
    return {
      status: 403,
      body: { error: 'No tienes permisos para publicar en este muro' },
    };
  }

  const { data: insertedPost, error: insertError } = await supabaseAdmin
    .from('posts')
    .insert({
      event_id: eventId,
      wall_id: matchedWall.id,
      author_membership_id: membership.id,
      content: content.trim(),
    })
    .select(POST_SELECT)
    .single();

  if (insertError || !insertedPost) {
    return {
      status: 400,
      body: { error: insertError?.message ?? 'No se pudo crear el post' },
    };
  }

  return {
    status: 201,
    body: {
      post: normalizePost(insertedPost as PostRow, membership),
    },
  };
};

export const deletePostService = async (params: {
  postId: string;
  eventId: string;
  membership: AuthMembership;
}) => {
  const { data: post, error: postError } = await supabaseAdmin
    .from('posts')
    .select('id, event_id, wall_id, author_membership_id, status')
    .eq('id', params.postId)
    .maybeSingle();

  if (postError) {
    throw new Error(postError.message);
  }

  if (!post || post.event_id !== params.eventId) {
    return {
      status: 404,
      body: { error: 'Post no encontrado en este evento' },
    };
  }

  const walls = await loadWallsByEvent(params.eventId);
  const matchedWall = walls.find((wall) => wall.id === post.wall_id);

  if (!matchedWall) {
    return {
      status: 404,
      body: { error: 'Muro no encontrado' },
    };
  }

  const wallView = mapWallForMembership(matchedWall, params.membership);

  if (!wallView.canAccess) {
    return {
      status: 403,
      body: { error: 'No tienes acceso a este post' },
    };
  }

  const isAdmin = isAdminRole(params.membership.role);
  const isAuthor = post.author_membership_id === params.membership.id;

  if (!isAdmin && !isAuthor) {
    return {
      status: 403,
      body: { error: 'No tienes permisos para eliminar esta publicacion' },
    };
  }

  const deletedByActorType = isAuthor ? 'AUTHOR' : 'ADMIN';

  const { data: updatedPost, error: updateError } = await supabaseAdmin
    .from('posts')
    .update({
      status: 'DELETED',
      deleted_by_actor_type: deletedByActorType,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', post.id)
    .select(POST_SELECT)
    .single();

  if (updateError || !updatedPost) {
    return {
      status: 400,
      body: { error: updateError?.message ?? 'No se pudo eliminar el post' },
    };
  }

  return {
    status: 200,
    body: {
      post: normalizePost(updatedPost as PostRow, params.membership),
    },
  };
};
