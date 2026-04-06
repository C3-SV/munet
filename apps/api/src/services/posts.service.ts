import type { AuthMembership } from '../types/auth-context';
import { supabaseAdmin } from '../lib/supabase';
import { POST_SELECT, type PostRow } from '../types/posts.types';
import { findWallBySlug, mapPost } from '../utils/posts.utils';
import { loadWallsByEvent, mapWallForMembership } from './walls.service';

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
    .eq('status', 'VISIBLE')
    .order('created_at', { ascending: false });

  if (postsError) {
    throw new Error(postsError.message);
  }

  return {
    status: 200,
    body: {
      wall: wallView,
      posts: ((posts ?? []) as PostRow[]).map(mapPost),
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
      post: mapPost(insertedPost as PostRow),
    },
  };
};
