// Reglas de adjuntos de publicaciones (REQ-16 / RN-11, ampliadas en la mejora 10): hasta 10 imágenes
// JPG/PNG de 15 MB y hasta 2 PDF de 30 MB por publicación, combinables. La API y Storage lo validan
// de nuevo; esto solo evita subir archivos que se van a rechazar.

const MB = 1024 * 1024;

export const ATTACHMENT_ACCEPT = "image/jpeg,image/png,application/pdf";

const LIMITS: Record<string, number> = {
    "image/jpeg": 15 * MB,
    "image/png": 15 * MB,
    "application/pdf": 30 * MB,
};

export const MAX_IMAGES_PER_POST = 10;
export const MAX_PDFS_PER_POST = 2;
export const MAX_ATTACHMENTS_PER_POST = MAX_IMAGES_PER_POST + MAX_PDFS_PER_POST;
// Máximo teórico por publicación (10 x 15 MB + 2 x 30 MB). Debe coincidir con la API.
export const MAX_POST_ATTACHMENT_BYTES = MAX_IMAGES_PER_POST * 15 * MB + MAX_PDFS_PER_POST * 30 * MB;

// Texto para lectores de pantalla y ayudas.
export const ATTACHMENT_LIMITS_TEXT = `Hasta ${MAX_IMAGES_PER_POST} imágenes JPG o PNG de 15 MB y hasta ${MAX_PDFS_PER_POST} PDF de 30 MB`;

export const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < MB) {
        return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / MB).toFixed(1).replace(".0", "")} MB`;
};

// Devuelve el mensaje de error en español, o null si el archivo es válido.
export const validateAttachment = (file: { type: string; size: number }): string | null => {
    const limit = LIMITS[file.type];

    if (limit === undefined) {
        return "Solo se admiten imágenes JPG o PNG y archivos PDF.";
    }

    if (file.size === 0) {
        return "El archivo está vacío.";
    }

    if (file.size > limit) {
        return `El archivo supera el máximo de ${limit / MB} MB para este tipo.`;
    }

    return null;
};

export const isImageAttachment = (mimeType: string): boolean => mimeType.startsWith("image/");
export const isPdfAttachment = (mimeType: string): boolean => mimeType === "application/pdf";

type FileLike = { name: string; type: string; size: number; lastModified?: number };

export const countAttachments = (files: { type: string }[]) => ({
    images: files.filter((file) => isImageAttachment(file.type)).length,
    pdfs: files.filter((file) => isPdfAttachment(file.type)).length,
});

const sameFile = (a: FileLike, b: FileLike) =>
    a.name === b.name && a.size === b.size && a.type === b.type && (a.lastModified ?? 0) === (b.lastModified ?? 0);

export type AttachmentSelection<T> = {
    // Lista resultante, en el orden en que se eligieron.
    files: T[];
    // Un mensaje por cada archivo omitido, con su nombre, para mostrarlos juntos.
    errors: string[];
};

// Agrega archivos elegidos a los ya seleccionados respetando tipos, tamaños y cantidades. Cada
// archivo que no cabe se omite con un mensaje claro; los demás se conservan.
export const addAttachments = <T extends FileLike>(current: T[], incoming: T[]): AttachmentSelection<T> => {
    const files = [...current];
    const errors: string[] = [];

    for (const file of incoming) {
        const invalid = validateAttachment(file);

        if (invalid) {
            errors.push(`${file.name}: ${invalid}`);
            continue;
        }

        if (files.some((existing) => sameFile(existing, file))) {
            errors.push(`${file.name}: ya está en la lista.`);
            continue;
        }

        const { images, pdfs } = countAttachments(files);

        if (isImageAttachment(file.type) && images >= MAX_IMAGES_PER_POST) {
            errors.push(`${file.name}: una publicación admite hasta ${MAX_IMAGES_PER_POST} imágenes.`);
            continue;
        }

        if (isPdfAttachment(file.type) && pdfs >= MAX_PDFS_PER_POST) {
            errors.push(`${file.name}: una publicación admite hasta ${MAX_PDFS_PER_POST} archivos PDF.`);
            continue;
        }

        const total = files.reduce((sum, existing) => sum + existing.size, 0) + file.size;

        if (total > MAX_POST_ATTACHMENT_BYTES) {
            errors.push(`${file.name}: se superaría el máximo de ${MAX_POST_ATTACHMENT_BYTES / MB} MB por publicación.`);
            continue;
        }

        files.push(file);
    }

    return { files, errors };
};

// Quita un archivo de la selección.
export const removeAttachmentAt = <T>(files: T[], index: number): T[] =>
    files.filter((_, position) => position !== index);
