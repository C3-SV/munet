"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FeedFilters } from "../../../../components/feed/FeedFilters";
import { PostCard } from "../../../../components/feed/PostCard";
import { PostEditor } from "../../../../components/feed/PostEditor";
import { Button } from "../../../../components/ui/Button";
import { ApiError } from "../../../../lib/api/client";
import { getEventCommittees, getEventWalls } from "../../../../lib/api/events";
import { getFeedPosts, publishFeedPost, type FeedResponse } from "../../../../lib/api/feed";
import { AttachmentUploadError } from "../../../../lib/attachment-upload";
import { buildWallNav } from "../../../../lib/wall-nav";
import { isPracticeEvent } from "../../../../lib/practice/constants";
import { supabaseBrowser } from "../../../../lib/supabase";
import { useAuthStore } from "../../../../stores/auth.store";
import type { EventWall, Post } from "../../../../types/common";

// Mensajes humanos: el detalle técnico no llega al participante.
const FEED_LOAD_ERROR = "No se pudieron cargar las publicaciones. Revisa tu conexión e inténtalo de nuevo.";
const FEED_PUBLISH_ERROR = "No se pudo publicar tu publicación. Tu texto sigue en el editor; revisa tu conexión e inténtalo de nuevo.";
const FEED_PUBLISH_ATTACHMENT_ERROR = "No se pudo publicar con el archivo adjunto. Tu texto y el archivo siguen en el editor; inténtalo de nuevo.";

