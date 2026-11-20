"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPostComment, deletePostComment, getPostComments } from "../../lib/api/comments";
import { realtimeEnabled, supabaseBrowser } from "../../lib/supabase";
import { formatDateTime } from "../../lib/format-datetime";
import { Button } from "../ui/Button";
import { PersonLabel } from "../ui/PersonLabel";
import type { PostComment } from "../../types/common";

type PostCommentsProps = {
    postId: string;
    token: string;
    eventId: string;
    disabled?: boolean;
    showAuthorCommittee?: boolean;
};

export const PostComments = ({
    postId,
    token,
    eventId,
    disabled = false,
    showAuthorCommittee = true,
}: PostCommentsProps) => {
    const COMMENT_SUBMIT_COOLDOWN_MS = 1200;
    const [comments, setComments] = useState<PostComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [inputValue, setInputValue] = useState("");
    const [replyTo, setReplyTo] = useState<PostComment | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastSubmitAt, setLastSubmitAt] = useState<number>(0);

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
        // Bootstrap inicial de comentarios por post.
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
        // Realtime de comentarios por `post_id`.
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

    const handleDeleteComment = async (comment: PostComment) => {
        // Soft delete de comentario con mensaje de confirmacion.
        if (!comment.canDelete || comment.isDeleted || deletingCommentId) {
            return;
        }

        const confirmed = window.confirm(
            "Este comentario se marcara como eliminado y ya no podra leerse su contenido. Deseas continuar?",
        );

        if (!confirmed) {
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
        <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
            <p
                className="text-[11px] font-extrabold uppercase tracking-widest font-heading mb-3"
                style={{ color: "var(--text-secondary)" }}
            >
                Comentarios
            </p>

            {loading ? (
                <p className="text-sm font-body" style={{ color: "var(--text-muted)" }}>
                    Cargando comentarios...
                </p>
            ) : comments.length > 0 ? (
                <div className="space-y-3">
                    {comments.map((comment) => {
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
                                        >
                                            <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
                                                <time
                                                    dateTime={comment.createdAt}
                                                    title={formatDateTime(comment.createdAt)}
                                                >
                                                    {formatDateTime(comment.createdAt)}
                                                </time>
                                            </p>
                                        </PersonLabel>
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
                                                    color: comment.isDeleted ? "var(--text-muted)" : "var(--danger)",
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
                        disabled={disabled || isSubmitting}
                        placeholder="Escribe un comentario..."
                        className="flex-1 rounded-lg px-3 py-2 text-sm font-body outline-none"
                        style={{
                            backgroundColor: "var(--bg-input)",
                            border: "1px solid var(--input-border)",
                            color: "var(--text-primary)",
                            opacity: disabled || isSubmitting ? 0.6 : 1,
                        }}
                    />
                    <Button
                        variant="secondary"
                        onClick={submitComment}
                        disabled={disabled || !inputValue.trim()}
                        loading={isSubmitting}
                        size="sm"
                    >
                        {isSubmitting ? "Enviando..." : "Comentar"}
                    </Button>
                </div>
                {error && (
                    <p className="mt-2 text-xs font-body" style={{ color: "var(--danger)" }}>
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
};
