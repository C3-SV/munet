"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminButton } from "../../../../../../components/admin/AdminButton";
import { AdminConfirmDialog } from "../../../../../../components/admin/AdminConfirmDialog";
import { AdminEmptyState } from "../../../../../../components/admin/AdminEmptyState";
import { AdminPageHeader } from "../../../../../../components/admin/AdminPageHeader";
import { AdminStatusBadge } from "../../../../../../components/admin/AdminStatusBadge";
import { AdminToast } from "../../../../../../components/admin/AdminToast";
import { IconAction } from "../../../../../../components/admin/IconAction";
import { describeCommitteeDeleteError } from "../../../../../../lib/admin-committee-delete";
import {
    deleteCommittee,
    getEvent,
    listCommittees,
    type AdminCommittee,
} from "../../../../../../lib/api/admin";
import { ApiError } from "../../../../../../lib/api/client";
import { useAuthStore } from "../../../../../../stores/auth.store";
import { IconAlertTriangle, IconCommittees, IconEdit, IconPlus, IconRefresh } from "../../../../../../components/ui/icons";

// Papelera local: icons.tsx no la incluye. Mismo trazo y tamaño que el resto de iconos.
const IconTrash = ({ size = 18 }: { size?: number }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
    >
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M6 6l1 14h10l1-14" />
        <path d="M10 11v6M14 11v6" />
    </svg>
);

const CommitteeRow = ({
    committee,
    eventId,
    onDelete,
}: {
    committee: AdminCommittee;
    eventId: string;
    onDelete: (committee: AdminCommittee) => void;
}) => (
    <tr
        className="hover:bg-[var(--bg-hover)]"
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
            <div className="flex items-center justify-end gap-2">
                <IconAction
                    href={`/admin/events/${eventId}/committees/${committee.id}/edit`}
                    label={`Editar ${committee.name}`}
                    icon={<IconEdit size={18} />}
                />
                <IconAction
                    label={`Eliminar ${committee.name}`}
                    icon={<IconTrash size={18} />}
                    tone="danger"
                    onClick={() => onDelete(committee)}
                />
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
    const [committeeToDelete, setCommitteeToDelete] = useState<AdminCommittee | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

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

    const closeDeleteDialog = () => {
        setCommitteeToDelete(null);
        setDeleteError(null);
    };

    // Borrado lógico en la API. Si sale bien, el comité se quita de la lista sin recargarla.
    const handleConfirmDelete = async () => {
        const target = committeeToDelete;

        if (!token || !target) {
            setDeleteError("Sesión no válida. Recarga la página.");
            return;
        }

        setDeleting(true);
        setDeleteError(null);

        try {
            await deleteCommittee(token, target.id, target.event_id);
            setCommittees((previous) => previous.filter((item) => item.id !== target.id));
            setCommitteeToDelete(null);
            setToast({ type: "success", message: `Comité «${target.name}» eliminado.` });
        } catch (deleteFailure) {
            setDeleteError(
                describeCommitteeDeleteError(
                    deleteFailure instanceof ApiError ? deleteFailure.status : null,
                ),
            );
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <AdminPageHeader
                title="Comités"
                breadcrumb={[
                    { label: "Panel", href: "/admin" },
                    { label: "Eventos", href: "/admin/events" },
                    { label: eventName, href: `/admin/events/${eventId}` },
                    { label: "Comités" },
                ]}
                action={
                    <AdminButton
                        href={`/admin/events/${eventId}/committees/new`}
                        icon={<IconPlus size={16} />}
                    >
                        Nuevo comité
                    </AdminButton>
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
                            className="animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
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
                        icon={<IconAlertTriangle size={32} />}
                        title="Error al cargar comités"
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

                {!loading && !error && committees.length === 0 && (
                    <AdminEmptyState
                        icon={<IconCommittees size={32} />}
                        title="No hay comités registrados"
                        description="Crea el primer comité para este evento."
                        action={
                            <AdminButton
                                href={`/admin/events/${eventId}/committees/new`}
                                icon={<IconPlus size={16} />}
                            >
                                Crear comité
                            </AdminButton>
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
                                                    "px-6 py-3 text-xs font-bold uppercase tracking-wide font-heading",
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
                                        onDelete={(item) => {
                                            setDeleteError(null);
                                            setCommitteeToDelete(item);
                                        }}
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

            {committeeToDelete && (
                <AdminConfirmDialog
                    title="¿Eliminar este comité?"
                    description={`Se eliminará el comité «${committeeToDelete.name}» y su muro. Los participantes asignados quedarán sin comité, y el muro con sus publicaciones dejará de estar disponible. No se puede deshacer desde el panel.`}
                    confirmLabel="Eliminar comité"
                    variant="danger"
                    loading={deleting}
                    error={deleteError}
                    onCancel={closeDeleteDialog}
                    onConfirm={() => void handleConfirmDelete()}
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
