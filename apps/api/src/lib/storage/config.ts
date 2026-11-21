import { StorageError, type StorageConfig } from './types';

const REQUIRED = [
  'STORAGE_ENDPOINT',
  'STORAGE_BUCKET',
  'STORAGE_ACCESS_KEY_ID',
  'STORAGE_SECRET_ACCESS_KEY',
] as const;

// Lee la configuración de almacenamiento del entorno del servidor. Los nombres no mencionan
// al proveedor: cualquier servicio con API S3 (R2, B2, S3) se configura igual.
// Los mensajes de error nombran las variables ausentes, nunca sus valores.
export const loadStorageConfig = (env: Record<string, string | undefined> = process.env): StorageConfig => {
  const read = (name: string) => env[name]?.trim() ?? '';
  const missing = REQUIRED.filter((name) => !read(name));

  if (missing.length > 0) {
    throw new StorageError('NOT_CONFIGURED', `Almacenamiento sin configurar. Faltan: ${missing.join(', ')}`);
  }

  let endpoint: URL;

  try {
    endpoint = new URL(read('STORAGE_ENDPOINT'));
  } catch {
    throw new StorageError('NOT_CONFIGURED', 'STORAGE_ENDPOINT no es una URL válida');
  }

  if (endpoint.protocol !== 'https:' && endpoint.hostname !== 'localhost' && endpoint.hostname !== '127.0.0.1') {
    throw new StorageError('NOT_CONFIGURED', 'STORAGE_ENDPOINT debe usar https');
  }

  return {
    endpoint: endpoint.origin,
    region: read('STORAGE_REGION') || 'auto',
    bucket: read('STORAGE_BUCKET'),
    accessKeyId: read('STORAGE_ACCESS_KEY_ID'),
    secretAccessKey: read('STORAGE_SECRET_ACCESS_KEY'),
    forcePathStyle: read('STORAGE_FORCE_PATH_STYLE').toLowerCase() === 'true',
  };
};
