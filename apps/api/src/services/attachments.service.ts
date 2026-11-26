import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../lib/supabase';
import { getFileStorage } from '../lib/storage';
import type { AuthMembership } from '../types/auth-context';
import {
  buildFinalKey,
  buildPendingKey,
  detectAttachmentMime,
  isUuid,
  validateAttachmentMeta,
  ATTACHMENT_SNIFF_BYTES,
} from '../utils/attachments.utils';
import { logAudit } from '../utils/audit.logger';
import { findWallBySlug } from '../utils/posts.utils';
import { loadWallsByEvent, mapWallForMembership } from './walls.service';

// Adjuntos de publicaciones (ADR-006). La API autoriza; el navegador sube y descarga
// directamente de almacenamiento con URL firmadas de corta vida.

export type ServiceResult = { status: number; body: Record<string, unknown> };

export const UPLOAD_URL_SECONDS = 300;
export const UPLOAD_VALID_MINUTES = 15;
export const DOWNLOAD_URL_SECONDS = 60;
export const MAX_PENDING_UPLOADS = 3;
export const MAX_UPLOADS_PER_HOUR = 20;

// Reintentos de la copia a la ruta final. Se puede sustituir en pruebas.
export const attachmentSettings = { copyRetryDelaysMs: [150, 500] };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const fail = (status: number, error: string): ServiceResult => ({ status, body: { error } });

// Traduce un fallo del almacenamiento a una respuesta; null si no es de almacenamiento.
const storageFailure = (error: unknown): ServiceResult | null => {
  const named = error as { name?: string; code?: string; cause?: unknown; message?: string } | null;

  if (named?.name !== 'StorageError') {
    return null;
  }

  if (named.code === 'NOT_CONFIGURED') {
    console.error(named.message);
    return fail(503, 'Los adjuntos no están disponibles por ahora.');
  }

  console.error('Fallo de almacenamiento de adjuntos:', named.cause ?? named.message);
  return fail(502, 'No se pudo acceder al almacenamiento de archivos. Intenta de nuevo.');
};

// ---------------------------------------------------------------------------
// 1) Inicio de una subida

