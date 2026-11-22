// Mensaje en español para un fallo al eliminar un comité. La API responde 404 si el
// comité ya no existe, 403 sin rol de administración del evento y 429 si se excede
// el límite de escrituras. Los 400 y 500 llegan con texto técnico, así que usan un
// mensaje genérico. `status` es null cuando no hubo respuesta HTTP (sin conexión).

export const COMMITTEE_DELETE_FALLBACK_MESSAGE =
    "No se pudo eliminar el comité. Intenta de nuevo.";

export const describeCommitteeDeleteError = (status: number | null): string => {
    if (status === null) {
        return "No hay conexión con el servidor. Revisa tu conexión e intenta de nuevo.";
    }

    if (status === 403) {
        return "No tienes permiso para administrar los comités de este evento.";
    }

    if (status === 404) {
        return "Este comité ya no existe. Recarga la lista.";
    }

    if (status === 429) {
        return "Demasiados intentos seguidos. Espera un momento e intenta de nuevo.";
    }

    return COMMITTEE_DELETE_FALLBACK_MESSAGE;
};
