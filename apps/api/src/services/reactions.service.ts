import { supabaseAdmin } from '../lib/supabase';
import type { AuthMembership } from '../types/auth-context';
import {
  emptyReactionSummary,
  isReactionType,
  summarizeReactions,
  type ReactionSummary,
} from '../utils/reactions.utils';
import { loadWallsByEvent, mapWallForMembership } from './walls.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_REACTION_LOOKUP = 100;

// Lee las reacciones de varias publicaciones con una sola consulta y las agrupa.
export const loadReactionSummaries = async (params: {
  postIds: string[];
  eventId: string;
  membershipId: string;
}): Promise<Map<string, ReactionSummary>> => {
  if (params.postIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from('post_reactions')
    .select('post_id, membership_id, reaction')
    .eq('event_id', params.eventId)
    .in('post_id', params.postIds);

  if (error) {
    // Las reacciones son accesorias: si no se pueden leer, el feed sigue funcionando sin ellas.
    console.error('No se pudieron leer las reacciones:', error.message);
    return new Map(params.postIds.map((id) => [id, emptyReactionSummary()]));
  }

  return summarizeReactions(params.postIds, data ?? [], params.membershipId);
};

// Añade `reactions` a cada publicación del feed.
export const attachReactions = async <T extends { id: string }>(params: {
  posts: T[];
  eventId: string;
  membershipId: string;
}) => {
  const summaries = await loadReactionSummaries({
    postIds: params.posts.map((post) => post.id),
    eventId: params.eventId,
    membershipId: params.membershipId,
  });

  return params.posts.map((post) => ({ ...post, reactions: summaries.get(post.id) ?? emptyReactionSummary() }));
};

type PostAccess =
  | { allowed: true; wallId: string }
  | { allowed: false; status: number; error: string };

// Valida que la publicación exista en el evento, esté visible y que la persona tenga acceso al
// muro. Las reacciones son de los canales (general y de comité), no de los avisos.
const ensureReactablePost = async (params: {
  postId: string;
  eventId: string;
  membership: AuthMembership;
}): Promise<PostAccess> => {
  if (!UUID_PATTERN.test(params.postId)) {
    return { allowed: false, status: 404, error: 'Post no encontrado en este evento' };
  }

  const { data: post, error } = await supabaseAdmin
    .from('posts')
    .select('id, event_id, wall_id, status')
    .eq('id', params.postId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!post || post.event_id !== params.eventId || post.status !== 'VISIBLE') {
    return { allowed: false, status: 404, error: 'Post no encontrado en este evento' };
  }

  const walls = await loadWallsByEvent(params.eventId);
  const wall = walls.find((item) => item.id === post.wall_id);

  if (!wall) {
    return { allowed: false, status: 404, error: 'Muro no encontrado' };
  }

  const view = mapWallForMembership(wall, params.membership);

  if (!view.canAccess) {
    return { allowed: false, status: 403, error: 'No tienes acceso a este post' };
  }

  if (view.kind === 'announcements') {
    return { allowed: false, status: 403, error: 'Las reacciones están disponibles en los canales, no en los avisos' };
  }

  return { allowed: true, wallId: post.wall_id as string };
};

const summaryFor = async (postId: string, eventId: string, membershipId: string) =>
  (await loadReactionSummaries({ postIds: [postId], eventId, membershipId })).get(postId) ?? emptyReactionSummary();

// Agrega la reacción de la persona o la cambia por otra (una por publicación).
export const setPostReaction = async (params: {
  postId: string;
  eventId: string;
  membership: AuthMembership;
  reaction: unknown;
}) => {
  if (!isReactionType(params.reaction)) {
    return { status: 400, body: { error: 'reaction debe ser LIKE, LOVE, LAUGH o CLAP' } };
  }

  const access = await ensureReactablePost(params);

  if (!access.allowed) {
    return { status: access.status, body: { error: access.error } };
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('post_reactions')
    .upsert(
      {
        post_id: params.postId,
        membership_id: params.membership.id,
        event_id: params.eventId,
        wall_id: access.wallId,
        reaction: params.reaction,
        updated_at: now,
      },
      { onConflict: 'post_id,membership_id' }
    );

  if (error) {
    throw new Error(error.message);
  }

  return {
    status: 200,
    body: { reactions: await summaryFor(params.postId, params.eventId, params.membership.id) },
  };
};

// Retira la reacción de la persona (si no tenía, no pasa nada).
export const removePostReaction = async (params: {
  postId: string;
  eventId: string;
  membership: AuthMembership;
}) => {
  const access = await ensureReactablePost(params);

  if (!access.allowed) {
    return { status: access.status, body: { error: access.error } };
  }

  const { error } = await supabaseAdmin
    .from('post_reactions')
    .delete()
    .eq('post_id', params.postId)
    .eq('membership_id', params.membership.id);

  if (error) {
    throw new Error(error.message);
  }

  return {
    status: 200,
    body: { reactions: await summaryFor(params.postId, params.eventId, params.membership.id) },
  };
};

// Reacciones de varias publicaciones, solo de muros a los que la persona tiene acceso. La
// pantalla lo usa para refrescar los contadores cuando llega un cambio en tiempo real.
export const listReactionsForPosts = async (params: {
  postIds: string[];
  eventId: string;
  membership: AuthMembership;
}) => {
  const ids = [...new Set(params.postIds)].filter((id) => UUID_PATTERN.test(id));

  if (ids.length === 0 || ids.length > MAX_REACTION_LOOKUP) {
    return {
      status: 400,
      body: { error: `ids debe tener entre 1 y ${MAX_REACTION_LOOKUP} identificadores de publicación` },
    };
  }

  const { data: posts, error } = await supabaseAdmin
    .from('posts')
    .select('id, wall_id')
    .eq('event_id', params.eventId)
    .eq('status', 'VISIBLE')
    .is('deleted_at', null)
    .in('id', ids);

  if (error) {
    throw new Error(error.message);
  }

  const walls = await loadWallsByEvent(params.eventId);
  const accessibleWalls = new Set(
    walls.filter((wall) => mapWallForMembership(wall, params.membership).canAccess).map((wall) => wall.id)
  );
  const allowedIds = ((posts ?? []) as { id: string; wall_id: string }[])
    .filter((post) => accessibleWalls.has(post.wall_id))
    .map((post) => post.id);

  const summaries = await loadReactionSummaries({
    postIds: allowedIds,
    eventId: params.eventId,
    membershipId: params.membership.id,
  });

  return { status: 200, body: { reactions: Object.fromEntries(summaries) } };
};
