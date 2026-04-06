import React, { useState, useRef, useEffect } from "react";

interface ChatInputProps {
    onSend: (text: string) => void | Promise<void>;
    disabled?: boolean;
}

export const ChatInput = ({ onSend, disabled = false }: ChatInputProps) => {
    const [text, setText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = async () => {
        if (!text.trim() || disabled || isSending) {
            return;
        }

        setIsSending(true);
        try {
            await onSend(text.trim());
            setText("");
        } finally {
            setIsSending(false);
        }
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height =
                Math.min(textareaRef.current.scrollHeight, 128) + "px";
        }
    }, [text]);

    const canSend = Boolean(text.trim()) && !disabled && !isSending;

    return (
        <div
            className="px-4 py-3 md:px-6 md:py-4 shrink-0"
            style={{
                backgroundColor: "var(--bg-surface)",
                borderTop: "1px solid var(--border-color)",
            }}
        >
            <div
                className="flex items-end gap-3 max-w-4xl mx-auto rounded-2xl px-4 py-2"
                style={{
                    backgroundColor: "var(--bg-input)",
                    border: "1px solid var(--input-border)",
                    boxShadow: "0 0 0 0 transparent",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocusCapture={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = "var(--input-focus)";
                    el.style.boxShadow =
                        "0 0 0 3px color-mix(in srgb, var(--input-focus) 15%, transparent)";
                }}
                onBlurCapture={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = "var(--input-border)";
                    el.style.boxShadow = "0 0 0 0 transparent";
                }}
            >
                <textarea
                    ref={textareaRef}
                    value={text}
                    disabled={disabled || isSending}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 bg-transparent resize-none outline-none text-[15px] py-2 placeholder:font-normal disabled:opacity-70"
                    rows={1}
                    style={{
                        fontFamily: "var(--font-body)",
                        color: "var(--text-primary)",
                        minHeight: "40px",
                        maxHeight: "128px",
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void handleSend();
                        }
                    }}
                />

                <button
                    onClick={() => void handleSend()}
                    disabled={!canSend}
                    className="shrink-0 flex items-center justify-center size-10 rounded-xl transition-all active:scale-95"
                    style={{
                        backgroundColor: canSend
                            ? "var(--bubble-me-bg)"
                            : "var(--bg-surface-secondary)",
                        color: canSend ? "white" : "var(--text-muted)",
                        cursor: canSend ? "pointer" : "not-allowed",
                    }}
                    aria-label="Enviar mensaje"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </div>

            <p
                className="text-center text-[11px] mt-2"
                style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}
            >
                Enter para enviar - Shift+Enter para nueva linea
            </p>
        </div>
    );
};
