"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { ChatRoomHeader } from "../../../../components/chat/ChatRoomHeader";
import { ChatMessage } from "../../../../components/chat/ChatMessage";
import { ChatInput } from "../../../../components/chat/ChatInput";
import type { Delegate, Message } from "../../../../types/common";

const DELEGATES: Record<string, Delegate> = {
    "1": {
        id: "1",
        name: "Sarah Chen",
        avatar: "https://i.pravatar.cc/150?u=sarah",
        role: "DELEGADO",
        committee: "COMITÉ 1",
        lastActive: "2 horas",
    },
    "2": {
        id: "2",
        name: "Rober Morán",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
        role: "DELEGADO",
        committee: "COMITÉ 2",
        lastActive: "5 minutos",
    },
    "3": {
        id: "3",
        name: "Elena Rojas",
        avatar: "https://i.pravatar.cc/150?u=elena",
        role: "DELEGADO",
        committee: "COMITÉ 1",
        lastActive: "1 día",
    },
    "4": {
        id: "4",
        name: "Miguel Torres",
        avatar: "https://i.pravatar.cc/150?u=miguel",
        role: "DELEGADO",
        committee: "COMITÉ 3",
        lastActive: "3 días",
    },
};

const ChatRoomPage = () => {
    const params = useParams();
    const chatId = typeof params?.id === "string" ? params.id : "1";

    const MY_USER_ID = "u_me";
    const bottomRef = useRef<HTMLDivElement>(null);
    const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());

    const delegate = DELEGATES[chatId] ?? {
        id: chatId,
        name: "Delegado",
        avatar: `https://i.pravatar.cc/150?u=${chatId}`,
        role: "DELEGADO",
        committee: "COMITÉ",
        lastActive: "desconocido",
    };

    const [messages, setMessages] = useState<Message[]>([
        {
            id: "m1",
            text: "Hola delegado, quería hablar con usted acerca del último anuncio que recibimos, ¿tienes tiempo?",
            senderId: MY_USER_ID,
            timestamp: "6:35 PM",
        },
        {
            id: "m2",
            text: "Claro que sí, ¿en qué te puedo ayudar?",
            senderId: chatId,
            timestamp: "6:45 PM",
        },
    ]);

    const handleSendMessage = (text: string) => {
        const newId = `m_${Date.now()}`;
        const newMessage: Message = {
            id: newId,
            text,
            senderId: MY_USER_ID,
            timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            }),
        };
        setMessages((prev) => [...prev, newMessage]);
        setNewMessageIds((prev) => new Set([...prev, newId]));
    };

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Group messages by "date" (simulated)
    const dateLabel = "HOY";

    return (
        <div
            className="flex flex-col h-full"
            style={{ backgroundColor: "var(--bg-base)" }}
        >
            <ChatRoomHeader delegate={delegate} isOnline={delegate.lastActive === "5 minutos"} />

            <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
                <div className="max-w-3xl mx-auto">
                    {/* Date separator */}
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
                            {dateLabel}
                        </span>
                        <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-color)" }} />
                    </div>

                    {messages.map((msg) => (
                        <ChatMessage
                            key={msg.id}
                            message={msg}
                            isMe={msg.senderId === MY_USER_ID}
                            isNew={newMessageIds.has(msg.id)}
                        />
                    ))}

                    <div ref={bottomRef} />
                </div>
            </div>

            <ChatInput onSend={handleSendMessage} />
        </div>
    );
};

export default ChatRoomPage;
