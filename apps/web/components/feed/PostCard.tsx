import React from "react";
import { Card } from "../ui/Card";
import type { Post } from "../../types/common";

interface PostCardProps {
    post: Post;
}

export const PostCard = ({ post }: PostCardProps) => {
    const displayTime =
        post.createdAt.toLowerCase() === "justo ahora"
            ? post.createdAt
            : `hace ${post.createdAt}`;

    return (
        <Card className="mb-4 p-5 md:p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-start justify-between mb-4 gap-4">
                <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                        <img
                            src={post.user.avatar}
                            className="size-12 rounded-full border border-gray-100 object-cover"
                            alt={post.user.name}
                        />
                    </div>
                    <div>
                        <h4 className="text-titles font-bold font-heading text-md">
                            {post.user.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-body mt-0.5">
                            <img
                                src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/clock.svg"
                                className="size-3.5 opacity-60"
                                alt=""
                            />
                            <span className="lowercase">{displayTime}</span>
                        </div>
                    </div>
                </div>

                {post.committeeTags && post.committeeTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-end mt-1">
                        {post.committeeTags.map((tag) => (
                            <span
                                key={tag}
                                className="px-2.5 py-1 bg-primary/5 text-primary text-[10px] font-extrabold uppercase tracking-widest rounded-full font-heading border border-primary/10"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <p className="text-body font-body leading-relaxed text-[15px]">
                {post.content}
            </p>
        </Card>
    );
};
