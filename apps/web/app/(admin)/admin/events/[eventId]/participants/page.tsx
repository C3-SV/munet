"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminButton } from "../../../../../../components/admin/AdminButton";
import { AdminChangeCommitteeDialog } from "../../../../../../components/admin/AdminChangeCommitteeDialog";
import { AdminReasonDialog } from "../../../../../../components/admin/AdminReasonDialog";
import { AdminConfirmDialog } from "../../../../../../components/admin/AdminConfirmDialog";
import {
    AdminCredentialsDialog,
    type AdminCredentialField,
} from "../../../../../../components/admin/AdminCredentialsDialog";
import { AdminEmptyState } from "../../../../../../components/admin/AdminEmptyState";
import { AdminFormInput } from "../../../../../../components/admin/AdminFormInput";
import { AdminFormSelect } from "../../../../../../components/admin/AdminFormSelect";
import { AdminPageHeader } from "../../../../../../components/admin/AdminPageHeader";
import { AdminStatusBadge } from "../../../../../../components/admin/AdminStatusBadge";
import { AdminToast } from "../../../../../../components/admin/AdminToast";
import { IconAction } from "../../../../../../components/admin/IconAction";
import {
    getEvent,
    listCommittees,
    type AdminCommittee,
} from "../../../../../../lib/api/admin";
import { ApiError } from "../../../../../../lib/api/client";
import {
    changeParticipantCommittee,
    changeParticipantRole,
    listParticipants,
    reactivateParticipant,
    resetParticipantPassword,
    suspendParticipant,
    type AdminParticipant,
    type AdminParticipantPagination,
    type ParticipantAccountStatus,
} from "../../../../../../lib/api/participants";
import { formatRoleLabel, PARTICIPANT_ROLES } from "../../../../../../lib/role-label";
import { isAdminRole, useAuthStore } from "../../../../../../stores/auth.store";
import {
    IconAlertTriangle,
    IconCommittees,
    IconDirectory,
    IconKey,
    IconPlus,
    IconRefresh,
    IconSearch,
    IconSettings,
    IconShield,
    IconUpload,
    IconUserCheck,
    IconUserOff,
} from "../../../../../../components/ui/icons";

const PAGE_SIZE = 10;

type ParticipantFilters = {
    committeeId: string;
    role: string;
    status: "" | ParticipantAccountStatus;
};

type ActionType =
    | "committee"
    | "reset-password"
    | "suspend"
    | "reactivate"
    | "make-moderator"
    | "remove-moderator";

type CredentialsState = {
    title: string;
    description?: string;
    fields: AdminCredentialField[];
    warnings?: string[];
};

