// Archivos de las subidas pendientes del modo práctica. Viven solo en memoria: el archivo llega aquí
// durante la subida y pasa al almacén de binarios únicamente cuando la publicación queda creada.
// Las claves son los ids de ticket; la pasarela es quien decide cuándo consumirlos.

const stash = new Map<string, File>();

export const stashPracticeFile = (uploadId: string, file: File): void => {
    stash.set(uploadId, file);
};

// Consulta el archivo sin quitarlo del stash.
export const peekPracticeFile = (uploadId: string): File | null => stash.get(uploadId) ?? null;

// Quita el archivo del stash y lo devuelve; una segunda llamada con el mismo id devuelve null.
export const takePracticeFile = (uploadId: string): File | null => {
    const file = stash.get(uploadId) ?? null;
    stash.delete(uploadId);
    return file;
};

export const clearPracticeFiles = (): void => {
    stash.clear();
};
