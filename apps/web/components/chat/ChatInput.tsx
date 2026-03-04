import React, { useState } from "react";

interface ChatInputProps {
    onSend: (text: string) => void;
}

export const ChatInput = ({ onSend }: ChatInputProps) => {
    const [text, setText] = useState("");

    const handleSend = () => {
        if (text.trim()) {
            onSend(text);
            setText("");
        }
    };

    return (
        <div className="p-4 md:p-6 bg-white border-t border-gray-100 shrink-0">
            <div className="flex items-end gap-3 max-w-4xl mx-auto">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 min-h-12 max-h-32 p-3.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-body font-body text-[15px] resize-none placeholder:text-gray-400 transition-all shadow-sm"
                    rows={1}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                />

                <button
                    onClick={handleSend}
                    disabled={!text.trim()}
                    className="h-13 w-13 flex items-center justify-center bg-primary disabled:bg-gray-300 text-white rounded-xl shadow-sm hover:bg-accent transition-colors shrink-0"
                >
                    <img
                        src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/send.svg"
                        className="size-5 filter invert"
                        alt="Enviar"
                    />
                </button>
            </div>
        </div>
    );
};
