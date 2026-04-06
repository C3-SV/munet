import React from "react";
import { Card } from "../ui/Card";
import type { Post } from "../../types/common";

interface PostCardProps {
    post: Post;
}

export const PostCard = ({ post }: PostCardProps) => {
    return (
        <Card className="mb-4 p-5 md:p-6">
            <div className="flex items-start justify-between mb-4 gap-4">
                <div className="flex items-center gap-4">
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
                            {post.user.name}
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
            </div>

            <p
                className="font-body leading-relaxed text-[15px]"
                style={{ color: "var(--text-primary)" }}
            >
                {post.content}
            </p>
        </Card>
    );
};
