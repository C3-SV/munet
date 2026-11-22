import type { Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../utils/audit.logger';

const POST_STATE = 'id, event_id, wall_id, author_membership_id, status, deleted_at, deleted_by_membership_id, deleted_by_membership_uuid, is_pinned, pinned_at, pinned_by_membership_id';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMMENT_STATE = 'id, event_id, post_id, author_membership_id, status, deleted_at, deleted_by_actor_type, deleted_by_membership_uuid';

type Profile = { first_name: string; last_name: string; display_name?: string | null; alias?: string | null };
type Author = {
  id: string; participant_code: string; delegation_code: string | null;
  profiles: Profile | Profile[] | null;
  committees: { id: string; name: string; code: string } | { id: string; name: string; code: string }[] | null;
};
type ModerationRow = {
  id: string; status: string; author_membership_id: string;
  deleted_by_membership_uuid: string | null; author: Author | Author[] | null;
};
const first = <T>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;
const profileName = (profile: Profile | null) => profile
  ? profile.display_name || `${profile.first_name} ${profile.last_name}`.trim() || null : null;
const authorSelect = (table: string) => `author:event_memberships!${table}_author_membership_id_fkey (
  id, participant_code, delegation_code,
  profiles (first_name, last_name, display_name, alias), committees (id, name, code)
)`;
const statusFilter = (req: Request) => {
  const value = req.query.status ?? 'VISIBLE';
  return typeof value === 'string' && ['VISIBLE', 'DELETED', 'ALL'].includes(value) ? value : null;
};
const positiveInteger = (value: unknown, fallback: number, max: number) => {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number <= max ? number : null;
};

const withHistory = async (row: ModerationRow, eventId: string, isPost: boolean) => {
  const author = first(row.author);
  const profile = first(author?.profiles);
  let deletedByName: string | null = null;
  let deletionReason: string | null = null;
  if (row.status === 'DELETED') {
    if (row.deleted_by_membership_uuid) {
      const { data, error } = await supabaseAdmin.from('profiles')
        .select('first_name, last_name, display_name').eq('event_membership_id', row.deleted_by_membership_uuid).maybeSingle();
      if (error) throw error;
      deletedByName = profileName(data);
    }
    // El motivo solo existe en auditoria; los borrados antiguos pueden no tenerlo.
    const { data, error } = await supabaseAdmin.from('audit_logs').select('reason')
      .eq('event_id', eventId).eq('entity_id', row.id)
      .eq('action_type', isPost ? 'MODERATE_DELETE_POST' : 'MODERATE_DELETE_COMMENT')
      .eq('outcome', 'SUCCESS').order('created_at', { ascending: false })
      .order('id', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    deletionReason = data?.reason ?? null;
  }
  return {
    ...row,
    author: {
      membership_id: row.author_membership_id,
      name: profileName(profile), alias: profile?.alias ?? null,
      participant_code: author?.participant_code ?? null,
      delegation_code: author?.delegation_code ?? null,
      committee: first(author?.committees),
    },
    deleted_by_name: deletedByName,
    deletion_reason: deletionReason,
  };
};

// Metadatos del adjunto por post (sin URL), acotados al evento. Sin posts no consulta.
const loadAttachments = async (postIds: string[], eventId: string) => {
  const byPost = new Map<string, { id: string; name: string; mimeType: string; size: number }>();
  if (postIds.length === 0) return byPost;
  const { data, error } = await supabaseAdmin.from('attachments')
    .select('id, post_id, file_name, mime_type, size_bytes')
    .eq('event_id', eventId).in('post_id', postIds);
  if (error) throw error;
  for (const row of (data ?? []) as { id: string; post_id: string; file_name: string; mime_type: string; size_bytes: number }[]) {
    byPost.set(row.post_id, { id: row.id, name: row.file_name, mimeType: row.mime_type, size: Number(row.size_bytes) });
  }
  return byPost;
};

export const listModerationWalls = async (req: Request, res: Response) => {
  const eventId = req.auth!.currentMembership!.eventId;
  try {
    const walls = [];
    // Pagina internamente para no truncar eventos que superen el limite de PostgREST.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabaseAdmin.from('walls')
        .select('id, event_id, committee_id, wall_type, name, status')
        .eq('event_id', eventId).eq('status', 'ACTIVE').is('deleted_at', null)
        .order('wall_type').order('name').order('id').range(offset, offset + 499);
      if (error) throw error;
      for (const wall of data ?? []) {
        const visible = await supabaseAdmin.from('posts').select('id', { count: 'exact', head: true })
          .eq('event_id', eventId).eq('wall_id', wall.id).eq('status', 'VISIBLE');
        const pinned = await supabaseAdmin.from('posts').select('id', { count: 'exact', head: true })
          .eq('event_id', eventId).eq('wall_id', wall.id).eq('status', 'VISIBLE').eq('is_pinned', true);
        if (visible.error) throw visible.error;
        if (pinned.error) throw pinned.error;
        walls.push({ ...wall, visible_posts: visible.count ?? 0, pinned_posts: pinned.count ?? 0 });
      }
      if ((data?.length ?? 0) < 500) break;
    }
    return res.json({ walls });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudieron listar los muros' });
  }
};

// Solo lectura para moderadores: nombre y codigo de las personas activas del evento, sin datos de contacto.
export const listModerationPeople = async (req: Request, res: Response) => {
  const eventId = req.auth!.currentMembership!.eventId;
  try {
    const people: { id: string; participant_code: string; first_name: string; last_name: string; alias: string | null }[] = [];
    // Pagina internamente por id para no truncar eventos grandes.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabaseAdmin.from('event_memberships')
        .select('id, participant_code, profiles (first_name, last_name, alias)')
        .eq('event_id', eventId).is('deleted_at', null)
        .order('id').range(offset, offset + 499);
      if (error) throw error;
      for (const row of (data ?? []) as unknown as { id: string; participant_code: string; profiles: Profile | Profile[] | null }[]) {
        const profile = first(row.profiles);
        people.push({
          id: row.id, participant_code: row.participant_code,
          first_name: profile?.first_name ?? '', last_name: profile?.last_name ?? '', alias: profile?.alias ?? null,
        });
      }
      if ((data?.length ?? 0) < 500) break;
    }
    people.sort((a, b) => a.last_name.localeCompare(b.last_name, 'es') || a.first_name.localeCompare(b.first_name, 'es')
      || a.participant_code.localeCompare(b.participant_code) || a.id.localeCompare(b.id));
    return res.json({ people });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudieron listar las personas' });
  }
};

