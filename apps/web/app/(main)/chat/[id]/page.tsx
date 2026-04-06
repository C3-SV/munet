"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ChatInput } from "../../../../components/chat/ChatInput";
import { ChatMessage } from "../../../../components/chat/ChatMessage";
import { ChatRoomHeader } from "../../../../components/chat/ChatRoomHeader";
import {
    getConversationMessages,
    getConversations,
    sendConversationMessage,
} from "../../../../lib/api/chat";
import { supabaseBrowser } from "../../../../lib/supabase";
import { useAuthStore } from "../../../../stores/auth.store";
import type { ConversationSummary, DirectMessage } from "../../../../types/chat";
import type { Delegate } from "../../../../types/common";

const ChatRoomPage = () => {
    const params = useParams();
    const conversationId = typeof params?.id === "string" ? params.id : "";

    const token = useAuthStore((state) => state.token);
    const eventId = useAuthStore((state) => state.activeEventId);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);

    const bottomRef = useRef<HTMLDivElement>(null);
    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [conversation, setConversation] = useState<ConversationSummary | null>(null);
    const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const delegate: Delegate = useMemo(
        () =>
            conversation
                ? {
                      ...conversation.otherParticipant,
                      lastActive: conversation.lastMessageAt
                          ? new Date(conversation.lastMessageAt).toLocaleDateString()
                          : "Nuevo",
                  }
                : {
                      id: conversationId,
                      name: "Delegado",
                      avatar: `https://ui-avatars.com/api/?name=Delegado&background=E5E7EB&color=111827`,
                      role: "DELEGADO",
                      committee: "Comite",
                      lastActive: "desconocido",
                  },
        [conversation, conversationId],
    );

    const refreshConversation = useCallback(async () => {
        if (!token || !eventId || !conversationId) {
            return;
        }

        const conversationList = await getConversations({ token, eventId });
        setConversation(
            conversationList.find((item) => item.id === conversationId) ?? null,
        );
    }, [conversationId, eventId, token]);

    const refreshMessages = useCallback(async (markAsNew = false) => {
        if (!token || !eventId || !conversationId) {
            return;
        }

        const data = await getConversationMessages(conversationId, { token, eventId });

        setMessages((current) => {
            const currentIds = new Set(current.map((message) => message.id));

            if (markAsNew) {
                const incomingIds = data
                    .filter((message) => !currentIds.has(message.id))
                    .map((message) => message.id);

                if (incomingIds.length > 0) {
                    setNewMessageIds((ids) => new Set([...ids, ...incomingIds]));
                }
            }

            return data;
        });
    }, [conversationId, eventId, token]);

    useEffect(() => {
        if (!token || !eventId || !conversationId) {
            return;
        }

        let cancelled = false;

        const loadRoom = async () => {
            try {
                setIsLoading(true);
                const [conversationList, messageList] = await Promise.all([
                    getConversations({ token, eventId }),
                    getConversationMessages(conversationId, { token, eventId }),
                ]);

                if (!cancelled) {
                    setConversation(
                        conversationList.find((item) => item.id === conversationId) ?? null,
                    );
                    setMessages(messageList);
                    setError(null);
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : "No se pudo cargar la conversacion.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void loadRoom();

        return () => {
            cancelled = true;
        };
    }, [conversationId, eventId, token]);

    useEffect(() => {
        if (!conversationId || !supabaseBrowser || !token || !eventId) {
            return;
        }

        const realtimeClient = supabaseBrowser;
        realtimeClient.realtime.setAuth(token);

        const channel = realtimeClient.channel(`dm-room:${conversationId}`);

        channel
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "dm_messages",
                    filter: `conversation_id=eq.${conversationId}`,
                },
                () => {
                    void refreshMessages(true);
                    void refreshConversation();
                },
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "dm_conversations",
                    filter: `id=eq.${conversationId}`,
                },
                () => {
                    void refreshConversation();
                },
            )
            .subscribe();

        return () => {
            void realtimeClient.removeChannel(channel);
        };
    }, [conversationId, eventId, refreshConversation, refreshMessages, token]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (text: string) => {
        if (!token || !eventId || !conversationId) {
            return;
        }

        try {
            setError(null);
            const sent = await sendConversationMessage(conversationId, text, {
                token,
                eventId,
            });

            setMessages((current) =>
                current.some((message) => message.id === sent.id)
                    ? current
                    : [...current, sent],
            );
            setNewMessageIds((current) => new Set([...current, sent.id]));
        } catch (sendError) {
            setError(
                sendError instanceof Error
                    ? sendError.message
                    : "No se pudo enviar el mensaje.",
            );
            throw sendError;
        }
    };

    return (
        <div
            className="flex flex-col h-full"
            style={{ backgroundColor: "var(--bg-base)" }}
        >
            <ChatRoomHeader delegate={delegate} isOnline={false} />

            {error && (
                <div
                    className="mx-4 mt-4 rounded-xl px-4 py-3 text-sm font-body"
                    style={{
                        backgroundColor: "color-mix(in srgb, #ef4444 8%, white)",
                        border: "1px solid color-mix(in srgb, #ef4444 20%, transparent)",
                        color: "#991b1b",
                    }}
                >
                    {error}
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-color)" }} />
                        <span
                            className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full font-heading"
                            style={{
                                color: "var(--text-muted)",
                                backgroundColor: "var(--bg-surface-secondary)",
                                border: "1px solid var(--border-color)",
                            }}
                        >
                            HOY
                        </span>
                        <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-color)" }} />
                    </div>

                    {isLoading ? (
                        <p className="text-center text-sm font-body" style={{ color: "var(--text-muted)" }}>
                            Cargando mensajes...
                        </p>
                    ) : messages.length > 0 ? (
                        messages.map((message) => (
                            <ChatMessage
                                key={message.id}
                                message={message}
                                isMe={message.senderId === activeMembershipId}
                                isNew={newMessageIds.has(message.id)}
                            />
                        ))
                    ) : (
                        <p className="text-center text-sm font-body" style={{ color: "var(--text-muted)" }}>
                            Todavia no hay mensajes. Escribe el primero.
                        </p>
                    )}

                    <div ref={bottomRef} />
                </div>
            </div>

            <ChatInput onSend={handleSendMessage} disabled={isLoading} />
        </div>
    );
};

export default ChatRoomPage;
