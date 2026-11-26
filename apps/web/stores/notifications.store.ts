import { create } from "zustand";
import type { NotificationSummary } from "../lib/api/notifications";
import { withAnnouncementsRead, withConversationRead } from "../lib/notifications";

type NotificationsState = {
    summary: NotificationSummary | null;
    setSummary: (summary: NotificationSummary | null) => void;
    // Actualizan el resumen al instante cuando la persona abre los avisos o una conversación.
    announcementsRead: () => void;
    conversationRead: (conversationId: string) => void;
    reset: () => void;
};

export const useNotificationsStore = create<NotificationsState>((set) => ({
    summary: null,
    setSummary: (summary) => set({ summary }),
    announcementsRead: () => set((state) => ({ summary: withAnnouncementsRead(state.summary) })),
    conversationRead: (conversationId) =>
        set((state) => ({ summary: withConversationRead(state.summary, conversationId) })),
    reset: () => set({ summary: null }),
}));
