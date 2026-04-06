"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PostEditor } from "../../../../components/feed/PostEditor";
import { FeedFilters } from "../../../../components/feed/FeedFilters";
import { PostCard } from "../../../../components/feed/PostCard";
import type { Post } from "../../../../types/common";
import {
    getFeedPosts,
    publishFeedPost,
} from "../../../../lib/api/feed";

const Feed = () => {
    const params = useParams();
    const muroParam =
        typeof params?.muro === "string" ? params.muro : "general";

    let currentMuro = "General";
    let headerTitle = "Muro General";

    if (muroParam === "avisos") {
        currentMuro = "Avisos";
        headerTitle = "Avisos Oficiales";
    } else if (muroParam.startsWith("comite-")) {
        const numero = muroParam.split("-")[1];
        currentMuro = `Comite ${numero}`;
        headerTitle = `Muro de Comite ${numero}`;
    }

    const showCommitteeFilter = currentMuro === "General";

    const [searchQuery, setSearchQuery] = useState<string>("");
    const [selectedCommittees, setSelectedCommittees] = useState<string[]>([]);
    const [sortOrder, setSortOrder] = useState<"recent" | "oldest">("recent");
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadPosts = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await getFeedPosts(muroParam);

                if (!cancelled) {
                    setPosts(response.posts);
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : "No se pudieron cargar las publicaciones.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadPosts();

        return () => {
            cancelled = true;
        };
    }, [muroParam]);

    const comitesDisponibles = useMemo(() => {
        const uniqueTags = new Set<string>();

        posts.forEach((post) => {
            post.committeeTags?.forEach((tag) => uniqueTags.add(tag));
        });

        return [...uniqueTags].sort((a, b) => a.localeCompare(b));
    }, [posts]);

    const formatRelativeTime = (timestamp: number) => {
        const diffInMinutes = Math.max(
            0,
            Math.floor((Date.now() - timestamp) / 60000),
        );

        if (diffInMinutes < 1) {
            return "justo ahora";
        }

        if (diffInMinutes < 60) {
            return `hace ${diffInMinutes} minuto${diffInMinutes === 1 ? "" : "s"}`;
        }

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) {
            return `hace ${diffInHours} hora${diffInHours === 1 ? "" : "s"}`;
        }

        const diffInDays = Math.floor(diffInHours / 24);
        return `hace ${diffInDays} dia${diffInDays === 1 ? "" : "s"}`;
    };

    const handlePublishPost = async (text: string) => {
        try {
            setError(null);
            const newPost = await publishFeedPost({
                muro: muroParam,
                content: text,
            });

            setPosts((currentPosts) => [newPost, ...currentPosts]);
        } catch (publishError) {
            setError(
                publishError instanceof Error
                    ? publishError.message
                    : "No se pudo publicar el post.",
            );
            throw publishError;
        }
    };

    const filteredPosts = posts.filter((post) => {
        const matchesSearch =
            post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            post.user.name.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCommittee =
            selectedCommittees.length === 0 ||
            (post.committeeTags &&
                post.committeeTags.some((tag) =>
                    selectedCommittees.includes(tag),
                ));

        return matchesSearch && matchesCommittee;
    });

    const sortedAndFilteredPosts = [...filteredPosts].sort((a, b) => {
        if (sortOrder === "recent") {
            return b.timestamp - a.timestamp;
        }

        return a.timestamp - b.timestamp;
    });

    return (
        <div className="p-4 sm:p-6 lg:p-12">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <span
                        className="text-[11px] font-bold uppercase tracking-[0.15em] font-heading"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Foro de discusion
                    </span>
                    <h1
                        className="text-3xl sm:text-4xl font-black font-heading mt-1 uppercase tracking-tight"
                        style={{ color: "var(--text-accent)" }}
                    >
                        {headerTitle}
                    </h1>
                </header>

                {currentMuro !== "Avisos" && (
                    <PostEditor
                        onPublish={handlePublishPost}
                        disabled={isLoading}
                    />
                )}

                {error && (
                    <div
                        className="mb-6 rounded-xl px-4 py-3 text-sm font-body"
                        style={{
                            backgroundColor:
                                "color-mix(in srgb, #ef4444 8%, white)",
                            border:
                                "1px solid color-mix(in srgb, #ef4444 20%, transparent)",
                            color: "#991b1b",
                        }}
                    >
                        {error}
                    </div>
                )}

                <FeedFilters
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    selectedCommittees={selectedCommittees}
                    onCommitteeToggle={(comite) => {
                        if (selectedCommittees.includes(comite)) {
                            setSelectedCommittees(
                                selectedCommittees.filter((c) => c !== comite),
                            );
                        } else {
                            setSelectedCommittees([
                                ...selectedCommittees,
                                comite,
                            ]);
                        }
                    }}
                    onClearCommittees={() => setSelectedCommittees([])}
                    comitesDisponibles={comitesDisponibles}
                    sortOrder={sortOrder}
                    onSortChange={setSortOrder}
                    showCommitteeFilter={showCommitteeFilter}
                />

                <div className="space-y-4">
                    {isLoading ? (
                        <div
                            className="flex justify-center py-12 rounded-xl"
                            style={{
                                backgroundColor: "var(--bg-surface)",
                                border: "1px solid var(--border-color)",
                            }}
                        >
                            <span
                                className="font-body text-sm"
                                style={{ color: "var(--text-muted)" }}
                            >
                                Cargando publicaciones...
                            </span>
                        </div>
                    ) : sortedAndFilteredPosts.length > 0 ? (
                        sortedAndFilteredPosts.map((post) => (
                            <PostCard
                                key={post.id}
                                post={{
                                    ...post,
                                    createdAt: formatRelativeTime(post.timestamp),
                                }}
                            />
                        ))
                    ) : (
                        <div
                            className="flex justify-center py-12 rounded-xl"
                            style={{
                                backgroundColor: "var(--bg-surface)",
                                border: "2px dashed var(--border-color)",
                            }}
                        >
                            <span
                                className="font-body text-sm"
                                style={{ color: "var(--text-muted)" }}
                            >
                                No se encontraron publicaciones.
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Feed;
