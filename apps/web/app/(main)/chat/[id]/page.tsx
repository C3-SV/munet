"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatInput } from "../../../../components/chat/ChatInput";
import { ChatMessage } from "../../../../components/chat/ChatMessage";
import { ChatRoomHeader } from "../../../../components/chat/ChatRoomHeader";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import { groupMessages } from "../../../../lib/chat-groups";
import {
    createConversation,
    deleteConversationMessage,
    getConversationMessages,
    getConversations,
    sendConversationMessage,
} from "../../../../lib/api/chat";
import { formatDayLabel, formatTime } from "../../../../lib/format-datetime";
import { isPracticeEvent } from "../../../../lib/practice/constants";
import { supabaseBrowser } from "../../../../lib/supabase";
import { useAuthStore } from "../../../../stores/auth.store";
import type { ConversationSummary, DirectMessage } from "../../../../types/chat";
import type { Delegate } from "../../../../types/common";

// Distancia en píxeles al final para considerar que el usuario sigue la conversación.
const NEAR_BOTTOM_PX = 120;
// En la práctica, la respuesta simulada aparece en el estado al enviar; se vuelve a leer tras este retraso.
const PRACTICE_REPLY_REFRESH_MS = 1200;

const preferredScrollBehavior = (): ScrollBehavior => {
    try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    } catch {
        return "smooth";
    }
};

