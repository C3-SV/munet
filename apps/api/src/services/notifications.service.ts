import { supabaseAdmin } from '../lib/supabase';
import type { AuthMembership } from '../types/auth-context';
import { POST_SELECT, type PostRow } from '../types/posts.types';
import { mapPost } from '../utils/posts.utils';
import { listDmConversations } from './dm.service';
import { loadWallsByEvent, mapWallForMembership } from './walls.service';

// Pendientes de lectura de una membresía: avisos nuevos y mensajes directos sin leer.
//
// No existe una tabla de notificaciones: lo pendiente se calcula con las marcas de lectura.
//   * Mensajes: dm_messages.read_at (migración 004).
//   * Avisos: wall_reads.last_read_at (migración 005). Sin marca cuenta desde el alta de la membresía.

const LATEST_ANNOUNCEMENTS = 5;
const EXCERPT_LENGTH = 120;

const excerpt = (text: string | null | undefined) => {
  const compact = (text ?? '').replace(/\s+/g, ' ').trim();
  return compact.length > EXCERPT_LENGTH ? `${compact.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…` : compact;
};

// Muro de avisos del evento al que la membresía tiene acceso (si existe).
const findAnnouncementsWall = async (eventId: string, membership: AuthMembership) => {
  const walls = await loadWallsByEvent(eventId);

  for (const wall of walls) {
    const view = mapWallForMembership(wall, membership);

    if (view.kind === 'announcements' && view.canAccess) {
      return view;
    }
  }

  return null;
};

const loadLastReadAt = async (membership: AuthMembership, wallId: string) => {
  const { data, error } = await supabaseAdmin
    .from('wall_reads')
    .select('last_read_at')
    .eq('membership_id', membership.id)
    .eq('wall_id', wallId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  // Sin marca: lo publicado desde que la persona entró al evento cuenta como nuevo.
  return (data?.last_read_at as string | undefined) ?? membership.createdAt ?? new Date(0).toISOString();
};

const loadAnnouncementsSummary = async (eventId: string, membership: AuthMembership) => {
  const wall = await findAnnouncementsWall(eventId, membership);

  if (!wall) {
    return null;
  }

  const lastReadAt = await loadLastReadAt(membership, wall.id);

  // Solo lo publicado por otras personas, visible y posterior a la última lectura.
  const base = () =>
    supabaseAdmin
      .from('posts')
      .select(POST_SELECT, { count: 'exact' })
      .eq('event_id', eventId)
      .eq('wall_id', wall.id)
      .eq('status', 'VISIBLE')
      .is('deleted_at', null)
      .neq('author_membership_id', membership.id)
      .gt('created_at', lastReadAt);

  const { data, error, count } = await base()
    .order('created_at', { ascending: false })
    .limit(LATEST_ANNOUNCEMENTS);

  if (error) {
    throw new Error(error.message);
  }

  const latest = ((data ?? []) as unknown as PostRow[]).map((row) => {
    const post = mapPost(row);

    return {
      postId: post.id,
      title: post.title,
      excerpt: excerpt(post.content),
      createdAt: post.createdAt,
      author: { name: post.user.name, alias: post.user.alias, avatar: post.user.avatar },
    };
  });

  return {
    wallId: wall.id,
    slug: wall.slug,
    name: wall.name,
    lastReadAt,
    unreadCount: count ?? latest.length,
    latest,
  };
};

export const getNotificationSummary = async (params: { eventId: string; membership: AuthMembership }) => {
  const [conversations, announcementsResult] = await Promise.all([
    listDmConversations(params),
    // Si faltara la tabla de lecturas de avisos, los mensajes siguen funcionando.
    loadAnnouncementsSummary(params.eventId, params.membership).catch((error: Error) => {
      console.error('No se pudo calcular los avisos sin leer:', error.message);
      return null;
    }),
  ]);

  const dms = conversations.body.conversations
    .filter((conversation) => conversation.unreadCount > 0)
    .map((conversation) => ({
      conversationId: conversation.id,
      unreadCount: conversation.unreadCount,
      otherParticipant: conversation.otherParticipant,
      lastMessage: excerpt(conversation.lastMessage),
      lastMessageAt: conversation.lastMessageAt,
    }));

  const unreadDms = dms.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
  const unreadAnnouncements = announcementsResult?.unreadCount ?? 0;

  return {
    status: 200,
    body: {
      // Todas las conversaciones activas: la pantalla se suscribe a ellas para enterarse al instante.
      conversationIds: conversations.body.conversations.map((conversation) => conversation.id),
      unread: {
        total: unreadDms + unreadAnnouncements,
        dms: unreadDms,
        announcements: unreadAnnouncements,
      },
      announcements: announcementsResult,
      dms,
    },
  };
};

// Marca el muro de avisos como leído hasta este momento.
export const markAnnouncementsRead = async (params: { eventId: string; membership: AuthMembership }) => {
  const wall = await findAnnouncementsWall(params.eventId, params.membership);

  if (!wall) {
    return { status: 404, body: { error: 'Este evento no tiene muro de avisos' } };
  }

  const readAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('wall_reads')
    .upsert(
      { membership_id: params.membership.id, wall_id: wall.id, last_read_at: readAt },
      { onConflict: 'membership_id,wall_id' }
    );

  if (error) {
    throw new Error(error.message);
  }

  return { status: 200, body: { readAt } };
};
