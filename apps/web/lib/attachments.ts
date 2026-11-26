// Reglas de adjuntos de publicaciones (REQ-16 / RN-11): cero o un archivo por post,
// JPG/PNG de hasta 5 MB o PDF de hasta 20 MB. La API y Storage lo validan de nuevo.

const MB = 1024 * 1024;

export const ATTACHMENT_ACCEPT = "image/jpeg,image/png,application/pdf";

const LIMITS: Record<string, number> = {
    "image/jpeg": 5 * MB,
    "image/png": 5 * MB,
    "application/pdf": 20 * MB,
};

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
