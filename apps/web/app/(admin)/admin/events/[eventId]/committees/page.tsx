"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminButton } from "../../../../../../components/admin/AdminButton";
import { AdminEmptyState } from "../../../../../../components/admin/AdminEmptyState";
import { AdminPageHeader } from "../../../../../../components/admin/AdminPageHeader";
import { AdminStatusBadge } from "../../../../../../components/admin/AdminStatusBadge";
import {
    getEvent,
    listCommittees,
    type AdminCommittee,
} from "../../../../../../lib/api/admin";
import { ApiError } from "../../../../../../lib/api/client";
import { useAuthStore } from "../../../../../../stores/auth.store";

const CommitteeRow = ({
    committee,
    eventId,
}: {
    committee: AdminCommittee;
    eventId: string;
}) => (
    <tr
        className="transition-colors hover:bg-[var(--bg-hover)]"
        style={{ borderBottom: "1px solid var(--border-light)" }}
    >
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

        <td className="px-6 py-4 hidden md:table-cell">
            <span
                className="text-sm line-clamp-1"
                style={{ color: "var(--text-secondary)" }}
            >
                {committee.description ?? "—"}
            </span>
        </td>

        <td className="px-6 py-4 hidden sm:table-cell text-center">
            <span
                className="text-sm tabular-nums"
                style={{ color: "var(--text-muted)" }}
            >
                {committee.sort_order}
            </span>
        </td>

        <td className="px-6 py-4">
            <AdminStatusBadge status={committee.status} />
        </td>

        <td className="px-6 py-4">
            <div className="flex justify-end">
                <Link
                    href={`/admin/events/${eventId}/committees/${committee.id}/edit`}
                    className="text-xs font-semibold font-heading transition-opacity hover:opacity-70"
                    style={{ color: "var(--text-accent)" }}
                >
                    Editar
                </Link>
            </div>
        </td>
    </tr>
);

export default function CommitteesPage() {
    const params = useParams<{ eventId: string }>();
    const eventId = params?.eventId ?? "";

    const token = useAuthStore((state) => state.token);
    const memberships = useAuthStore((state) => state.memberships);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const membershipEventName =
        memberships.find((membership) => membership.eventId === eventId)?.eventName ??
        memberships.find((membership) => membership.id === activeMembershipId)?.eventName;

    const [eventName, setEventName] = useState(membershipEventName ?? "Evento");
    const [committees, setCommittees] = useState<AdminCommittee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;

        getEvent(token, eventId)
            .then((data) => {
                if (!cancelled) {
                    setEventName(data.event.name);
                }
            })
            .catch(() => {
                // Si falla, se mantiene el nombre de la membresía o "Evento".
            });

        return () => {
            cancelled = true;
        };
    }, [eventId, token]);

    useEffect(() => {
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;

        setLoading(true);
        setError(null);

        listCommittees(token, eventId)
            .then((data) => {
                if (!cancelled) {
                    setCommittees(data);
                }
            })
            .catch((loadError) => {
                if (!cancelled) {
                    setError(
                        loadError instanceof ApiError
                            ? loadError.message
                            : "No se pudieron cargar los comités. Intenta de nuevo.",
                    );
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [eventId, reloadKey, token]);

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

                {!loading && error && (
                    <AdminEmptyState
                        icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/alert-triangle.svg"
                        title="Error al cargar comités"
                        description={error}
                        action={
                            <AdminButton
                                variant="secondary"
                                onClick={() => setReloadKey((value) => value + 1)}
                                icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/refresh.svg"
                            >
                                Reintentar
                            </AdminButton>
                        }
                    />
                )}

                {!loading && !error && committees.length === 0 && (
                    <AdminEmptyState
                        icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/building.svg"
                        title="No hay comités registrados"
                        description="Crea el primer comité para este evento."
                        action={
                            <Link href={`/admin/events/${eventId}/committees/new`}>
                                <AdminButton
                                    icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/plus.svg"
                                >
                                    Crear comité
                                </AdminButton>
                            </Link>
                        }
                    />
                )}

                {!loading && !error && committees.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                                    {["Comité", "Descripción", "Orden", "Estado", ""].map(
                                        (column, index) => (
                                            <th
                                                key={column || index}
                                                className={[
                                                    "px-6 py-3 text-xs font-extrabold uppercase tracking-widest font-heading",
                                                    index === 1 ? "hidden md:table-cell" : "",
                                                    index === 2 ? "hidden sm:table-cell text-center" : "",
                                                    index === 4 ? "text-right" : "",
                                                ].join(" ")}
                                                style={{
                                                    color: "var(--text-muted)",
                                                    backgroundColor: "var(--bg-surface-secondary)",
                                                }}
                                            >
                                                {column || "Acciones"}
                                            </th>
                                        ),
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {committees.map((committee) => (
                                    <CommitteeRow
                                        key={committee.id}
                                        committee={committee}
                                        eventId={eventId}
                                    />
                                ))}
                            </tbody>
                        </table>

                        <div
                            className="px-6 py-3 flex items-center justify-between"
                            style={{
                                borderTop: "1px solid var(--border-light)",
                                backgroundColor: "var(--bg-surface-secondary)",
                            }}
                        >
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
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
