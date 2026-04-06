"use client";

import { useEffect, useMemo, useState } from "react";
import { createPostComment, deletePostComment, getPostComments } from "../../lib/api/comments";
import { realtimeEnabled, supabaseBrowser } from "../../lib/supabase";
import type { PostComment } from "../../types/common";

type PostCommentsProps = {
    postId: string;
    token: string;
    eventId: string;
    disabled?: boolean;
};

const formatRelativeTime = (timestamp: number) => {
    const diffInMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));

    if (diffInMinutes < 1) {
        return "justo ahora";
    }

    if (diffInMinutes < 60) {
        return `hace ${diffInMinutes} min`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);

    if (diffInHours < 24) {
        return `hace ${diffInHours} h`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    return `hace ${diffInDays} d`;
};

export const PostComments = ({
    postId,
    token,
    eventId,
    disabled = false,
}: PostCommentsProps) => {
    const [comments, setComments] = useState<PostComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [inputValue, setInputValue] = useState("");
    const [replyTo, setReplyTo] = useState<PostComment | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

    const loadComments = async (options?: { showLoader?: boolean }) => {
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
    };

    useEffect(() => {
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
    }, [eventId, postId, token]);

    useEffect(() => {
        if (!realtimeEnabled || !supabaseBrowser) {
            return;
        }

        const realtimeClient = supabaseBrowser;
        let cancelled = false;
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
            .subscribe();

        return () => {
            cancelled = true;
            void realtimeClient.removeChannel(channel);
        };
    }, [eventId, postId, token]);

    const byId = useMemo(
        () =>
            new Map<string, PostComment>(
                comments.map((comment) => [comment.id, comment]),
            ),
        [comments],
    );

    const submitComment = async () => {
        if (!inputValue.trim()) {
            return;
        }

        try {
            const newComment = await createPostComment(postId, {
                token,
                eventId,
                content: inputValue,
                parentCommentId: replyTo?.id,
            });

            setComments((current) => [...current, newComment]);
            setInputValue("");
            setReplyTo(null);
            setError(null);
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "No se pudo comentar");
        }
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
                current.map((item) =>
                    item.id === comment.id
                        ? deletedComment
                        : item,
                ),
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
        <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
            <p
                className="text-[11px] font-extrabold uppercase tracking-widest font-heading mb-3"
                style={{ color: "var(--text-secondary)" }}
            >
                Comentarios
            </p>
            {realtimeEnabled && (
                <p className="mb-3 text-[10px] font-heading font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Realtime activo
                </p>
            )}

            {loading ? (
                <p className="text-sm font-body" style={{ color: "var(--text-muted)" }}>
                    Cargando comentarios...
                </p>
            ) : comments.length > 0 ? (
                <div className="space-y-3">
                    {comments.map((comment) => {
                        const authorLabel = `${comment.user.name} | ${comment.user.committeeName ?? "COMITE SIN ASIGNAR"}`.toUpperCase();

                        return (
                            <div
                                key={comment.id}
                                className="rounded-xl p-3"
                                style={{
                                    backgroundColor: "var(--bg-surface-secondary)",
                                    border: "1px solid var(--border-color)",
                                }}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <img
                                            src={comment.user.avatar}
                                            alt={comment.user.name}
                                            className="size-7 rounded-full object-cover"
                                            style={{ border: "1px solid var(--border-color)" }}
                                        />
                                        <div className="min-w-0">
                                            <p
                                                className="text-sm font-semibold font-heading truncate"
                                                style={{ color: "var(--text-primary)" }}
                                            >
                                                {authorLabel}
                                            </p>
                                            <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
                                                {formatRelativeTime(comment.timestamp)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {!comment.isDeleted && !disabled && (
                                            <button
                                                type="button"
                                                onClick={() => setReplyTo(comment)}
                                                className="text-xs font-semibold font-heading"
                                                style={{ color: "var(--text-accent)" }}
                                            >
                                                Responder
                                            </button>
                                        )}
                                        {comment.canDelete && (
                                            <button
                                                type="button"
                                                onClick={() => void handleDeleteComment(comment)}
                                                disabled={comment.isDeleted || deletingCommentId === comment.id}
                                                className="text-xs font-semibold font-heading"
                                                style={{
                                                    color: comment.isDeleted ? "var(--text-muted)" : "#b91c1c",
                                                    cursor:
                                                        comment.isDeleted || deletingCommentId === comment.id
                                                            ? "not-allowed"
                                                            : "pointer",
                                                    opacity:
                                                        comment.isDeleted || deletingCommentId === comment.id
                                                            ? 0.6
                                                            : 1,
                                                }}
                                            >
                                                {comment.isDeleted
                                                    ? "Eliminado"
                                                    : deletingCommentId === comment.id
                                                      ? "Eliminando..."
                                                      : "Eliminar"}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {comment.parentCommentId && (
                                    <p className="mt-2 text-xs font-body" style={{ color: "var(--text-muted)" }}>
                                        Respuesta a {byId.get(comment.parentCommentId)?.user.name ?? "comentario"}
                                    </p>
                                )}

                                <p
                                    className="mt-2 text-sm font-body"
                                    style={{
                                        color: comment.isDeleted ? "var(--text-muted)" : "var(--text-primary)",
                                        fontStyle: comment.isDeleted ? "italic" : "normal",
                                    }}
                                >
                                    {comment.content}
                                </p>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="text-sm font-body" style={{ color: "var(--text-muted)" }}>
                    Aun no hay comentarios.
                </p>
            )}

            <div className="mt-4">
                {replyTo && (
                    <div
                        className="mb-2 flex items-center justify-between rounded-lg px-3 py-2"
                        style={{
                            backgroundColor: "var(--sidebar-active-bg)",
                            border: "1px solid var(--border-color)",
                        }}
                    >
                        <p className="text-xs font-body" style={{ color: "var(--text-secondary)" }}>
                            Respondiendo a <strong>{replyTo.user.name}</strong>
                        </p>
                        <button
                            type="button"
                            onClick={() => setReplyTo(null)}
                            className="text-xs font-semibold font-heading"
                            style={{ color: "var(--text-accent)" }}
                        >
                            Cancelar
                        </button>
                    </div>
                )}

                <div className="flex gap-2">
                    <input
                        value={inputValue}
                        onChange={(event) => setInputValue(event.target.value)}
                        disabled={disabled}
                        placeholder="Escribe un comentario..."
                        className="flex-1 rounded-lg px-3 py-2 text-sm font-body outline-none"
                        style={{
                            backgroundColor: "var(--bg-input)",
                            border: "1px solid var(--input-border)",
                            color: "var(--text-primary)",
                            opacity: disabled ? 0.6 : 1,
                        }}
                    />
                    <button
                        type="button"
                        onClick={submitComment}
                        disabled={disabled || !inputValue.trim()}
                        className="rounded-lg px-4 py-2 text-sm font-heading font-semibold"
                        style={{
                            backgroundColor:
                                disabled || !inputValue.trim()
                                    ? "var(--bg-surface-secondary)"
                                    : "var(--bubble-me-bg)",
                            color:
                                disabled || !inputValue.trim()
                                    ? "var(--text-muted)"
                                    : "white",
                            border:
                                disabled || !inputValue.trim()
                                    ? "1px solid var(--border-color)"
                                    : "1px solid transparent",
                            cursor:
                                disabled || !inputValue.trim() ? "not-allowed" : "pointer",
                        }}
                    >
                        Comentar
                    </button>
                </div>
                {error && (
                    <p className="mt-2 text-xs font-body" style={{ color: "#b91c1c" }}>
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
};
