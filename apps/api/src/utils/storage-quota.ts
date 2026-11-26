// Protecciones de la cuota de almacenamiento de adjuntos (por ejemplo, Cloudflare R2).
//
// La cuota la configura quien administra el servicio con STORAGE_QUOTA_BYTES. Sin ella no se
// aplica ninguna protección. Con ella:
//   * al 90 % de uso se emite una alerta (queda en los registros del servidor);
//   * al 95 % se bloquean las cargas nuevas. El bloqueo se evalúa con lo que ocuparía la carga:
//     una subida que haría pasar el uso del 95 % también se rechaza.

export const QUOTA_ALERT_RATIO = 0.9;
export const QUOTA_BLOCK_RATIO = 0.95;

export type QuotaLevel = 'disabled' | 'ok' | 'alert' | 'blocked';

export type QuotaStatus = {
  level: QuotaLevel;
  quotaBytes: number | null;
  usedBytes: number;
  // Uso actual y uso proyectado si se acepta la carga, en porcentaje de la cuota (0 a 100+).
  usedPercent: number;
  projectedPercent: number;
};

// Lee STORAGE_QUOTA_BYTES; null si no está configurada o no es un entero positivo.
export const parseQuotaBytes = (raw: string | undefined): number | null => {
  const trimmed = raw?.trim();

  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return null;
  }

  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

export const evaluateStorageQuota = (params: {
  quotaBytes: number | null;
  usedBytes: number;
  incomingBytes?: number;
}): QuotaStatus => {
  const { quotaBytes, usedBytes } = params;
  const incoming = Math.max(0, params.incomingBytes ?? 0);

  if (!quotaBytes) {
    return { level: 'disabled', quotaBytes: null, usedBytes, usedPercent: 0, projectedPercent: 0 };
  }

  const usedPercent = (usedBytes / quotaBytes) * 100;
  const projectedPercent = ((usedBytes + incoming) / quotaBytes) * 100;
  const level: QuotaLevel =
    projectedPercent >= QUOTA_BLOCK_RATIO * 100
      ? 'blocked'
      : usedPercent >= QUOTA_ALERT_RATIO * 100 || projectedPercent >= QUOTA_ALERT_RATIO * 100
        ? 'alert'
        : 'ok';

  return { level, quotaBytes, usedBytes, usedPercent, projectedPercent };
};
