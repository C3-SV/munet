"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminButton } from "../../../../../../components/admin/AdminButton";
import { AdminEmptyState } from "../../../../../../components/admin/AdminEmptyState";
import { AdminFormSelect } from "../../../../../../components/admin/AdminFormSelect";
import { AdminPageHeader } from "../../../../../../components/admin/AdminPageHeader";
import { AdminToast } from "../../../../../../components/admin/AdminToast";
import { ModerationPostCard } from "../../../../../../components/admin/ModerationPostCard";
import { IconAlertTriangle, IconRefresh, IconShield } from "../../../../../../components/ui/icons";
import { ApiError } from "../../../../../../lib/api/client";
import {
    listModerationPeople,
    listModerationPosts,
    listModerationWalls,
    type ModerationPagination,
    type ModerationPerson,
    type ModerationPost,
    type ModerationStatusFilter,
    type ModerationWall,
} from "../../../../../../lib/api/moderation";
import { useAuthStore } from "../../../../../../stores/auth.store";

const PAGE_SIZE = 20;
// Espera tras un 429 antes de permitir otra acción de escritura.
const COOLDOWN_MS = 5000;

const TABS: { value: ModerationStatusFilter; label: string }[] = [
    { value: "VISIBLE", label: "Visibles" },
    { value: "DELETED", label: "Eliminados" },
    { value: "ALL", label: "Todos" },
];

type ToastState = { type: "success" | "error"; message: string };

const wallLabel = (wall: ModerationWall) =>
    `${wall.name} · ${wall.visible_posts} visibles · ${wall.pinned_posts} fijados`;

const personLabel = (person: ModerationPerson) => {
    const name = `${person.first_name} ${person.last_name}`.trim() || person.alias || "";
    return name ? `${name} · ${person.participant_code}` : person.participant_code;
};

