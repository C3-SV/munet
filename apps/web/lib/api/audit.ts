import { requestApi } from "./client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AuditLog = {
    id: string;
    created_at: string;
    action_type: string;
    entity_type: string;
    entity_id: string | null;
    outcome: string;
    reason: string | null;
    actor_membership_id: string | null;
    actor_role: string | null;
    target_membership_id: string | null;
    // Solo ADMIN_TECH recibe estas dos claves; para el resto no vienen en la respuesta.
    ip_address?: string | null;
    user_agent?: string | null;
};

export type AuditLogsPage = {
    logs: AuditLog[];
    // Cursor para la página siguiente (`before`); null cuando no quedan más.
    next_before: string | null;
};

export type ListAuditLogsParams = {
    limit?: number;
    before?: string;
};

// ─── Lectura ──────────────────────────────────────────────────────────────────

// Solo lectura, del más reciente al más antiguo. El límite lo valida la API (1 a 100).
export const listAuditLogs = (
    token: string,
    eventId: string,
    { limit = 50, before }: ListAuditLogsParams = {},
): Promise<AuditLogsPage> => {
    const params = new URLSearchParams({
        event_id: eventId,
        limit: String(limit),
    });

    if (before) {
        params.set("before", before);
    }

    return requestApi<AuditLogsPage>(`/admin/audit-logs?${params.toString()}`, { token });
};
