import React from "react";
import type { Message } from "../../types/common";

interface ChatMessageProps {
    message: Message;
    isMe: boolean;
}

export const ChatMessage = ({ message, isMe }: ChatMessageProps) => {
    return (
        <div
            className={`flex w-full ${isMe ? "justify-end" : "justify-start"} mb-4`}
        >
            <div
                className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-sm ${
                    isMe
                        ? "bg-primary text-white rounded-tr-sm"
                        : "bg-white border border-gray-100 text-body rounded-tl-sm"
                }`}
            >
                <p className="font-body text-[15px] leading-relaxed">
                    {message.text}
                </p>
                <span
                    className={`block text-[10px] font-medium mt-2 ${
                        isMe ? "text-blue-200" : "text-gray-400"
                    }`}
                >
                    {message.timestamp}
                </span>
            </div>
        </div>
    );
};
