"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ChatRoomHeader } from "../../../../components/chat/ChatRoomHeader";
import { ChatMessage } from "../../../../components/chat/ChatMessage";
import { ChatInput } from "../../../../components/chat/ChatInput";
import type { Delegate, Message } from "../../../../types/common";

const ChatRoomPage = () => {
    const params = useParams();
    const chatId = typeof params?.id === "string" ? params.id : "";

    const MY_USER_ID = "u_me";

    const [delegate, setDelegate] = useState<Delegate | null>(null);

    useEffect(() => {
        setDelegate({
            id: chatId,
            name: "Sarah Chen",
            avatar: "https://i.pravatar.cc/150?u=sarah",
            role: "DELEGADO",
            committee: "COMITÉ 1",
            lastActive: "2 horas",
        });
    }, [chatId]);

    const [messages, setMessages] = useState<Message[]>([
        {
            id: "m1",
            text: "Hola delegado, quería hablar con usted acerca del último anuncio que recibimos, ¿tienes tiempo?",
            senderId: "u_me",
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
        const newMessage: Message = {
            id: Math.random().toString(),
            text,
            senderId: MY_USER_ID,
            timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            }),
        };
        setMessages([...messages, newMessage]);
    };

    if (!delegate) return null;

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC]">
            <ChatRoomHeader delegate={delegate} />

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-center mb-6">
                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest font-heading">
                            MARTES, 6:35 PM
                        </span>
                    </div>

                    {messages.map((msg) => (
                        <ChatMessage
                            key={msg.id}
                            message={msg}
                            isMe={msg.senderId === MY_USER_ID}
                        />
                    ))}
                </div>
            </div>

            <ChatInput onSend={handleSendMessage} />
        </div>
    );
};

export default ChatRoomPage;
