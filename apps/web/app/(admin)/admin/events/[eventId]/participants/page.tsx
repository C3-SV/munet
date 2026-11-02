"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminButton } from "../../../../../../components/admin/AdminButton";
import { AdminEmptyState } from "../../../../../../components/admin/AdminEmptyState";
import { AdminFormInput } from "../../../../../../components/admin/AdminFormInput";
import { AdminFormSelect } from "../../../../../../components/admin/AdminFormSelect";
import { AdminPageHeader } from "../../../../../../components/admin/AdminPageHeader";
import { AdminStatusBadge } from "../../../../../../components/admin/AdminStatusBadge";
import {
    getEvent,
    listCommittees,
    type AdminCommittee,
} from "../../../../../../lib/api/admin";
import { ApiError } from "../../../../../../lib/api/client";
import {
    listParticipants,
    type AdminParticipant,
    type AdminParticipantPagination,
    type ParticipantAccountStatus,
} from "../../../../../../lib/api/participants";
import { useAuthStore } from "../../../../../../stores/auth.store";

const PAGE_SIZE = 10;

type ParticipantFilters = {
    committeeId: string;
    role: string;
    status: "" | ParticipantAccountStatus;
};

const EMPTY_FILTERS: ParticipantFilters = {
    committeeId: "",
    role: "",
    status: "",
};

const STATUS_OPTIONS = [
    { value: "", label: "Todos los estados" },
    { value: "ACTIVE", label: "Activo" },
    { value: "PENDING_ACTIVATION", label: "Pendiente de activación" },
    { value: "SUSPENDED", label: "Suspendido" },
];

