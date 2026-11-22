// Cambio de estado de evento que ofrece el botón del panel admin. La API acepta
// cualquier valor de `status` (no tiene máquina de estados); esta regla solo decide
// qué transición muestra el botón. ARCHIVED no tiene botón: se cambia desde el
// selector del formulario de edición.

export type EventStatusToggleTarget = "CLOSED" | "ACTIVE";

export const getEventStatusToggleTarget = (
    status: string,
): EventStatusToggleTarget | null => {
    if (status === "ACTIVE") return "CLOSED";
    if (status === "CLOSED") return "ACTIVE";
    return null;
};
