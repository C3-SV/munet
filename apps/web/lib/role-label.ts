// Roles conocidos del evento, con su texto visible en español.
const ROLE_LABELS: Record<string, string> = {
    // Valores reales de membership_role_enum en la base.
    PARTICIPANT: "Delegado",
    MODERATOR: "Moderador",
    ADMIN_MUN: "Administrador MUN",
    ADMIN_TECH: "Administrador técnico",
    // Textos antiguos que aún pueden aparecer en datos previos.
    ADMIN: "Administrador",
    COORDINADOR: "Coordinador",
    ORGANIZADOR: "Organizador",
    DELEGADO: "Delegado",
};

// Traduce el rol de una membresía a texto visible. Un rol desconocido se muestra
// en minúscula con la primera letra en mayúscula, nunca como enum crudo.
export const formatRoleLabel = (role: string | null | undefined): string => {
    const normalized = (role ?? "").trim().toUpperCase();

    if (!normalized) {
        return "Sin rol";
    }

    const known = ROLE_LABELS[normalized];

    if (known) {
        return known;
    }

    const lower = normalized.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
};

// Roles que el panel admin ofrece al asignar o filtrar participantes.
export const PARTICIPANT_ROLES: readonly string[] = [
    "PARTICIPANT",
    "MODERATOR",
    "ADMIN_MUN",
    "ADMIN_TECH",
];
