import React, { useState } from "react";
import { deleteFeedPost } from "../../lib/api/feed";
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
