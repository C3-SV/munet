"use client";

import { useState } from "react";
import {
    deleteModerationComment,
    deleteModerationPost,
    listModerationComments,
    MAX_PINNED_POSTS,
    pinPost,
    removeModerationAttachment,
    unpinPost,
    type ModerationComment,
    type ModerationDetail,
    type ModerationPost,
} from "../../lib/api/moderation";
import { formatFileSize, isImageAttachment } from "../../lib/attachments";
import { formatDateTime } from "../../lib/format-datetime";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { IconFile } from "../ui/icons";
import { PersonLabel } from "../ui/PersonLabel";
import { AdminReasonDialog } from "./AdminReasonDialog";

type ModerationPostCardProps = {
    post: ModerationPost;
    token: string;
    // Fijados actuales del muro, para deshabilitar "Fijar" al llegar al máximo.
    wallPinnedPosts: number;
    // Convierte el error en texto y activa la espera si fue un 429.
    describeError: (error: unknown) => string;
    actionsBlocked: boolean;
    // Tras una acción exitosa: recarga la lista y los contadores del muro.
    onChanged: (message: string) => void;
};

type DeleteTarget =
    | { kind: "post" }
    | { kind: "attachment" }
    | { kind: "comment"; comment: ModerationComment };

const DIALOG_COPY: Record<DeleteTarget["kind"], { title: string; description: string; confirmLabel: string }> = {
    post: {
        title: "¿Eliminar esta publicación?",
        description:
            "El contenido dejará de verse para los participantes. Quedará registrado quién lo eliminó y por qué.",
        confirmLabel: "Eliminar",
    },
    comment: {
        title: "¿Eliminar este comentario?",
        description:
            "El contenido dejará de verse para los participantes. Quedará registrado quién lo eliminó y por qué.",
        confirmLabel: "Eliminar",
    },
    attachment: {
        title: "¿Retirar este adjunto?",
        description:
            "El archivo dejará de estar disponible y no se puede recuperar. La publicación y su texto se conservan. Quedará registrado quién lo retiró y por qué.",
        confirmLabel: "Retirar adjunto",
    },
};

const TYPE_LABELS: Record<ModerationPost["post_type"], string | null> = {
    TEXT: null,
    LINK: "Enlace",
    POLL: "Encuesta",
};

const Badge = ({ children, tone = "accent" }: { children: string; tone?: "accent" | "danger" | "muted" }) => {
    const color =
        tone === "danger" ? "var(--danger)" : tone === "muted" ? "var(--text-secondary)" : "var(--text-accent)";

    return (
        <span
            className="px-2.5 py-1 text-xs font-semibold rounded-full font-heading"
            style={{
                color,
                backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
            }}
        >
            {children}
        </span>
    );
};

const AuthorLine = ({ detail }: { detail: ModerationDetail }) => {
    const { author } = detail;
    const codes = [
        author.participant_code ? `Código ${author.participant_code}` : null,
        author.delegation_code ? `# ${author.delegation_code}` : null,
    ].filter(Boolean);

    return (
        <PersonLabel
            person={{
                name: author.name,
                alias: author.alias,
                committeeName: author.committee
                    ? [author.committee.code, author.committee.name].filter(Boolean).join(" — ")
                    : null,
            }}
            size="sm"
        >
            <div
                className="flex flex-wrap items-center gap-x-2 text-xs font-body mt-0.5"
                style={{ color: "var(--text-muted)" }}
            >
                <time dateTime={detail.created_at} title={formatDateTime(detail.created_at)}>
                    {formatDateTime(detail.created_at)}
                </time>
                {codes.length > 0 && <span>· {codes.join(" · ")}</span>}
            </div>
        </PersonLabel>
    );
};

const deletedBy = (
    detail: ModerationDetail,
    actor: "AUTHOR" | "ADMIN" | null,
) =>
    detail.deleted_by_name ??
    (actor === "AUTHOR" ? "su autor" : actor === "ADMIN" ? "la organización" : "—");

