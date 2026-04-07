import React, { useState } from "react";
import { closeFeedPoll, deleteFeedPost, voteOnFeedPoll } from "../../lib/api/feed";
import { PostComments } from "./PostComments";
import { UserHoverCard } from "../profile/UserHoverCard";
import { Card } from "../ui/Card";
import type { Post } from "../../types/common";

interface PostCardProps {
    post: Post;
    token: string;
    eventId: string;
    canComment?: boolean;
    onPostUpdated?: (post: Post) => void;
}

export const PostCard = ({
    post,
    token,
    eventId,
    canComment = true,
    onPostUpdated,
}: PostCardProps) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isClosingPoll, setIsClosingPoll] = useState(false);
    const [votingOptionId, setVotingOptionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const authorLabel = `${post.user.name} | ${post.user.committeeName ?? "COMITE SIN ASIGNAR"}`.toUpperCase();

    const handleDeletePost = async () => {
        if (!post.canDelete || post.isDeleted || isDeleting) {
            return;
        }

        const confirmed = window.confirm(
            "Esta publicacion se marcara como eliminada y ya no podra leerse su contenido. Deseas continuar?",
        );

        if (!confirmed) {
            return;
        }

        try {
            setIsDeleting(true);
            setError(null);
            const updatedPost = await deleteFeedPost(post.id, { token, eventId });
            onPostUpdated?.(updatedPost);
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la publicacion");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleVoteOption = async (optionId: string) => {
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

    const handleClosePoll = async () => {
        if (!post.poll || !post.poll.canClose || post.isDeleted || isClosingPoll) {
            return;
        }

        const confirmed = window.confirm(
            "Al cerrar la encuesta ya no se podra votar ni cambiar votos. Deseas continuar?",
        );

        if (!confirmed) {
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

    return (
        <Card className="mb-4 p-5 md:p-6">
            <div className="flex items-start justify-between mb-4 gap-4">
                <UserHoverCard
                    membershipId={post.user.id}
                    name={post.user.name}
                    role={post.user.role}
                >
                    <div className="flex items-center gap-4 cursor-pointer">
                        <div className="relative shrink-0">
                            <img
                                src={post.user.avatar}
                                className="size-11 rounded-full object-cover"
                                alt={post.user.name}
                                style={{ border: "2px solid var(--border-color)" }}
                            />
                        </div>
                        <div>
                            <h4
                                className="font-bold font-heading text-[14px]"
                                style={{ color: "var(--text-primary)" }}
                            >
                                {authorLabel}
                            </h4>
                            <div
                                className="flex items-center gap-1.5 text-xs font-body mt-0.5"
                                style={{ color: "var(--text-muted)" }}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span className="lowercase">{post.createdAt}</span>
                            </div>
                        </div>
                    </div>
                </UserHoverCard>

                <div className="flex flex-col items-end gap-2">
                    {post.committeeTags && post.committeeTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-end mt-1">
                            {post.committeeTags.map((tag) => (
                                <span
                                    key={tag}
                                    className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded-full font-heading"
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

                    {post.canDelete && (
                        <button
                            type="button"
                            onClick={handleDeletePost}
                            disabled={post.isDeleted || isDeleting}
                            className="text-xs font-semibold font-heading"
                            style={{
                                color: post.isDeleted ? "var(--text-muted)" : "#b91c1c",
                                cursor: post.isDeleted || isDeleting ? "not-allowed" : "pointer",
                                opacity: post.isDeleted || isDeleting ? 0.6 : 1,
                            }}
                        >
                            {post.isDeleted ? "Eliminada" : isDeleting ? "Eliminando..." : "Eliminar"}
                        </button>
                    )}
                </div>
            </div>

            <p
                className="font-body leading-relaxed text-[15px]"
                style={{
                    color: post.isDeleted ? "var(--text-muted)" : "var(--text-primary)",
                    fontStyle: post.isDeleted ? "italic" : "normal",
                }}
            >
                {post.content}
            </p>

            {post.postType === "POLL" && post.poll && (
                <div
                    className="mt-4 rounded-xl p-4 space-y-3"
                    style={{
                        backgroundColor: "var(--bg-surface-secondary)",
                        border: "1px solid var(--border-color)",
                    }}
                >
                    <div className="flex items-center justify-between gap-3">
                        <p
                            className="text-[11px] font-extrabold uppercase tracking-wider font-heading"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            {post.poll.isClosed ? "Encuesta cerrada" : "Encuesta abierta"}
                        </p>
                        {post.poll.canClose && (
                            <button
                                type="button"
                                onClick={() => void handleClosePoll()}
                                disabled={isClosingPoll}
                                className="text-xs font-semibold font-heading"
                                style={{
                                    color: isClosingPoll ? "var(--text-muted)" : "var(--text-accent)",
                                    cursor: isClosingPoll ? "wait" : "pointer",
                                }}
                            >
                                {isClosingPoll ? "Cerrando..." : "Cerrar encuesta"}
                            </button>
                        )}
                    </div>

                    <div className="space-y-2">
                        {post.poll.options.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => void handleVoteOption(option.id)}
                                disabled={!post.poll?.canVote || Boolean(votingOptionId)}
                                className="w-full text-left rounded-lg px-3 py-2.5"
                                style={{
                                    border: `1px solid ${option.isSelectedByMe ? "var(--text-accent)" : "var(--border-color)"}`,
                                    backgroundColor:
                                        option.isSelectedByMe
                                            ? "color-mix(in srgb, var(--text-accent) 12%, transparent)"
                                            : "var(--bg-surface)",
                                    cursor:
                                        !post.poll?.canVote || Boolean(votingOptionId)
                                            ? "not-allowed"
                                            : "pointer",
                                    opacity:
                                        !post.poll?.canVote || Boolean(votingOptionId)
                                            ? 0.85
                                            : 1,
                                }}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-body" style={{ color: "var(--text-primary)" }}>
                                        {option.text}
                                    </span>
                                    <span className="text-xs font-body" style={{ color: "var(--text-secondary)" }}>
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
                <p className="mt-3 text-xs font-body" style={{ color: "#b91c1c" }}>
                    {error}
                </p>
            )}

            <PostComments
                postId={post.id}
                token={token}
                eventId={eventId}
                disabled={!canComment || Boolean(post.isDeleted)}
            />
        </Card>
    );
};
