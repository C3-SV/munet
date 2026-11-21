"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPostComment, deletePostComment, getPostComments } from "../../lib/api/comments";
import { realtimeEnabled, supabaseBrowser } from "../../lib/supabase";
import { formatDateTime } from "../../lib/format-datetime";
import { Button } from "../ui/Button";
import { IconChat, IconChevronDown } from "../ui/icons";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { PersonLabel } from "../ui/PersonLabel";
import type { PostComment } from "../../types/common";

const COMMENT_SUBMIT_COOLDOWN_MS = 1200;

type PostCommentsProps = {
    postId: string;
    token: string;
    eventId: string;
    disabled?: boolean;
    showAuthorCommittee?: boolean;
    defaultOpen?: boolean;
};

// En pantallas táctiles Enter inserta salto de línea; el envío es el botón.
const isCoarsePointer = () =>
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

// Solo el disparador vive aquí. El panel (carga, realtime y composer) se monta al abrir
// y se desmonta al cerrar, así que sus efectos empiezan y terminan con la apertura.
export const PostComments = ({
    postId,
    token,
    eventId,
    disabled = false,
    showAuthorCommittee = true,
    defaultOpen = false,
}: PostCommentsProps) => {
    const [open, setOpen] = useState(defaultOpen);
    const [count, setCount] = useState<number | null>(null);
    const panelId = useId();

    useEffect(() => {
        // Contador del disparador: una carga ligera al montar; el panel abierto lo mantiene al día.
        let cancelled = false;

        getPostComments(postId, { token, eventId })
            .then((data) => {
                if (!cancelled) {
                    setCount(data.filter((comment) => !comment.isDeleted).length);
                }
            })
            .catch(() => {
                // Sin contador no se bloquea nada: el botón sigue abriendo el panel.
            });

        return () => {
            cancelled = true;
        };
    }, [eventId, postId, token]);

    return (
        <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
            <button
                type="button"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => setOpen((current) => !current)}
                className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-color)] px-3 text-sm font-heading font-semibold text-[var(--text-accent)] hover:bg-[var(--bg-surface-secondary)] md:min-h-9"
            >
                <IconChat size={18} />
                <span>
                    {count === null
                        ? "Comentarios"
                        : count === 0
                          ? "Comentar"
                          : `${count} ${count === 1 ? "comentario" : "comentarios"}`}
                </span>
                <IconChevronDown
                    size={16}
                    style={{
                        transform: open ? "rotate(180deg)" : "none",
                        transition: "transform 160ms ease-out",
                    }}
                />
            </button>

            {open && (
                <CommentsPanel
                    id={panelId}
                    postId={postId}
                    token={token}
                    eventId={eventId}
                    disabled={disabled}
                    showAuthorCommittee={showAuthorCommittee}
                    onCountChange={setCount}
                />
            )}
        </div>
    );
};

type CommentsPanelProps = Omit<PostCommentsProps, "defaultOpen"> & {
    id: string;
    onCountChange: (count: number) => void;
};

