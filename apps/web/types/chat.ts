import type { Delegate, Message } from "./common";

export type ChatParticipant = Delegate & {
    delegationName: string | null;
    institutionName: string | null;
};

export type ConversationSummary = {
    id: string;
    eventId: string;
    status: string;
    createdAt: string;
    lastMessageAt: string | null;
    otherParticipant: ChatParticipant;
    lastMessage: string | null;
    lastMessageAuthorId: string | null;
};

// El horario se formatea en el navegador a partir de createdAt (ISO).
export type DirectMessage = Omit<Message, "timestamp"> & {
    conversationId: string;
    createdAt: string;
};