type ToastState = {
    type: "success" | "error";
    message: string;
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

const getFullName = (participant: AdminParticipant, fallback = "Sin perfil") => {
    const profile = participant.profile;
    const fullName = [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || profile?.display_name?.trim() || fallback;
};

const getActionErrorMessage = (failure: unknown) => {
    if (failure instanceof ApiError) {
        return failure.status === 403
            ? "No tienes permisos para administrar este evento."
            : failure.message;
    }

    return "No se pudo completar la acción. Intenta de nuevo.";
};

const ParticipantRow = ({
    participant,
    committee,
    eventId,
    committeesLoading,
    onAction,
}: {
    participant: AdminParticipant;
    committee?: AdminCommittee;
    eventId: string;
    committeesLoading: boolean;
    onAction: (participant: AdminParticipant, action: ActionType) => void;
}) => {
    const fullName = getFullName(participant);
    const displayName = participant.profile?.display_name?.trim();
    const alias = participant.profile?.alias?.trim();
    const isSuspended = participant.account_status === "SUSPENDED";

    const isModerator = participant.role.trim().toUpperCase() === "MODERATOR";

    return (
        <tr
            className="hover:bg-[var(--bg-hover)]"
            style={{ borderBottom: "1px solid var(--border-light)" }}
        >
            <td className="px-6 py-4">
                <div className="min-w-0">
                    <Link
                        href={`/admin/events/${eventId}/participants/${participant.id}`}
                        className="text-sm font-semibold font-heading hover:underline"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {fullName}
                    </Link>
                    {displayName && displayName !== fullName && (
                        <p
                            className="mt-0.5 text-xs truncate"
                            style={{ color: "var(--text-muted)" }}
                        >
                            {displayName}
                        </p>
                    )}
                    {alias && (
                        <p
                            className="mt-0.5 text-xs truncate"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            Alias: {alias}
                        </p>
                    )}
                </div>
            </td>

            <td className="px-6 py-4">
                {participant.delegation_code ? (
                    <span
                        className="inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold font-heading"
                        style={{
                            backgroundColor:
                                "color-mix(in srgb, var(--warning) 12%, transparent)",
                            color: "var(--warning)",
                        }}
                    >
                        {participant.delegation_code}
                    </span>
                ) : (
                    <span
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                    >
                        Sin código
                    </span>
                )}
            </td>

            <td className="px-6 py-4 hidden sm:table-cell">
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

            <td className="px-6 py-4 hidden lg:table-cell">
                {committee ? (
                    <span
                        className="text-sm"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        <span className="font-semibold">{committee.code}</span>
                        {" — "}
                        {committee.name}
                    </span>
                ) : participant.committee_id ? (
                    <span
                        className="text-sm"
                        style={{ color: "var(--text-muted)" }}
                    >
                        Comité no disponible
                    </span>
                ) : (
                    <span
                        className="text-sm"
                        style={{ color: "var(--text-muted)" }}
                    >
                        —
                    </span>
                )}
            </td>

            <td className="px-6 py-4 hidden xl:table-cell">
                <span
                    className="text-xs font-semibold font-heading"
                    style={{ color: "var(--text-secondary)" }}
                >
                    {formatRoleLabel(participant.role)}
                </span>
            </td>

            <td className="px-6 py-4">
                <AdminStatusBadge status={participant.account_status} />
            </td>

            <td className="px-6 py-4">
                <div className="flex items-center justify-end gap-2">
                    <IconAction
                        href={`/admin/events/${eventId}/participants/${participant.id}`}
                        label={`Gestionar a ${fullName}`}
                        icon={<IconSettings size={18} />}
                    />
                    {!committeesLoading && (
                        <IconAction
                            label={`Cambiar comité de ${fullName}`}
                            icon={<IconCommittees size={18} />}
                            onClick={() => onAction(participant, "committee")}
                        />
                    )}
                    {!isSuspended && (
                        <IconAction
                            label={`Reiniciar contraseña de ${fullName}`}
                            icon={<IconKey size={18} />}
                            onClick={() => onAction(participant, "reset-password")}
                        />
                    )}
                    {!isAdminRole(participant.role) && (
                        <IconAction
                            label={
                                isModerator
                                    ? `Quitar moderador a ${fullName}`
                                    : `Hacer moderador a ${fullName}`
                            }
                            icon={<IconShield size={18} />}
                            onClick={() =>
                                onAction(participant, isModerator ? "remove-moderator" : "make-moderator")
                            }
                        />
                    )}
                    {isSuspended ? (
                        <IconAction
                            label={`Reactivar cuenta de ${fullName}`}
                            icon={<IconUserCheck size={18} />}
                            onClick={() => onAction(participant, "reactivate")}
                        />
                    ) : (
                        <IconAction
                            label={`Suspender cuenta de ${fullName}`}
                            icon={<IconUserOff size={18} />}
                            tone="danger"
                            onClick={() => onAction(participant, "suspend")}
                        />
                    )}
                </div>
            </td>
        </tr>
    );
};

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
    const [committeesLoading, setCommitteesLoading] = useState(true);
    const [participants, setParticipants] = useState<AdminParticipant[]>([]);
    const [pagination, setPagination] =
        useState<AdminParticipantPagination | null>(null);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [filters, setFilters] = useState<ParticipantFilters>(EMPTY_FILTERS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const [actionParticipant, setActionParticipant] =
        useState<AdminParticipant | null>(null);
    const [actionType, setActionType] = useState<ActionType | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [credentials, setCredentials] = useState<CredentialsState | null>(
        null,
    );
    const [toast, setToast] = useState<ToastState | null>(null);
    const [roleBlocked, setRoleBlocked] = useState(false);

    const committeeById = useMemo(
        () => new Map(committees.map((committee) => [committee.id, committee])),
        [committees],
    );

    const hasActiveFilters = Boolean(
        search.trim() ||
            filters.committeeId ||
            filters.role.trim() ||
            filters.status,
    );

    const roleOptions = [
        { value: "", label: "Todos los roles" },
        ...PARTICIPANT_ROLES.map((role) => ({ value: role, label: formatRoleLabel(role) })),
    ];

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

        setCommitteesLoading(true);

        listCommittees(token, eventId)
            .then((data) => {
                if (!cancelled) {
                    setCommittees(data);
                }
            })
            .catch(() => {
                // Sin comités disponibles, la tabla muestra el respaldo.
            })
            .finally(() => {
                if (!cancelled) {
                    setCommitteesLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [eventId, token]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 300);

        return () => {
            window.clearTimeout(timer);
        };
    }, [search]);

    useEffect(() => {
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;

        setLoading(true);
        setError(null);

        listParticipants(token, {
            eventId,
            q: debouncedSearch || undefined,
            page,
            limit: PAGE_SIZE,
            committeeId: filters.committeeId || undefined,
            role: filters.role || undefined,
            status: filters.status || undefined,
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
                            ? getActionErrorMessage(loadError)
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
    }, [
        debouncedSearch,
        eventId,
        filters.committeeId,
        filters.role,
        filters.status,
        page,
        reloadKey,
        token,
    ]);

    const updateFilter = <K extends keyof ParticipantFilters>(
        field: K,
        value: ParticipantFilters[K],
    ) => {
        setFilters((previous) => ({ ...previous, [field]: value }));
        setPage(1);
    };

    const handleClearFilters = () => {
        setSearch("");
        setDebouncedSearch("");
        setFilters(EMPTY_FILTERS);
        setPage(1);
    };

    const refreshParticipants = () => {
        setReloadKey((value) => value + 1);
    };

    const openAction = (
        participant: AdminParticipant,
        action: ActionType,
    ) => {
        setActionParticipant(participant);
        setActionType(action);
        setActionError(null);
    };

    const closeActionDialog = () => {
        if (actionLoading) {
            return;
        }

        setActionParticipant(null);
        setActionType(null);
        setActionError(null);
    };

    const handleConfirmLifecycleAction = async (reason: string) => {
        if (
            !token ||
            !actionParticipant ||
            (actionType !== "suspend" && actionType !== "reactivate")
        ) {
            return;
        }

        setActionLoading(true);
        setActionError(null);

        try {
            const response =
                actionType === "suspend"
                    ? await suspendParticipant(
                          token,
                          actionParticipant.id,
                          reason,
                      )
                    : await reactivateParticipant(
                          token,
                          actionParticipant.id,
                          reason,
                      );

            setToast({ type: "success", message: response.message });
            setActionParticipant(null);
            setActionType(null);
            refreshParticipants();
        } catch (actionFailure) {
            setActionError(getActionErrorMessage(actionFailure));
        } finally {
            setActionLoading(false);
        }
    };

    const handleChangeRole = async (reason: string) => {
        if (
            !token ||
            !actionParticipant ||
            (actionType !== "make-moderator" && actionType !== "remove-moderator")
        ) {
            return;
        }

        setActionLoading(true);
        setActionError(null);

        try {
            const response = await changeParticipantRole(
                token,
                actionParticipant.id,
                actionType === "make-moderator" ? "MODERATOR" : "PARTICIPANT",
                reason || undefined,
            );

            setToast({ type: "success", message: response.message });
            setActionParticipant(null);
            setActionType(null);
            refreshParticipants();
        } catch (actionFailure) {
            setActionError(getActionErrorMessage(actionFailure));

            // Ante un 429 se bloquea el botón unos segundos; no se reintenta solo.
            if (actionFailure instanceof ApiError && actionFailure.status === 429) {
                setRoleBlocked(true);
                window.setTimeout(() => setRoleBlocked(false), 5000);
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!token || !actionParticipant) {
            return;
        }

        setActionLoading(true);
        setActionError(null);

        try {
            const response = await resetParticipantPassword(
                token,
                actionParticipant.id,
            );

            setCredentials({
                title: "Contraseña temporal generada",
                description: `Comparte esta contraseña con ${getFullName(
                    actionParticipant,
                    "el participante",
                )}.`,
                fields: [
                    {
                        key: "password",
                        label: "Contraseña temporal",
                        value: response.temporary_password,
                    },
                ],
            });
            setToast({ type: "success", message: response.message });
            setActionParticipant(null);
            setActionType(null);
            refreshParticipants();
        } catch (actionFailure) {
            setActionError(getActionErrorMessage(actionFailure));
        } finally {
            setActionLoading(false);
        }
    };

    const handleChangeCommittee = async (
        committeeId: string | null,
        reason: string,
    ) => {
        if (!token || !actionParticipant) {
            return;
        }

        setActionLoading(true);
        setActionError(null);

        try {
            const response = await changeParticipantCommittee(
                token,
                actionParticipant.id,
                committeeId,
                reason || undefined,
            );

            setToast({ type: "success", message: response.message });
            setActionParticipant(null);
            setActionType(null);
            refreshParticipants();
        } catch (actionFailure) {
            setActionError(getActionErrorMessage(actionFailure));
        } finally {
            setActionLoading(false);
        }
    };

    const totalPages = Math.max(1, pagination?.total_pages ?? 1);
    const totalParticipants = pagination?.total ?? participants.length;
    const actionParticipantName = actionParticipant
        ? getFullName(actionParticipant, "el participante")
        : "el participante";

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <AdminPageHeader
                title="Participantes"
                breadcrumb={[
                    { label: "Panel", href: "/admin" },
                    { label: "Eventos", href: "/admin/events" },
                    { label: eventName, href: `/admin/events/${eventId}` },
                    { label: "Participantes" },
                ]}
                action={
                    <div className="flex flex-wrap items-center gap-2">
                        <AdminButton
                            href={`/admin/events/${eventId}/participants/import`}
                            variant="secondary"
                            icon={<IconUpload size={16} />}
                        >
                            Importar CSV
                        </AdminButton>
                        <AdminButton
                            href={`/admin/events/${eventId}/participants/new`}
                            icon={<IconPlus size={16} />}
                        >
                            Nuevo participante
                        </AdminButton>
                    </div>
                }
            />

            <div
                role="search"
                aria-label="Filtrar participantes"
                className="rounded-2xl p-4 sm:p-5 space-y-4"
                style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    boxShadow: "var(--shadow-sm)",
                }}
            >
                <AdminFormInput
                    id="participant-search"
                    label="Buscar participante"
                    placeholder="Nombre, alias, código de login o #"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    hint="La búsqueda se aplica automáticamente."
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <AdminFormSelect
                        id="participant-filter-committee"
                        label="Comité"
                        value={filters.committeeId}
                        onChange={(event) =>
                            updateFilter("committeeId", event.target.value)
                        }
                        options={committeeOptions}
                        disabled={committeesLoading || committees.length === 0}
                    />
                    <AdminFormSelect
                        id="participant-filter-role"
                        label="Rol"
                        value={filters.role}
                        onChange={(event) =>
                            updateFilter("role", event.target.value)
                        }
                        options={roleOptions}
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

                {hasActiveFilters && (
                    <div className="flex justify-end">
                        <AdminButton
                            type="button"
                            variant="secondary"
                            onClick={handleClearFilters}
                            icon={<IconRefresh size={16} />}
                        >
                            Limpiar filtros
                        </AdminButton>
                    </div>
                )}
            </div>

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
                        title="Error al cargar participantes"
                        description={error}
                        action={
                            <AdminButton
                                variant="secondary"
                                onClick={refreshParticipants}
                                icon={<IconRefresh size={16} />}
                            >
                                Reintentar
                            </AdminButton>
                        }
                    />
                )}

                {!loading && !error && participants.length === 0 && (
                    <AdminEmptyState
                        icon={
                            hasActiveFilters
                                ? <IconSearch size={32} />
                                : <IconDirectory size={32} />
                        }
                        title={
                            hasActiveFilters
                                ? "Sin resultados"
                                : "No hay participantes registrados"
                        }
                        description={
                            hasActiveFilters
                                ? "No se encontraron participantes con la búsqueda o los filtros seleccionados."
                                : "Registra el primer participante para este evento."
                        }
                        action={
                            hasActiveFilters ? (
                                <AdminButton
                                    variant="secondary"
                                    onClick={handleClearFilters}
                                    icon={<IconRefresh size={16} />}
                                >
                                    Limpiar filtros
                                </AdminButton>
                            ) : (
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                    <AdminButton
                                        href={`/admin/events/${eventId}/participants/import`}
                                        variant="secondary"
                                        icon={<IconUpload size={16} />}
                                    >
                                        Importar CSV
                                    </AdminButton>
                                    <AdminButton
                                        href={`/admin/events/${eventId}/participants/new`}
                                        icon={<IconPlus size={16} />}
                                    >
                                        Registrar participante
                                    </AdminButton>
                                </div>
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
                                        { label: "Nombre completo", className: "" },
                                        { label: "Código #", className: "" },
                                        { label: "Código de login", className: "hidden sm:table-cell" },
                                        { label: "Comité", className: "hidden lg:table-cell" },
                                        { label: "Rol", className: "hidden xl:table-cell" },
                                        { label: "Estado", className: "" },
                                        { label: "Acciones", className: "text-right" },
                                    ].map((column) => (
                                        <th
                                            key={column.label}
                                            className={[
                                                "px-6 py-3 text-xs font-bold uppercase tracking-wide font-heading",
                                                column.className,
                                            ].join(" ")}
                                            style={{
                                                color: "var(--text-muted)",
                                                backgroundColor:
                                                    "var(--bg-surface-secondary)",
                                            }}
                                        >
                                            {column.label}
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
                                        committeesLoading={committeesLoading}
                                        onAction={openAction}
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

            {actionType === "committee" && actionParticipant && (
                <AdminChangeCommitteeDialog
                    participantName={actionParticipantName}
                    currentCommitteeId={actionParticipant.committee_id}
                    committees={committees}
                    loading={actionLoading}
                    error={actionError}
                    onCancel={closeActionDialog}
                    onConfirm={handleChangeCommittee}
                />
            )}

            {(actionType === "suspend" || actionType === "reactivate") &&
                actionParticipant && (
                    <AdminConfirmDialog
                        key={actionType}
                        title={
                            actionType === "suspend"
                                ? "Suspender cuenta"
                                : "Reactivar cuenta"
                        }
                        description={
                            actionType === "suspend"
                                ? `La cuenta de ${actionParticipantName} dejará de operar hasta que se reactive. Indica el motivo.`
                                : `La cuenta de ${actionParticipantName} volverá a estar activa. Indica el motivo.`
                        }
                        confirmLabel={
                            actionType === "suspend"
                                ? "Suspender cuenta"
                                : "Reactivar cuenta"
                        }
                        variant={
                            actionType === "suspend" ? "danger" : "primary"
                        }
                        requireReason
                        reasonLabel={
                            actionType === "suspend"
                                ? "Motivo de la suspensión"
                                : "Motivo de la reactivación"
                        }
                        loading={actionLoading}
                        error={actionError}
                        onCancel={closeActionDialog}
                        onConfirm={handleConfirmLifecycleAction}
                    />
                )}

            {actionType === "reset-password" && actionParticipant && (
                <AdminConfirmDialog
                    title="Restablecer contraseña"
                    description={`Se generará una contraseña temporal para ${actionParticipantName}. La contraseña actual dejará de funcionar.`}
                    confirmLabel="Restablecer contraseña"
                    loading={actionLoading}
                    error={actionError}
                    onCancel={closeActionDialog}
                    onConfirm={handleResetPassword}
                />
            )}

            {(actionType === "make-moderator" || actionType === "remove-moderator") &&
                actionParticipant && (
                    <AdminReasonDialog
                        key={actionType}
                        title={
                            actionType === "make-moderator"
                                ? "¿Hacer moderador a este participante?"
                                : "¿Quitar el rol de moderador?"
                        }
                        description={
                            actionType === "make-moderator"
                                ? `${actionParticipantName} podrá ver y moderar todos los muros del evento, eliminar y fijar publicaciones. No podrá crear cuentas ni editar el evento.`
                                : `${actionParticipantName} volverá a ser participante y perderá el acceso a Moderación.`
                        }
                        confirmLabel={
                            actionType === "make-moderator"
                                ? "Hacer moderador"
                                : "Quitar moderador"
                        }
                        required={false}
                        reasonLabel="Motivo (opcional)"
                        loading={actionLoading}
                        error={actionError}
                        confirmDisabled={roleBlocked}
                        onCancel={closeActionDialog}
                        onConfirm={handleChangeRole}
                    />
                )}

            {credentials && (
                <AdminCredentialsDialog
                    title={credentials.title}
                    description={credentials.description}
                    fields={credentials.fields}
                    warnings={credentials.warnings}
                    note="Guarda esta información ahora. No se volverá a mostrar."
                    onClose={() => setCredentials(null)}
                />
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
