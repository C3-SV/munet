import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { buildContentDisposition } from '../../utils/attachments.utils';
import { StorageError, type FileStorage, type StorageConfig } from './types';

type S3Like = Pick<S3Client, 'send'>;

type Presign = (client: S3Client, command: any, options: any) => Promise<string>;

export type S3StorageDeps = {
  client?: S3Like;
  presign?: Presign;
};

const isNotFound = (error: unknown) => {
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
  return (
    candidate?.name === 'NotFound' ||
    candidate?.name === 'NoSuchKey' ||
    candidate?.$metadata?.httpStatusCode === 404
  );
};

const unavailable = (error: unknown) =>
  new StorageError('UNAVAILABLE', 'El almacenamiento de archivos no está disponible', { cause: error });

// CopySource va codificado por segmentos y precedido por el bucket.
const copySource = (bucket: string, key: string) =>
  `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;

// Adaptador para cualquier almacenamiento con API S3. Hoy se usa con Cloudflare R2.
export const createS3Storage = (config: StorageConfig, deps: S3StorageDeps = {}): FileStorage => {
  const client: S3Like =
    deps.client ??
    new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // Las versiones recientes del SDK añaden sumas de verificación por defecto, que no
      // encajan con las URL firmadas de R2. Solo se calculan cuando la operación las exige.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  const presign: Presign = deps.presign ?? ((c, command, options) => getSignedUrl(c, command, options));
  const bucket = config.bucket;

  return {
    async presignUpload({ key, contentType, contentLength, expiresInSeconds }) {
      try {
        const url = await presign(
          client as S3Client,
          new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: contentLength }),
          {
            expiresIn: expiresInSeconds,
            // Tipo y tamaño quedan firmados: un PUT con otro valor falla con 403.
            // Pendiente de confirmar contra R2 real que acepta content-length firmado.
            signableHeaders: new Set(['content-type', 'content-length']),
          },
        );

        return {
          url,
          method: 'PUT' as const,
          headers: { 'Content-Type': contentType },
          expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
        };
      } catch (error) {
        throw unavailable(error);
      }
    },

    async presignDownload({ key, fileName, contentType, expiresInSeconds }) {
      try {
        const url = await presign(
          client as S3Client,
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
            ResponseContentType: contentType,
            ResponseContentDisposition: buildContentDisposition(fileName, 'inline'),
          }),
          { expiresIn: expiresInSeconds },
        );

        return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
      } catch (error) {
        throw unavailable(error);
      }
    },

    async head(key) {
      try {
        const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { size: Number(result.ContentLength ?? 0), contentType: result.ContentType ?? null };
      } catch (error) {
        if (isNotFound(error)) {
          return null;
        }
        throw unavailable(error);
      }
    },

    async readRange(key, start, end) {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=${start}-${end}` }),
        );
        return (await result.Body?.transformToByteArray()) ?? new Uint8Array();
      } catch (error) {
        if (isNotFound(error)) {
          return null;
        }
        // Rango fuera de un objeto vacío: no hay bytes que leer.
        if ((error as { name?: string })?.name === 'InvalidRange') {
          return new Uint8Array();
        }
        throw unavailable(error);
      }
    },

    async copy(sourceKey, destinationKey) {
      try {
        await client.send(
          new CopyObjectCommand({ Bucket: bucket, Key: destinationKey, CopySource: copySource(bucket, sourceKey) }),
        );
      } catch (error) {
        if (isNotFound(error)) {
          throw new StorageError('NOT_FOUND', 'El archivo de origen no existe', { cause: error });
        }
        throw unavailable(error);
      }
    },

    async delete(key) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      } catch (error) {
        if (isNotFound(error)) {
          return;
        }
        throw unavailable(error);
      }
    },
  };
};
