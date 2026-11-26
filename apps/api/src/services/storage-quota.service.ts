import { supabaseAdmin } from '../lib/supabase';
import { evaluateStorageQuota, parseQuotaBytes, type QuotaStatus } from '../utils/storage-quota';

// Uso del almacenamiento de adjuntos y protección de la cuota (ver utils/storage-quota.ts).
// El uso se calcula con la base: adjuntos guardados más los intentos de subida vigentes, que ya
// reservan espacio. Se guarda unos segundos en memoria para no consultarlo en cada subida.

const USAGE_CACHE_MS = 60_000;
const ALERT_EVERY_MS = 10 * 60_000;
const PAGE_SIZE = 1000;
const MAX_PAGES = 200;

let usageCache: { at: number; usedBytes: number } | null = null;
let lastAlertAt = 0;

// Solo para pruebas.
export const resetStorageQuotaCache = () => {
  usageCache = null;
  lastAlertAt = 0;
};

const sumColumn = async (table: 'attachments' | 'attachment_uploads', filter?: (query: any) => any) => {
  let total = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = supabaseAdmin
      .from(table)
      .select('size_bytes')
      .order('created_at', { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (filter) {
      query = filter(query);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as { size_bytes: number | string }[];
    total += rows.reduce((sum, row) => sum + Number(row.size_bytes), 0);

    if (rows.length < PAGE_SIZE) {
      break;
    }
  }

  return total;
};

export const loadStorageUsageBytes = async (now = Date.now()): Promise<number> => {
  if (usageCache && now - usageCache.at < USAGE_CACHE_MS) {
    return usageCache.usedBytes;
  }

  const nowIso = new Date(now).toISOString();
  const stored = await sumColumn('attachments');
  // Intentos vigentes: subidos o por subir, todavía sin asociarse a una publicación.
  const reserved = await sumColumn('attachment_uploads', (query) =>
    query.is('consumed_at', null).gt('expires_at', nowIso)
  );

  usageCache = { at: now, usedBytes: stored + reserved };
  return usageCache.usedBytes;
};

// Evalúa si se puede aceptar una carga de `incomingBytes`. Sin STORAGE_QUOTA_BYTES no hace nada
// (ni consulta la base). Al 90 % deja una alerta en los registros; al 95 % la carga se rechaza.
export const checkUploadQuota = async (incomingBytes: number, env = process.env): Promise<QuotaStatus> => {
  const quotaBytes = parseQuotaBytes(env.STORAGE_QUOTA_BYTES);

  if (!quotaBytes) {
    return evaluateStorageQuota({ quotaBytes: null, usedBytes: 0 });
  }

  let usedBytes: number;

  try {
    usedBytes = await loadStorageUsageBytes();
  } catch (error) {
    // Si no se puede medir, no se bloquean las subidas por una falla de la medición.
    console.error('No se pudo medir el uso del almacenamiento de adjuntos:', (error as Error).message);
    return evaluateStorageQuota({ quotaBytes: null, usedBytes: 0 });
  }

  const status = evaluateStorageQuota({ quotaBytes, usedBytes, incomingBytes });

  if (status.level === 'alert' || status.level === 'blocked') {
    const now = Date.now();

    if (now - lastAlertAt >= ALERT_EVERY_MS) {
      lastAlertAt = now;
      console.error(
        `[ALERTA ALMACENAMIENTO] Adjuntos al ${status.usedPercent.toFixed(1)} % de la cuota ` +
          `(${usedBytes} de ${quotaBytes} bytes).` +
          (status.level === 'blocked' ? ' Las cargas nuevas están bloqueadas (95 %).' : '')
      );
    }
  }

  return status;
};
