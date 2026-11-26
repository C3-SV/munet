import { requestApi } from "./client";

type NotificationContext = {
    token: string;
    eventId: string;
};

export type AnnouncementNotification = {
    postId: string;
    title: string | null;
    excerpt: string;
    createdAt: string;
    author: { name: string; alias?: string | null; avatar?: string | null };
};

export type DmNotification = {
    conversationId: string;
    unreadCount: number;
    otherParticipant: { id: string; name: string; alias?: string | null; avatar?: string | null };
    lastMessage: string;
    lastMessageAt: string | null;
};

// Pendientes de lectura de la persona en el evento activo.
export type NotificationSummary = {
    unread: { total: number; dms: number; announcements: number };
    announcements: {
        wallId: string;
        slug: string;
        name: string;
        // Última vez que abrió los avisos: lo posterior es nuevo.
        lastReadAt: string;
        unreadCount: number;
        latest: AnnouncementNotification[];
    } | null;
    dms: DmNotification[];
    // Todas las conversaciones activas, también las ya leídas.
    conversationIds?: string[];
};

export const getNotificationSummary = (context: NotificationContext) =>
    requestApi<NotificationSummary>("/notifications/summary", {
        method: "GET",
        token: context.token,
        eventId: context.eventId,
        cache: "no-store",
    });

export const markAnnouncementsRead = (context: NotificationContext) =>
    requestApi<{ readAt: string }>("/notifications/announcements/read", {
        method: "POST",
        token: context.token,
        eventId: context.eventId,
    });
