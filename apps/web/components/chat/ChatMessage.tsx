import React, { useEffect, useId, useRef, useState } from "react";
import { formatDateTime, formatTime } from "../../lib/format-datetime";
import { canSubmitEdit, isEdited } from "../../lib/message-edit";
import { messageReadState } from "../../lib/read-receipts";
import type { DirectMessage } from "../../types/chat";

interface ChatMessageProps {
    message: DirectMessage;
    isMe: boolean;
    isNew?: boolean;
    // La hora solo se muestra en el último mensaje de cada bloque del mismo autor.
    isLastInRun?: boolean;
    onDelete?: (messageId: string) => void;
    // Guarda el texto editado; rechaza si falla para que el mensaje siga en edición.
    onEdit?: (messageId: string, content: string) => Promise<void>;
    isDeleting?: boolean;
}

export const ChatMessage = ({
    message,
    isMe,
    isNew,
    isLastInRun = true,
    onDelete,
    onEdit,
    isDeleting = false,
}: ChatMessageProps) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const [saving, setSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const firstItemRef = useRef<HTMLButtonElement>(null);
    const canDelete = isMe && Boolean(onDelete);
    const canEdit = isMe && Boolean(onEdit);
    const readState = messageReadState(message);

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

    const startEditing = () => {
        setMenuOpen(false);
        setDraft(message.text);
        setEditError(null);
        setEditing(true);
    };

    const cancelEditing = () => {
        setEditing(false);
        setEditError(null);
        triggerRef.current?.focus();
    };

    const saveEditing = async () => {
        if (!onEdit || saving || !canSubmitEdit(message.text, draft)) {
            return;
        }

        try {
            setSaving(true);
            setEditError(null);
            await onEdit(message.id, draft.trim());
            setEditing(false);
        } catch (error) {
            setEditError(error instanceof Error ? error.message : "No se pudo editar el mensaje");
        } finally {
            setSaving(false);
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
                    {(canDelete || canEdit) && !editing && (
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
                                    {canEdit && (
                                        <button
                                            ref={firstItemRef}
                                            type="button"
                                            role="menuitem"
                                            onClick={startEditing}
                                            className="flex items-center w-full min-h-11 md:min-h-0 px-4 py-2 text-left text-sm font-semibold font-body"
                                            style={{ color: "var(--text-primary)" }}
                                        >
                                            Editar
                                        </button>
                                    )}
                                    {canDelete && (
                                    <button
                                        ref={canEdit ? undefined : firstItemRef}
                                        type="button"
                                        role="menuitem"
                                        disabled={isDeleting}
                                        onClick={() => {
                                            // El foco vuelve al disparador "⋯" (sigue montado) antes de abrir
                                            // el diálogo, para que al cerrarlo el foco no se pierda.
                                            triggerRef.current?.focus();
                                            setMenuOpen(false);
                                            onDelete?.(message.id);
                                        }}
                                        className="flex items-center w-full min-h-11 md:min-h-0 px-4 py-2 text-left text-sm font-semibold font-body disabled:opacity-60"
                                        style={{ color: "var(--danger)" }}
                                    >
                                        {isDeleting ? "Eliminando..." : "Eliminar"}
                                    </button>
                                    )}
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
                        {editing ? (
                            <div className="flex flex-col gap-2">
                                <textarea
                                    autoFocus
                                    rows={2}
                                    value={draft}
                                    disabled={saving}
                                    aria-label="Editar mensaje"
                                    onChange={(event) => setDraft(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Escape") {
                                            event.preventDefault();
                                            cancelEditing();
                                        } else if (
                                            event.key === "Enter" &&
                                            !event.shiftKey &&
                                            !event.nativeEvent.isComposing &&
                                            event.keyCode !== 229
                                        ) {
                                            event.preventDefault();
                                            void saveEditing();
                                        }
                                    }}
                                    className="w-full min-w-48 resize-none rounded-lg px-2 py-1.5 text-sm"
                                    style={{
                                        backgroundColor: "var(--bg-input)",
                                        color: "var(--text-primary)",
                                        border: "1px solid var(--input-border)",
                                    }}
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={cancelEditing}
                                        disabled={saving}
                                        className="min-h-9 rounded-lg px-3 text-xs font-semibold"
                                        style={{ color: "var(--bubble-me-text)" }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void saveEditing()}
                                        disabled={saving || !canSubmitEdit(message.text, draft)}
                                        className="min-h-9 rounded-lg px-3 text-xs font-bold disabled:opacity-60"
                                        style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                                    >
                                        {saving ? "Guardando..." : "Guardar"}
                                    </button>
                                </div>
                                {editError && (
                                    <p role="alert" className="text-xs" style={{ color: "var(--bubble-me-text)" }}>
                                        {editError}
                                    </p>
                                )}
                            </div>
                        ) : (
                            message.text
                        )}
                    </div>
                </div>

                {isLastInRun && (
                    <div className="mt-1.5 flex items-center gap-2 px-1">
                        <time
                            dateTime={message.createdAt}
                            title={formatDateTime(message.createdAt)}
                            className="text-xs font-medium"
                            style={{
                                color: isMe ? "var(--text-muted)" : "var(--bubble-other-time)",
                            }}
                        >
                            {formatTime(message.createdAt)}
                        </time>
                        {isEdited(message) && message.editedAt && (
                            <span
                                data-edited
                                className="text-xs"
                                title={`Editado ${formatDateTime(message.editedAt)}`}
                                style={{ color: "var(--text-muted)" }}
                            >
                                (editado)
                            </span>
                        )}
                        {isMe && (
                            <span
                                className="text-xs font-semibold"
                                data-read-state={readState}
                                title={
                                    readState === "read" && message.readAt
                                        ? `Leído ${formatDateTime(message.readAt)}`
                                        : "Enviado, aún sin leer"
                                }
                                style={{
                                    color: readState === "read" ? "var(--text-accent)" : "var(--text-muted)",
                                }}
                            >
                                <span aria-hidden="true">{readState === "read" ? "✓✓" : "✓"}</span>{" "}
                                {readState === "read" ? "Leído" : "Enviado"}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
