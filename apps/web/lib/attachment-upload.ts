// Orquestación de una publicación con adjunto (ADR-006). Sin dependencias del navegador ni de
// la API para poder probarla aislada: quien llama inyecta las operaciones reales.
//
// Pasos: 1) pedir a la API una subida autorizada, 2) subir el archivo directo al almacenamiento
// con la URL firmada, 3) crear el post con el identificador de la subida.

export type UploadTicket = {
    id: string;
    url: string;
    method: "PUT";
    // Cabeceras firmadas: se envían tal cual.
    headers: Record<string, string>;
};

export class AttachmentUploadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AttachmentUploadError";
    }
}

type FetchLike = (
    url: string,
    init: { method: string; headers: Record<string, string>; body: unknown },
) => Promise<{ ok: boolean; status: number }>;

// Sube el archivo directo al almacenamiento. Nunca incluye credenciales de la API.
export const putFileToStorage = async (
    ticket: UploadTicket,
    file: unknown,
    fetchImpl: FetchLike,
): Promise<void> => {
    let response: { ok: boolean; status: number };

    try {
        response = await fetchImpl(ticket.url, {
            method: ticket.method,
            headers: ticket.headers,
            body: file,
        });
    } catch {
        throw new AttachmentUploadError(
            "No se pudo subir el archivo. Revisa tu conexión e inténtalo de nuevo.",
        );
    }

    if (!response.ok) {
        // 403 en una URL firmada: venció o el archivo no coincide con lo declarado.
        throw new AttachmentUploadError(
            response.status === 403
                ? "La subida venció o el archivo no coincide. Inténtalo de nuevo."
                : "No se pudo subir el archivo. Inténtalo de nuevo.",
        );
    }
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type PublishParams<T> = {
    initUpload: () => Promise<UploadTicket>;
    upload: (ticket: UploadTicket) => Promise<void>;
    createPost: (uploadId: string) => Promise<T>;
    // Un corte de red al crear el post no implica que no se creó: la API es idempotente por
    // upload_id y devuelve el mismo post, así que se reintenta una vez solo ante esos errores.
    isRetryable: (error: unknown) => boolean;
    retryDelayMs?: number;
};

export const publishWithAttachment = async <T>({
    initUpload,
    upload,
    createPost,
    isRetryable,
    retryDelayMs = 800,
}: PublishParams<T>): Promise<T> => {
    const ticket = await initUpload();
    await upload(ticket);

    try {
        return await createPost(ticket.id);
    } catch (error) {
        if (!isRetryable(error)) {
            throw error;
        }

        await wait(retryDelayMs);
        return createPost(ticket.id);
    }
};

// ---------------------------------------------------------------------------
// Publicación con varios adjuntos (hasta 12): cada archivo sube directo al almacenamiento con su
// propia URL firmada, con progreso por archivo, y el post se crea al final con todos los ids.
// Si algo falla antes de crear el post, no se crea nada y la persona conserva su contenido.

export type UploadFileStatus = "waiting" | "uploading" | "done" | "error";

export type UploadFileProgress = {
    name: string;
    size: number;
    // Bytes ya enviados.
    loaded: number;
    status: UploadFileStatus;
};

export type UploadProgress = {
    stage: "uploading" | "publishing";
    files: UploadFileProgress[];
    // Avance total de la subida, de 0 a 100.
    percent: number;
};

export const computePercent = (files: { size: number; loaded: number }[]): number => {
    const total = files.reduce((sum, file) => sum + file.size, 0);

    if (total === 0) {
        return 0;
    }

    const loaded = files.reduce((sum, file) => sum + Math.min(file.loaded, file.size), 0);
    return Math.min(100, Math.round((loaded / total) * 100));
};

type PublishManyParams<T, F extends { name: string; size: number }> = {
    files: F[];
    initUpload: (file: F) => Promise<UploadTicket>;
    upload: (ticket: UploadTicket, file: F, onProgress: (loaded: number) => void) => Promise<void>;
    createPost: (uploadIds: string[]) => Promise<T>;
    // Un corte de red al crear el post no implica que no se creó: la API es idempotente por
    // upload_id, así que se reintenta una vez solo ante esos errores.
    isRetryable: (error: unknown) => boolean;
    onProgress?: (progress: UploadProgress) => void;
    // Cuántos archivos suben a la vez.
    concurrency?: number;
    retryDelayMs?: number;
};

export const publishWithAttachments = async <T, F extends { name: string; size: number }>({
    files,
    initUpload,
    upload,
    createPost,
    isRetryable,
    onProgress,
    concurrency = 3,
    retryDelayMs = 800,
}: PublishManyParams<T, F>): Promise<T> => {
    const state: UploadFileProgress[] = files.map((file) => ({
        name: file.name,
        size: file.size,
        loaded: 0,
        status: "waiting",
    }));
    const tickets: (UploadTicket | null)[] = files.map(() => null);
    let stopped = false;
    let firstError: unknown = null;

    const emit = (stage: UploadProgress["stage"]) =>
        onProgress?.({ stage, files: state.map((item) => ({ ...item })), percent: computePercent(state) });

    emit("uploading");

    let next = 0;

    const worker = async () => {
        while (!stopped) {
            const index = next;
            next += 1;

            const file = files[index];
            const progress = state[index];

            if (!file || !progress) {
                return;
            }

            try {
                progress.status = "uploading";
                emit("uploading");

                const ticket = await initUpload(file);
                tickets[index] = ticket;

                await upload(ticket, file, (loaded) => {
                    progress.loaded = loaded;
                    emit("uploading");
                });

                progress.loaded = file.size;
                progress.status = "done";
                emit("uploading");
            } catch (error) {
                progress.status = "error";
                stopped = true;
                firstError ??= error;
                emit("uploading");
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, () => worker()));

    if (firstError) {
        throw firstError;
    }

    const uploadIds = tickets.map((ticket) => (ticket as UploadTicket).id);
    emit("publishing");

    try {
        return await createPost(uploadIds);
    } catch (error) {
        if (!isRetryable(error)) {
            throw error;
        }

        await wait(retryDelayMs);
        return createPost(uploadIds);
    }
};
