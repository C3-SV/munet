import React from "react";
import type { Message } from "../../types/common";

interface ChatMessageProps {
    message: Message;
    isMe: boolean;
    isNew?: boolean;
}

export const ChatMessage = ({ message, isMe, isNew }: ChatMessageProps) => {
    return (
        <div
            className={`flex w-full mb-3 ${isMe ? "justify-end" : "justify-start"} ${isNew ? "animate-message-in" : ""}`}
        >
            <div
                className="max-w-[82%] md:max-w-[65%] flex flex-col"
                style={{ alignItems: isMe ? "flex-end" : "flex-start" }}
            >
                <div
                    className="px-4 py-3 text-[15px] leading-relaxed"
                    style={{
                        backgroundColor: isMe ? "var(--bubble-me-bg)" : "var(--bubble-other-bg)",
                        color: isMe ? "var(--bubble-me-text)" : "var(--bubble-other-text)",
                        borderRadius: isMe
                            ? "18px 18px 4px 18px"
                            : "18px 18px 18px 4px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                        fontFamily: "var(--font-body)",
                        wordBreak: "break-word",
                    }}
                >
                    {message.text}
                </div>
                <span
                    className="text-[11px] mt-1.5 font-medium px-1"
                    style={{
                        color: isMe ? "var(--text-muted)" : "var(--bubble-other-time)",
                    }}
                >
                    {message.timestamp}
                </span>
            </div>
        </div>
    );
};
