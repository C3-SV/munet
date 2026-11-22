"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AdminButton } from "../../../../../../components/admin/AdminButton";
import { AdminEmptyState } from "../../../../../../components/admin/AdminEmptyState";
import { AdminPageHeader } from "../../../../../../components/admin/AdminPageHeader";
import { IconAlertTriangle, IconFile, IconRefresh } from "../../../../../../components/ui/icons";
import { listAuditLogs, type AuditLog } from "../../../../../../lib/api/audit";
import { ApiError } from "../../../../../../lib/api/client";
import {
    formatAuditAction,
    formatAuditEntity,
    formatAuditOutcome,
} from "../../../../../../lib/audit-labels";
import { formatDateTime } from "../../../../../../lib/format-datetime";
import { formatRoleLabel } from "../../../../../../lib/role-label";
import { useAuthStore } from "../../../../../../stores/auth.store";

const PAGE_SIZE = 50;

const describeAuditError = (error: unknown) => {
    if (error instanceof ApiError) {
        return error.status === 403
            ? "No tienes permisos para ver la auditoría de este evento."
            : error.message;
    }

    return "No se pudo cargar la auditoría. Intenta de nuevo.";
};

const outcomeColor = (outcome: string) => {
    switch (outcome) {
        case "SUCCESS":
            return "var(--success)";
        case "FAILURE":
            return "var(--danger)";
        case "DENIED":
            return "var(--warning)";
        default:
            return "var(--text-secondary)";
    }
};

// Identificador abreviado; el completo queda en el atributo title.
const shortId = (id: string | null | undefined) => (id ? id.slice(0, 8) : null);

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

const HEADER_STYLE = {
    color: "var(--text-muted)",
    backgroundColor: "var(--bg-surface-secondary)",
};

const CELL_MUTED = { color: "var(--text-muted)" };