export default function ModerationPage() {
    const params = useParams<{ eventId: string }>();
    const eventId = params.eventId;
    const token = useAuthStore((state) => state.token);
    const eventName = useAuthStore(
        (state) =>
            state.memberships.find((membership) => membership.eventId === eventId)?.eventName ??
            "Evento",
    );

    const [walls, setWalls] = useState<ModerationWall[]>([]);
    const [wallsLoading, setWallsLoading] = useState(true);
    const [wallsError, setWallsError] = useState<string | null>(null);
    const [wallId, setWallId] = useState("");

    const [people, setPeople] = useState<ModerationPerson[]>([]);
    const [peopleLoading, setPeopleLoading] = useState(true);
    const [peopleError, setPeopleError] = useState<string | null>(null);
    // "" = todas las personas del muro seleccionado.
    const [authorId, setAuthorId] = useState("");

    const [status, setStatus] = useState<ModerationStatusFilter>("VISIBLE");
    const [page, setPage] = useState(1);
    const [posts, setPosts] = useState<ModerationPost[]>([]);
    const [pagination, setPagination] = useState<ModerationPagination | null>(null);
    const [postsLoading, setPostsLoading] = useState(false);
    const [postsError, setPostsError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const [toast, setToast] = useState<ToastState | null>(null);
    const [blocked, setBlocked] = useState(false);
    const cooldownTimer = useRef<number | null>(null);

    useEffect(
        () => () => {
            if (cooldownTimer.current) {
                window.clearTimeout(cooldownTimer.current);
            }
        },
        [],
    );

    const selectedWall = walls.find((wall) => wall.id === wallId) ?? null;

    // Texto del error; un 429 muestra el mensaje de la API y bloquea las acciones unos segundos.
    const describeError = useCallback((error: unknown) => {
        if (error instanceof ApiError) {
            if (error.status === 429) {
                setBlocked(true);

                if (cooldownTimer.current) {
                    window.clearTimeout(cooldownTimer.current);
                }

                cooldownTimer.current = window.setTimeout(() => setBlocked(false), COOLDOWN_MS);
                setToast({ type: "error", message: error.message });
            }

            return error.status === 403
                ? "No tienes permisos de moderación en este evento."
                : error.message;
        }

        return "No se pudo completar la acción. Intenta de nuevo.";
    }, []);

    const loadWalls = useCallback(async () => {
        if (!token || !eventId) {
            return;
        }

        try {
            const list = await listModerationWalls(token, eventId);
            setWalls(list);
            setWallsError(null);
            setWallId((current) =>
                list.some((wall) => wall.id === current) ? current : (list[0]?.id ?? ""),
            );
        } catch (error) {
            setWallsError(describeError(error));
        } finally {
            setWallsLoading(false);
        }
    }, [token, eventId, describeError]);

    useEffect(() => {
        void loadWalls();
    }, [loadWalls]);

    // Personas del evento para el selector. Si falla, el selector se deshabilita y el resto sigue.
    useEffect(() => {
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;
        setPeopleLoading(true);
        setPeopleError(null);
        setAuthorId("");

        listModerationPeople(token, eventId)
            .then((list) => {
                if (!cancelled) {
                    setPeople(list);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setPeople([]);
                    setPeopleError("No se pudo cargar la lista de personas.");
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setPeopleLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [token, eventId]);

    useEffect(() => {
        if (!token || !wallId) {
            return;
        }

        let cancelled = false;
        setPostsLoading(true);
        setPostsError(null);

        listModerationPosts(token, wallId, {
            status,
            page,
            limit: PAGE_SIZE,
            author_membership_id: authorId || undefined,
        })
            .then((data) => {
                if (!cancelled) {
                    setPosts(data.posts);
                    setPagination(data.pagination);
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    setPostsError(describeError(error));
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setPostsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [token, wallId, status, page, authorId, reloadKey, describeError]);

    const handleChanged = (message: string) => {
        setToast({ type: "success", message });
        setReloadKey((value) => value + 1);
        void loadWalls();
    };

    const totalPages = pagination?.total_pages ?? 1;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <AdminPageHeader
                title="Moderación"
                description={`Muros y publicaciones de ${eventName}.`}
                breadcrumb={[{ label: "Panel", href: "/admin" }, { label: "Moderación" }]}
            />

            {wallsError && (
                <AdminEmptyState
                    icon={<IconAlertTriangle size={32} />}
                    title="No se pudieron cargar los muros"
                    description={wallsError}
                    action={
                        <AdminButton
                            variant="secondary"
                            icon={<IconRefresh size={16} />}
                            onClick={() => {
                                setWallsLoading(true);
                                void loadWalls();
                            }}
                        >
                            Reintentar
                        </AdminButton>
                    }
                />
            )}

            {!wallsError && !wallsLoading && walls.length === 0 && (
                <AdminEmptyState
                    icon={<IconShield size={32} />}
                    title="Este evento no tiene muros"
                    description="Cuando se creen muros aparecerán aquí."
                />
            )}

            {walls.length > 0 && (
                <div
                    className="rounded-2xl p-4 sm:p-5 space-y-4"
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <AdminFormSelect
                            id="moderation-wall"
                            label="Muro"
                            value={wallId}
                            onChange={(event) => {
                                setWallId(event.target.value);
                                setPage(1);
                            }}
                            options={walls.map((wall) => ({ value: wall.id, label: wallLabel(wall) }))}
                        />

                        <AdminFormSelect
                            id="moderation-author"
                            label="Persona"
                            value={authorId}
                            disabled={peopleLoading || peopleError !== null}
                            error={peopleError ?? undefined}
                            onChange={(event) => {
                                setAuthorId(event.target.value);
                                setPage(1);
                            }}
                            options={[
                                { value: "", label: "Todas las personas" },
                                ...people.map((person) => ({
                                    value: person.id,
                                    label: personLabel(person),
                                })),
                            ]}
                        />
                    </div>

                    <div role="tablist" aria-label="Estado de las publicaciones" className="flex gap-2">
                        {TABS.map((tab) => (
                            <AdminButton
                                key={tab.value}
                                role="tab"
                                aria-selected={status === tab.value}
                                variant={status === tab.value ? "primary" : "secondary"}
                                onClick={() => {
                                    setStatus(tab.value);
                                    setPage(1);
                                }}
                            >
                                {tab.label}
                            </AdminButton>
                        ))}
                    </div>
                </div>
            )}

            {selectedWall && (
                <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                >
                    {postsLoading && (
                        <p className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>
                            Cargando publicaciones...
                        </p>
                    )}

                    {!postsLoading && postsError && (
                        <AdminEmptyState
                            icon={<IconAlertTriangle size={32} />}
                            title="No se pudieron cargar las publicaciones"
                            description={postsError}
                            action={
                                <AdminButton
                                    variant="secondary"
                                    icon={<IconRefresh size={16} />}
                                    onClick={() => setReloadKey((value) => value + 1)}
                                >
                                    Reintentar
                                </AdminButton>
                            }
                        />
                    )}

                    {!postsLoading && !postsError && posts.length === 0 && (
                        <AdminEmptyState
                            icon={<IconShield size={32} />}
                            title="Sin publicaciones"
                            description={
                                authorId
                                    ? "Esta persona no tiene publicaciones con este estado en el muro."
                                    : "No hay publicaciones con este estado en el muro."
                            }
                        />
                    )}

                    {!postsLoading && !postsError && posts.length > 0 && (
                        <div className="px-5 md:px-6">
                            {posts.map((post) => (
                                <ModerationPostCard
                                    key={post.id}
                                    post={post}
                                    token={token ?? ""}
                                    wallPinnedPosts={selectedWall.pinned_posts}
                                    describeError={describeError}
                                    actionsBlocked={blocked}
                                    onChanged={handleChanged}
                                />
                            ))}
                        </div>
                    )}

                    {pagination && totalPages > 1 && (
                        <div
                            className="flex items-center justify-between gap-3 px-5 py-4"
                            style={{ borderTop: "1px solid var(--border-color)" }}
                        >
                            <AdminButton
                                variant="secondary"
                                disabled={page <= 1 || postsLoading}
                                onClick={() => setPage((value) => value - 1)}
                            >
                                Anterior
                            </AdminButton>
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                Página {pagination.page} de {totalPages} · {pagination.total} en total
                            </span>
                            <AdminButton
                                variant="secondary"
                                disabled={page >= totalPages || postsLoading}
                                onClick={() => setPage((value) => value + 1)}
                            >
                                Siguiente
                            </AdminButton>
                        </div>
                    )}
                </div>
            )}

            {toast && (
                <AdminToast
                    type={toast.type}
                    message={toast.message}
                    onDismiss={() => setToast(null)}
                />
            )}
        </div>
    );
}
