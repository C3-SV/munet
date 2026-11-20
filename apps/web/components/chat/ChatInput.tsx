import React, { useState, useRef, useEffect } from "react";
import { IconSend } from "../ui/icons";

interface ChatInputProps {
    onSend: (text: string) => void | Promise<void>;
    disabled?: boolean;
}

const SEND_HINT = "Enter para enviar; Shift+Enter para nueva línea";

// En dispositivos táctiles Enter inserta salto de línea y solo el botón envía.
const usePrefersCoarsePointer = () => {
    const [isCoarse, setIsCoarse] = useState(false);

    useEffect(() => {
        try {
            if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
                setIsCoarse(window.matchMedia("(pointer: coarse)").matches);
            }
        } catch {
            // Sin soporte de matchMedia se usa el comportamiento de escritorio.
        }
    }, []);

    return isCoarse;
};

export const ChatInput = ({ onSend, disabled = false }: ChatInputProps) => {
    const [text, setText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isCoarsePointer = usePrefersCoarsePointer();

    const handleSend = async () => {
        // Evita envios vacios/duplicados y limpia input tras exito.
        if (!text.trim() || disabled || isSending) {
            return;
        }

        setIsSending(true);
        try {
            await onSend(text.trim());
            setText("");
        } finally {
            setIsSending(false);
            // Mantiene el foco en el campo para seguir escribiendo (teclado abierto en móvil).
            textareaRef.current?.focus();
        }
    };

    useEffect(() => {
        // Auto-ajusta alto del textarea segun contenido (hasta maximo definido).
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
                    disabled={disabled}
                    readOnly={isSending}
                    aria-label="Escribe un mensaje"
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
                        if (e.key === "Enter" && !e.shiftKey && !isCoarsePointer) {
                            e.preventDefault();
                            void handleSend();
                        }
                    }}
                />

                <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!canSend}
                    className="shrink-0 flex items-center justify-center size-11 md:size-10 rounded-xl transition-[opacity,transform,background-color,border-color,color]"
                    style={{
                        backgroundColor: canSend
                            ? "var(--bubble-me-bg)"
                            : "var(--bg-surface-secondary)",
                        color: canSend ? "var(--text-on-accent)" : "var(--text-muted)",
                        cursor: canSend ? "pointer" : "not-allowed",
                    }}
                    aria-label="Enviar mensaje"
                    title={isCoarsePointer ? undefined : SEND_HINT}
                >
                    <IconSend size={18} />
                </button>
            </div>
        </div>
    );
};
