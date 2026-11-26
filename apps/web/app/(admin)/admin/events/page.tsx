"use client";

import { useEffect, useState } from "react";
import { AdminButton } from "../../../../components/admin/AdminButton";
import { AdminEmptyState } from "../../../../components/admin/AdminEmptyState";
import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { AdminStatusBadge } from "../../../../components/admin/AdminStatusBadge";
import { IconAction } from "../../../../components/admin/IconAction";
import {
    listEvents,
    type AdminEvent,
    type AdminEventPagination,
} from "../../../../lib/api/admin";
import { ApiError } from "../../../../lib/api/client";
import { isSuperAdminMembership, useAuthStore } from "../../../../stores/auth.store";
import {
    IconAlertTriangle,
    IconCalendar,
    IconCommittees,
    IconDirectory,
    IconPlus,
    IconRefresh,
    IconSettings,
} from "../../../../components/ui/icons";

const PAGE_SIZE = 10;

const formatDate = (value: string | null) => {
    if (!value) {
        return "—";
    }

    const date = new Date(`${value.slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat("es", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
};

const EventDates = ({
    startDate,
    endDate,
}: {
    startDate: string | null;
    endDate: string | null;
}) => {
    if (!startDate && !endDate) {
        return <span style={{ color: "var(--text-muted)" }}>Sin fechas</span>;
    }

    return (
        <span style={{ color: "var(--text-secondary)" }}>
            {formatDate(startDate)} — {formatDate(endDate)}
        </span>
    );
};

const EventRow = ({ event }: { event: AdminEvent }) => (
    <tr
        className="hover:bg-[var(--bg-hover)]"
        style={{ borderBottom: "1px solid var(--border-light)" }}
    >
        <td className="px-4 py-4 sm:px-6">
            <div className="min-w-0">
                <p
                    className="text-sm font-semibold font-heading truncate"
                    style={{ color: "var(--text-primary)" }}
                >
                    {event.name}
                </p>
                <p
                    className="mt-0.5 text-xs font-body truncate"
                    style={{ color: "var(--text-muted)" }}
                >
                    /{event.slug}
                </p>
            </div>
        </td>

        <td className="px-4 py-4 hidden md:table-cell text-sm whitespace-nowrap">
            <EventDates startDate={event.start_date} endDate={event.end_date} />
        </td>

        <td className="px-4 py-4">
            <AdminStatusBadge status={event.status} />
        </td>

        <td className="px-4 py-4">
            <div className="flex items-center justify-end gap-2">
                <IconAction
                    href={`/admin/events/${event.id}/participants`}
                    label={`Participantes de ${event.name}`}
                    icon={<IconDirectory size={18} />}
                />
                <IconAction
                    href={`/admin/events/${event.id}/committees`}
                    label={`Comités de ${event.name}`}
                    icon={<IconCommittees size={18} />}
                />
                <IconAction
                    href={`/admin/events/${event.id}`}
                    label={`Configurar ${event.name}`}
                    icon={<IconSettings size={18} />}
                />
            </div>
        </td>
    </tr>
);

const LoadingState = () => (
    <div className="flex items-center justify-center py-20">
        <span
            className="animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
            style={{
                width: 32,
                height: 32,
                borderColor: "var(--text-accent)",
                borderTopColor: "transparent",
            }}
        />
    </div>
);

export default function AdminEventsPage() {
    const token = useAuthStore((state) => state.token);
    // Solo el equipo técnico crea eventos; la API responde 403 al resto.
    const canCreateEvent = useAuthStore((state) =>
        state.memberships.some(isSuperAdminMembership),
    );

    const [events, setEvents] = useState<AdminEvent[]>([]);
    const [pagination, setPagination] = useState<AdminEventPagination | null>(null);
    const [page, setPage] = useState(1);
    const [reloadKey, setReloadKey] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            return;
        }

        let cancelled = false;

        setLoading(true);
        setError(null);

        listEvents(token, { page, limit: PAGE_SIZE })
            .then((data) => {
                if (!cancelled) {
                    setEvents(data.events);
                    setPagination(data.pagination);
                }
            })
            .catch((loadError) => {
                if (!cancelled) {
                    setError(
                        loadError instanceof ApiError
                            ? loadError.message
                            : "No se pudieron cargar los eventos.",
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
    }, [page, reloadKey, token]);

    const totalPages = Math.max(1, pagination?.total_pages ?? 1);
    const totalEvents = pagination?.total ?? events.length;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <AdminPageHeader
                title="Eventos"
                breadcrumb={[{ label: "Panel", href: "/admin" }, { label: "Eventos" }]}
                action={
                    canCreateEvent ? (
                        <AdminButton
                            href="/admin/events/new"
                            icon={<IconPlus size={16} />}
                        >
                            Nuevo evento
                        </AdminButton>
                    ) : undefined
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
                {loading && <LoadingState />}

                {!loading && error && (
                    <AdminEmptyState
                        icon={<IconAlertTriangle size={32} />}
                        title="Error al cargar eventos"
                        description={error}
                        action={
                            <AdminButton
                                variant="secondary"
                                onClick={() => setReloadKey((value) => value + 1)}
                                icon={<IconRefresh size={16} />}
                            >
                                Reintentar
                            </AdminButton>
                        }
                    />
                )}

                {!loading && !error && events.length === 0 && (
                    <AdminEmptyState
                        icon={<IconCalendar size={32} />}
                        title="No hay eventos registrados"
                        description={
                            canCreateEvent
                                ? "Crea el primer evento para empezar a configurar comités y participantes."
                                : "Solo el equipo técnico puede crear eventos."
                        }
                        action={
                            canCreateEvent ? (
                                <AdminButton
                                    href="/admin/events/new"
                                    icon={<IconPlus size={16} />}
                                >
                                    Crear primer evento
                                </AdminButton>
                            ) : undefined
                        }
                    />
                )}

                {!loading && !error && events.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full table-fixed text-left border-collapse">
                            <thead>
                                <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                                    {["Evento", "Fechas", "Estado", "Acciones"].map((column, index) => (
                                        <th
                                            key={column}
                                            className={[
                                                "px-4 py-3 text-xs font-bold uppercase tracking-wide font-heading",
                                                index === 0 ? "sm:px-6" : "",
                                                index === 1 ? "hidden md:table-cell w-56" : "",
                                                index === 2 ? "w-28" : "",
                                                index === 3 ? "w-36 sm:w-44 text-right" : "",
                                            ].join(" ")}
                                            style={{
                                                color: "var(--text-muted)",
                                                backgroundColor: "var(--bg-surface-secondary)",
                                            }}
                                        >
                                            {column}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((event) => (
                                    <EventRow key={event.id} event={event} />
                                ))}
                            </tbody>
                        </table>

                        <div
                            className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3"
                            style={{
                                borderTop: "1px solid var(--border-light)",
                                backgroundColor: "var(--bg-surface-secondary)",
                            }}
                        >
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {totalEvents} {totalEvents === 1 ? "evento" : "eventos"}
                            </p>
                            <div className="flex items-center gap-3">
                                <AdminButton
                                    variant="secondary"
                                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                                    disabled={page <= 1}
                                >
                                    Anterior
                                </AdminButton>
                                <span className="text-xs font-semibold font-heading" style={{ color: "var(--text-secondary)" }}>
                                    Página {page} de {totalPages}
                                </span>
                                <AdminButton
                                    variant="secondary"
                                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                                    disabled={page >= totalPages}
                                >
                                    Siguiente
                                </AdminButton>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