export const listModerationPosts = async (req: Request, res: Response) => {
  const status = statusFilter(req);
  const page = positiveInteger(req.query.page, 1, 1_000_000);
  const limit = positiveInteger(req.query.limit, 20, 100);
  if (!status || !page || !limit || typeof req.query.wall_id !== 'string' || !req.query.wall_id.trim()) {
    return res.status(400).json({ error: 'wall_id, status, page o limit invalidos' });
  }
  // Filtro opcional por persona (membership) dentro del muro; sin el parametro no cambia nada.
  const rawAuthor = req.query.author_membership_id;
  let authorMembershipId: string | undefined;
  if (rawAuthor !== undefined) {
    if (typeof rawAuthor !== 'string' || !UUID_PATTERN.test(rawAuthor)) {
      return res.status(400).json({ error: 'author_membership_id debe ser un UUID' });
    }
    authorMembershipId = rawAuthor;
  }
  const eventId = req.auth!.currentMembership!.eventId;
  try {
    if (authorMembershipId) {
      // La membresia debe pertenecer al evento del contexto; si no, no revela si existe en otro evento.
      const { data: author, error: authorError } = await supabaseAdmin.from('event_memberships')
        .select('id').eq('id', authorMembershipId).eq('event_id', eventId).maybeSingle();
      if (authorError) throw authorError;
      if (!author) return res.status(404).json({ error: 'La persona no pertenece a este evento' });
    }
    let query = supabaseAdmin.from('posts')
      .select(`${POST_STATE}, post_type, title, content, created_at, updated_at, ${authorSelect('posts')}`, { count: 'exact' })
      .eq('event_id', eventId).eq('wall_id', req.query.wall_id);
    if (status !== 'ALL') query = query.eq('status', status);
    if (authorMembershipId) query = query.eq('author_membership_id', authorMembershipId);
    const { data, count, error } = await query
      .order('is_pinned', { ascending: false }).order('pinned_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as ModerationRow[];
    const posts = [];
    for (const row of rows) posts.push(await withHistory(row, eventId, true));
    // Una consulta por página: moderación ve el adjunto aunque el post esté eliminado, hasta la purga.
    const attachments = await loadAttachments(rows.map(row => row.id), eventId);
    return res.json({
      posts: posts.map(post => ({ ...post, attachment: attachments.get(post.id) ?? null })),
      pagination: { page, limit, total: count ?? 0, total_pages: Math.ceil((count ?? 0) / limit) },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudieron listar los posts' });
  }
};

export const listModerationComments = async (req: Request, res: Response) => {
  const status = statusFilter(req);
  if (!status) return res.status(400).json({ error: 'status debe ser VISIBLE, DELETED o ALL' });
  const eventId = req.auth!.currentMembership!.eventId;
  try {
    const comments = [];
    for (let offset = 0; ; offset += 500) {
      let query = supabaseAdmin.from('post_comments')
        .select(`${COMMENT_STATE}, parent_comment_id, content, created_at, updated_at, ${authorSelect('post_comments')}`)
        .eq('event_id', eventId).eq('post_id', String(req.params.postId));
      if (status !== 'ALL') query = query.eq('status', status);
      const { data, error } = await query.order('created_at', { ascending: true }).order('id').range(offset, offset + 499);
      if (error) throw error;
      for (const row of (data ?? []) as unknown as ModerationRow[]) comments.push(await withHistory(row, eventId, false));
      if ((data?.length ?? 0) < 500) break;
    }
    return res.json({ comments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudieron listar los comentarios' });
  }
};

const deleteResource = async (req: Request, res: Response, isPost: boolean) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 3 || reason.length > 500) {
    return res.status(400).json({ error: 'reason debe tener entre 3 y 500 caracteres' });
  }
  const membership = req.auth!.currentMembership!;
  const table = isPost ? 'posts' : 'post_comments';
  const id = String(isPost ? req.params.postId : req.params.commentId);
  const select = isPost ? POST_STATE : COMMENT_STATE;
  try {
    const { data: resource, error } = await supabaseAdmin.from(table).select(select)
      .eq('id', id).eq('event_id', membership.eventId)
      .maybeSingle<{ status: string; author_membership_id: string }>();
    if (error) throw error;
    if (!resource) return res.status(404).json({ error: isPost ? 'Post no encontrado' : 'Comentario no encontrado' });
    if (resource.status === 'DELETED') return res.status(409).json({ error: 'El recurso ya estaba eliminado' });

    const { data: updated, error: updateError } = await supabaseAdmin.from(table).update({
      status: 'DELETED',
      deleted_at: new Date().toISOString(),
      // El tipo de actor y su UUID viven en columnas distintas en el esquema vigente.
      [isPost ? 'deleted_by_membership_id' : 'deleted_by_actor_type']: 'ADMIN',
      deleted_by_membership_uuid: membership.id,
      updated_by_membership_id: membership.id,
      ...(isPost ? { is_pinned: false, pinned_at: null, pinned_by_membership_id: null } : {}),
    }).eq('id', id).eq('event_id', membership.eventId).eq('status', resource.status)
      .select(select).maybeSingle();
    if (updateError) throw updateError;
    // La condicion de estado impide auditar dos borrados simultaneos como exitosos.
    if (!updated) return res.status(409).json({ error: 'El recurso cambio; vuelve a cargarlo' });
    await logAudit({
      eventId: membership.eventId, membership, targetMembershipId: resource.author_membership_id,
      actionType: isPost ? 'MODERATE_DELETE_POST' : 'MODERATE_DELETE_COMMENT',
      entityType: isPost ? 'POST' : 'COMMENT', entityId: id, outcome: 'SUCCESS', reason,
    });
    return res.json({ [isPost ? 'post' : 'comment']: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo eliminar el recurso' });
  }
};

export const deleteModerationPost = (req: Request, res: Response) => deleteResource(req, res, true);
export const deleteModerationComment = (req: Request, res: Response) => deleteResource(req, res, false);

// Serializa el conteo y la escritura en esta instancia. Entre instancias hace falta
// una transaccion en la base para garantizar el cupo, pendiente sin migraciones.
const pinQueues = new Map<string, Promise<void>>();
const setPinned = async (req: Request, res: Response, pinned: boolean) => {
  const membership = req.auth!.currentMembership!;
  const previous = pinQueues.get(membership.eventId) ?? Promise.resolve();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  pinQueues.set(membership.eventId, pending);
  await previous;
  try {
    const id = String(req.params.postId);
    const { data: post, error } = await supabaseAdmin.from('posts').select(POST_STATE)
      .eq('id', id).eq('event_id', membership.eventId).maybeSingle();
    if (error) throw error;
    if (!post) return res.status(404).json({ error: 'Post no encontrado' });
    if (post.status !== 'VISIBLE') return res.status(409).json({ error: 'Solo se pueden fijar o desfijar posts VISIBLE' });
    if (post.is_pinned === pinned) return res.json({ post });
    if (pinned) {
      const { count, error: countError } = await supabaseAdmin.from('posts').select('id', { count: 'exact', head: true })
        .eq('event_id', membership.eventId).eq('wall_id', post.wall_id)
        .eq('status', 'VISIBLE').eq('is_pinned', true);
      if (countError) throw countError;
      if (count === null) throw new Error('No se pudo contar los fijados');
      if ((count ?? 0) >= 3) return res.status(409).json({ error: 'El muro ya tiene 3 posts fijados. Desfija uno primero.' });
    }
    const { data: updated, error: updateError } = await supabaseAdmin.from('posts').update({
      is_pinned: pinned,
      pinned_at: pinned ? new Date().toISOString() : null,
      pinned_by_membership_id: pinned ? membership.id : null,
      updated_by_membership_id: membership.id,
    }).eq('id', id).eq('event_id', membership.eventId).eq('status', 'VISIBLE')
      .eq('is_pinned', post.is_pinned).select(POST_STATE).maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return res.status(409).json({ error: 'El post cambio; vuelve a cargarlo' });
    await logAudit({
      eventId: membership.eventId, membership, targetMembershipId: post.author_membership_id,
      actionType: pinned ? 'PIN_POST' : 'UNPIN_POST', entityType: 'POST', entityId: id,
      outcome: 'SUCCESS', reason: pinned ? 'Post fijado desde moderacion' : 'Post desfijado desde moderacion',
    });
    return res.json({ post: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo cambiar el fijado del post' });
  } finally {
    release();
    if (pinQueues.get(membership.eventId) === pending) pinQueues.delete(membership.eventId);
  }
};

export const pinModerationPost = (req: Request, res: Response) => setPinned(req, res, true);
export const unpinModerationPost = (req: Request, res: Response) => setPinned(req, res, false);
