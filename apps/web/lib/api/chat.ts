import type {
    ChatParticipant,
    ConversationSummary,
    DirectMessage,
} from "../../types/chat";
import { requestApi } from "./client";

type ChatContext = {
    token: string;
    eventId: string;
};

export const getConversations = async (
    context: ChatContext,
): Promise<ConversationSummary[]> => {
    const payload = await requestApi<{ conversations: ConversationSummary[] }>(
        "/dm/conversations",
        {
            method: "GET",
            token: context.token,
            eventId: context.eventId,
            cache: "no-store",
        },
    );

    return payload.conversations;
};

export const searchParticipants = async (
    query: string,
    context: ChatContext,
): Promise<ChatParticipant[]> => {
    const searchParams = new URLSearchParams();

    if (query.trim()) {
        searchParams.set("search", query.trim());
    }

    const suffix = searchParams.toString() ? `?${searchParams}` : "";
    const payload = await requestApi<{ participants: ChatParticipant[] }>(
        `/dm/participants${suffix}`,
        {
            method: "GET",
            token: context.token,
            eventId: context.eventId,
            cache: "no-store",
        },
    );

    return payload.participants;
};

export const createConversation = async (
    targetMembershipId: string,
    context: ChatContext,
): Promise<ConversationSummary> => {
    const payload = await requestApi<{ conversation: ConversationSummary }>(
        "/dm/conversations",
        {
            method: "POST",
            token: context.token,
            eventId: context.eventId,
            body: { targetMembershipId },
        },
    );

    return payload.conversation;
};

export const getConversationMessages = async (
    conversationId: string,
    context: ChatContext,
): Promise<DirectMessage[]> => {
    const payload = await requestApi<{ messages: DirectMessage[] }>(
        `/dm/conversations/${conversationId}/messages`,
        {
            method: "GET",
            token: context.token,
            eventId: context.eventId,
            cache: "no-store",
        },
    );

    return payload.messages;
};

export const sendConversationMessage = async (
    conversationId: string,
    content: string,
    context: ChatContext,
): Promise<DirectMessage> => {
    const payload = await requestApi<{ message: DirectMessage }>(
        `/dm/conversations/${conversationId}/messages`,
        {
            method: "POST",
            token: context.token,
            eventId: context.eventId,
            body: { content },
        },
    );

    return payload.message;
};

export const deleteConversationMessage = async (
    conversationId: string,
    messageId: string,
    context: ChatContext,
): Promise<void> => {
    await requestApi<{ success: boolean }>(
        `/dm/conversations/${conversationId}/messages/${messageId}`,
        {
            method: "DELETE",
            token: context.token,
            eventId: context.eventId,
        },
    );
};