const DeletionInfo = ({
    detail,
    actor,
    deletedAt,
}: {
    detail: ModerationDetail;
    actor: "AUTHOR" | "ADMIN" | null;
    deletedAt: string | null;
}) => (
    <p className="mt-2 text-xs font-body" style={{ color: "var(--text-muted)" }}>
        Eliminado por {deletedBy(detail, actor)} · {formatDateTime(deletedAt)} ·{" "}
        {detail.deletion_reason?.trim()
            ? `Motivo: ${detail.deletion_reason}`
            : "Sin motivo registrado"}
    </p>
);

export const ModerationPostCard = ({
    post,
    token,
    wallPinnedPosts,
    describeError,
    actionsBlocked,
    onChanged,
}: ModerationPostCardProps) => {
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [dialogError, setDialogError] = useState<string | null>(null);

    const [commentsOpen, setCommentsOpen] = useState(false);
    const [comments, setComments] = useState<ModerationComment[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsError, setCommentsError] = useState<string | null>(null);

    const isDeleted = post.status === "DELETED";
    const isVisible = post.status === "VISIBLE";
    const pinLimitReached = !post.is_pinned && wallPinnedPosts >= MAX_PINNED_POSTS;
    const typeLabel = TYPE_LABELS[post.post_type];

    const loadComments = async () => {
        setCommentsLoading(true);
        setCommentsError(null);

        try {
            setComments(await listModerationComments(token, post.id, { status: "ALL" }));
        } catch (error) {
            setCommentsError(describeError(error));
        } finally {
            setCommentsLoading(false);
        }
    };

    const toggleComments = () => {
        const next = !commentsOpen;
        setCommentsOpen(next);

        if (next) {
            void loadComments();
        }
    };

    const handlePin = async () => {
        setBusy(true);
        setActionError(null);

        try {
            if (post.is_pinned) {
                await unpinPost(token, post.id);
                onChanged("Publicación desfijada.");
            } else {
                await pinPost(token, post.id);
                onChanged("Publicación fijada.");
            }
        } catch (error) {
            setActionError(describeError(error));
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (reason: string) => {
        if (!deleteTarget) {
            return;
        }

        setBusy(true);
        setDialogError(null);

        try {
            if (deleteTarget.kind === "post") {
                await deleteModerationPost(token, post.id, reason);
                setDeleteTarget(null);
                onChanged("Publicación eliminada.");
            } else if (deleteTarget.kind === "attachment") {
                await removeModerationAttachment(token, post.id, reason);
                setDeleteTarget(null);
                onChanged("Adjunto retirado.");
            } else {
                await deleteModerationComment(token, deleteTarget.comment.id, reason);
                setDeleteTarget(null);
                await loadComments();
                onChanged("Comentario eliminado.");
            }
        } catch (error) {
            setDialogError(describeError(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card variant="flat" className="py-5 md:py-6">
            <div className="flex items-start justify-between gap-4 mb-4">
                <AuthorLine detail={post} />
                <div className="flex flex-wrap justify-end gap-2">
                    {post.is_pinned && <Badge>Fijado</Badge>}
                    {typeLabel && <Badge tone="muted">{typeLabel}</Badge>}
                    {isDeleted && <Badge tone="danger">Eliminado</Badge>}
                    {!isDeleted && !isVisible && <Badge tone="muted">Oculto</Badge>}
                </div>
            </div>

            {post.title && (
                <h3
                    className="mb-1 font-heading text-base font-bold"
                    style={{ color: "var(--text-primary)", overflowWrap: "anywhere" }}
                >
                    {post.title}
                </h3>
            )}

            <p
                className="font-body leading-relaxed text-[15px]"
                style={{
                    color: isDeleted ? "var(--text-muted)" : "var(--text-primary)",
                    opacity: isDeleted ? 0.7 : 1,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                }}
            >
                {post.content}
            </p>

            {post.attachment && (
                <div
                    className="mt-3 flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5"
                    style={{ border: "1px solid var(--border-color)" }}
                >
                    <span style={{ color: "var(--text-accent)" }}>
                        <IconFile size={22} />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span
                            className="block truncate text-sm font-semibold font-heading"
                            style={{ color: "var(--text-primary)" }}
                            title={post.attachment.name}
                        >
                            {post.attachment.name}
                        </span>
                        <span className="block text-xs font-body" style={{ color: "var(--text-muted)" }}>
                            {isImageAttachment(post.attachment.mimeType) ? "Imagen" : "PDF"} ·{" "}
                            {formatFileSize(post.attachment.size)}
                        </span>
                    </span>
                    <Button
                        variant="danger-text"
                        size="sm"
                        onClick={() => {
                            setDialogError(null);
                            setDeleteTarget({ kind: "attachment" });
                        }}
                        disabled={busy || actionsBlocked}
                        aria-label={`Retirar adjunto ${post.attachment.name}`}
                    >
                        Retirar adjunto
                    </Button>
                </div>
            )}

            {isDeleted && (
                <DeletionInfo
                    detail={post}
                    actor={post.deleted_by_membership_id}
                    deletedAt={post.deleted_at}
                />
            )}

            {actionError && (
                <p role="alert" className="mt-3 text-xs font-body" style={{ color: "var(--danger)" }}>
                    {actionError}
                </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={toggleComments} aria-expanded={commentsOpen}>
                    {commentsOpen ? "Ocultar comentarios" : "Ver comentarios"}
                </Button>
                {isVisible && (
                    <>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handlePin()}
                            loading={busy && !deleteTarget}
                            disabled={busy || actionsBlocked || pinLimitReached}
                            title={
                                pinLimitReached
                                    ? `El muro ya tiene ${MAX_PINNED_POSTS} publicaciones fijadas. Desfija una primero.`
                                    : undefined
                            }
                        >
                            {post.is_pinned ? "Desfijar" : "Fijar"}
                        </Button>
                        <Button
                            variant="danger-text"
                            size="sm"
                            onClick={() => {
                                setDialogError(null);
                                setDeleteTarget({ kind: "post" });
                            }}
                            disabled={busy || actionsBlocked}
                        >
                            Eliminar
                        </Button>
                    </>
                )}
            </div>

            {commentsOpen && (
                <div
                    className="mt-4 space-y-3 border-t pt-4"
                    style={{ borderColor: "var(--border-color)" }}
                >
                    {commentsLoading && (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            Cargando comentarios...
                        </p>
                    )}
                    {commentsError && (
                        <p role="alert" className="text-xs" style={{ color: "var(--danger)" }}>
                            {commentsError}
                        </p>
                    )}
                    {!commentsLoading && !commentsError && comments.length === 0 && (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            Sin comentarios.
                        </p>
                    )}
                    {comments.map((comment) => {
                        const commentDeleted = comment.status === "DELETED";

                        return (
                            <div
                                key={comment.id}
                                className={comment.parent_comment_id ? "ml-6" : undefined}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <AuthorLine detail={comment} />
                                    {comment.status === "VISIBLE" && (
                                        <Button
                                            variant="danger-text"
                                            size="sm"
                                            onClick={() => {
                                                setDialogError(null);
                                                setDeleteTarget({ kind: "comment", comment });
                                            }}
                                            disabled={busy || actionsBlocked}
                                        >
                                            Eliminar
                                        </Button>
                                    )}
                                    {!commentDeleted && comment.status !== "VISIBLE" && (
                                        <Badge tone="muted">Oculto</Badge>
                                    )}
                                </div>
                                <p
                                    className="mt-1 text-sm font-body"
                                    style={{
                                        color: commentDeleted ? "var(--text-muted)" : "var(--text-primary)",
                                        opacity: commentDeleted ? 0.7 : 1,
                                        whiteSpace: "pre-wrap",
                                        overflowWrap: "anywhere",
                                    }}
                                >
                                    {comment.content}
                                </p>
                                {commentDeleted && (
                                    <DeletionInfo
                                        detail={comment}
                                        actor={comment.deleted_by_actor_type}
                                        deletedAt={comment.deleted_at}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {deleteTarget && (
                <AdminReasonDialog
                    title={DIALOG_COPY[deleteTarget.kind].title}
                    description={DIALOG_COPY[deleteTarget.kind].description}
                    confirmLabel={DIALOG_COPY[deleteTarget.kind].confirmLabel}
                    tone="danger"
                    loading={busy}
                    error={dialogError}
                    confirmDisabled={actionsBlocked}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </Card>
    );
};
