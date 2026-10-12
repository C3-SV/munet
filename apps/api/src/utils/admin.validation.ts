export function validateCatalogBody(body: unknown, kind: 'event' | 'committee', partial = false): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'El body debe ser un objeto';
  const payload = body as Record<string, unknown>;
  const fields = kind === 'event'
    ? ['name', 'slug', 'description', 'start_date', 'end_date', 'status']
    : ['event_id', 'name', 'code', 'description', 'sort_order'];
  if (partial && !fields.some(key => key !== 'event_id' && Object.prototype.hasOwnProperty.call(payload, key))) return 'No hay campos para actualizar';
  const required = kind === 'event' ? ['name', 'slug'] : partial ? ['name', 'code'] : ['event_id', 'name', 'code'];
  for (const key of required) {
    if ((!partial || Object.prototype.hasOwnProperty.call(payload, key)) && (typeof payload[key] !== 'string' || !(payload[key] as string).trim())) return `${key} debe ser un texto no vacío`;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'description') && payload.description !== null && typeof payload.description !== 'string') return 'description debe ser texto o null';
  if (kind === 'committee' && Object.prototype.hasOwnProperty.call(payload, 'sort_order') && !Number.isSafeInteger(payload.sort_order)) return 'sort_order debe ser un entero';
  for (const key of kind === 'event' ? ['start_date', 'end_date'] : []) {
    const value = payload[key];
    if (value != null && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) return `${key} debe ser una fecha válida YYYY-MM-DD o null`;
  }
  if (payload.start_date && payload.end_date && String(payload.start_date) > String(payload.end_date)) return 'start_date no puede ser posterior a end_date';
  return null;
}
