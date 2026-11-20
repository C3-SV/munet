import React, { useEffect, useId, useRef, useState } from "react";
import { formatDateTime, formatTime } from "../../lib/format-datetime";
import type { DirectMessage } from "../../types/chat";

interface ChatMessageProps {
    message: DirectMessage;
    isMe: boolean;
    isNew?: boolean;
    // La hora solo se muestra en el último mensaje de cada bloque del mismo autor.
    isLastInRun?: boolean;
    onDelete?: (messageId: string) => void;
    isDeleting?: boolean;
}

export const ChatMessage = ({
    message,
    isMe,
    isNew,
    isLastInRun = true,
    onDelete,
    isDeleting = false,
}: ChatMessageProps) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const firstItemRef = useRef<HTMLButtonElement>(null);
    const canDelete = isMe && Boolean(onDelete);

    // Cierra el menú al pulsar fuera de la burbuja.
    useEffect(() => {
        if (!menuOpen) return;

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("touchstart", handlePointerDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("touchstart", handlePointerDown);
        };
    }, [menuOpen]);

    // Con el menú abierto, el foco pasa a la acción para poder usarla con teclado.
    useEffect(() => {
        if (menuOpen) {
            firstItemRef.current?.focus();
        }
    }, [menuOpen]);

    const closeMenu = (returnFocus: boolean) => {
        setMenuOpen(false);
        if (returnFocus) {
            triggerRef.current?.focus();
        }
    };

    return (
        <div
            className={`flex w-full ${isLastInRun ? "mb-3" : "mb-1"} ${isMe ? "justify-end" : "justify-start"} ${isNew ? "motion-fade-in" : ""}`}
        >
            <div
                className="max-w-[82%] md:max-w-[65%] flex flex-col"
                style={{ alignItems: isMe ? "flex-end" : "flex-start" }}
            >
                <div
                    ref={containerRef}
                    className="flex items-center gap-1 max-w-full"
                    onKeyDown={(event) => {
                        if (event.key === "Escape" && menuOpen) {
                            closeMenu(true);
                        }
                    }}
                    onBlur={(event) => {
                        // Si el foco sale del mensaje hacia fuera, el menú se cierra.
                        const next = event.relatedTarget as Node | null;
                        if (next && !event.currentTarget.contains(next)) {
                            setMenuOpen(false);
                        }
                    }}
                >
                    {canDelete && (
                        <div className="relative shrink-0">
                            <button
                                ref={triggerRef}
                                type="button"
                                aria-label="Opciones del mensaje"
                                aria-haspopup="menu"
                                aria-expanded={menuOpen}
                                aria-controls={menuOpen ? menuId : undefined}
                                disabled={isDeleting}
                                onClick={() => setMenuOpen((open) => !open)}
                                className="flex items-center justify-center size-11 md:size-8 rounded-full text-lg leading-none disabled:opacity-60"
                                style={{ color: "var(--text-muted)" }}
                            >
                                <span aria-hidden="true">⋯</span>
                            </button>

                            {menuOpen && (
                                <div
                                    id={menuId}
                                    role="menu"
                                    aria-label="Acciones del mensaje"
                                    className="absolute z-10 top-full left-0 mt-1 min-w-40 rounded-xl py-1"
                                    style={{
                                        backgroundColor: "var(--bg-surface)",
                                        border: "1px solid var(--border-color)",
                                        boxShadow: "var(--shadow-sm)",
                                    }}
                                >
                                    <button
                                        ref={firstItemRef}
                                        type="button"
                                        role="menuitem"
                                        disabled={isDeleting}
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onDelete?.(message.id);
                                        }}
                                        className="flex items-center w-full min-h-11 md:min-h-0 px-4 py-2 text-left text-sm font-semibold font-body disabled:opacity-60"
                                        style={{ color: "var(--danger)" }}
                                    >
                                        {isDeleting ? "Eliminando..." : "Eliminar"}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div
                        className="min-w-0 px-4 py-3 text-[15px] leading-relaxed"
                        style={{
                            backgroundColor: isMe ? "var(--bubble-me-bg)" : "var(--bubble-other-bg)",
                            color: isMe ? "var(--bubble-me-text)" : "var(--bubble-other-text)",
                            borderRadius: isMe
                                ? "18px 18px 4px 18px"
                                : "18px 18px 18px 4px",
                            boxShadow: "var(--shadow-sm)",
                            fontFamily: "var(--font-body)",
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                        }}
                    >
                        {message.text}
                    </div>
                </div>

                {isLastInRun && (
                    <time
                        dateTime={message.createdAt}
                        title={formatDateTime(message.createdAt)}
                        className="text-xs mt-1.5 font-medium px-1"
                        style={{
                            color: isMe ? "var(--text-muted)" : "var(--bubble-other-time)",
                        }}
                    >
                        {formatTime(message.createdAt)}
                    </time>
                )}
            </div>
        </div>
    );
};
