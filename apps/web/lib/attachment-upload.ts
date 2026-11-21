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