const ChatRoomPage = () => {
    const params = useParams();
    const router = useRouter();
    const conversationId = typeof params?.id === "string" ? params.id : "";

    const token = useAuthStore((state) => state.token);
    const eventId = useAuthStore((state) => state.activeEventId);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);

    const scrollRef = useRef<HTMLDivElement>(null);
    const nearBottomRef = useRef(true);
    const initialScrollDoneRef = useRef(false);
    const knownMessageIdsRef = useRef<Set<string>>(new Set());
    const practiceRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showNewMessagesChip, setShowNewMessagesChip] = useState(false);
    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [conversation, setConversation] = useState<ConversationSummary | null>(null);
    const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
    const [deletingMessageIds, setDeletingMessageIds] = useState<Set<string>>(new Set());
    const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const delegate: Delegate = useMemo(
        () =>
            conversation
                ? {
                      ...conversation.otherParticipant,
                      lastActive: conversation.lastMessageAt
                          ? `${formatDayLabel(conversation.lastMessageAt)} · ${formatTime(conversation.lastMessageAt)}`
                          : "Nuevo",
                  }
                : {
                      id: conversationId,
                      name: "Delegado",
                      // Sin avatar: ChatRoomHeader muestra iniciales locales.
                      avatar: "",
                      role: "PARTICIPANT",
                      committee: "Comité",
                      lastActive: "desconocido",
                  },
        [conversation, conversationId],
    );

    // Bloques por día y por autor consecutivo (ver lib/chat-groups.ts).
    const messageGroups = useMemo(
        () =>
            groupMessages(
                messages.map((message) => ({
                    id: message.id,
                    senderId: message.senderId,
                    createdAt: message.createdAt,
                })),
            ),
        [messages],
    );

    const messagesById = useMemo(
        () => new Map(messages.map((message) => [message.id, message])),
        [messages],
    );

    const refreshConversation = useCallback(async () => {
        // Refresca metadata de la conversacion (participant/last message).
        if (!token || !eventId || !conversationId) {
            return;
        }

        const conversationList = await getConversations({ token, eventId });
        setConversation(
            conversationList.find((item) => item.id === conversationId) ?? null,
        );
    }, [conversationId, eventId, token]);

    const refreshMessages = useCallback(async (markAsNew = false) => {
        // Refresca mensajes y marca como nuevos los que no estaban en memoria.
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
        // Carga inicial del room; si llega membershipId accidental intenta resolver conversacion.
        if (!token || !eventId || !conversationId) {
            return;
        }

        let cancelled = false;

        // Otra conversación no hereda el estado de scroll ni los ids ya conocidos,
        // aunque el componente no se desmonte al cambiar el parámetro.
        initialScrollDoneRef.current = false;
        knownMessageIdsRef.current = new Set();
        nearBottomRef.current = true;
        setShowNewMessagesChip(false);

        const loadRoom = async () => {
            try {
                setIsLoading(true);
                const conversationList = await getConversations({ token, eventId });
                const matchedConversation =
                    conversationList.find((item) => item.id === conversationId) ?? null;

                if (!matchedConversation) {
                    // Si la URL trae membershipId por error, intentamos resolver/crear conversación.
                    const createdConversation = await createConversation(conversationId, {
                        token,
                        eventId,
                    });

                    if (!cancelled) {
                        const matchedByTarget =
                            conversationList.find(
                                (item) => item.otherParticipant.id === conversationId,
                            ) ?? null;
                        const resolvedConversationId = matchedByTarget?.id ?? createdConversation.id;

                        // Normalizamos URL final para que siempre quede `/chat/<conversationId>`.
                        router.replace(`/chat/${resolvedConversationId}`);
                    }

                    return;
                }

                const messageList = await getConversationMessages(matchedConversation.id, {
                    token,
                    eventId,
                });

                if (!cancelled) {
                    setConversation(matchedConversation);
                    setMessages(messageList);
                    setError(null);
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : "No se pudo cargar la conversación.",
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
    }, [conversationId, eventId, router, token]);

    useEffect(() => {
        // Al cambiar de conversacion o salir de la pantalla se cancela la relectura pendiente de la practica.
        return () => {
            if (practiceRefreshTimerRef.current !== null) {
                clearTimeout(practiceRefreshTimerRef.current);
                practiceRefreshTimerRef.current = null;
            }
        };
    }, [conversationId]);

    useEffect(() => {
        // Realtime de la conversacion: mensajes y cambios de cabecera.
        if (!conversationId || !supabaseBrowser || !token || !eventId || isPracticeEvent(eventId)) {
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

    const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
        const element = scrollRef.current;
        if (!element) {
            return;
        }

        element.scrollTo({ top: element.scrollHeight, behavior });
        nearBottomRef.current = true;
        setShowNewMessagesChip(false);
    }, []);

    const handleScroll = () => {
        const element = scrollRef.current;
        if (!element) {
            return;
        }

        const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
        nearBottomRef.current = distance < NEAR_BOTTOM_PX;
        if (nearBottomRef.current) {
            setShowNewMessagesChip(false);
        }
    };

    useEffect(() => {
        // Carga inicial: baja al final sin animación. Después, solo sigue la conversación
        // si el usuario está cerca del final o si el mensaje es suyo; si no, ofrece un chip.
        if (isLoading) {
            return;
        }

        const previousIds = knownMessageIdsRef.current;
        const incoming = messages.filter((message) => !previousIds.has(message.id));
        knownMessageIdsRef.current = new Set(messages.map((message) => message.id));

        if (!initialScrollDoneRef.current) {
            initialScrollDoneRef.current = true;
            scrollToBottom("auto");
            return;
        }

        if (incoming.length === 0) {
            return;
        }

        const hasOwnIncoming = incoming.some(
            (message) => message.senderId === activeMembershipId,
        );

        if (hasOwnIncoming || nearBottomRef.current) {
            scrollToBottom(preferredScrollBehavior());
        } else {
            setShowNewMessagesChip(true);
        }
    }, [activeMembershipId, isLoading, messages, scrollToBottom]);

    const handleSendMessage = async (text: string) => {
        // Envia mensaje y agrega resultado local para respuesta inmediata.
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

            // En la practica la respuesta simulada ya esta guardada: se relee tras un retraso para mostrarla.
            if (isPracticeEvent(eventId)) {
                if (practiceRefreshTimerRef.current !== null) {
                    clearTimeout(practiceRefreshTimerRef.current);
                }
                practiceRefreshTimerRef.current = setTimeout(() => {
                    practiceRefreshTimerRef.current = null;
                    void refreshMessages(true);
                }, PRACTICE_REPLY_REFRESH_MS);
            }
        } catch (sendError) {
            setError(
                sendError instanceof Error
                    ? sendError.message
                    : "No se pudo enviar el mensaje.",
            );
            throw sendError;
        }
    };

    const requestDeleteMessage = (messageId: string) => {
        // Elimina mensaje propio: pide confirmacion antes de llamar a la API.
        if (!token || !eventId || !conversationId) {
            return;
        }

        setPendingDeleteMessageId(messageId);
    };

    const handleDeleteMessage = async (messageId: string) => {
        // Elimina mensaje propio y refresca la conversacion.
        if (!token || !eventId || !conversationId) {
            return;
        }

        try {
            setError(null);
            setDeletingMessageIds((current) => new Set([...current, messageId]));
            await deleteConversationMessage(conversationId, messageId, {
                token,
                eventId,
            });
            setMessages((current) =>
                current.filter((message) => message.id !== messageId),
            );
            await refreshMessages(false);
            await refreshConversation();
            setNewMessageIds((current) => {
                const next = new Set(current);
                next.delete(messageId);
                return next;
            });
        } catch (deleteError) {
            setError(
                deleteError instanceof Error
                    ? deleteError.message
                    : "No se pudo eliminar el mensaje.",
            );
        } finally {
            setDeletingMessageIds((current) => {
                const next = new Set(current);
                next.delete(messageId);
                return next;
            });
        }
    };

    return (
        <div
            className="flex flex-col flex-1 min-h-0"
            style={{ backgroundColor: "var(--bg-base)" }}
        >
            <ChatRoomHeader delegate={delegate} />

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

            <div className="relative flex-1 min-h-0">
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="h-full overflow-y-auto px-4 py-6 md:px-8"
                >
                    <div className="max-w-3xl mx-auto">
                        {isLoading ? (
                            <p className="text-center text-sm font-body" style={{ color: "var(--text-muted)" }}>
                                Cargando mensajes...
                            </p>
                        ) : messages.length > 0 ? (
                            messageGroups.map((group, groupIndex) => (
                                <React.Fragment key={`day-${groupIndex}`}>
                                    {group.dayLabel && (
                                        <div className="flex items-center gap-3 my-6">
                                            <div
                                                className="flex-1 h-px"
                                                style={{ backgroundColor: "var(--border-color)" }}
                                            />
                                            <span
                                                className="text-xs font-semibold px-3 py-1 rounded-full font-heading"
                                                style={{
                                                    color: "var(--text-muted)",
                                                    backgroundColor: "var(--bg-surface-secondary)",
                                                    border: "1px solid var(--border-color)",
                                                }}
                                            >
                                                {group.dayLabel}
                                            </span>
                                            <div
                                                className="flex-1 h-px"
                                                style={{ backgroundColor: "var(--border-color)" }}
                                            />
                                        </div>
                                    )}
                                    {group.runs.map((run) =>
                                        run.messageIds.map((messageId, indexInRun) => {
                                            const message = messagesById.get(messageId);
                                            if (!message) {
                                                return null;
                                            }

                                            const isMe = message.senderId === activeMembershipId;

                                            return (
                                                <ChatMessage
                                                    key={message.id}
                                                    message={message}
                                                    isMe={isMe}
                                                    isNew={newMessageIds.has(message.id)}
                                                    isLastInRun={indexInRun === run.messageIds.length - 1}
                                                    onDelete={isMe ? requestDeleteMessage : undefined}
                                                    isDeleting={deletingMessageIds.has(message.id)}
                                                />
                                            );
                                        }),
                                    )}
                                </React.Fragment>
                            ))
                        ) : (
                            <p className="text-center text-sm font-body" style={{ color: "var(--text-muted)" }}>
                                Todavía no hay mensajes. Escribe el primero.
                            </p>
                        )}
                    </div>
                </div>

                {showNewMessagesChip && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                        <button
                            type="button"
                            onClick={() => scrollToBottom(preferredScrollBehavior())}
                            className="pointer-events-auto motion-fade-in min-h-11 px-4 rounded-full text-sm font-semibold font-body"
                            style={{
                                backgroundColor: "var(--bubble-me-bg)",
                                color: "var(--text-on-accent)",
                                boxShadow: "var(--shadow-sm)",
                            }}
                        >
                            Mensajes nuevos
                        </button>
                    </div>
                )}
            </div>

            <ChatInput onSend={handleSendMessage} disabled={isLoading} />

            <ConfirmDialog
                open={pendingDeleteMessageId !== null}
                title="¿Eliminar este mensaje?"
                description="Dejará de verse en la conversación, aunque quedará registrado en auditoría. Esta acción no se puede deshacer."
                confirmLabel="Eliminar"
                tone="danger"
                onCancel={() => setPendingDeleteMessageId(null)}
                onConfirm={() => {
                    const messageId = pendingDeleteMessageId;
                    setPendingDeleteMessageId(null);
                    if (messageId) {
                        void handleDeleteMessage(messageId);
                    }
                }}
            />
        </div>
    );
};

export default ChatRoomPage;
