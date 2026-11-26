// Reglas puras de adjuntos de publicaciones (RN-11 / REQ-16): tipos y tamaños permitidos,
// firma real del archivo, claves de objeto y cabecera de descarga. Sin dependencias de
// almacenamiento ni de Express para poder probarlas aisladas.

const MB = 1024 * 1024;

export const ATTACHMENT_MIME_LIMITS: Readonly<Record<string, number>> = {
  'image/jpeg': 5 * MB,
  'image/png': 5 * MB,
  'application/pdf': 20 * MB,
};

export const ATTACHMENT_MAX_BYTES = 20 * MB;
export const ATTACHMENT_FILE_NAME_MAX = 255;

// Bytes que hay que leer del inicio del objeto para reconocer su firma.
export const ATTACHMENT_SNIFF_BYTES = 8;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

export type AttachmentMeta = { fileName: string; mimeType: string; size: number };

export type AttachmentMetaResult =
  | { ok: true; value: AttachmentMeta }
  | { ok: false; error: string };

// Valida lo que declara el cliente al iniciar la subida. La verificación real del objeto
// (tamaño almacenado y firma de archivo) se hace después, antes de asociarlo al post.
export const validateAttachmentMeta = (input: {
  fileName?: unknown;
  mimeType?: unknown;
  size?: unknown;
}): AttachmentMetaResult => {
  const mimeType = typeof input.mimeType === 'string' ? input.mimeType.trim().toLowerCase() : '';
  const limit = ATTACHMENT_MIME_LIMITS[mimeType];

  if (limit === undefined) {
    return { ok: false, error: 'Solo se admiten imágenes JPG o PNG y archivos PDF.' };
  }

  const size = input.size;

  if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) {
    return { ok: false, error: 'El tamaño del archivo no es válido.' };
  }

  if (size > limit) {
    return { ok: false, error: `El archivo supera el máximo de ${limit / MB} MB para este tipo.` };
  }

  const fileName = typeof input.fileName === 'string' ? input.fileName.trim() : '';

  // eslint-disable-next-line no-control-regex
  if (!fileName || fileName.length > ATTACHMENT_FILE_NAME_MAX || /[\u0000-\u001f\u007f]/.test(fileName)) {
    return { ok: false, error: 'El nombre del archivo no es válido.' };
  }

  return { ok: true, value: { fileName, mimeType, size } };
};

// Reconoce el tipo por la firma de los primeros bytes. Devuelve null si no es JPG, PNG ni PDF.
export const detectAttachmentMime = (bytes: Uint8Array): string | null => {
  const startsWith = (signature: number[]) =>
    bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);

  if (startsWith([0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }

  // "%PDF-"
  if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return 'application/pdf';
  }

  return null;
};

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

const assertUuid = (name: string, value: string) => {
  if (!isUuid(value)) {
    throw new Error(`${name} debe ser un uuid`);
  }
};

// Clave temporal donde sube el navegador. Un ciclo de vida del bucket borra este prefijo.
export const buildPendingKey = (eventId: string, uploadId: string) => {
  assertUuid('eventId', eventId);
  assertUuid('uploadId', uploadId);
  return `pending/${eventId}/${uploadId}`;
};

// Clave definitiva del adjunto, derivada del intento: un intento solo produce una clave.
export const buildFinalKey = (eventId: string, uploadId: string, mimeType: string) => {
  assertUuid('eventId', eventId);
  assertUuid('uploadId', uploadId);
  const extension = EXTENSIONS[mimeType];

  if (!extension) {
    throw new Error('Tipo de adjunto no admitido');
  }

  return `events/${eventId}/posts/${uploadId}.${extension}`;
};

// Cabecera Content-Disposition con nombre ASCII de respaldo y nombre UTF-8 codificado (RFC 5987).
export const buildContentDisposition = (fileName: string, disposition: 'inline' | 'attachment' = 'inline') => {
  const cleaned = fileName.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() || 'adjunto';
  const ascii = cleaned.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(cleaned).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
};