export default function EventAuditPage() {
    const params = useParams<{ eventId: string }>();
    const eventId = params?.eventId ?? "";
    const token = useAuthStore((state) => state.token);
    const eventName = useAuthStore(
        (state) =>
            state.memberships.find((membership) => membership.eventId === eventId)?.eventName ??
            "Evento",
    );

    const [logs, setLogs] = useState<AuditLog[]>([]);
    // Cursor de la página siguiente; null cuando ya no quedan registros.
    const [nextBefore, setNextBefore] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [moreError, setMoreError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    // Cada recarga abre una "generación"; una respuesta de una generación anterior se descarta.
    const generation = useRef(0);

    useEffect(() => {
        if (!token || !eventId) {
            return;
        }

        const current = ++generation.current;
        setLoading(true);
        setError(null);
        setMoreError(null);
        setLoadingMore(false);
        setLogs([]);
        setNextBefore(null);

        listAuditLogs(token, eventId, { limit: PAGE_SIZE })
            .then((page) => {
                if (current === generation.current) {
                    setLogs(page.logs);
                    setNextBefore(page.next_before);
                }
            })
            .catch((loadError: unknown) => {
                if (current === generation.current) {
                    setError(describeAuditError(loadError));
                }
            })
            .finally(() => {
                if (current === generation.current) {
                    setLoading(false);
                }
            });
    }, [token, eventId, reloadKey]);

    const handleLoadMore = async () => {
        if (!token || !eventId || !nextBefore || loadingMore) {
            return;
        }

        const current = generation.current;
        setLoadingMore(true);
        setMoreError(null);

        try {
            const page = await listAuditLogs(token, eventId, {
                limit: PAGE_SIZE,
                before: nextBefore,
            });

            if (current === generation.current) {
                setLogs((existing) => [...existing, ...page.logs]);
                setNextBefore(page.next_before);
            }
        } catch (loadError) {
            if (current === generation.current) {
                setMoreError(describeAuditError(loadError));
            }
        } finally {
            if (current === generation.current) {
                setLoadingMore(false);
            }
        }
    };

    // La API solo incluye IP y navegador para ADMIN_TECH: la columna aparece si la respuesta los trae.
    const showIp = logs.some((log) => log.ip_address !== undefined);
    const showUserAgent = logs.some((log) => log.user_agent !== undefined);

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <AdminPageHeader
                title="Auditoría"
                description={`Registro de acciones de ${eventName}. Solo lectura.`}
                breadcrumb={[{ label: "Panel", href: "/admin" }, { label: "Auditoría" }]}
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
                        title="No se pudo cargar la auditoría"
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

                {!loading && !error && logs.length === 0 && (
                    <AdminEmptyState
                        icon={<IconFile size={32} />}
                        title="Sin registros de auditoría"
                        description="Todavía no hay acciones registradas en este evento."
                    />
                )}

                {!loading && !error && logs.length > 0 && (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide font-heading whitespace-nowrap" style={HEADER_STYLE}>
                                            Fecha
                                        </th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide font-heading" style={HEADER_STYLE}>
                                            Acción
                                        </th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide font-heading hidden md:table-cell" style={HEADER_STYLE}>
                                            Entidad
                                        </th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide font-heading" style={HEADER_STYLE}>
                                            Resultado
                                        </th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide font-heading" style={HEADER_STYLE}>
                                            Motivo
                                        </th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide font-heading hidden md:table-cell" style={HEADER_STYLE}>
                                            Actor
                                        </th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide font-heading hidden xl:table-cell" style={HEADER_STYLE}>
                                            Objetivo
                                        </th>
                                        {showIp && (
                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide font-heading hidden lg:table-cell" style={HEADER_STYLE}>
                                                IP
                                            </th>
                                        )}
                                        {showUserAgent && (
                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide font-heading hidden xl:table-cell" style={HEADER_STYLE}>
                                                Navegador
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => {
                                        const actorShortId = shortId(log.actor_membership_id);
                                        const targetShortId = shortId(log.target_membership_id);

                                        return (
                                            <tr key={log.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                                <td className="px-4 py-3 align-top whitespace-nowrap">
                                                    <time dateTime={log.created_at} className="text-sm" style={{ color: "var(--text-secondary)" }}>
                                                        {formatDateTime(log.created_at)}
                                                    </time>
                                                </td>

                                                <td className="px-4 py-3 align-top">
                                                    <span
                                                        className="text-sm font-semibold font-heading"
                                                        style={{ color: "var(--text-primary)" }}
                                                        title={log.action_type}
                                                    >
                                                        {formatAuditAction(log.action_type)}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3 align-top hidden md:table-cell">
                                                    <span className="block text-sm" style={{ color: "var(--text-secondary)" }}>
                                                        {formatAuditEntity(log.entity_type)}
                                                    </span>
                                                    {log.entity_id && (
                                                        <span className="block text-xs font-mono" style={CELL_MUTED} title={log.entity_id}>
                                                            {shortId(log.entity_id)}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3 align-top">
                                                    <span
                                                        className="inline-flex items-center whitespace-nowrap rounded-lg px-2 py-0.5 text-xs font-bold font-heading"
                                                        style={{
                                                            color: outcomeColor(log.outcome),
                                                            backgroundColor: `color-mix(in srgb, ${outcomeColor(log.outcome)} 12%, transparent)`,
                                                        }}
                                                    >
                                                        {formatAuditOutcome(log.outcome)}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3 align-top max-w-xs">
                                                    <span
                                                        className="block text-sm"
                                                        style={{
                                                            color: log.reason?.trim()
                                                                ? "var(--text-primary)"
                                                                : "var(--text-muted)",
                                                            overflowWrap: "anywhere",
                                                            whiteSpace: "pre-wrap",
                                                        }}
                                                    >
                                                        {log.reason?.trim() || "—"}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3 align-top hidden md:table-cell">
                                                    <span className="block text-sm" style={{ color: "var(--text-secondary)" }}>
                                                        {log.actor_role ? formatRoleLabel(log.actor_role) : "—"}
                                                    </span>
                                                    {actorShortId && (
                                                        <span className="block text-xs font-mono" style={CELL_MUTED} title={log.actor_membership_id ?? undefined}>
                                                            {actorShortId}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3 align-top hidden xl:table-cell">
                                                    {targetShortId ? (
                                                        <span className="text-xs font-mono" style={CELL_MUTED} title={log.target_membership_id ?? undefined}>
                                                            {targetShortId}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm" style={CELL_MUTED}>—</span>
                                                    )}
                                                </td>

                                                {showIp && (
                                                    <td className="px-4 py-3 align-top hidden lg:table-cell">
                                                        <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                                                            {log.ip_address || "—"}
                                                        </span>
                                                    </td>
                                                )}

                                                {showUserAgent && (
                                                    <td className="px-4 py-3 align-top hidden xl:table-cell">
                                                        <span
                                                            className="block max-w-[16rem] truncate text-xs"
                                                            style={{ color: "var(--text-secondary)" }}
                                                            title={log.user_agent ?? undefined}
                                                        >
                                                            {log.user_agent || "—"}
                                                        </span>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div
                            className="flex flex-col items-center gap-3 px-5 py-4 sm:flex-row sm:justify-between"
                            style={{ borderTop: "1px solid var(--border-color)" }}
                        >
                            <span className="text-xs" style={CELL_MUTED}>
                                {logs.length} {logs.length === 1 ? "registro cargado" : "registros cargados"}
                            </span>

                            {nextBefore && (
                                <AdminButton
                                    variant="secondary"
                                    onClick={() => void handleLoadMore()}
                                    loading={loadingMore}
                                    disabled={loadingMore}
                                >
                                    Cargar más
                                </AdminButton>
                            )}
                        </div>

                        {moreError && (
                            <p role="alert" className="px-5 pb-4 text-sm" style={{ color: "var(--danger)" }}>
                                {moreError}
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
