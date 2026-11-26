import type { NotificationSummary } from "./api/notifications.ts";

// Tope de conversaciones a las que la pantalla se suscribe en tiempo real.
export const MAX_REALTIME_CONVERSATIONS = 30;

// Texto del indicador: nada si no hay pendientes y «99+» a partir de 100.
export const formatBadge = (count: number | null | undefined): string | null => {
    if (!count || count < 1) {
        return null;
    }

    return count > 99 ? "99+" : String(count);
};

export const totalUnread = (summary: NotificationSummary | null): number => summary?.unread.total ?? 0;

// Tras abrir los avisos: se quitan del resumen sin esperar a la API.
export const withAnnouncementsRead = (summary: NotificationSummary | null): NotificationSummary | null => {
    if (!summary?.announcements) {
        return summary;
    }

    return {
        ...summary,
        unread: {
            ...summary.unread,
            announcements: 0,
            total: summary.unread.total - summary.unread.announcements,
        },
        announcements: { ...summary.announcements, unreadCount: 0, latest: [] },
    };
};

// Tras abrir una conversación: se quitan sus mensajes pendientes sin esperar a la API.
export const withConversationRead = (
    summary: NotificationSummary | null,
    conversationId: string,
): NotificationSummary | null => {
    if (!summary) {
        return summary;
    }

    const removed = summary.dms.find((item) => item.conversationId === conversationId)?.unreadCount ?? 0;

    if (removed === 0) {
        return summary;
    }

    return {
        ...summary,
        unread: { ...summary.unread, dms: summary.unread.dms - removed, total: summary.unread.total - removed },
        dms: summary.dms.filter((item) => item.conversationId !== conversationId),
    };
};

// Conversaciones a las que suscribirse: primero las que tienen pendientes, luego el resto.
export const conversationIdsToWatch = (summary: NotificationSummary | null): string[] => {
    if (!summary) {
        return [];
    }

    const withUnread = summary.dms.map((item) => item.conversationId);
    const rest = (summary.conversationIds ?? []).filter((id) => !withUnread.includes(id));

    return [...withUnread, ...rest].slice(0, MAX_REALTIME_CONVERSATIONS);
};

// ¿Es un aviso nuevo? Posterior a la última lectura y de otra persona.
export const isNewAnnouncement = (
    post: { createdAt: string; user: { id: string } },
    lastReadAt: string | null,
    myMembershipId: string | null,
): boolean =>
    Boolean(lastReadAt) &&
    post.user.id !== myMembershipId &&
    new Date(post.createdAt).getTime() > new Date(lastReadAt as string).getTime();
