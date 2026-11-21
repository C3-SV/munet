import React, { useState } from "react";
import {
    closeFeedPoll,
    deleteFeedPost,
    getAttachmentDownloadUrl,
    removeOwnAttachment,
    voteOnFeedPoll,
} from "../../lib/api/feed";
import { formatFileSize, isImageAttachment } from "../../lib/attachments";
import { formatDateTime } from "../../lib/format-datetime";
import { AttachmentImagePreview } from "./AttachmentImagePreview";
import { PostComments } from "./PostComments";
import { UserHoverCard } from "../profile/UserHoverCard";
import { Button } from "../ui/Button";
import { Card, type CardVariant } from "../ui/Card";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { IconFile } from "../ui/icons";
import { PersonLabel } from "../ui/PersonLabel";
import type { Post } from "../../types/common";

interface PostCardProps {
    post: Post;
    token: string;
    eventId: string;
    canComment?: boolean;
    // En el muro de un comité el comité no se repite en cada publicación.
    showAuthorCommittee?: boolean;
    // "official" en el muro de avisos; "flat" en el resto del foro.
    variant?: CardVariant;
    onPostUpdated?: (post: Post) => void;
    onPostDeleted?: (postId: string) => void;
}

const deletedLabel = (deletedByActorType: Post["deletedByActorType"]) => {
    if (deletedByActorType === "ADMIN") {
        return "Eliminada por la organización";
    }

    if (deletedByActorType === "AUTHOR") {
        return "Eliminada por su autor";
    }

    return "Esta publicación fue eliminada";
};

