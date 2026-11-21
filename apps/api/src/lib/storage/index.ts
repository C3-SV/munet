import { loadStorageConfig } from './config';
import { createS3Storage } from './s3-storage';
import type { FileStorage } from './types';

export { StorageError } from './types';
export type { FileStorage, PresignedDownload, PresignedUpload, StorageObjectInfo } from './types';

let instance: FileStorage | null = null;

// Almacenamiento configurado por entorno. Se crea al primer uso, así que arrancar la API
// no exige credenciales y las rutas sin adjuntos siguen funcionando sin ellas.
// Lanza StorageError('NOT_CONFIGURED') si faltan variables.
export const getFileStorage = (): FileStorage => {
  if (!instance) {
    instance = createS3Storage(loadStorageConfig());
  }

  return instance;
};

// Solo para pruebas: reemplaza (o limpia con null) la instancia compartida.
export const setFileStorageForTests = (storage: FileStorage | null) => {
  instance = storage;
};
