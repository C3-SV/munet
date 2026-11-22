"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminAlertBanner } from "../../../../components/admin/AdminAlertBanner";
import {
    AdminBulkCommitteeDialog,
    type BulkDialogItem,
} from "../../../../components/admin/AdminBulkCommitteeDialog";
import { AdminButton } from "../../../../components/admin/AdminButton";
import { AdminEmptyState } from "../../../../components/admin/AdminEmptyState";
import { AdminFormInput } from "../../../../components/admin/AdminFormInput";
import { AdminFormSelect } from "../../../../components/admin/AdminFormSelect";
import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { AdminStatusBadge } from "../../../../components/admin/AdminStatusBadge";
import { AdminToast } from "../../../../components/admin/AdminToast";
import {
    IconAlertTriangle,
    IconBuilding,
    IconCalendar,
    IconDirectory,
    IconRefresh,
    IconSearch,
} from "../../../../components/ui/icons";
import {
    listCommittees,
    listEvents,
    type AdminCommittee,
    type AdminEvent,
} from "../../../../lib/api/admin";
import { ApiError } from "../../../../lib/api/client";
import {
    changeParticipantCommittee,
    listParticipants,
    type AdminParticipant,
    type ParticipantAccountStatus,
} from "../../../../lib/api/participants";
import {
    failedIds,
    planCommitteeChange,
    runInBatches,
    type BulkOutcome,
    type BulkProgress,
} from "../../../../lib/bulk-assign";
import { useAuthStore } from "../../../../stores/auth.store";

const PAGE_SIZE = 20;
// Tope de la API para los listados administrativos.
const API_PAGE_LIMIT = 100;
// Valor del filtro «Sin comité»: un id real nunca coincide con él.
const NO_COMMITTEE = "__sin-comite__";

const STATUS_OPTIONS = [
    { value: "", label: "Todos los estados" },
    { value: "ACTIVE", label: "Activo" },
    { value: "PENDING_ACTIVATION", label: "Pendiente de activación" },
    { value: "SUSPENDED", label: "Suspendido" },
];

const EVENT_STATUS_SUFFIX: Record<AdminEvent["status"], string> = {
    ACTIVE: "",
    CLOSED: " (cerrado)",
    ARCHIVED: " (archivado)",
};

type CommitteeOption = {
    value: string;
    label: string;
    disabled?: boolean;
};

type BulkDialogState = {
    mode: "assign" | "remove";
    targetCommitteeId: string | null;
    targetLabel: string | null;
    items: BulkDialogItem[];
    unchangedCount: number;
};

type ToastState = {
    type: "success" | "error";
    message: string;
};

const plural = (count: number, one: string, many: string) =>
    count === 1 ? one : many;

