import { supabaseAdmin } from '../lib/supabase';
import { getFileStorage } from '../lib/storage';

// Mantenimiento de adjuntos (ADR-006). Se ejecuta a mano con el script reconcile-attachments;
// no forma parte del camino crítico. Por defecto simula: solo cuenta lo que haría.

export const RETENTION_DAYS = 30;
export const ORPHAN_MIN_AGE_HOURS = 24;
const PAGE = 500;

export type MaintenanceSummary = {
  dryRun: boolean;
  purgedAttachments: number;
  orphanObjects: number;
  failures: number;
};

type PurgeRow = { id: string; storage_path: string };

// 1) Adjuntos de posts eliminados hace más de 30 días, salvo los marcados con retention_hold.
export const purgeDeletedPostAttachments = async (params: { apply: boolean; now: Date }) => {
  const cutoff = new Date(params.now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let purged = 0;
  let failures = 0;
  let lastId: string | null = null;

  for (;;) {
    // Paginación por cursor (id): vale igual en simulación, donde nada se borra.
    let query = supabaseAdmin
      .from('attachments')
      .select('id, storage_path, posts!inner(status, deleted_at)')
      .eq('retention_hold', false)
      .eq('posts.status', 'DELETED')
      .lt('posts.deleted_at', cutoff)
      .order('id')
      .limit(PAGE);

    if (lastId) {
      query = query.gt('id', lastId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as unknown as PurgeRow[];

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      lastId = row.id;

      if (!params.apply) {
        purged += 1;
        continue;
      }

      try {
        // Primero el objeto, luego la fila: nunca queda una referencia a un objeto inexistente.
        await getFileStorage().delete(row.storage_path);
        const { error: deleteError } = await supabaseAdmin.from('attachments').delete().eq('id', row.id);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        purged += 1;
      } catch (error) {
        failures += 1;
        console.error('No se pudo purgar el adjunto', row.id, error);
      }
    }

    if (rows.length < PAGE) {
      break;
    }
  }

  return { purged, failures };
};

// 2) Objetos sin fila: sobrantes de compensaciones fallidas. `pending/` se barre como respaldo
// de la regla de ciclo de vida del bucket; `events/` solo se borra si ninguna fila lo referencia.
export const removeOrphanObjects = async (params: { apply: boolean; now: Date }) => {
  const cutoff = params.now.getTime() - ORPHAN_MIN_AGE_HOURS * 60 * 60 * 1000;
  const storage = getFileStorage();
  let orphans = 0;
  let failures = 0;

  for (const prefix of ['pending/', 'events/']) {
    let token: string | undefined;

    do {
      const page = await storage.list({ prefix, continuationToken: token, maxKeys: PAGE });
      // Se ignora lo reciente: puede ser una subida o una creación de post en curso.
      const old = page.objects.filter((object) => object.lastModified && object.lastModified.getTime() < cutoff);
      let candidates = old.map((object) => object.key);

      if (prefix === 'events/' && candidates.length > 0) {
        const { data, error } = await supabaseAdmin.from('attachments').select('storage_path').in('storage_path', candidates);

        if (error) {
          throw new Error(error.message);
        }

        const referenced = new Set(((data ?? []) as { storage_path: string }[]).map((row) => row.storage_path));
        candidates = candidates.filter((key) => !referenced.has(key));
      }

      for (const key of candidates) {
        orphans += 1;

        if (!params.apply) {
          continue;
        }

        try {
          await storage.delete(key);
        } catch (error) {
          failures += 1;
          orphans -= 1;
          console.error('No se pudo borrar el objeto huérfano', key, error);
        }
      }

      token = page.nextToken ?? undefined;
    } while (token);
  }

  return { orphans, failures };
};

export const runAttachmentMaintenance = async (params: { apply: boolean; now: Date }): Promise<MaintenanceSummary> => {
  const purge = await purgeDeletedPostAttachments(params);
  const orphans = await removeOrphanObjects(params);

  return {
    dryRun: !params.apply,
    purgedAttachments: purge.purged,
    orphanObjects: orphans.orphans,
    failures: purge.failures + orphans.failures,
  };
};
