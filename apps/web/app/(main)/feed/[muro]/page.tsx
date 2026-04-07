"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { FeedFilters } from "../../../../components/feed/FeedFilters";
import { PostCard } from "../../../../components/feed/PostCard";
import { PostEditor } from "../../../../components/feed/PostEditor";
import { ApiError } from "../../../../lib/api/client";
import { getEventCommittees } from "../../../../lib/api/events";
import { getFeedPosts, publishFeedPost, type FeedResponse } from "../../../../lib/api/feed";
import { supabaseBrowser } from "../../../../lib/supabase";
import { useAuthStore } from "../../../../stores/auth.store";
import type { Post } from "../../../../types/common";

const Feed = () => {
    const params = useParams();
    const muroParam = typeof params?.muro === "string" ? params.muro : "general";

    const token = useAuthStore((state) => state.token);
    const eventId = useAuthStore((state) => state.activeEventId);

    const [searchQuery, setSearchQuery] = useState<string>("");
    const [selectedCommittees, setSelectedCommittees] = useState<string[]>([]);
    const [sortOrder, setSortOrder] = useState<"recent" | "oldest">("recent");
    const [posts, setPosts] = useState<Post[]>([]);
    const [activeWall, setActiveWall] = useState<FeedResponse["wall"] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isForbidden, setIsForbidden] = useState(false);
    const [allEventCommittees, setAllEventCommittees] = useState<string[]>([]);

    useEffect(() => {
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;

        const loadPosts = async (showLoader = true) => {
            if (showLoader) {
                setIsLoading(true);
            }

            try {
                const response = await getFeedPosts(muroParam, { token, eventId });

                if (!cancelled) {
                    setActiveWall(response.wall);
                    setPosts(response.posts);
                    setError(null);
                    setIsForbidden(false);
                }
            } catch (loadError) {
                if (!cancelled) {
                    if (loadError instanceof ApiError && loadError.status === 403) {
                        setIsForbidden(true);
                        setError("No tienes acceso a este muro.");
                    } else {
                        setError(
                            loadError instanceof Error
                                ? loadError.message
                                : "No se pudieron cargar las publicaciones.",
                        );
                    }
                }
            } finally {
                if (!cancelled && showLoader) {
                    setIsLoading(false);
                }
            }
        };

        setActiveWall(null);
        void loadPosts();

        return () => {
            cancelled = true;
        };
    }, [eventId, muroParam, token]);

    useEffect(() => {
        if (!activeWall?.id || !supabaseBrowser || !token || !eventId || isForbidden) {
            return;
        }

        const realtimeClient = supabaseBrowser;
        let cancelled = false;
        const channel = realtimeClient.channel(`feed-posts:${activeWall.id}`);

        const refreshPosts = async () => {
            try {
                const response = await getFeedPosts(muroParam, { token, eventId });

                if (!cancelled) {
                    setActiveWall(response.wall);
                    setPosts(response.posts);
                }
            } catch (refreshError) {
                if (!cancelled) {
                    setError(
                        refreshError instanceof Error
                            ? refreshError.message
                            : "No se pudieron sincronizar las publicaciones.",
                    );
                }
            }
        };

        channel
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "posts",
                    filter: `wall_id=eq.${activeWall.id}`,
                },
                () => {
                    void refreshPosts();
                },
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "polls",
                    filter: `wall_id=eq.${activeWall.id}`,
                },
                () => {
                    void refreshPosts();
                },
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "poll_votes",
                },
                () => {
                    void refreshPosts();
                },
            )
            .subscribe();

        return () => {
            cancelled = true;
            void realtimeClient.removeChannel(channel);
        };
    }, [activeWall?.id, eventId, isForbidden, muroParam, token]);

    useEffect(() => {
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;

        const loadEventCommittees = async () => {
            try {
                const committees = await getEventCommittees({
                    token,
                    eventId,
                });

                if (!cancelled) {
                    const committeeNames = committees
                        .map((committee) => committee.name.trim())
                        .filter((name) => name.length > 0);

                    setAllEventCommittees(
                        [...new Set(committeeNames)].sort((a, b) => a.localeCompare(b)),
                    );
                }
            } catch {
                if (!cancelled) {
                    setAllEventCommittees([]);
                }
            }
        };

        void loadEventCommittees();

        return () => {
            cancelled = true;
        };
    }, [eventId, token]);

    const comitesDisponibles = useMemo(() => {
        if (allEventCommittees.length > 0) {
            return allEventCommittees;
        }

        const committees = new Set<string>();

        posts.forEach((post) => {
            const committeeName = post.user.committeeName?.trim();
            if (committeeName) {
                committees.add(committeeName);
            }
        });

        return [...committees].sort((a, b) => a.localeCompare(b));
    }, [allEventCommittees, posts]);

    const formatRelativeTime = (timestamp: number) => {
        const diffInMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));

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

    const handlePublishPost = async (draft: {
        content: string;
        postType: "TEXT" | "POLL";
        pollOptions?: string[];
    }) => {
        if (!token || !eventId) {
            throw new Error("No hay sesion activa");
        }

        try {
            setError(null);
            const newPost = await publishFeedPost({
                muro: muroParam,
                content: draft.content,
                postType: draft.postType,
                pollOptions: draft.pollOptions,
                token,
                eventId,
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
            (post.user.committeeName &&
                selectedCommittees.includes(post.user.committeeName));

        return matchesSearch && matchesCommittee;
    });

    const handlePostUpdated = (updatedPost: Post) => {
        setPosts((currentPosts) =>
            currentPosts.map((post) =>
                post.id === updatedPost.id
                    ? {
                          ...post,
                          ...updatedPost,
                          user: {
                              ...post.user,
                              ...updatedPost.user,
                          },
                      }
                    : post,
            ),
        );
    };

    const sortedAndFilteredPosts = [...filteredPosts].sort((a, b) => {
        if (sortOrder === "recent") {
            return b.timestamp - a.timestamp;
        }

        return a.timestamp - b.timestamp;
    });

    const showCommitteeFilter = activeWall?.kind === "general";
    const headerTitle = activeWall
        ? activeWall.kind === "committee"
            ? activeWall.committeeName ?? activeWall.name
            : activeWall.name
        : "Muro";
    const canCommentInWall = activeWall
        ? activeWall.kind === "announcements"
            ? activeWall.canPublish
            : activeWall.canAccess
        : false;

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

                {!isForbidden && activeWall?.canPublish && (
                    <PostEditor
                        onPublish={handlePublishPost}
                        disabled={isLoading}
                    />
                )}

                {error && !isForbidden && (
                    <div
                        className="mb-6 rounded-xl px-4 py-3 text-sm font-body"
                        style={{
                            backgroundColor: "color-mix(in srgb, #ef4444 8%, white)",
                            border:
                                "1px solid color-mix(in srgb, #ef4444 20%, transparent)",
                            color: "#991b1b",
                        }}
                    >
                        {error}
                    </div>
                )}

                {isForbidden ? (
                    <div
                        className="rounded-2xl p-6"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-sm)",
                        }}
                    >
                        <h2 className="text-xl font-bold font-heading" style={{ color: "var(--text-primary)" }}>
                            No tienes acceso a este muro
                        </h2>
                        <p className="mt-2 text-sm font-body" style={{ color: "var(--text-secondary)" }}>
                            Puedes ver el muro en el menu lateral, pero solo podras entrar cuando tengas permiso.
                        </p>
                    </div>
                ) : (
                    <>
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
                                    setSelectedCommittees([...selectedCommittees, comite]);
                                }
                            }}
                            onClearCommittees={() => setSelectedCommittees([])}
                            comitesDisponibles={comitesDisponibles}
                            sortOrder={sortOrder}
                            onSortChange={setSortOrder}
                            showCommitteeFilter={Boolean(showCommitteeFilter)}
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
                            ) : sortedAndFilteredPosts.length > 0 && token && eventId ? (
                                sortedAndFilteredPosts.map((post) => (
                                    <PostCard
                                        key={post.id}
                                        post={{
                                            ...post,
                                            createdAt: formatRelativeTime(post.timestamp),
                                        }}
                                        token={token}
                                        eventId={eventId}
                                        canComment={canCommentInWall}
                                        onPostUpdated={handlePostUpdated}
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
                    </>
                )}
            </div>
        </div>
    );
};

export default Feed;
