"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../../../../../stores/auth.store";
import { getEventCommittees, type EventCommittee } from "../../../../../../lib/api/events";
import { AdminPageHeader } from "../../../../../../components/admin/AdminPageHeader";
import { AdminButton } from "../../../../../../components/admin/AdminButton";
import { AdminEmptyState } from "../../../../../../components/admin/AdminEmptyState";

// Fila de comité en la tabla.
const CommitteeRow = ({ committee }: { committee: EventCommittee }) => {
    const [hovered, setHovered] = useState(false);

    return (
        <tr
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                backgroundColor: hovered
                    ? "var(--bg-hover)"
                    : "transparent",
                cursor: "default",
                transition: "background-color 0.15s ease",
            }}
        >
            {/* Nombre */}
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div
                        className="flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-bold font-heading shrink-0"
                        style={{
                            backgroundColor: "color-mix(in srgb, var(--text-accent) 12%, transparent)",
                            color: "var(--text-accent)",
                            minWidth: 40,
                        }}
                    >
                        {committee.code}
                    </div>
                    <span
                        className="text-sm font-semibold font-heading"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {committee.name}
                    </span>
                </div>
            </td>

            {/* Descripción */}
            <td className="px-6 py-4 hidden md:table-cell">
                <span
                    className="text-sm line-clamp-1"
                    style={{ color: "var(--text-secondary)" }}
                >
                    {committee.description ?? "—"}
                </span>
            </td>

            {/* Orden */}
            <td className="px-6 py-4 hidden sm:table-cell text-center">
                <span
                    className="text-sm tabular-nums"
                    style={{ color: "var(--text-muted)" }}
                >
                    {committee.sort_order}
                </span>
            </td>

            {/* Estado */}
            <td className="px-6 py-4">
                <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{
                        backgroundColor:
                            committee.status === "ACTIVE"
                                ? "color-mix(in srgb, #22c55e 12%, transparent)"
                                : "color-mix(in srgb, #94a3b8 12%, transparent)",
                        color:
                            committee.status === "ACTIVE"
                                ? "#16a34a"
                                : "var(--text-secondary)",
                    }}
                >
                    {committee.status === "ACTIVE" ? "Activo" : committee.status}
                </span>
            </td>
        </tr>
    );
};

// Página de listado de comités de un evento.
// Usa GET /events/:eventId/committees (ya disponible en BE).
export default function CommitteesPage() {
    const params = useParams<{ eventId: string }>();
    const eventId = params?.eventId ?? "";

    const token = useAuthStore((state) => state.token);
    const memberships = useAuthStore((state) => state.memberships);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const activeMembership = memberships.find((m) => m.id === activeMembershipId);

    const [committees, setCommittees] = useState<EventCommittee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Resolvemos el nombre del evento desde las memberships del store.
    const eventName =
        memberships.find((m) => m.eventId === eventId)?.eventName ??
        activeMembership?.eventName ??
        "Evento";

    useEffect(() => {
        if (!token || !eventId) return;

        setLoading(true);
        setError(null);

        getEventCommittees({ token, eventId })
            .then((data) => setCommittees(data))
            .catch(() =>
                setError("No se pudieron cargar los comités. Intenta de nuevo."),
            )
            .finally(() => setLoading(false));
    }, [token, eventId]);

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <AdminPageHeader
                title="Comités"
                description={`Comités registrados en ${eventName}.`}
                breadcrumb={[
                    { label: "Panel", href: "/admin" },
                    { label: "Eventos", href: "/admin/events" },
                    { label: eventName, href: `/admin/events/${eventId}` },
                    { label: "Comités" },
                ]}
                action={
                    <Link href={`/admin/events/${eventId}/committees/new`}>
                        <AdminButton
                            icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/plus.svg"
                        >
                            Nuevo comité
                        </AdminButton>
                    </Link>
                }
            />

            <div
                className="rounded-2xl overflow-hidden"
                style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    boxShadow: "var(--shadow-sm)",
                }}
            >
                {/* Estado de carga */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <span
                            className="animate-spin rounded-full border-2 border-t-transparent"
                            style={{
                                width: 32,
                                height: 32,
                                borderColor: "var(--text-accent)",
                                borderTopColor: "transparent",
                            }}
                        />
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <AdminEmptyState
                        icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/alert-triangle.svg"
                        title="Error al cargar comités"
                        description={error}
                        action={
                            <AdminButton
                                variant="secondary"
                                onClick={() => {
                                    if (!token) return;
                                    setLoading(true);
                                    setError(null);
                                    getEventCommittees({ token, eventId })
                                        .then(setCommittees)
                                        .catch(() =>
                                            setError(
                                                "No se pudieron cargar los comités.",
                                            ),
                                        )
                                        .finally(() => setLoading(false));
                                }}
                                icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/refresh.svg"
                            >
                                Reintentar
                            </AdminButton>
                        }
                    />
                )}

                {/* Vacío */}
                {!loading && !error && committees.length === 0 && (
                    <AdminEmptyState
                        icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/building.svg"
                        title="No hay comités registrados"
                        description="Crea el primer comité para este evento."
                        action={
                            <Link
                                href={`/admin/events/${eventId}/committees/new`}
                            >
                                <AdminButton
                                    icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/plus.svg"
                                >
                                    Crear comité
                                </AdminButton>
                            </Link>
                        }
                    />
                )}

                {/* Tabla */}
                {!loading && !error && committees.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr
                                    style={{
                                        borderBottom: "1px solid var(--border-color)",
                                    }}
                                >
                                    {["Comité", "Descripción", "Orden", "Estado"].map(
                                        (col, i) => (
                                            <th
                                                key={col}
                                                className={[
                                                    "px-6 py-3 text-xs font-extrabold uppercase tracking-widest font-heading",
                                                    i === 1 ? "hidden md:table-cell" : "",
                                                    i === 2 ? "hidden sm:table-cell text-center" : "",
                                                ].join(" ")}
                                                style={{
                                                    color: "var(--text-muted)",
                                                    backgroundColor:
                                                        "var(--bg-surface-secondary)",
                                                }}
                                            >
                                                {col}
                                            </th>
                                        ),
                                    )}
                                </tr>
                            </thead>
                            <tbody
                                style={{
                                    borderBottom: "1px solid var(--border-color)",
                                }}
                            >
                                {committees.map((committee) => (
                                    <CommitteeRow
                                        key={committee.id}
                                        committee={committee}
                                    />
                                ))}
                            </tbody>
                        </table>

                        {/* Pie de tabla */}
                        <div
                            className="px-6 py-3 flex items-center justify-between"
                            style={{
                                borderTop: "1px solid var(--border-light)",
                                backgroundColor: "var(--bg-surface-secondary)",
                            }}
                        >
                            <p
                                className="text-xs"
                                style={{ color: "var(--text-muted)" }}
                            >
                                {committees.length}{" "}
                                {committees.length === 1 ? "comité" : "comités"}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
