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

export type DirectMessage = Message & {
    conversationId: string;
    createdAt: string;
};
