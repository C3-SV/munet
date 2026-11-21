// Contrato de almacenamiento de archivos. La lógica de negocio solo conoce esta interfaz;
// el proveedor concreto (hoy Cloudflare R2 por su API S3) vive en un adaptador.

export type StorageObjectInfo = {
  size: number;
  contentType: string | null;
};

export type PresignedUpload = {
  url: string;
  method: 'PUT';
  // Cabeceras que el cliente debe enviar tal cual: están firmadas.
  headers: Record<string, string>;
  expiresAt: Date;
};

export type PresignedDownload = {
  url: string;
  expiresAt: Date;
};

export interface FileStorage {
  presignUpload(params: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds: number;
  }): Promise<PresignedUpload>;

  presignDownload(params: {
    key: string;
    fileName: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<PresignedDownload>;

  // null si el objeto no existe.
  head(key: string): Promise<StorageObjectInfo | null>;

  // Lee bytes [start, end] (ambos incluidos). null si el objeto no existe.
  readRange(key: string, start: number, end: number): Promise<Uint8Array | null>;

  copy(sourceKey: string, destinationKey: string): Promise<void>;

  // Idempotente: borrar un objeto inexistente no es un error.
  delete(key: string): Promise<void>;

  // Lista objetos bajo un prefijo, por páginas. Solo para mantenimiento (conciliación).
  list(params: { prefix: string; continuationToken?: string; maxKeys?: number }): Promise<StorageListPage>;
}

export type StorageListPage = {
  objects: { key: string; lastModified: Date | null }[];
  nextToken: string | null;
};

export type StorageErrorCode = 'NOT_CONFIGURED' | 'NOT_FOUND' | 'UNAVAILABLE';

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  readonly cause?: unknown;

  constructor(code: StorageErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.cause = options?.cause;
  }
}

export type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};
