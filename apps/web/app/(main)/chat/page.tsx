"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatHeader } from "../../../components/chat/ChatHeader";
import { ChatItem } from "../../../components/chat/ChatItem";
import { ChatSearch } from "../../../components/chat/ChatSearch";
import {
    buildRecipientSearchKey,
    directoryEntryToRecipient,
    excludeOwnRecipient,
    RECIPIENT_DIRECTORY_LIMIT,
    resolveRecipientSearchMode,
    resolveRecipientSearchView,
    type RecipientSearchResult,
} from "../../../lib/api/chat-recipient-search";
import {
    createConversation,
    getConversations,
    searchParticipants,
} from "../../../lib/api/chat";
import { listParticipantDirectory } from "../../../lib/api/directory";
import { getEventCommittees, type EventCommittee } from "../../../lib/api/events";
import { formatDayLabel, formatTime } from "../../../lib/format-datetime";
import { isPracticeEvent } from "../../../lib/practice/constants";
import { supabaseBrowser } from "../../../lib/supabase";
import { useAuthStore } from "../../../stores/auth.store";
import type { ChatParticipant, ConversationSummary } from "../../../types/chat";

const Chats = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = useAuthStore((state) => state.token);
    const eventId = useAuthStore((state) => state.activeEventId);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);

    const [searchTerm, setSearchTerm] = useState("");
    // Selección y catálogo llevan el evento al que pertenecen: otro evento los invalida sin efectos adicionales.
    const [committeeSelection, setCommitteeSelection] = useState({ eventId: "", committeeId: "" });
    const [committeeCatalog, setCommitteeCatalog] = useState<{
        eventId: string;
        items: EventCommittee[];
    }>({ eventId: "", items: [] });
    // Resultado de la última búsqueda, etiquetado con su clave; si no coincide con el contexto actual, se ignora.
    const [recipientResult, setRecipientResult] = useState<RecipientSearchResult | null>(null);
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAutoOpeningConversation, setIsAutoOpeningConversation] = useState(false);
    const [lastOpenedTargetKey, setLastOpenedTargetKey] = useState<string | null>(null);
    const autoOpenInProgressRef = useRef(false);

    const committeeId =
        eventId && committeeSelection.eventId === eventId ? committeeSelection.committeeId : "";
    const committees =
        eventId && committeeCatalog.eventId === eventId ? committeeCatalog.items : [];
    const recipientMode = resolveRecipientSearchMode({ query: searchTerm, committeeId });
    const recipientKey = buildRecipientSearchKey({ eventId, query: searchTerm, committeeId });
    const recipientView = resolveRecipientSearchView(recipientKey, recipientResult);
    const recipients = excludeOwnRecipient(recipientView.participants, activeMembershipId);

    const targetMembershipIdFromQuery = searchParams.get("with")?.trim() ?? "";
    const targetConversationKey =
        targetMembershipIdFromQuery && eventId
            ? `${eventId}:${targetMembershipIdFromQuery}`
            : "";

    const refreshConversations = useCallback(async (showLoader = false) => {
        // Refresco reutilizable del inbox, usado en carga inicial y realtime.
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
        // Carga inicial de conversaciones.
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
        // Flujo deep-link `/chat?with=<membershipId>`: abre o crea conversacion y redirige.
        if (
            !targetMembershipIdFromQuery ||
            !token ||
            !eventId ||
            autoOpenInProgressRef.current ||
            lastOpenedTargetKey === targetConversationKey
        ) {
            return;
        }

        if (targetMembershipIdFromQuery === activeMembershipId) {
            setLastOpenedTargetKey(targetConversationKey);
            setError("No puedes iniciar una conversación contigo.");
            return;
        }

        let cancelled = false;

        const openConversationFromQuery = async () => {
            try {
                autoOpenInProgressRef.current = true;
                setIsAutoOpeningConversation(true);
                setError(null);
                const conversationList = await getConversations({ token, eventId });
                const existingConversation = conversationList.find(
                    (conversation) => conversation.otherParticipant.id === targetMembershipIdFromQuery,
                );
                // Si ya existe chat entre ambos, evitamos crear duplicado y abrimos el existente.
                const conversation =
                    existingConversation ??
                    (await createConversation(targetMembershipIdFromQuery, {
                        token,
                        eventId,
                    }));

                if (!cancelled) {
                    setLastOpenedTargetKey(targetConversationKey);
                    router.replace(`/chat/${conversation.id}`);
                }
            } catch (createError) {
                if (!cancelled) {
                    setLastOpenedTargetKey(targetConversationKey);
                    setError(
                        createError instanceof Error
                            ? createError.message
                            : "No se pudo iniciar la conversación.",
                    );
                }
            } finally {
                autoOpenInProgressRef.current = false;
                if (!cancelled) {
                    setIsAutoOpeningConversation(false);
                }
            }
        };

        void openConversationFromQuery();

        return () => {
            cancelled = true;
        };
    }, [
        activeMembershipId,
        eventId,
        lastOpenedTargetKey,
        router,
        targetConversationKey,
        targetMembershipIdFromQuery,
        token,
    ]);

    useEffect(() => {
        // Realtime para inbox: cambios en conversaciones o mensajes.
        if (!eventId || !supabaseBrowser || !token || isPracticeEvent(eventId)) {
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
        // Catálogo de comités del evento para el filtro del buscador de destinatarios.
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;

        const loadCommittees = async () => {
            try {
                const items = await getEventCommittees({ token, eventId });

                if (!cancelled) {
                    setCommitteeCatalog({ eventId, items });
                }
            } catch {
                // Sin catálogo el filtro queda en "Todos los comités"; la búsqueda sigue disponible.
                if (!cancelled) {
                    setCommitteeCatalog({ eventId, items: [] });
                }
            }
        };

        void loadCommittees();

        return () => {
            cancelled = true;
        };
    }, [eventId, token]);

    useEffect(() => {
        // Busqueda con debounce de destinatarios: directorio si hay comité, búsqueda DM si solo hay texto.
        if (!token || !eventId || !recipientKey) {
            return;
        }

        const trimmedQuery = searchTerm.trim();
        let cancelled = false;

        const loadRecipients = async (): Promise<
            Pick<RecipientSearchResult, "participants" | "hasMore">
        > => {
            if (recipientMode === "directory") {
                const response = await listParticipantDirectory(
                    { token, eventId },
                    {
                        q: trimmedQuery,
                        committeeId,
                        page: 1,
                        limit: RECIPIENT_DIRECTORY_LIMIT,
                    },
                );

                return {
                    participants: response.participants.map(directoryEntryToRecipient),
                    hasMore: response.hasMore,
                };
            }

            const participants = await searchParticipants(trimmedQuery, { token, eventId });

            return { participants, hasMore: false };
        };

        const timeout = window.setTimeout(() => {
            const runSearch = async () => {
                try {
                    const found = await loadRecipients();

                    if (!cancelled) {
                        setRecipientResult({
                            key: recipientKey,
                            status: "ready",
                            participants: found.participants,
                            hasMore: found.hasMore,
                            error: null,
                        });
                    }
                } catch (searchError) {
                    if (!cancelled) {
                        setRecipientResult({
                            key: recipientKey,
                            status: "error",
                            participants: [],
                            hasMore: false,
                            error:
                                searchError instanceof Error
                                    ? searchError.message
                                    : "No se pudieron buscar participantes.",
                        });
                    }
                }
            };

            void runSearch();
        }, 250);

        return () => {
            // Al cambiar evento, comité o texto la petición anterior no escribe ningún estado.
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [committeeId, eventId, recipientKey, recipientMode, searchTerm, token]);

    const handleCommitteeChange = (value: string) => {
        setCommitteeSelection({ eventId: eventId ?? "", committeeId: value });
    };

    const handleSelectParticipant = async (participant: ChatParticipant) => {
        // Al seleccionar participante se crea/reutiliza conversacion y se navega al room.
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
                    : "No se pudo iniciar la conversación.",
            );
        }
    };

    const visibleConversations = useMemo(() => conversations, [conversations]);
    const isSearchMode = recipientMode !== "idle";

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
                            committees={committees}
                            committeeId={committeeId}
                            onCommitteeChange={handleCommitteeChange}
                        />
                    </div>

                    {error && (
                        <div
                            className="mx-4 mt-4 rounded-xl px-4 py-3 text-sm font-body"
                            style={{
                                backgroundColor: "color-mix(in srgb, var(--danger) 8%, var(--bg-surface))",
                                border: "1px solid color-mix(in srgb, var(--danger) 20%, transparent)",
                                color: "var(--danger)",
                            }}
                        >
                            {error}
                        </div>
                    )}

                    <div className="p-2">
                        {isLoading ? (
                            <EmptyChatState text="Cargando conversaciones..." />
                        ) : isAutoOpeningConversation ? (
                            <EmptyChatState text="Abriendo conversación..." />
                        ) : isSearchMode ? (
                            recipientView.status === "loading" ? (
                                <EmptyChatState text="Buscando participantes..." />
                            ) : recipientView.status === "error" ? (
                                <EmptyChatState
                                    text={recipientView.error ?? "No se pudieron buscar participantes."}
                                />
                            ) : recipients.length > 0 ? (
                                <>
                                    {recipients.map((participant) => (
                                        <ChatItem
                                            key={participant.id}
                                            delegate={participant}
                                            onSelect={() => void handleSelectParticipant(participant)}
                                        />
                                    ))}
                                    {recipientView.hasMore && (
                                        <p
                                            className="text-center text-xs font-body px-4 py-3"
                                            style={{ color: "var(--text-muted)" }}
                                        >
                                            Hay más participantes. Refina la búsqueda o el comité para verlos.
                                        </p>
                                    )}
                                </>
                            ) : (
                                <EmptyChatState text="No se encontraron participantes con esos criterios." />
                            )
                        ) : visibleConversations.length > 0 ? (
                            visibleConversations.map((conversation) => (
                                <ChatItem
                                    key={conversation.id}
                                    delegate={{
                                        ...conversation.otherParticipant,
                                        lastActive: conversation.lastMessageAt
                                            ? `${formatDayLabel(conversation.lastMessageAt)} · ${formatTime(conversation.lastMessageAt)}`
                                            : "Nuevo",
                                    }}
                                    href={`/chat/${conversation.id}`}
                                    lastMessage={conversation.lastMessage}
                                    lastMessageIsMine={
                                        Boolean(activeMembershipId) &&
                                        conversation.lastMessageAuthorId === activeMembershipId
                                    }
                                />
                            ))
                        ) : (
                            <EmptyChatState text="Todavía no tienes conversaciones. Busca un delegado para iniciar una." />
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
