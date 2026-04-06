"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatHeader } from "../../../components/chat/ChatHeader";
import { ChatItem } from "../../../components/chat/ChatItem";
import { ChatSearch } from "../../../components/chat/ChatSearch";
import {
    createConversation,
    getConversations,
    searchParticipants,
} from "../../../lib/api/chat";
import { realtimeEnabled, supabaseBrowser } from "../../../lib/supabase";
import { useAuthStore } from "../../../stores/auth.store";
import type { ChatParticipant, ConversationSummary } from "../../../types/chat";

const Chats = () => {
    const router = useRouter();
    const token = useAuthStore((state) => state.token);
    const eventId = useAuthStore((state) => state.activeEventId);

    const [searchTerm, setSearchTerm] = useState("");
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [participants, setParticipants] = useState<ChatParticipant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshConversations = useCallback(async (showLoader = false) => {
        if (!token || !eventId) {
            return;
        }

        if (showLoader) {
            setIsLoading(true);
        }

        try {
            const data = await getConversations({ token, eventId });
            setConversations(data);
            setError(null);
        } catch (loadError) {
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : "No se pudieron cargar los mensajes.",
            );
        } finally {
            if (showLoader) {
                setIsLoading(false);
            }
        }
    }, [eventId, token]);

    useEffect(() => {
        let cancelled = false;
        const loadConversations = async () => {
            if (!cancelled) {
                await refreshConversations(true);
            }
        };

        void loadConversations();

        return () => {
            cancelled = true;
        };
    }, [refreshConversations]);

    useEffect(() => {
        if (!eventId || !supabaseBrowser || !token) {
            return;
        }

        const realtimeClient = supabaseBrowser;
        realtimeClient.realtime.setAuth(token);

        const channel = realtimeClient.channel(`dm-inbox:${eventId}`);
        const refreshInbox = () => {
            void refreshConversations(false);
        };

        channel
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "dm_conversations",
                    filter: `event_id=eq.${eventId}`,
                },
                refreshInbox,
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "dm_messages",
                    filter: `event_id=eq.${eventId}`,
                },
                refreshInbox,
            )
            .subscribe();

        return () => {
            void realtimeClient.removeChannel(channel);
        };
    }, [eventId, refreshConversations, token]);

    useEffect(() => {
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;
        const timeout = window.setTimeout(() => {
            const runSearch = async () => {
                if (!searchTerm.trim()) {
                    setParticipants([]);
                    return;
                }

                try {
                    setIsSearching(true);
                    const data = await searchParticipants(searchTerm, { token, eventId });

                    if (!cancelled) {
                        setParticipants(data);
                        setError(null);
                    }
                } catch (searchError) {
                    if (!cancelled) {
                        setError(
                            searchError instanceof Error
                                ? searchError.message
                                : "No se pudieron buscar participantes.",
                        );
                    }
                } finally {
                    if (!cancelled) {
                        setIsSearching(false);
                    }
                }
            };

            void runSearch();
        }, 250);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [eventId, searchTerm, token]);

    const handleSelectParticipant = async (participant: ChatParticipant) => {
        if (!token || !eventId) {
            return;
        }

        try {
            setError(null);
            const conversation = await createConversation(participant.id, {
                token,
                eventId,
            });

            router.push(`/chat/${conversation.id}`);
        } catch (createError) {
            setError(
                createError instanceof Error
                    ? createError.message
                    : "No se pudo iniciar la conversacion.",
            );
        }
    };

    const visibleConversations = useMemo(() => conversations, [conversations]);
    const isSearchMode = Boolean(searchTerm.trim());

    return (
        <div className="p-4 sm:p-6 lg:p-10">
            <div className="max-w-2xl mx-auto">
                <ChatHeader />

                <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                >
                    <div className="p-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <ChatSearch
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                        />

                        <p
                            className="text-[11px] font-semibold uppercase tracking-widest font-heading px-1"
                            style={{ color: "var(--text-muted)" }}
                        >
                            {isSearchMode
                                ? `${participants.length} resultado${participants.length !== 1 ? "s" : ""}`
                                : `${visibleConversations.length} conversacion${visibleConversations.length !== 1 ? "es" : ""}`}
                            {realtimeEnabled && !isSearchMode ? " - Realtime activo" : ""}
                        </p>
                    </div>

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

                    <div className="p-2">
                        {isLoading ? (
                            <EmptyChatState text="Cargando conversaciones..." />
                        ) : isSearchMode ? (
                            isSearching ? (
                                <EmptyChatState text="Buscando participantes..." />
                            ) : participants.length > 0 ? (
                                participants.map((participant) => (
                                    <ChatItem
                                        key={participant.id}
                                        delegate={participant}
                                        onSelect={() => void handleSelectParticipant(participant)}
                                    />
                                ))
                            ) : (
                                <EmptyChatState text="No se encontraron participantes con ese nombre." />
                            )
                        ) : visibleConversations.length > 0 ? (
                            visibleConversations.map((conversation) => (
                                <ChatItem
                                    key={conversation.id}
                                    delegate={{
                                        ...conversation.otherParticipant,
                                        lastActive: conversation.lastMessageAt
                                            ? new Date(conversation.lastMessageAt).toLocaleDateString()
                                            : "Nuevo",
                                    }}
                                    href={`/chat/${conversation.id}`}
                                    lastMessage={conversation.lastMessage}
                                />
                            ))
                        ) : (
                            <EmptyChatState text="Todavia no tienes conversaciones. Busca un delegado para iniciar una." />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const EmptyChatState = ({ text }: { text: string }) => (
    <div
        className="text-center py-12 text-sm rounded-xl mx-2 my-2"
        style={{
            color: "var(--text-muted)",
            border: "2px dashed var(--border-color)",
            fontFamily: "var(--font-body)",
        }}
    >
        {text}
    </div>
);

export default Chats;
