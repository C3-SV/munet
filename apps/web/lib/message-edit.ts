// Edición de mensajes directos: reglas de la pantalla.

// Se puede guardar si hay texto y es distinto del actual (sin contar espacios en los extremos).
export const canSubmitEdit = (original: string, draft: string): boolean => {
    const next = draft.trim();

    return next.length > 0 && next !== original.trim();
};

// ¿Se muestra «(editado)»? Solo si la API informa una fecha de edición.
export const isEdited = (message: { editedAt?: string | null }): boolean => Boolean(message.editedAt);
