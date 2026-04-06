"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatHeader } from "../../../components/chat/ChatHeader";
import { ChatItem } from "../../../components/chat/ChatItem";
import { ChatSearch } from "../../../components/chat/ChatSearch";
import {
    createConversation,
    getConversations,
    searchParticipants,
} from "../../../lib/api/chat";
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

    useEffect(() => {
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;

        const loadConversations = async () => {
            try {
                setIsLoading(true);
                const data = await getConversations({ token, eventId });

                if (!cancelled) {
                    setConversations(data);
                    setError(null);
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : "No se pudieron cargar los mensajes.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void loadConversations();

        return () => {
            cancelled = true;
        };
    }, [eventId, token]);

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