const CommentsPanel = ({
    id,
    postId,
    token,
    eventId,
    disabled = false,
    showAuthorCommittee = true,
    onCountChange,
}: CommentsPanelProps) => {
    const [comments, setComments] = useState<PostComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [inputValue, setInputValue] = useState("");
    const [replyTo, setReplyTo] = useState<PostComment | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
    const [pendingDeleteComment, setPendingDeleteComment] = useState<PostComment | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastSubmitAt, setLastSubmitAt] = useState<number>(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        // Mantiene el contador del disparador sincronizado con la lista visible, ya cargada.
        if (!loading) {
            onCountChange(comments.filter((comment) => !comment.isDeleted).length);
        }
    }, [comments, loading, onCountChange]);
    // Botones "⋯" por comentario: el foco vuelve a ellos al cerrar el diálogo de borrado.
    const menuButtonRefs = useRef(new Map<string, HTMLButtonElement>());

    const loadComments = useCallback(async (options?: { showLoader?: boolean }) => {
        // Fetch reutilizable para carga inicial y refrescos por realtime.
        const showLoader = options?.showLoader ?? true;

        if (showLoader) {
            setLoading(true);
        }

        try {
            const data = await getPostComments(postId, { token, eventId });
            setComments(data);
            setError(null);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar comentarios");
        } finally {
            if (showLoader) {
                setLoading(false);
            }
        }
    }, [eventId, postId, token]);

    useEffect(() => {
        // Carga inicial al abrir el panel.
        let cancelled = false;

        const bootstrap = async () => {
            if (cancelled) {
                return;
            }

            await loadComments({ showLoader: true });
        };

        void bootstrap();

        return () => {
            cancelled = true;
        };
    }, [eventId, postId, token, loadComments]);

    useEffect(() => {
        // Realtime de comentarios por `post_id`; se cancela al cerrar el panel.
        if (!realtimeEnabled || !supabaseBrowser || !token) {
            return;
        }

        const realtimeClient = supabaseBrowser;
        let cancelled = false;
        let hasJoined = false;
        // Autoriza el socket con la sesión activa antes de suscribirse.
        realtimeClient.realtime.setAuth(token);
        const channel = realtimeClient.channel(`post-comments:${postId}`);

        const refreshComments = async () => {
            if (cancelled) {
                return;
            }

            await loadComments({ showLoader: false });
        };

        channel
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "post_comments",
                    filter: `post_id=eq.${postId}`,
                },
                () => {
                    void refreshComments();
                },
            )
            .subscribe((status) => {
                // Relee al reconectar para recuperar cambios perdidos sin socket.
                if (status !== "SUBSCRIBED") return;
                if (hasJoined) void refreshComments();
                hasJoined = true;
            });

        return () => {
            cancelled = true;
            void realtimeClient.removeChannel(channel);
        };
    }, [eventId, postId, token, loadComments]);

    useEffect(() => {
        // Auto-altura del campo: crece con el texto hasta el límite de max-h.
        const field = textareaRef.current;

        if (!field) {
            return;
        }

        field.style.height = "auto";
        field.style.height = `${field.scrollHeight}px`;
    }, [inputValue]);

    useEffect(() => {
        // Safari no enfoca el control tocado, así que el blur no basta: cierra el menú al tocar fuera.
        if (!openMenuId) {
            return;
        }

        const closeOnOutsidePointer = (event: PointerEvent) => {
            if (event.target instanceof Element && event.target.closest("[data-comment-menu]")) {
                return;
            }

            setOpenMenuId(null);
        };

        document.addEventListener("pointerdown", closeOnOutsidePointer);

        return () => {
            document.removeEventListener("pointerdown", closeOnOutsidePointer);
        };
    }, [openMenuId]);

    const byId = useMemo(
        () =>
            new Map<string, PostComment>(
                comments.map((comment) => [comment.id, comment]),
            ),
        [comments],
    );

    const submitComment = async () => {
        // Aplica debounce/cooldown para evitar doble envio por doble click.
        const normalizedContent = inputValue.trim();

        if (!normalizedContent || isSubmitting || disabled) {
            return;
        }

        const now = Date.now();

        if (now - lastSubmitAt < COMMENT_SUBMIT_COOLDOWN_MS) {
            setError("Espera un momento antes de enviar otro comentario.");
            return;
        }

        // El foco se queda en el campo para seguir escribiendo.
        textareaRef.current?.focus();

        try {
            setIsSubmitting(true);
            setError(null);

            const newComment = await createPostComment(postId, {
                token,
                eventId,
                content: normalizedContent,
                parentCommentId: replyTo?.id,
            });

            setComments((current) => [...current, newComment]);
            setInputValue("");
            setReplyTo(null);
            setLastSubmitAt(now);
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "No se pudo comentar");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        // Escritorio: Enter envía y Shift+Enter inserta salto. Táctil: Enter inserta salto.
        // Safari dispara el Enter que confirma un IME con keyCode 229 y sin isComposing.
        if (
            event.key !== "Enter" ||
            event.shiftKey ||
            event.nativeEvent.isComposing ||
            event.keyCode === 229 ||
            isCoarsePointer()
        ) {
            return;
        }

        event.preventDefault();
        void submitComment();
    };

    const requestDeleteComment = (comment: PostComment) => {
        // Soft delete de comentario: pide confirmacion antes de llamar a la API.
        if (!comment.canDelete || comment.isDeleted || deletingCommentId) {
            return;
        }

        setPendingDeleteComment(comment);
    };

    const handleDeleteComment = async (comment: PostComment) => {
        if (!comment.canDelete || comment.isDeleted || deletingCommentId) {
            return;
        }

        try {
            setDeletingCommentId(comment.id);
            setError(null);

            const deletedComment = await deletePostComment(postId, comment.id, {
                token,
                eventId,
            });

            setComments((current) =>
                current.filter((item) => item.id !== deletedComment.id),
            );

            if (replyTo?.id === comment.id) {
                setReplyTo(null);
            }
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el comentario");
        } finally {
            setDeletingCommentId(null);
        }
    };

    return (
        <div id={id} className="mt-3">
            {loading ? (
                <p className="text-sm font-body" style={{ color: "var(--text-muted)" }}>
                    Cargando comentarios...
                </p>
            ) : comments.length > 0 ? (
                <ul className="space-y-4" aria-label="Comentarios">
                    {comments.map((comment) => {
                        const isReply = Boolean(comment.parentCommentId);
                        const parent = comment.parentCommentId
                            ? byId.get(comment.parentCommentId)
                            : undefined;
                        const menuOpen = openMenuId === comment.id;
                        const showMenu = comment.canDelete && !comment.isDeleted;

                        return (
                            <li
                                key={comment.id}
                                className={isReply ? "ml-4 border-l-2 pl-3 md:ml-8" : undefined}
                                style={isReply ? { borderLeftColor: "var(--border-color)" } : undefined}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <PersonLabel
                                            size="sm"
                                            person={{
                                                name: comment.user.name,
                                                alias: comment.user.alias,
                                                committeeName: comment.user.committeeName,
                                                avatar: comment.user.avatar,
                                            }}
                                            showSecondary={showAuthorCommittee}
                                        />
                                    </div>

                                    <time
                                        dateTime={comment.createdAt}
                                        className="shrink-0 pt-1 text-xs font-body"
                                        style={{ color: "var(--text-muted)" }}
                                    >
                                        {formatDateTime(comment.createdAt)}
                                    </time>

                                    {showMenu && (
                                        <div
                                            data-comment-menu
                                            className="relative shrink-0 -mr-2 -mt-2"
                                            onKeyDown={(event) => {
                                                if (event.key === "Escape") {
                                                    setOpenMenuId(null);
                                                }
                                            }}
                                            onBlur={(event) => {
                                                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                                                    setOpenMenuId(null);
                                                }
                                            }}
                                        >
                                            <button
                                                ref={(element) => {
                                                    if (element) {
                                                        menuButtonRefs.current.set(comment.id, element);
                                                    } else {
                                                        menuButtonRefs.current.delete(comment.id);
                                                    }
                                                }}
                                                type="button"
                                                aria-label="Más acciones del comentario"
                                                aria-haspopup="menu"
                                                aria-expanded={menuOpen}
                                                onClick={() => setOpenMenuId(menuOpen ? null : comment.id)}
                                                className="inline-flex size-11 items-center justify-center rounded-[var(--radius-sm)] enabled:hover:bg-[var(--bg-surface-secondary)]"
                                                style={{ color: "var(--text-secondary)" }}
                                            >
                                                <svg
                                                    width="20"
                                                    height="20"
                                                    viewBox="0 0 24 24"
                                                    fill="currentColor"
                                                    aria-hidden="true"
                                                    focusable="false"
                                                >
                                                    <circle cx="5" cy="12" r="1.75" />
                                                    <circle cx="12" cy="12" r="1.75" />
                                                    <circle cx="19" cy="12" r="1.75" />
                                                </svg>
                                            </button>

                                            {menuOpen && (
                                                <div
                                                    role="menu"
                                                    className="absolute right-0 top-11 z-10 min-w-40 rounded-[var(--radius-sm)] p-1"
                                                    style={{
                                                        backgroundColor: "var(--bg-surface)",
                                                        border: "1px solid var(--border-color)",
                                                    }}
                                                >
                                                    <Button
                                                        role="menuitem"
                                                        variant="danger-text"
                                                        size="sm"
                                                        className="w-full justify-start"
                                                        onClick={() => {
                                                            // El ítem se desmonta al cerrar el menú: el foco pasa al "⋯" antes.
                                                            menuButtonRefs.current.get(comment.id)?.focus();
                                                            setOpenMenuId(null);
                                                            requestDeleteComment(comment);
                                                        }}
                                                    >
                                                        Eliminar
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {isReply && (
                                    <p className="mt-1.5 pl-11 text-xs font-body" style={{ color: "var(--text-muted)" }}>
                                        En respuesta a {parent ? parent.user.name : "un comentario"}
                                    </p>
                                )}

                                <p
                                    className="mt-1.5 pl-11 text-sm font-body whitespace-pre-wrap"
                                    style={{
                                        color: comment.isDeleted ? "var(--text-muted)" : "var(--text-primary)",
                                        fontStyle: comment.isDeleted ? "italic" : "normal",
                                        overflowWrap: "anywhere",
                                    }}
                                >
                                    {comment.content}
                                </p>

                                {!comment.isDeleted && !disabled && (
                                    <div className="pl-8">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setReplyTo(comment);
                                                textareaRef.current?.focus();
                                            }}
                                        >
                                            Responder
                                        </Button>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            ) : error ? null : (
                <p className="text-sm font-body" style={{ color: "var(--text-muted)" }}>
                    Sé la primera persona en comentar.
                </p>
            )}

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    void submitComment();
                }}
                className="mt-4"
            >
                {replyTo && (
                    <div
                        className="mb-2 flex items-center justify-between gap-2 rounded-lg px-3 py-1"
                        style={{
                            backgroundColor: "var(--sidebar-active-bg)",
                            border: "1px solid var(--border-color)",
                        }}
                    >
                        <p className="min-w-0 truncate text-xs font-body" style={{ color: "var(--text-secondary)" }}>
                            Respondiendo a <strong>{replyTo.user.name}</strong>
                        </p>
                        <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
                            Cancelar
                        </Button>
                    </div>
                )}

                <div className="flex items-end gap-2">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={inputValue}
                        onChange={(event) => setInputValue(event.target.value)}
                        onKeyDown={handleComposerKeyDown}
                        disabled={disabled}
                        readOnly={isSubmitting}
                        aria-label="Escribe un comentario"
                        placeholder="Escribe un comentario..."
                        className="max-h-40 min-h-11 flex-1 resize-none overflow-y-auto whitespace-pre-wrap rounded-lg px-3 py-2.5 text-sm font-body"
                        style={{
                            backgroundColor: "var(--bg-input)",
                            border: "1px solid var(--input-border)",
                            color: "var(--text-primary)",
                            opacity: disabled ? 0.6 : 1,
                        }}
                    />
                    <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={disabled || !inputValue.trim()}
                        loading={isSubmitting}
                    >
                        {isSubmitting ? "Enviando..." : "Comentar"}
                    </Button>
                </div>

                {error && (
                    <p role="alert" className="mt-2 text-xs font-body" style={{ color: "var(--danger)" }}>
                        {error}
                    </p>
                )}
            </form>

            <ConfirmDialog
                open={pendingDeleteComment !== null}
                title="¿Eliminar este comentario?"
                description="El contenido dejará de leerse. Esta acción no se puede deshacer."
                confirmLabel="Eliminar"
                tone="danger"
                onCancel={() => setPendingDeleteComment(null)}
                onConfirm={() => {
                    const comment = pendingDeleteComment;
                    setPendingDeleteComment(null);
                    if (comment) {
                        void handleDeleteComment(comment);
                    }
                }}
            />
        </div>
    );
};