export const initAttachmentUpload = async (params: {
  eventId: string;
  membership: AuthMembership;
  muro?: string;
  fileName?: unknown;
  mimeType?: unknown;
  size?: unknown;
}): Promise<ServiceResult> => {
  const meta = validateAttachmentMeta({ fileName: params.fileName, mimeType: params.mimeType, size: params.size });

  if (!meta.ok) {
    return fail(400, meta.error);
  }

  const walls = await loadWallsByEvent(params.eventId);
  const wall = findWallBySlug(walls, String(params.muro ?? 'general'));

  if (!wall) {
    return fail(404, 'Muro no encontrado');
  }

  const wallView = mapWallForMembership(wall, params.membership);

  if (!wallView.canAccess) {
    return fail(403, 'No tienes acceso a este muro');
  }

  if (!wallView.canPublish) {
    return fail(403, 'No tienes permisos para publicar en este muro');
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const hourAgoIso = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  // Los límites salen de la base, no de memoria: valen entre instancias serverless.
  const pending = await supabaseAdmin
    .from('attachment_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('membership_id', params.membership.id)
    .is('consumed_at', null)
    .gt('expires_at', nowIso);

  if (pending.error || pending.count === null) {
    throw new Error(pending.error?.message ?? 'No se pudo contar las subidas pendientes');
  }

  if (pending.count >= MAX_PENDING_UPLOADS) {
    return fail(429, 'Tienes varias subidas sin terminar. Espera unos minutos e intenta de nuevo.');
  }

  const recent = await supabaseAdmin
    .from('attachment_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('membership_id', params.membership.id)
    .gte('created_at', hourAgoIso);

  if (recent.error || recent.count === null) {
    throw new Error(recent.error?.message ?? 'No se pudo contar las subidas recientes');
  }

  if (recent.count >= MAX_UPLOADS_PER_HOUR) {
    return fail(429, 'Alcanzaste el máximo de archivos por hora. Intenta más tarde.');
  }

  const uploadId = randomUUID();
  const storageKey = buildPendingKey(params.eventId, uploadId);

  try {
    // Se firma antes de guardar: si falla, no queda ningún intento registrado.
    const presigned = await getFileStorage().presignUpload({
      key: storageKey,
      contentType: meta.value.mimeType,
      contentLength: meta.value.size,
      expiresInSeconds: UPLOAD_URL_SECONDS,
    });

    const { error: insertError } = await supabaseAdmin.from('attachment_uploads').insert({
      id: uploadId,
      event_id: params.eventId,
      membership_id: params.membership.id,
      wall_id: wall.id,
      storage_key: storageKey,
      file_name: meta.value.fileName,
      mime_type: meta.value.mimeType,
      size_bytes: meta.value.size,
      expires_at: new Date(now.getTime() + UPLOAD_VALID_MINUTES * 60 * 1000).toISOString(),
    });

    if (insertError) {
      throw new Error(insertError.message);
    }

    return {
      status: 201,
      body: {
        upload: {
          id: uploadId,
          url: presigned.url,
          method: presigned.method,
          headers: presigned.headers,
          expiresAt: presigned.expiresAt.toISOString(),
        },
      },
    };
  } catch (error) {
    const mapped = storageFailure(error);

    if (mapped) {
      return mapped;
    }

    throw error;
  }
};

// ---------------------------------------------------------------------------
// 2) Reclamo del intento al crear el post (orden y compensaciones: plan §2.2)

export type ClaimedUpload = {
  uploadId: string;
  eventId: string;
  membershipId: string;
  pendingKey: string;
  finalKey: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export type ClaimOutcome =
  | { kind: 'error'; result: ServiceResult }
  | { kind: 'replay'; postId: string }
  | { kind: 'claimed'; claim: ClaimedUpload };

type UploadRow = {
  id: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

const releaseClaim = async (uploadId: string) => {
  const { error } = await supabaseAdmin
    .from('attachment_uploads')
    .update({ consumed_at: null, post_id: null })
    .eq('id', uploadId);

  if (error) {
    console.error('No se pudo liberar el intento de subida:', uploadId, error.message);
  }
};

// Marca el intento como gastado y descarta el objeto temporal inválido.
const rejectInvalidObject = async (claim: ClaimedUpload, message: string): Promise<ClaimOutcome> => {
  try {
    await getFileStorage().delete(claim.pendingKey);
  } catch (error) {
    console.error('No se pudo borrar el objeto temporal inválido:', error);
  }

  return { kind: 'error', result: fail(422, message) };
};

const copyWithRetries = async (claim: ClaimedUpload) => {
  const delays = attachmentSettings.copyRetryDelaysMs;

  for (let attempt = 0; ; attempt += 1) {
    try {
      await getFileStorage().copy(claim.pendingKey, claim.finalKey);
      return;
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;

      if (code === 'NOT_FOUND' || attempt >= delays.length) {
        throw error;
      }

      await sleep(delays[attempt]);
    }
  }
};

// Reclama el intento (un solo uso), verifica el objeto subido y lo copia a su ruta final.
// No toca la tabla de posts. Si devuelve `claimed`, quien llama debe terminar con
// attachClaimedUpload + completeClaim, o con abortClaim si algo falla después.
export const claimUploadForPost = async (params: {
  eventId: string;
  membership: AuthMembership;
  wallId: string;
  uploadId: unknown;
}): Promise<ClaimOutcome> => {
  if (!isUuid(params.uploadId)) {
    return { kind: 'error', result: fail(400, 'upload_id no es válido') };
  }

  const uploadId = params.uploadId;
  const nowIso = new Date().toISOString();

  // Actualización atómica: dos confirmaciones simultáneas no pueden reclamar el mismo intento.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('attachment_uploads')
    .update({ consumed_at: nowIso })
    .eq('id', uploadId)
    .eq('event_id', params.eventId)
    .eq('membership_id', params.membership.id)
    .eq('wall_id', params.wallId)
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .select('id, storage_key, file_name, mime_type, size_bytes')
    .maybeSingle();

  if (claimError) {
    throw new Error(claimError.message);
  }

  if (!claimed) {
    return explainFailedClaim({ ...params, uploadId });
  }

  const row = claimed as UploadRow;
  const claim: ClaimedUpload = {
    uploadId,
    eventId: params.eventId,
    membershipId: params.membership.id,
    pendingKey: row.storage_key,
    finalKey: buildFinalKey(params.eventId, uploadId, row.mime_type),
    fileName: row.file_name,
    mimeType: row.mime_type,
    size: Number(row.size_bytes),
  };

  try {
    const storage = getFileStorage();
    const info = await storage.head(claim.pendingKey);

    if (!info) {
      await releaseClaim(uploadId);
      return { kind: 'error', result: fail(422, 'El archivo no llegó al almacenamiento. Vuelve a intentarlo.') };
    }

    if (info.size !== claim.size) {
      return rejectInvalidObject(claim, 'El archivo subido no coincide con el declarado.');
    }

    if (info.contentType && info.contentType.toLowerCase() !== claim.mimeType) {
      return rejectInvalidObject(claim, 'El tipo del archivo subido no coincide con el declarado.');
    }

    const head = await storage.readRange(claim.pendingKey, 0, ATTACHMENT_SNIFF_BYTES - 1);

    if (head === null) {
      await releaseClaim(uploadId);
      return { kind: 'error', result: fail(422, 'El archivo no llegó al almacenamiento. Vuelve a intentarlo.') };
    }

    if (detectAttachmentMime(head) !== claim.mimeType) {
      return rejectInvalidObject(claim, 'El contenido del archivo no corresponde a un JPG, PNG o PDF válido.');
    }

    await copyWithRetries(claim);

    return { kind: 'claimed', claim };
  } catch (error) {
    await releaseClaim(uploadId);

    if ((error as { code?: string } | null)?.code === 'NOT_FOUND') {
      return { kind: 'error', result: fail(422, 'El archivo no llegó al almacenamiento. Vuelve a intentarlo.') };
    }

    const mapped = storageFailure(error);

    if (mapped) {
      return { kind: 'error', result: mapped };
    }

    throw error;
  }
};

// Distingue por qué no se pudo reclamar: inexistente o ajeno, otro muro, vencido o ya usado.
const explainFailedClaim = async (params: {
  eventId: string;
  membership: AuthMembership;
  wallId: string;
  uploadId: string;
}): Promise<ClaimOutcome> => {
  const { data, error } = await supabaseAdmin
    .from('attachment_uploads')
    .select('id, event_id, membership_id, wall_id, consumed_at, post_id, expires_at')
    .eq('id', params.uploadId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as {
    event_id: string;
    membership_id: string;
    wall_id: string;
    consumed_at: string | null;
    post_id: string | null;
    expires_at: string;
  } | null;

  // Un intento ajeno responde igual que uno inexistente: no revela su existencia.
  if (!row || row.event_id !== params.eventId || row.membership_id !== params.membership.id) {
    return { kind: 'error', result: fail(404, 'Subida no encontrada') };
  }

  if (row.consumed_at) {
    // Reintento tras un corte: devuelve el post ya creado en vez de duplicarlo.
    if (row.post_id) {
      return { kind: 'replay', postId: row.post_id };
    }

    return { kind: 'error', result: fail(409, 'Esta subida ya se está procesando o se descartó. Sube el archivo de nuevo.') };
  }

  if (row.wall_id !== params.wallId) {
    return { kind: 'error', result: fail(400, 'La subida corresponde a otro muro') };
  }

  return { kind: 'error', result: fail(410, 'La subida venció. Sube el archivo de nuevo.') };
};

// Inserta la fila de attachments del post. Devuelve un mensaje de error o null.
export const attachClaimedUpload = async (params: {
  claim: ClaimedUpload;
  postId: string;
  membership: AuthMembership;
}): Promise<string | null> => {
  const { claim } = params;
  const { data, error } = await supabaseAdmin
    .from('attachments')
    .insert({
      event_id: claim.eventId,
      post_id: params.postId,
      uploaded_by_membership_id: claim.membershipId,
      storage_path: claim.finalKey,
      file_name: claim.fileName,
      mime_type: claim.mimeType,
      size_bytes: claim.size,
    })
    .select('id')
    .single();

  if (error || !data) {
    return error?.message ?? 'No se pudo guardar el adjunto';
  }

  await logAudit({
    eventId: claim.eventId,
    membership: params.membership,
    actionType: 'UPLOAD_ATTACHMENT',
    entityType: 'ATTACHMENT',
    entityId: (data as { id: string }).id,
    outcome: 'SUCCESS',
    reason: `Adjunto ${claim.mimeType} de ${claim.size} bytes en el post ${params.postId}`,
  });

  return null;
};

// Cierra el intento: lo enlaza con el post y borra el objeto temporal (mejor esfuerzo).
export const completeClaim = async (claim: ClaimedUpload, postId: string) => {
  const { error } = await supabaseAdmin
    .from('attachment_uploads')
    .update({ post_id: postId })
    .eq('id', claim.uploadId);

  if (error) {
    console.error('No se pudo enlazar el intento con el post:', claim.uploadId, error.message);
  }

  try {
    await getFileStorage().delete(claim.pendingKey);
  } catch (storageError) {
    // El ciclo de vida del bucket limpia pending/ a las 24 horas.
    console.error('No se pudo borrar el objeto temporal:', storageError);
  }
};

// Compensación: borra el objeto final y libera el intento para que el cliente reintente.
// El objeto de pending/ sigue ahí, así que no hace falta volver a subir el archivo.
export const abortClaim = async (claim: ClaimedUpload) => {
  try {
    await getFileStorage().delete(claim.finalKey);
  } catch (error) {
    // Un objeto huérfano no daña a nadie; lo recoge el script de conciliación.
    console.error('No se pudo borrar el objeto final al compensar:', claim.finalKey, error);
  }

  await releaseClaim(claim.uploadId);
};

// ---------------------------------------------------------------------------
// 3) Metadatos en el feed

export type AttachmentView = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  // Solo el autor puede retirar su adjunto desde el feed.
  canRemove: boolean;
};

// Añade `attachment` (sin URL) a cada post con una sola consulta por lote.
export const attachAttachmentsToPosts = async <
  T extends { id: string; isDeleted?: boolean; user?: { id: string } },
>(params: {
  posts: T[];
  eventId: string;
  membershipId: string;
}): Promise<(T & { attachment: AttachmentView | null })[]> => {
  if (params.posts.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from('attachments')
    .select('id, post_id, file_name, mime_type, size_bytes')
    .eq('event_id', params.eventId)
    .in('post_id', params.posts.map((post) => post.id));

  if (error) {
    throw new Error(error.message);
  }

  const byPost = new Map<string, Omit<AttachmentView, 'canRemove'>>();
  ((data ?? []) as { id: string; post_id: string; file_name: string; mime_type: string; size_bytes: number }[]).forEach(
    (row) => {
      byPost.set(row.post_id, {
        id: row.id,
        name: row.file_name,
        mimeType: row.mime_type,
        size: Number(row.size_bytes),
      });
    },
  );

  // Un post eliminado no sirve su adjunto.
  return params.posts.map((post) => {
    const found = post.isDeleted ? undefined : byPost.get(post.id);

    return {
      ...post,
      attachment: found ? { ...found, canRemove: post.user?.id === params.membershipId } : null,
    };
  });
};

// ---------------------------------------------------------------------------
// 4) Descarga a demanda

type PostAccess = { id: string; wallId: string; status: string; authorMembershipId: string };

const loadPost = async (postId: string, eventId: string): Promise<PostAccess | null> => {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .select('id, event_id, wall_id, status, author_membership_id')
    .eq('id', postId)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as { id: string; wall_id: string; status: string; author_membership_id: string };
  return { id: row.id, wallId: row.wall_id, status: row.status, authorMembershipId: row.author_membership_id };
};

const loadAttachmentByPost = async (postId: string, eventId: string) => {
  const { data, error } = await supabaseAdmin
    .from('attachments')
    .select('id, storage_path, file_name, mime_type')
    .eq('post_id', postId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string; storage_path: string; file_name: string; mime_type: string } | null) ?? null;
};

export const getAttachmentDownload = async (params: {
  postId: string;
  eventId: string;
  membership: AuthMembership;
}): Promise<ServiceResult> => {
  const post = await loadPost(params.postId, params.eventId);

  if (!post || post.status !== 'VISIBLE') {
    return fail(404, 'Post no encontrado en este evento');
  }

  const walls = await loadWallsByEvent(params.eventId);
  const wall = walls.find((candidate) => candidate.id === post.wallId);

  if (!wall) {
    return fail(404, 'Muro no encontrado');
  }

  if (!mapWallForMembership(wall, params.membership).canAccess) {
    return fail(403, 'No tienes acceso a este post');
  }

  const attachment = await loadAttachmentByPost(post.id, params.eventId);

  if (!attachment) {
    return fail(404, 'El post no tiene adjunto');
  }

  try {
    const download = await getFileStorage().presignDownload({
      key: attachment.storage_path,
      fileName: attachment.file_name,
      contentType: attachment.mime_type,
      expiresInSeconds: DOWNLOAD_URL_SECONDS,
    });

    return { status: 200, body: { url: download.url, expiresAt: download.expiresAt.toISOString() } };
  } catch (error) {
    const mapped = storageFailure(error);

    if (mapped) {
      return mapped;
    }

    throw error;
  }
};

// ---------------------------------------------------------------------------
// 5) Retiro (autor o moderación)

export const removeAttachment = async (params: {
  postId: string;
  eventId: string;
  membership: AuthMembership;
  // AUTHOR: solo el autor, con el post visible. MODERATION: ya autorizado por la ruta; exige motivo.
  mode: 'AUTHOR' | 'MODERATION';
  reason?: string;
}): Promise<ServiceResult> => {
  const post = await loadPost(params.postId, params.eventId);

  if (!post) {
    return fail(404, 'Post no encontrado en este evento');
  }

  if (params.mode === 'AUTHOR') {
    if (post.status !== 'VISIBLE') {
      return fail(404, 'Post no encontrado en este evento');
    }

    if (post.authorMembershipId !== params.membership.id) {
      return fail(403, 'Solo el autor puede retirar el adjunto');
    }
  }

  const attachment = await loadAttachmentByPost(post.id, params.eventId);

  if (!attachment) {
    return fail(404, 'El post no tiene adjunto');
  }

  try {
    // Primero el objeto y luego la fila: nunca queda una referencia a un objeto inexistente.
    // Si falla el borrado del objeto, la fila se conserva y el retiro se puede repetir.
    await getFileStorage().delete(attachment.storage_path);
  } catch (error) {
    const mapped = storageFailure(error);

    if (mapped) {
      return mapped;
    }

    throw error;
  }

  const { error: deleteError } = await supabaseAdmin
    .from('attachments')
    .delete()
    .eq('id', attachment.id)
    .eq('event_id', params.eventId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  await logAudit({
    eventId: params.eventId,
    membership: params.membership,
    targetMembershipId: post.authorMembershipId,
    actionType: params.mode === 'MODERATION' ? 'MODERATE_DELETE_ATTACHMENT' : 'DELETE_ATTACHMENT',
    entityType: 'ATTACHMENT',
    entityId: attachment.id,
    outcome: 'SUCCESS',
    reason: params.reason?.trim() || `Adjunto retirado por el autor del post ${post.id}`,
  });

  return { status: 200, body: { removed: true, postId: post.id, attachmentId: attachment.id } };
};