const normalizeText = (value: string | null | undefined) =>
    (value ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();

const getFullName = (participant: AdminParticipant) => {
    const profile = participant.profile;
    const fullName = [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || profile?.display_name?.trim() || "Sin perfil";
};

// Misma regla que la búsqueda de la API: código de login, #, nombre, alias; sin
// mayúsculas ni tildes. Se aplica en memoria porque «sin comité» no es un filtro de la API.
const matchesSearch = (participant: AdminParticipant, term: string) => {
    const needle = normalizeText(term).replace(/^#/, "");

    if (!needle) {
        return true;
    }

    const profile = participant.profile;
    const haystack = [
        participant.participant_code,
        participant.delegation_code?.replace(/^#/, ""),
        profile?.first_name,
        profile?.last_name,
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" "),
        profile?.display_name,
        profile?.alias,
    ];

    return haystack.some((value) => normalizeText(value).includes(needle));
};

const getActionErrorMessage = (failure: unknown) => {
    if (failure instanceof ApiError) {
        return failure.status === 403
            ? "No tienes permisos para administrar este evento."
            : failure.message;
    }

    return "No se pudo completar la acción. Intenta de nuevo.";
};

// La API limita cada página a 100; se piden todas para poder filtrar en memoria.
const loadAllAdminEvents = async (token: string): Promise<AdminEvent[]> => {
    const first = await listEvents(token, { page: 1, limit: API_PAGE_LIMIT });
    const events = [...first.events];

    for (let page = 2; page <= first.pagination.total_pages; page += 1) {
        const next = await listEvents(token, { page, limit: API_PAGE_LIMIT });
        events.push(...next.events);
    }

    return events;
};

const loadAllParticipants = async (
    token: string,
    eventId: string,
): Promise<AdminParticipant[]> => {
    const first = await listParticipants(token, {
        eventId,
        page: 1,
        limit: API_PAGE_LIMIT,
    });
    const participants = [...first.participants];

    for (let page = 2; page <= first.pagination.total_pages; page += 1) {
        const next = await listParticipants(token, {
            eventId,
            page,
            limit: API_PAGE_LIMIT,
        });
        participants.push(...next.participants);
    }

    return participants;
};

const committeeLabel = (committee: AdminCommittee | undefined) =>
    committee ? `${committee.code} — ${committee.name}` : null;

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

// Selector de comité de una fila. Es un select nativo: su etiqueta es el nombre
// del participante (aria-label), porque la fila ya lo muestra.
const RowCommitteeSelect = ({
    name,
    value,
    options,
    disabled,
    onChange,
}: {
    name: string;
    value: string;
    options: { value: string; label: string; disabled?: boolean }[];
    disabled: boolean;
    onChange: (committeeId: string | null) => void;
}) => (
    <select
        aria-label={`Comité de ${name}`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
        className="w-full min-h-11 md:min-h-9 rounded-xl px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--input-focus)] disabled:cursor-not-allowed disabled:opacity-60"
        style={{
            backgroundColor: "var(--input-bg)",
            border: "1px solid var(--input-border)",
            color: "var(--text-primary)",
        }}
    >
        {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
            </option>
        ))}
    </select>
);

export default function AdminAssignmentsPage() {
    const token = useAuthStore((state) => state.token);

    const [events, setEvents] = useState<AdminEvent[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [eventsError, setEventsError] = useState<string | null>(null);
    const [eventsReloadKey, setEventsReloadKey] = useState(0);
    const [selectedEventId, setSelectedEventId] = useState("");

    const [committees, setCommittees] = useState<AdminCommittee[]>([]);
    const [committeesLoading, setCommitteesLoading] = useState(true);
    const [committeesError, setCommitteesError] = useState<string | null>(null);

    const [participants, setParticipants] = useState<AdminParticipant[]>([]);
    const [participantsLoading, setParticipantsLoading] = useState(true);
    const [participantsError, setParticipantsError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const [search, setSearch] = useState("");
    const [committeeFilter, setCommitteeFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState<"" | ParticipantAccountStatus>("");
    const [page, setPage] = useState(1);

    const [selected, setSelected] = useState<Set<string>>(() => new Set());
    const [rowBusy, setRowBusy] = useState<Set<string>>(() => new Set());
    const [bulkTarget, setBulkTarget] = useState("");
    const [bulkDialog, setBulkDialog] = useState<BulkDialogState | null>(null);
    const [toast, setToast] = useState<ToastState | null>(null);

    // Un único evento se preselecciona; con varios, la elección la hace el usuario.
    const activeEventId =
        selectedEventId || (events.length === 1 ? (events[0]?.id ?? "") : "");

    useEffect(() => {
        if (!token) {
            return;
        }

        let cancelled = false;

        setEventsLoading(true);
        setEventsError(null);

        loadAllAdminEvents(token)
            .then((data) => {
                if (!cancelled) {
                    setEvents(data);
                    setEventsError(null);
                }
            })
            .catch((failure) => {
                if (!cancelled) {
                    setEventsError(
                        failure instanceof ApiError
                            ? failure.message
                            : "No se pudieron cargar los eventos.",
                    );
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setEventsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [eventsReloadKey, token]);

    useEffect(() => {
        if (!token || !activeEventId) {
            return;
        }

        let cancelled = false;

        setCommitteesLoading(true);
        setCommitteesError(null);

        listCommittees(token, activeEventId)
            .then((data) => {
                if (!cancelled) {
                    setCommittees(data);
                }
            })
            .catch((failure) => {
                if (!cancelled) {
                    setCommittees([]);
                    setCommitteesError(
                        failure instanceof ApiError
                            ? failure.message
                            : "No se pudieron cargar los comités del evento.",
                    );
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setCommitteesLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [activeEventId, reloadKey, token]);

    useEffect(() => {
        if (!token || !activeEventId) {
            return;
        }

        let cancelled = false;

        setParticipantsLoading(true);
        setParticipantsError(null);

        loadAllParticipants(token, activeEventId)
            .then((data) => {
                if (!cancelled) {
                    setParticipants(data);
                }
            })
            .catch((failure) => {
                if (!cancelled) {
                    setParticipantsError(
                        failure instanceof ApiError
                            ? failure.message
                            : "No se pudieron cargar los participantes. Intenta de nuevo.",
                    );
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setParticipantsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [activeEventId, reloadKey, token]);

    const committeeById = useMemo(
        () => new Map(committees.map((committee) => [committee.id, committee])),
        [committees],
    );

    const assignableCommittees = useMemo(
        () => committees.filter((committee) => committee.status !== "ARCHIVED"),
        [committees],
    );

    const filteredParticipants = useMemo(
        () =>
            participants
                .filter((participant) => {
                    if (committeeFilter === NO_COMMITTEE) {
                        return !participant.committee_id;
                    }

                    if (committeeFilter) {
                        return participant.committee_id === committeeFilter;
                    }

                    return true;
                })
                .filter(
                    (participant) =>
                        !statusFilter || participant.account_status === statusFilter,
                )
                .filter((participant) => matchesSearch(participant, search))
                .sort((a, b) => getFullName(a).localeCompare(getFullName(b), "es")),
        [participants, committeeFilter, statusFilter, search],
    );

    const selectedRows = useMemo(
        () => participants.filter((participant) => selected.has(participant.id)),
        [participants, selected],
    );

    const totalPages = Math.max(1, Math.ceil(filteredParticipants.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pageRows = filteredParticipants.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
    );
    const pageIds = pageRows.map((participant) => participant.id);
    const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
    const allOnPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;
    const someOnPageSelected = selectedOnPage > 0 && !allOnPageSelected;

    const hasFilters = Boolean(search.trim() || committeeFilter || statusFilter);

    const eventOptions = [
        ...(activeEventId ? [] : [{ value: "", label: "Elige un evento", disabled: true }]),
        ...events.map((event) => ({
            value: event.id,
            label: `${event.name}${EVENT_STATUS_SUFFIX[event.status]}`,
        })),
    ];

    const committeeFilterOptions = [
        { value: "", label: "Todos los comités" },
        { value: NO_COMMITTEE, label: "Sin comité" },
        ...committees.map((committee) => ({
            value: committee.id,
            label:
                committee.status === "ARCHIVED"
                    ? `${committee.code} — ${committee.name} (archivado)`
                    : `${committee.code} — ${committee.name}`,
        })),
    ];

    const bulkTargetOptions = [
        { value: "", label: "Elige un comité", disabled: true },
        ...assignableCommittees.map((committee) => ({
            value: committee.id,
            label: `${committee.code} — ${committee.name}`,
        })),
    ];

    const rowCommitteeOptions = (participant: AdminParticipant) => {
        const options: CommitteeOption[] = [
            { value: "", label: "Sin comité" },
            ...assignableCommittees.map((committee) => ({
                value: committee.id,
                label: `${committee.code} — ${committee.name}`,
            })),
        ];

        // Un comité archivado o ausente sigue visible, pero no se puede elegir.
        if (
            participant.committee_id &&
            !assignableCommittees.some((committee) => committee.id === participant.committee_id)
        ) {
            const current = committeeById.get(participant.committee_id);
            options.push({
                value: participant.committee_id,
                label: current
                    ? `${current.code} — ${current.name} (archivado)`
                    : "Comité no disponible",
                disabled: true,
            });
        }

        return options;
    };

    const handleEventChange = (eventId: string) => {
        setSelectedEventId(eventId);
        setSelected(new Set());
        setBulkTarget("");
        setSearch("");
        setCommitteeFilter("");
        setStatusFilter("");
        setPage(1);
        setCommittees([]);
        setParticipants([]);
        setCommitteesLoading(true);
        setParticipantsLoading(true);
        setCommitteesError(null);
        setParticipantsError(null);
    };

    const clearFilters = () => {
        setSearch("");
        setCommitteeFilter("");
        setStatusFilter("");
        setPage(1);
    };

    const toggleRow = (id: string) => {
        setSelected((previous) => {
            const next = new Set(previous);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    };

    const toggleAllOnPage = () => {
        setSelected((previous) => {
            const next = new Set(previous);

            for (const id of pageIds) {
                if (allOnPageSelected) {
                    next.delete(id);
                } else {
                    next.add(id);
                }
            }

            return next;
        });
    };

    // Tras un cambio correcto la lista se actualiza en local, sin recargar la tabla.
    const applyCommittee = (ids: string[], committeeId: string | null) => {
        const changed = new Set(ids);

        setParticipants((previous) =>
            previous.map((participant) =>
                changed.has(participant.id)
                    ? { ...participant, committee_id: committeeId }
                    : participant,
            ),
        );
    };

    const changeRowCommittee = async (
        participant: AdminParticipant,
        committeeId: string | null,
    ) => {
        if (!token) {
            return;
        }

        const name = getFullName(participant);

        setRowBusy((previous) => new Set(previous).add(participant.id));

        try {
            await changeParticipantCommittee(token, participant.id, committeeId);
            applyCommittee([participant.id], committeeId);
            setToast({ type: "success", message: `Comité de ${name} actualizado.` });
        } catch (failure) {
            setToast({ type: "error", message: getActionErrorMessage(failure) });
        } finally {
            setRowBusy((previous) => {
                const next = new Set(previous);
                next.delete(participant.id);
                return next;
            });
        }
    };

    const openBulkDialog = (mode: "assign" | "remove", targetCommitteeId: string | null) => {
        const { pending, unchanged } = planCommitteeChange(
            selectedRows.map((participant) => ({
                id: participant.id,
                committeeId: participant.committee_id,
            })),
            targetCommitteeId,
        );

        if (pending.length === 0) {
            setToast({
                type: "success",
                message:
                    mode === "assign"
                        ? "Los participantes seleccionados ya están en ese comité."
                        : "Los participantes seleccionados no tienen comité.",
            });
            return;
        }

        const byId = new Map(selectedRows.map((participant) => [participant.id, participant]));
        const items = pending.flatMap((id) => {
            const participant = byId.get(id);
            return participant ? [{ id, name: getFullName(participant) }] : [];
        });

        setBulkDialog({
            mode,
            targetCommitteeId,
            targetLabel: committeeLabel(
                targetCommitteeId ? committeeById.get(targetCommitteeId) : undefined,
            ),
            items,
            unchangedCount: unchanged.length,
        });
    };

    // Operación del lote: una llamada a la asignación existente por participante.
    const runCommitteeChange =
        (committeeId: string | null) =>
        (ids: string[], reason: string, onProgress: (progress: BulkProgress) => void) =>
            runInBatches({
                ids,
                apply: async (id) => {
                    if (!token) {
                        throw new Error("Sesión no disponible.");
                    }

                    await changeParticipantCommittee(token, id, committeeId, reason || undefined);
                },
                describeError: getActionErrorMessage,
                onProgress,
            });

    // Al terminar (o reintentar) el lote: se actualiza lo que cambió y queda
    // seleccionado lo que falló, para reintentarlo.
    const handleBulkFinished = (outcome: BulkOutcome) => {
        if (bulkDialog) {
            applyCommittee(outcome.ok, bulkDialog.targetCommitteeId);
        }

        setSelected(new Set(failedIds(outcome)));
    };

    const closeBulkDialog = () => {
        setBulkDialog(null);
    };

    const selectedCount = selectedRows.length;
    const shownCount = filteredParticipants.length;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <AdminPageHeader
                title="Asignaciones"
                description="Asigna participantes a comités de un evento, uno por uno o en lotes."
                breadcrumb={[
                    { label: "Panel", href: "/admin" },
                    { label: "Asignaciones" },
                ]}
            />

            {eventsLoading && (
                <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                >
                    <LoadingState />
                </div>
            )}

            {!eventsLoading && eventsError && (
                <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                >
                    <AdminEmptyState
                        icon={<IconAlertTriangle size={32} />}
                        title="Error al cargar eventos"
                        description={eventsError}
                        action={
                            <AdminButton
                                variant="secondary"
                                onClick={() => setEventsReloadKey((value) => value + 1)}
                                icon={<IconRefresh size={16} />}
                            >
                                Reintentar
                            </AdminButton>
                        }
                    />
                </div>
            )}

            {!eventsLoading && !eventsError && events.length === 0 && (
                <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                >
                    <AdminEmptyState
                        icon={<IconCalendar size={32} />}
                        title="No administras ningún evento"
                        description="Necesitas una membresía administrativa activa en un evento para asignar participantes."
                    />
                </div>
            )}

            {!eventsLoading && !eventsError && events.length > 0 && (
                <>
                    <div
                        className="rounded-2xl p-4 sm:p-5 flex flex-col gap-4 sm:flex-row sm:items-end"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-sm)",
                        }}
                    >
                        <div className="flex-1 min-w-0">
                            <AdminFormSelect
                                id="assign-event"
                                label="Evento"
                                value={activeEventId}
                                onChange={(event) => handleEventChange(event.target.value)}
                                options={eventOptions}
                            />
                        </div>
                        <AdminButton
                            type="button"
                            variant="secondary"
                            onClick={() => setReloadKey((value) => value + 1)}
                            disabled={!activeEventId}
                            icon={<IconRefresh size={16} />}
                        >
                            Actualizar lista
                        </AdminButton>
                    </div>

                    {activeEventId && (
                        <>
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
                                    id="assign-search"
                                    label="Buscar participante"
                                    placeholder="Nombre, alias, código de login o #"
                                    value={search}
                                    onChange={(event) => {
                                        setSearch(event.target.value);
                                        setPage(1);
                                    }}
                                />

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <AdminFormSelect
                                        id="assign-filter-committee"
                                        label="Comité"
                                        value={committeeFilter}
                                        onChange={(event) => {
                                            setCommitteeFilter(event.target.value);
                                            setPage(1);
                                        }}
                                        options={committeeFilterOptions}
                                        disabled={committeesLoading}
                                    />
                                    <AdminFormSelect
                                        id="assign-filter-status"
                                        label="Estado de cuenta"
                                        value={statusFilter}
                                        onChange={(event) => {
                                            setStatusFilter(
                                                event.target.value as "" | ParticipantAccountStatus,
                                            );
                                            setPage(1);
                                        }}
                                        options={STATUS_OPTIONS}
                                    />
                                </div>

                                {hasFilters && (
                                    <div className="flex justify-end">
                                        <AdminButton
                                            type="button"
                                            variant="secondary"
                                            onClick={clearFilters}
                                            icon={<IconRefresh size={16} />}
                                        >
                                            Limpiar filtros
                                        </AdminButton>
                                    </div>
                                )}
                            </div>

                            {committeesError && (
                                <AdminAlertBanner type="warning" message={committeesError} />
                            )}

                            {selectedCount > 0 && (
                                <div
                                    role="region"
                                    aria-label="Acciones para la selección"
                                    className="rounded-2xl p-4 sm:p-5 flex flex-col gap-4 lg:flex-row lg:items-end"
                                    style={{
                                        backgroundColor: "var(--bg-surface)",
                                        border: "1px solid var(--border-color)",
                                        boxShadow: "var(--shadow-sm)",
                                    }}
                                >
                                    <p
                                        className="text-sm font-semibold font-heading lg:pb-2.5"
                                        style={{ color: "var(--text-primary)" }}
                                    >
                                        {selectedCount}{" "}
                                        {plural(selectedCount, "seleccionado", "seleccionados")}
                                    </p>
                                    <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                                        <div className="w-full sm:w-64">
                                            <AdminFormSelect
                                                id="assign-bulk-target"
                                                label="Comité destino"
                                                value={bulkTarget}
                                                onChange={(event) => setBulkTarget(event.target.value)}
                                                options={bulkTargetOptions}
                                                disabled={committeesLoading || assignableCommittees.length === 0}
                                            />
                                        </div>
                                        <AdminButton
                                            type="button"
                                            onClick={() => openBulkDialog("assign", bulkTarget || null)}
                                            disabled={!bulkTarget}
                                            icon={<IconBuilding size={16} />}
                                        >
                                            Asignar a comité
                                        </AdminButton>
                                        <AdminButton
                                            type="button"
                                            variant="secondary"
                                            onClick={() => openBulkDialog("remove", null)}
                                        >
                                            Quitar de comité
                                        </AdminButton>
                                        <AdminButton
                                            type="button"
                                            variant="secondary"
                                            onClick={() => setSelected(new Set())}
                                        >
                                            Limpiar selección
                                        </AdminButton>
                                    </div>
                                </div>
                            )}

                            <div
                                className="rounded-2xl overflow-hidden"
                                style={{
                                    backgroundColor: "var(--bg-surface)",
                                    border: "1px solid var(--border-color)",
                                    boxShadow: "var(--shadow-sm)",
                                }}
                            >
                                {participantsLoading && <LoadingState />}

                                {!participantsLoading && participantsError && (
                                    <AdminEmptyState
                                        icon={<IconAlertTriangle size={32} />}
                                        title="Error al cargar participantes"
                                        description={participantsError}
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

                                {!participantsLoading && !participantsError && participants.length === 0 && (
                                    <AdminEmptyState
                                        icon={<IconDirectory size={32} />}
                                        title="No hay participantes en este evento"
                                        description="Registra participantes desde la sección Participantes para asignarlos a comités."
                                    />
                                )}

                                {!participantsLoading &&
                                    !participantsError &&
                                    participants.length > 0 &&
                                    filteredParticipants.length === 0 && (
                                        <AdminEmptyState
                                            icon={<IconSearch size={32} />}
                                            title="Sin resultados"
                                            description="Ningún participante coincide con la búsqueda o los filtros."
                                            action={
                                                hasFilters ? (
                                                    <AdminButton
                                                        variant="secondary"
                                                        onClick={clearFilters}
                                                        icon={<IconRefresh size={16} />}
                                                    >
                                                        Limpiar filtros
                                                    </AdminButton>
                                                ) : undefined
                                            }
                                        />
                                    )}

                                {!participantsLoading &&
                                    !participantsError &&
                                    pageRows.length > 0 && (
                                        <>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                                                            <th
                                                                className="w-12 pl-4 pr-2 py-3"
                                                                style={{
                                                                    backgroundColor: "var(--bg-surface-secondary)",
                                                                }}
                                                            >
                                                                <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        ref={(element) => {
                                                                            if (element) {
                                                                                element.indeterminate =
                                                                                    someOnPageSelected;
                                                                            }
                                                                        }}
                                                                        checked={allOnPageSelected}
                                                                        onChange={toggleAllOnPage}
                                                                        aria-label="Seleccionar participantes de esta página"
                                                                        className="h-5 w-5 cursor-pointer"
                                                                        style={{ accentColor: "var(--text-accent)" }}
                                                                    />
                                                                </label>
                                                            </th>
                                                            <th
                                                                className="px-2 py-3 text-xs font-bold uppercase tracking-wide font-heading"
                                                                style={{
                                                                    color: "var(--text-muted)",
                                                                    backgroundColor: "var(--bg-surface-secondary)",
                                                                }}
                                                            >
                                                                Participante
                                                            </th>
                                                            <th
                                                                className="hidden sm:table-cell px-4 py-3 text-xs font-bold uppercase tracking-wide font-heading"
                                                                style={{
                                                                    color: "var(--text-muted)",
                                                                    backgroundColor: "var(--bg-surface-secondary)",
                                                                }}
                                                            >
                                                                Estado
                                                            </th>
                                                            <th
                                                                className="w-44 sm:w-64 px-2 pr-4 py-3 text-xs font-bold uppercase tracking-wide font-heading"
                                                                style={{
                                                                    color: "var(--text-muted)",
                                                                    backgroundColor: "var(--bg-surface-secondary)",
                                                                }}
                                                            >
                                                                Comité
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {pageRows.map((participant) => {
                                                            const name = getFullName(participant);

                                                            return (
                                                                <tr
                                                                    key={participant.id}
                                                                    className="hover:bg-[var(--bg-hover)]"
                                                                    style={{ borderBottom: "1px solid var(--border-light)" }}
                                                                >
                                                                    <td className="w-12 pl-4 pr-2 py-2 align-middle">
                                                                        <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={selected.has(participant.id)}
                                                                                onChange={() => toggleRow(participant.id)}
                                                                                aria-label={`Seleccionar a ${name}`}
                                                                                className="h-5 w-5 cursor-pointer"
                                                                                style={{ accentColor: "var(--text-accent)" }}
                                                                            />
                                                                        </label>
                                                                    </td>

                                                                    <td className="px-2 py-3 min-w-0">
                                                                        <Link
                                                                            href={`/admin/events/${activeEventId}/participants/${participant.id}`}
                                                                            className="block truncate text-sm font-semibold font-heading hover:underline"
                                                                            style={{ color: "var(--text-primary)" }}
                                                                        >
                                                                            {name}
                                                                        </Link>
                                                                        <p
                                                                            className="mt-0.5 truncate text-xs"
                                                                            style={{ color: "var(--text-muted)" }}
                                                                        >
                                                                            {participant.participant_code}
                                                                            {participant.delegation_code
                                                                                ? ` · ${participant.delegation_code}`
                                                                                : ""}
                                                                        </p>
                                                                    </td>

                                                                    <td className="hidden sm:table-cell px-4 py-3 align-middle">
                                                                        <AdminStatusBadge status={participant.account_status} />
                                                                    </td>

                                                                    <td className="w-44 sm:w-64 px-2 pr-4 py-3 align-middle">
                                                                        <RowCommitteeSelect
                                                                            name={name}
                                                                            value={participant.committee_id ?? ""}
                                                                            options={rowCommitteeOptions(participant)}
                                                                            disabled={rowBusy.has(participant.id)}
                                                                            onChange={(committeeId) =>
                                                                                changeRowCommittee(participant, committeeId)
                                                                            }
                                                                        />
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div
                                                className="px-4 py-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3"
                                                style={{
                                                    borderTop: "1px solid var(--border-light)",
                                                    backgroundColor: "var(--bg-surface-secondary)",
                                                }}
                                            >
                                                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                                    {hasFilters
                                                        ? `${shownCount} de ${participants.length} ${plural(participants.length, "participante", "participantes")}`
                                                        : `${participants.length} ${plural(participants.length, "participante", "participantes")}`}
                                                </p>
                                                <div className="flex items-center gap-3">
                                                    <AdminButton
                                                        variant="secondary"
                                                        onClick={() => setPage(Math.max(1, currentPage - 1))}
                                                        disabled={currentPage <= 1}
                                                    >
                                                        Anterior
                                                    </AdminButton>
                                                    <span
                                                        className="text-xs font-semibold font-heading"
                                                        style={{ color: "var(--text-secondary)" }}
                                                    >
                                                        Página {currentPage} de {totalPages}
                                                    </span>
                                                    <AdminButton
                                                        variant="secondary"
                                                        onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                                                        disabled={currentPage >= totalPages}
                                                    >
                                                        Siguiente
                                                    </AdminButton>
                                                </div>
                                            </div>
                                        </>
                                    )}
                            </div>
                        </>
                    )}
                </>
            )}

            {bulkDialog && (
                <AdminBulkCommitteeDialog
                    mode={bulkDialog.mode}
                    targetLabel={bulkDialog.targetLabel}
                    items={bulkDialog.items}
                    unchangedCount={bulkDialog.unchangedCount}
                    onRun={runCommitteeChange(bulkDialog.targetCommitteeId)}
                    onFinished={handleBulkFinished}
                    onClose={closeBulkDialog}
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