export const PostCard = ({
    post,
    token,
    eventId,
    canComment = true,
    showAuthorCommittee = true,
    variant = "flat",
    onPostUpdated,
    onPostDeleted,
}: PostCardProps) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isClosingPoll, setIsClosingPoll] = useState(false);
    const [votingOptionId, setVotingOptionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<
        "delete-post" | "close-poll" | "remove-attachment" | null
    >(null);
    const [isOpeningAttachment, setIsOpeningAttachment] = useState(false);
    const [isRemovingAttachment, setIsRemovingAttachment] = useState(false);

    const isOfficial = variant === "official";
    const isFlat = variant === "flat";
    // Un comité ya visible en la línea del autor no se repite como etiqueta.
    const committeeTags = (post.committeeTags ?? []).filter(
        (tag) => tag !== post.user.committeeName,
    );

    const requestDeletePost = () => {
        // Soft delete: pide confirmacion antes de llamar a la API; backend decide permiso final.
        if (!post.canDelete || post.isDeleted || isDeleting) {
            return;
        }

        setConfirmAction("delete-post");
    };

    const handleDeletePost = async () => {
        if (!post.canDelete || post.isDeleted || isDeleting) {
            return;
        }

        try {
            setIsDeleting(true);
            setError(null);
            await deleteFeedPost(post.id, { token, eventId });
            onPostDeleted?.(post.id);
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la publicación");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleVoteOption = async (optionId: string) => {
        // Voto de encuesta (crea o reemplaza voto activo del usuario).
        if (!post.poll || !post.poll.canVote || post.isDeleted || votingOptionId) {
            return;
        }

        try {
            setError(null);
            setVotingOptionId(optionId);
            const updatedPost = await voteOnFeedPoll(post.id, optionId, { token, eventId });
            onPostUpdated?.(updatedPost);
        } catch (voteError) {
            setError(voteError instanceof Error ? voteError.message : "No se pudo registrar el voto");
        } finally {
            setVotingOptionId(null);
        }
    };

    const requestClosePoll = () => {
        // Cierre manual de encuesta; solo disponible para el autor.
        if (!post.poll || !post.poll.canClose || post.isDeleted || isClosingPoll) {
            return;
        }

        setConfirmAction("close-poll");
    };

    const handleClosePoll = async () => {
        if (!post.poll || !post.poll.canClose || post.isDeleted || isClosingPoll) {
            return;
        }

        try {
            setError(null);
            setIsClosingPoll(true);
            const updatedPost = await closeFeedPoll(post.id, { token, eventId });
            onPostUpdated?.(updatedPost);
        } catch (closeError) {
            setError(closeError instanceof Error ? closeError.message : "No se pudo cerrar la encuesta");
        } finally {
            setIsClosingPoll(false);
        }
    };

    const handleOpenAttachment = async () => {
        // La URL firmada dura 60 segundos: se pide al hacer clic, no al cargar el muro.
        if (!post.attachment || isOpeningAttachment) {
            return;
        }

        // La pestaña se abre de inmediato (dentro del clic) para que el navegador no la bloquee.
        const tab = window.open("about:blank", "_blank");

        if (tab) {
            tab.opener = null;
        }

        try {
            setError(null);
            setIsOpeningAttachment(true);
            const url = await getAttachmentDownloadUrl(post.id, { token, eventId });

            if (tab) {
                tab.location.href = url;
            } else {
                window.location.assign(url);
            }
        } catch (attachmentError) {
            tab?.close();
            setError(
                attachmentError instanceof Error ? attachmentError.message : "No se pudo abrir el adjunto",
            );
        } finally {
            setIsOpeningAttachment(false);
        }
    };

    const handleRemoveAttachment = async () => {
        if (!post.attachment?.canRemove || isRemovingAttachment) {
            return;
        }

        try {
            setError(null);
            setIsRemovingAttachment(true);
            await removeOwnAttachment(post.id, { token, eventId });
            onPostUpdated?.({ ...post, attachment: null });
        } catch (removeError) {
            setError(
                removeError instanceof Error ? removeError.message : "No se pudo retirar el adjunto",
            );
        } finally {
            setIsRemovingAttachment(false);
        }
    };

    const canVoteNow = Boolean(post.poll?.canVote) && !votingOptionId;

    return (
        <Card
            variant={variant}
            className={isFlat ? "py-5 md:py-6" : "mb-4 p-5 md:p-6"}
        >
            {isOfficial && (
                <p
                    className="mb-3 text-xs font-semibold font-heading"
                    style={{ color: "var(--signal)" }}
                >
                    Aviso
                </p>
            )}

            <div className="flex items-start justify-between mb-4 gap-4">
                <UserHoverCard
                    membershipId={post.user.id}
                    name={post.user.name}
                    alias={post.user.alias}
                    committeeName={post.user.committeeName}
                    role={post.user.role}
                >
                    <div className="cursor-pointer min-w-0 max-w-full">
                        <PersonLabel
                            person={{
                                name: post.user.name,
                                alias: post.user.alias,
                                committeeName: post.user.committeeName,
                                avatar: post.user.avatar,
                            }}
                            showSecondary={showAuthorCommittee}
                        >
                            <div
                                className="flex items-center gap-1.5 text-xs font-body mt-0.5"
                                style={{ color: "var(--text-muted)" }}
                            >
                                <time
                                    dateTime={post.createdAt}
                                    title={formatDateTime(post.createdAt)}
                                >
                                    {formatDateTime(post.createdAt)}
                                </time>
                            </div>
                        </PersonLabel>
                    </div>
                </UserHoverCard>

                <div className="flex flex-col items-end gap-2">
                    {committeeTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-end">
                            {committeeTags.map((tag) => (
                                <span
                                    key={tag}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-full font-heading"
                                    style={{
                                        backgroundColor:
                                            "color-mix(in srgb, var(--text-accent) 10%, transparent)",
                                        color: "var(--text-accent)",
                                        border:
                                            "1px solid color-mix(in srgb, var(--text-accent) 20%, transparent)",
                                    }}
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {post.canDelete && !post.isDeleted && (
                        <Button
                            variant="danger-text"
                            size="sm"
                            onClick={requestDeletePost}
                            disabled={isDeleting}
                            loading={isDeleting}
                        >
                            {isDeleting ? "Eliminando..." : "Eliminar"}
                        </Button>
                    )}
                </div>
            </div>

            {post.isDeleted ? (
                <p
                    className="font-body text-[15px] italic"
                    style={{ color: "var(--text-muted)" }}
                >
                    {deletedLabel(post.deletedByActorType)}
                </p>
            ) : (
                <p
                    className="font-body leading-relaxed text-[15px]"
                    style={{
                        color: "var(--text-primary)",
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                    }}
                >
                    {post.content}
                </p>
            )}

            {post.attachment && !post.isDeleted && (
                <div className="mt-4 space-y-2">
                    {isImageAttachment(post.attachment.mimeType) && (
                        <AttachmentImagePreview
                            postId={post.id}
                            token={token}
                            eventId={eventId}
                            name={post.attachment.name}
                            onOpen={() => void handleOpenAttachment()}
                            disabled={isOpeningAttachment}
                        />
                    )}
                    <div className="flex items-stretch gap-2">
                    <button
                        type="button"
                        onClick={() => void handleOpenAttachment()}
                        disabled={isOpeningAttachment}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-left hover:bg-[var(--bg-surface-secondary)] disabled:opacity-60"
                        style={{ border: "1px solid var(--border-color)" }}
                        aria-label={`Abrir adjunto ${post.attachment.name} en una pestaña nueva`}
                    >
                        <span style={{ color: "var(--text-accent)" }}>
                            <IconFile size={22} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span
                                className="block truncate text-sm font-semibold font-heading"
                                style={{ color: "var(--text-primary)" }}
                            >
                                {post.attachment.name}
                            </span>
                            <span className="block text-xs font-body" style={{ color: "var(--text-muted)" }}>
                                {isOpeningAttachment
                                    ? "Abriendo..."
                                    : `${isImageAttachment(post.attachment.mimeType) ? "Imagen" : "PDF"} · ${formatFileSize(post.attachment.size)}`}
                            </span>
                        </span>
                    </button>
                    {post.attachment.canRemove && (
                        <Button
                            variant="danger-text"
                            size="sm"
                            onClick={() => setConfirmAction("remove-attachment")}
                            disabled={isRemovingAttachment}
                            loading={isRemovingAttachment}
                            aria-label={`Quitar adjunto ${post.attachment.name}`}
                        >
                            Quitar
                        </Button>
                    )}
                    </div>
                </div>
            )}

            {post.postType === "POLL" && post.poll && (
                <div
                    className="mt-4 rounded-[var(--radius-sm)] p-4 space-y-3"
                    style={{
                        backgroundColor: "var(--bg-surface-secondary)",
                        border: "1px solid var(--border-color)",
                    }}
                >
                    <div className="flex items-center justify-between gap-3 min-w-0">
                        <p
                            className="min-w-0 text-sm font-semibold font-heading"
                            style={{ color: "var(--text-secondary)", overflowWrap: "anywhere" }}
                        >
                            {`Encuesta · ${post.poll.isClosed ? "cerrada" : "abierta"}`}
                        </p>
                        {post.poll.canClose && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={requestClosePoll}
                                disabled={isClosingPoll}
                                loading={isClosingPoll}
                            >
                                {isClosingPoll ? "Cerrando..." : "Cerrar encuesta"}
                            </Button>
                        )}
                    </div>

                    <div className="space-y-2">
                        {post.poll.options.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => void handleVoteOption(option.id)}
                                disabled={!post.poll?.canVote || Boolean(votingOptionId)}
                                aria-pressed={option.isSelectedByMe}
                                className="w-full text-left rounded-[var(--radius-sm)] px-3 py-2.5 min-h-11"
                                style={{
                                    border: `1px solid ${option.isSelectedByMe ? "var(--text-accent)" : "var(--border-color)"}`,
                                    backgroundColor:
                                        option.isSelectedByMe
                                            ? "color-mix(in srgb, var(--text-accent) 12%, transparent)"
                                            : "var(--bg-surface)",
                                    cursor: canVoteNow ? "pointer" : "default",
                                }}
                            >
                                <div className="flex items-center justify-between gap-3 min-w-0">
                                    <span
                                        className="min-w-0 text-sm font-body"
                                        style={{ color: "var(--text-primary)", overflowWrap: "anywhere" }}
                                    >
                                        {option.text}
                                    </span>
                                    <span className="shrink-0 text-xs font-body" style={{ color: "var(--text-secondary)" }}>
                                        {option.votes} votos ({option.percentage}%)
                                    </span>
                                </div>
                                <div
                                    className="mt-2 h-1.5 rounded-full overflow-hidden"
                                    style={{ backgroundColor: "var(--border-color)" }}
                                >
                                    <div
                                        style={{
                                            width: `${option.percentage}%`,
                                            height: "100%",
                                            backgroundColor: option.isSelectedByMe
                                                ? "var(--text-accent)"
                                                : "var(--text-muted)",
                                        }}
                                    />
                                </div>
                            </button>
                        ))}
                    </div>

                    <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
                        {post.poll.totalVotes} voto{post.poll.totalVotes === 1 ? "" : "s"} totales
                    </p>
                </div>
            )}

            {error && (
                <p className="mt-3 text-xs font-body" style={{ color: "var(--danger)" }}>
                    {error}
                </p>
            )}

            <PostComments
                postId={post.id}
                token={token}
                eventId={eventId}
                disabled={!canComment || Boolean(post.isDeleted)}
                showAuthorCommittee={showAuthorCommittee}
                initialCount={post.commentCount}
            />

            <ConfirmDialog
                open={confirmAction === "delete-post"}
                title="¿Eliminar esta publicación?"
                description="El contenido dejará de leerse. Esta acción no se puede deshacer."
                confirmLabel="Eliminar"
                tone="danger"
                onCancel={() => setConfirmAction(null)}
                onConfirm={() => {
                    setConfirmAction(null);
                    void handleDeletePost();
                }}
            />
            <ConfirmDialog
                open={confirmAction === "remove-attachment"}
                title="¿Quitar el archivo adjunto?"
                description="El archivo dejará de estar disponible para quienes leen esta publicación. El texto se conserva."
                confirmLabel="Quitar archivo"
                tone="danger"
                onCancel={() => setConfirmAction(null)}
                onConfirm={() => {
                    setConfirmAction(null);
                    void handleRemoveAttachment();
                }}
            />
            <ConfirmDialog
                open={confirmAction === "close-poll"}
                title="¿Cerrar esta encuesta?"
                description="Ya no se podrá votar ni cambiar votos."
                confirmLabel="Cerrar encuesta"
                tone="danger"
                onCancel={() => setConfirmAction(null)}
                onConfirm={() => {
                    setConfirmAction(null);
                    void handleClosePoll();
                }}
            />
        </Card>
    );
};
