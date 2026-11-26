import { AttachmentUploadError, type UploadTicket } from "./attachment-upload.ts";

// Subida directa al almacenamiento con progreso. fetch no informa el avance de una subida;
// XMLHttpRequest sí. Nunca envía credenciales de la API: solo la URL y las cabeceras firmadas.

type XhrLike = {
    open: (method: string, url: string) => void;
    setRequestHeader: (name: string, value: string) => void;
    send: (body: unknown) => void;
    abort: () => void;
    status: number;
    upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number }) => void) | null };
    onload: (() => void) | null;
    onerror: (() => void) | null;
    onabort: (() => void) | null;
    ontimeout: (() => void) | null;
    timeout: number;
};

// El navegador calcula estas cabeceras; intentar fijarlas lanza un error.
const FORBIDDEN_HEADERS = new Set(["content-length", "host"]);

const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

export const putFileWithProgress = (
    ticket: UploadTicket,
    file: unknown,
    onProgress: (loaded: number) => void,
    createXhr: () => XhrLike = () => new XMLHttpRequest() as unknown as XhrLike,
): Promise<void> =>
    new Promise<void>((resolve, reject) => {
        const xhr = createXhr();
        const networkError = () =>
            reject(new AttachmentUploadError("No se pudo subir el archivo. Revisa tu conexión e inténtalo de nuevo."));

        xhr.open(ticket.method, ticket.url);
        xhr.timeout = UPLOAD_TIMEOUT_MS;

        for (const [name, value] of Object.entries(ticket.headers)) {
            if (!FORBIDDEN_HEADERS.has(name.toLowerCase())) {
                xhr.setRequestHeader(name, value);
            }
        }

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                onProgress(event.loaded);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
                return;
            }

            // 403 en una URL firmada: venció o el archivo no coincide con lo declarado.
            reject(
                new AttachmentUploadError(
                    xhr.status === 403
                        ? "La subida venció o el archivo no coincide. Inténtalo de nuevo."
                        : "No se pudo subir el archivo. Inténtalo de nuevo.",
                ),
            );
        };
        xhr.onerror = networkError;
        xhr.ontimeout = networkError;
        xhr.onabort = networkError;

        xhr.send(file);
    });