const getParticipantName = (participant: AdminParticipant) => {
    const profile = participant.profile;

    if (profile?.display_name?.trim()) {
        return profile.display_name.trim();
    }

    const fullName = [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || "Sin perfil";
};

const ParticipantRow = ({
    participant,
    committee,
    eventId,
}: {
    participant: AdminParticipant;
    committee?: AdminCommittee;
    eventId: string;
}) => (
    <tr
        className="transition-colors hover:bg-[var(--bg-hover)]"
        style={{ borderBottom: "1px solid var(--border-light)" }}
    >
        <td className="px-6 py-4">
            <span
                className="inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold font-heading"
                style={{
                    backgroundColor:
                        "color-mix(in srgb, var(--text-accent) 12%, transparent)",
                    color: "var(--text-accent)",
                }}
            >
                {participant.participant_code}
            </span>
        </td>

        <td className="px-6 py-4">
            <p
                className="text-sm font-semibold font-heading"
                style={{ color: "var(--text-primary)" }}
            >
                {getParticipantName(participant)}
            </p>
        </td>

        <td className="px-6 py-4 hidden md:table-cell">
            {committee ? (
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span className="font-semibold">{committee.code}</span>
                    {" — "}
                    {committee.name}
                </span>
            ) : participant.committee_id ? (
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Comité no disponible
                </span>
            ) : (
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    —
                </span>
            )}
        </td>

        <td className="px-6 py-4 hidden sm:table-cell">
            <span
                className="text-xs font-semibold font-heading uppercase tracking-wide"
                style={{ color: "var(--text-secondary)" }}
            >
                {participant.role}
            </span>
        </td>

        <td className="px-6 py-4">
            <AdminStatusBadge status={participant.account_status} />
        </td>

        <td className="px-6 py-4">
            <div className="flex justify-end">
                <Link
                    href={`/admin/events/${eventId}/participants/${participant.id}`}
                    className="text-xs font-semibold font-heading transition-opacity hover:opacity-70"
                    style={{ color: "var(--text-accent)" }}
                >
                    Gestionar
                </Link>
            </div>
        </td>
    </tr>
);

const LoadingState = () => (
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
);

export default function EventParticipantsPage() {
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
    const [participants, setParticipants] = useState<AdminParticipant[]>([]);
    const [pagination, setPagination] =
        useState<AdminParticipantPagination | null>(null);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<ParticipantFilters>(EMPTY_FILTERS);
    const [appliedFilters, setAppliedFilters] =
        useState<ParticipantFilters>(EMPTY_FILTERS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const committeeById = useMemo(
        () => new Map(committees.map((committee) => [committee.id, committee])),
        [committees],
    );

    const hasSelectedFilters = Boolean(
        filters.committeeId || filters.role.trim() || filters.status,
    );

    const hasAppliedFilters = Boolean(
        appliedFilters.committeeId ||
            appliedFilters.role.trim() ||
            appliedFilters.status,
    );

    const committeeOptions = [
        { value: "", label: "Todos los comités" },
        ...committees.map((committee) => ({
            value: committee.id,
            label: `${committee.code} — ${committee.name}`,
        })),
    ];

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

        listCommittees(token, eventId)
            .then((data) => {
                if (!cancelled) {
                    setCommittees(data);
                }
            })
            .catch(() => {
                // Sin comités disponibles, la tabla muestra el respaldo.
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

        listParticipants(token, {
            eventId,
            page,
            limit: PAGE_SIZE,
            committeeId: appliedFilters.committeeId || undefined,
            role: appliedFilters.role || undefined,
            status: appliedFilters.status || undefined,
        })
            .then((data) => {
                if (!cancelled) {
                    setParticipants(data.participants);
                    setPagination(data.pagination);
                }
            })
            .catch((loadError) => {
                if (!cancelled) {
                    setError(
                        loadError instanceof ApiError
                            ? loadError.message
                            : "No se pudieron cargar los participantes. Intenta de nuevo.",
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
    }, [appliedFilters, eventId, page, reloadKey, token]);

    const updateFilter = <K extends keyof ParticipantFilters>(
        field: K,
        value: ParticipantFilters[K],
    ) => {
        setFilters((previous) => ({ ...previous, [field]: value }));
    };

    const handleApplyFilters = (event: React.FormEvent) => {
        event.preventDefault();
        setPage(1);
        setAppliedFilters({ ...filters });
    };

    const handleClearFilters = () => {
        setFilters(EMPTY_FILTERS);
        setAppliedFilters(EMPTY_FILTERS);
        setPage(1);
    };

    const totalPages = Math.max(1, pagination?.total_pages ?? 1);
    const totalParticipants = pagination?.total ?? participants.length;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <AdminPageHeader
                title="Participantes"
                description={`Participantes registrados en ${eventName}.`}
                breadcrumb={[
                    { label: "Panel", href: "/admin" },
                    { label: "Eventos", href: "/admin/events" },
                    { label: eventName, href: `/admin/events/${eventId}` },
                    { label: "Participantes" },
                ]}
                action={
                    <Link href={`/admin/events/${eventId}/participants/new`}>
                        <AdminButton
                            icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/plus.svg"
                        >
                            Nuevo participante
                        </AdminButton>
                    </Link>
                }
            />

            <form
                onSubmit={handleApplyFilters}
                className="rounded-2xl p-4 sm:p-5 space-y-4"
                style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    boxShadow: "var(--shadow-sm)",
                }}
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <AdminFormSelect
                        id="participant-filter-committee"
                        label="Comité"
                        value={filters.committeeId}
                        onChange={(event) =>
                            updateFilter("committeeId", event.target.value)
                        }
                        options={committeeOptions}
                        disabled={committees.length === 0}
                    />
                    <AdminFormInput
                        id="participant-filter-role"
                        label="Rol"
                        placeholder="Ej: DELEGADO"
                        value={filters.role}
                        onChange={(event) =>
                            updateFilter(
                                "role",
                                event.target.value.toUpperCase(),
                            )
                        }
                    />
                    <AdminFormSelect
                        id="participant-filter-status"
                        label="Estado"
                        value={filters.status}
                        onChange={(event) =>
                            updateFilter(
                                "status",
                                event.target.value as ParticipantFilters["status"],
                            )
                        }
                        options={STATUS_OPTIONS}
                    />
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-3">
                    {(hasSelectedFilters || hasAppliedFilters) && (
                        <AdminButton
                            type="button"
                            variant="secondary"
                            onClick={handleClearFilters}
                            icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/refresh.svg"
                        >
                            Limpiar filtros
                        </AdminButton>
                    )}
                    <AdminButton
                        type="submit"
                        icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/filter.svg"
                    >
                        Filtrar
                    </AdminButton>
                </div>
            </form>

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
                        icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/alert-triangle.svg"
                        title="Error al cargar participantes"
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

                {!loading && !error && participants.length === 0 && (
                    <AdminEmptyState
                        icon={
                            hasAppliedFilters
                                ? "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/search.svg"
                                : "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/users.svg"
                        }
                        title={
                            hasAppliedFilters
                                ? "Sin resultados"
                                : "No hay participantes registrados"
                        }
                        description={
                            hasAppliedFilters
                                ? "No se encontraron participantes con los filtros seleccionados."
                                : "Registra el primer participante para este evento."
                        }
                        action={
                            hasAppliedFilters ? (
                                <AdminButton
                                    variant="secondary"
                                    onClick={handleClearFilters}
                                    icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/refresh.svg"
                                >
                                    Limpiar filtros
                                </AdminButton>
                            ) : (
                                <Link
                                    href={`/admin/events/${eventId}/participants/new`}
                                >
                                    <AdminButton
                                        icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/plus.svg"
                                    >
                                        Registrar participante
                                    </AdminButton>
                                </Link>
                            )
                        }
                    />
                )}

                {!loading && !error && participants.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr
                                    style={{
                                        borderBottom:
                                            "1px solid var(--border-color)",
                                    }}
                                >
                                    {[
                                        "Código",
                                        "Participante",
                                        "Comité",
                                        "Rol",
                                        "Estado",
                                        "Acciones",
                                    ].map((column, index) => (
                                        <th
                                            key={column}
                                            className={[
                                                "px-6 py-3 text-xs font-extrabold uppercase tracking-widest font-heading",
                                                index === 2
                                                    ? "hidden md:table-cell"
                                                    : "",
                                                index === 3
                                                    ? "hidden sm:table-cell"
                                                    : "",
                                                index === 5 ? "text-right" : "",
                                            ].join(" ")}
                                            style={{
                                                color: "var(--text-muted)",
                                                backgroundColor:
                                                    "var(--bg-surface-secondary)",
                                            }}
                                        >
                                            {column}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {participants.map((participant) => (
                                    <ParticipantRow
                                        key={participant.id}
                                        participant={participant}
                                        committee={
                                            participant.committee_id
                                                ? committeeById.get(
                                                      participant.committee_id,
                                                  )
                                                : undefined
                                        }
                                        eventId={eventId}
                                    />
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
                            <p
                                className="text-xs"
                                style={{ color: "var(--text-muted)" }}
                            >
                                {totalParticipants}{" "}
                                {totalParticipants === 1
                                    ? "participante"
                                    : "participantes"}
                            </p>
                            <div className="flex items-center gap-3">
                                <AdminButton
                                    variant="secondary"
                                    onClick={() =>
                                        setPage((value) =>
                                            Math.max(1, value - 1),
                                        )
                                    }
                                    disabled={page <= 1}
                                >
                                    Anterior
                                </AdminButton>
                                <span
                                    className="text-xs font-semibold font-heading"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    Página {page} de {totalPages}
                                </span>
                                <AdminButton
                                    variant="secondary"
                                    onClick={() =>
                                        setPage((value) =>
                                            Math.min(totalPages, value + 1),
                                        )
                                    }
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