// Con adjunto, los errores de la API sobre el archivo (tipo, tamaño, límites) se muestran tal cual.
const publishErrorMessage = (error: unknown, hasAttachment: boolean) => {
    if (error instanceof AttachmentUploadError) {
        return error.message;
    }

    if (hasAttachment && error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return error.message;
    }

    return hasAttachment ? FEED_PUBLISH_ATTACHMENT_ERROR : FEED_PUBLISH_ERROR;
};

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
    // Error de carga o sincronización del muro: se reintenta recargando el muro.
    const [error, setError] = useState<string | null>(null);
    // Error al publicar: no se reintenta recargando; el borrador del editor se conserva.
    const [publishError, setPublishError] = useState<string | null>(null);
    const [isForbidden, setIsForbidden] = useState(false);
    const [allEventCommittees, setAllEventCommittees] = useState<string[]>([]);
    const [walls, setWalls] = useState<EventWall[]>([]);
    // Incrementar fuerza una nueva carga del muro (botón "Reintentar").
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        // Muros accesibles del evento para el selector rapido en movil.
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;

        const loadWalls = async () => {
            try {
                const response = await getEventWalls({ token, eventId });

                if (!cancelled) {
                    setWalls(response.walls);
                }
            } catch {
                if (!cancelled) {
                    setWalls([]);
                }
            }
        };

        void loadWalls();

        return () => {
            cancelled = true;
        };
    }, [eventId, token]);

    useEffect(() => {
        // Carga inicial del muro activo (incluye control de acceso 403).
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
                        setError(FEED_LOAD_ERROR);
                    }
                }
            } finally {
                if (!cancelled && showLoader) {
                    setIsLoading(false);
                }
            }
        };

        // Al cambiar de contexto no se conservan publicaciones del anterior.
        setActiveWall(null);
        setPosts([]);
        setPublishError(null);
        void loadPosts();

        return () => {
            cancelled = true;
        };
    }, [eventId, muroParam, token, reloadKey]);

    // Ids de encuestas del muro: poll_votes no tiene wall_id, así que se escucha cada una.
    const pollIdsKey = posts
        .map((post) => post.poll?.id)
        .filter((id): id is string => Boolean(id))
        .sort()
        .join(",");

    useEffect(() => {
        // Realtime: sincroniza cambios en posts/polls/votos del muro actual.
        if (!activeWall?.id || !supabaseBrowser || !token || !eventId || isForbidden || isPracticeEvent(eventId)) {
            return;
        }

        const realtimeClient = supabaseBrowser;
        let cancelled = false;
        let hasJoined = false;
        // Autoriza el socket con la sesión activa antes de suscribirse.
        realtimeClient.realtime.setAuth(token);
        const channel = realtimeClient.channel(`feed-posts:${activeWall.id}`);
        const pollIds = pollIdsKey ? pollIdsKey.split(",") : [];

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

        // Un filtro por encuesta: evita reconsultar por votos de otros eventos o muros.
        pollIds.forEach((pollId) => {
            channel.on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "poll_votes",
                    filter: `poll_id=eq.${pollId}`,
                },
                () => {
                    void refreshPosts();
                },
            );
        });

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
            .subscribe((status) => {
                // Relee al reconectar para recuperar cambios perdidos sin socket.
                if (status !== "SUBSCRIBED") return;
                if (hasJoined) void refreshPosts();
                hasJoined = true;
            });

        return () => {
            cancelled = true;
            void realtimeClient.removeChannel(channel);
        };
    }, [activeWall?.id, eventId, isForbidden, muroParam, pollIdsKey, token]);

    useEffect(() => {
        // Carga catalogo de comites del evento para filtro del muro general.
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
        // Prioriza catalogo del evento; usa fallback desde posts si falla API.
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

    const handlePublishPost = async (draft: {
        content: string;
        postType: "TEXT" | "POLL";
        pollOptions?: string[];
        // Adjunto elegido en el editor: se sube a almacenamiento y luego se crea el post.
        attachment?: File;
    }) => {
        // Publica y actualiza estado local optimistamente con el post retornado.
        if (!token || !eventId) {
            throw new Error("No hay sesión activa");
        }

        try {
            setPublishError(null);
            const newPost = await publishFeedPost({
                muro: muroParam,
                content: draft.content,
                postType: draft.postType,
                pollOptions: draft.pollOptions,
                attachment: draft.attachment,
                token,
                eventId,
            });

            setPosts((currentPosts) => [newPost, ...currentPosts]);
        } catch (submitError) {
            setPublishError(publishErrorMessage(submitError, Boolean(draft.attachment)));
            throw submitError;
        }
    };

    // El filtro de comité solo existe en el muro General: en otros muros no se aplica.
    const showCommitteeFilter = activeWall?.kind === "general";
    const activeCommittees = showCommitteeFilter ? selectedCommittees : [];

    const filteredPosts = posts.filter((post) => {
        // Filtro combinado de busqueda libre + comites seleccionados.
        const matchesSearch =
            post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            post.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (post.user.alias ?? "").toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCommittee =
            activeCommittees.length === 0 ||
            (post.user.committeeName &&
                activeCommittees.includes(post.user.committeeName));

        return matchesSearch && matchesCommittee;
    });

    const handlePostUpdated = (updatedPost: Post) => {
        // Reconcilia actualizaciones parciales (votos/cierre/delete) sin recargar todo.
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

    const handlePostDeleted = (postId: string) => {
        // Remueve post de la lista tras confirmacion de borrado exitoso.
        setPosts((currentPosts) => currentPosts.filter((post) => post.id !== postId));
    };

    const sortedAndFilteredPosts = [...filteredPosts].sort((a, b) => {
        if (sortOrder === "recent") {
            return b.timestamp - a.timestamp;
        }

        return a.timestamp - b.timestamp;
    });

    const headerTitle = activeWall
        ? activeWall.kind === "committee"
            ? activeWall.committeeName ?? activeWall.name
            : activeWall.name
        : "Muro";
    // Identidad de cada muro: avisos oficiales, foro abierto o comité con su código.
    const headerSubtitle = !activeWall
        ? null
        : activeWall.kind === "announcements"
          ? "Aviso oficial"
          : activeWall.kind === "general"
            ? "Abierto a todo el evento"
            : activeWall.kind === "committee" && activeWall.committeeCode
              ? `Comité · código ${activeWall.committeeCode}`
              : null;
    // Avisos usan tarjeta oficial; el resto del foro usa publicaciones planas.
    const cardVariant = activeWall?.kind === "announcements" ? "official" : "default";
    const canCommentInWall = activeWall
        ? activeWall.kind === "announcements"
            ? activeWall.canPublish
            : activeWall.canAccess
        : false;

    // Selector rapido de muros para movil: mismos muros que el menu lateral, en orden.
    const wallNav = useMemo(() => buildWallNav(walls, muroParam), [walls, muroParam]);
    const quickWalls = [
        wallNav.announcements,
        wallNav.general,
        wallNav.mine,
        ...wallNav.committees,
    ].filter((wall): wall is EventWall => wall !== null);

    return (
        <div className="p-4 sm:p-6 lg:p-12">
            <div className="max-w-4xl mx-auto">
                <header className="mb-6">
                    <h1
                        className="text-2xl sm:text-3xl font-bold font-heading tracking-tight"
                        style={{ color: "var(--text-accent)" }}
                    >
                        {headerTitle}
                    </h1>
                    {headerSubtitle && (
                        <p
                            className="mt-1 text-sm font-body"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            {headerSubtitle}
                        </p>
                    )}
                </header>

                {quickWalls.length > 1 && (
                    <nav
                        aria-label="Muros"
                        className="md:hidden -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1"
                    >
                        {quickWalls.map((wall) => {
                            const isActive = wall.slug === muroParam;
                            const label =
                                wall.kind === "committee"
                                    ? wall.committeeName ?? wall.name
                                    : wall.name;

                            return (
                                <Link
                                    key={wall.id}
                                    href={`/feed/${wall.slug}`}
                                    aria-current={isActive ? "page" : undefined}
                                    className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold font-heading"
                                    style={{
                                        backgroundColor: isActive
                                            ? "var(--sidebar-active-bg)"
                                            : "var(--bg-surface)",
                                        border: `1px solid ${
                                            isActive ? "var(--text-accent)" : "var(--border-color)"
                                        }`,
                                        color: isActive ? "var(--text-accent)" : "var(--text-secondary)",
                                    }}
                                >
                                    {label}
                                </Link>
                            );
                        })}
                    </nav>
                )}

                {/* El borrador es por evento y muro: los slugs de muro se repiten entre eventos. */}
                {!isForbidden && activeWall?.canPublish && (
                    <PostEditor
                        key={`${eventId ?? "sin-evento"}:${muroParam}`}
                        draftKey={`${eventId ?? "sin-evento"}:${muroParam}`}
                        onPublish={handlePublishPost}
                        disabled={isLoading}
                    />
                )}

                {publishError && !isForbidden && (
                    <div
                        role="alert"
                        className="mb-6 rounded-[var(--radius-sm)] px-4 py-3 text-sm font-body"
                        style={{
                            backgroundColor: "var(--danger-bg)",
                            border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
                            color: "var(--text-primary)",
                        }}
                    >
                        <span>{publishError}</span>
                    </div>
                )}

                {error && !isForbidden && (
                    <div
                        role="alert"
                        className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] px-4 py-3 text-sm font-body"
                        style={{
                            backgroundColor: "var(--danger-bg)",
                            border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
                            color: "var(--text-primary)",
                        }}
                    >
                        <span>{error}</span>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setReloadKey((key) => key + 1)}
                        >
                            Reintentar
                        </Button>
                    </div>
                )}

                {isForbidden ? (
                    <div
                        className="rounded-[var(--radius-lg)] p-6"
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
                            Este muro pertenece a otro comité. Puedes entrar al muro general, a avisos y al de tu comité desde el menú lateral.
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
                                <div role="status" className="space-y-4">
                                    <span className="sr-only">Cargando publicaciones</span>
                                    {[0, 1, 2].map((item) => (
                                        <div
                                            key={item}
                                            aria-hidden="true"
                                            className="motion-fade-in rounded-[var(--radius-lg)] p-5 md:p-6"
                                            style={{
                                                backgroundColor: "var(--bg-surface)",
                                                border: "1px solid var(--border-color)",
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="size-11 shrink-0 rounded-full"
                                                    style={{ backgroundColor: "var(--bg-surface-secondary)" }}
                                                />
                                                <div className="flex-1 space-y-2">
                                                    <div
                                                        className="h-3 w-40 rounded"
                                                        style={{ backgroundColor: "var(--bg-surface-secondary)" }}
                                                    />
                                                    <div
                                                        className="h-2.5 w-24 rounded"
                                                        style={{ backgroundColor: "var(--bg-surface-secondary)" }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-4 space-y-2">
                                                <div
                                                    className="h-3 w-full rounded"
                                                    style={{ backgroundColor: "var(--bg-surface-secondary)" }}
                                                />
                                                <div
                                                    className="h-3 w-5/6 rounded"
                                                    style={{ backgroundColor: "var(--bg-surface-secondary)" }}
                                                />
                                                <div
                                                    className="h-3 w-2/3 rounded"
                                                    style={{ backgroundColor: "var(--bg-surface-secondary)" }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : sortedAndFilteredPosts.length > 0 && token && eventId ? (
                                sortedAndFilteredPosts.map((post) => (
                                    <PostCard
                                        key={post.id}
                                        post={post}
                                        token={token}
                                        eventId={eventId}
                                        canComment={canCommentInWall}
                                        showAuthorCommittee={activeWall?.kind !== "committee"}
                                        variant={cardVariant}
                                        onPostUpdated={handlePostUpdated}
                                        onPostDeleted={handlePostDeleted}
                                    />
                                ))
                            ) : (
                                <div
                                    className="flex justify-center py-12 rounded-[var(--radius-lg)]"
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
