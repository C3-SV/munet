"use client";

import { useId } from "react";
import { getEventStatusToggleTarget } from "../../lib/admin-event-status";
import { AdminAlertBanner } from "./AdminAlertBanner";
import { AdminButton } from "./AdminButton";
import { AdminConfirmDialog } from "./AdminConfirmDialog";
import { AdminStatusBadge } from "./AdminStatusBadge";

// Bloque de estado del evento: muestra el estado actual y el botón para cerrar o
// reabrir, con confirmación. El estado y la llamada a la API viven en la página.

export type AdminEventStatusFeedback = {
    type: "success" | "error";
    message: string;
};

type AdminEventStatusCardProps = {
    status: string;
    disabled?: boolean;
    dialogOpen: boolean;
    dialogLoading: boolean;
    dialogError: string | null;
    feedback: AdminEventStatusFeedback | null;
    onOpenDialog: () => void;
    onCloseDialog: () => void;
    onConfirm: () => void;
    onDismissFeedback: () => void;
};

const STATUS_DESCRIPTIONS: Record<string, string> = {
    ACTIVE: "Participantes y moderadores pueden publicar, comentar y votar.",
    CLOSED: "Participantes y moderadores solo pueden leer. El contenido sigue visible.",
    ARCHIVED:
        "El evento está archivado. Para cambiar su estado usa el campo Estado del formulario.",
};

const CLOSE_DESCRIPTION =
    "Con el evento cerrado, participantes y moderadores solo podrán leer: no podrán publicar, comentar, votar, enviar mensajes privados, editar su perfil ni moderar. El contenido seguirá visible y podrás reabrir el evento cuando quieras.";

const REOPEN_DESCRIPTION =
    "Participantes y moderadores podrán volver a publicar, comentar, votar, enviar mensajes privados y moderar según su rol. El contenido ya publicado no cambia.";

export const AdminEventStatusCard = ({
    status,
    disabled = false,
    dialogOpen,
    dialogLoading,
    dialogError,
    feedback,
    onOpenDialog,
    onCloseDialog,
    onConfirm,
    onDismissFeedback,
}: AdminEventStatusCardProps) => {
    const headingId = useId();
    const target = getEventStatusToggleTarget(status);
    const closing = target === "CLOSED";

    return (
        <section
            aria-labelledby={headingId}
            className="rounded-2xl p-6 sm:p-8 space-y-4"
            style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                boxShadow: "var(--shadow-sm)",
            }}
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2
                            id={headingId}
                            className="text-base font-bold font-heading"
                            style={{ color: "var(--text-primary)" }}
                        >
                            Estado del evento
                        </h2>
                        <AdminStatusBadge status={status} />
                    </div>
                    <p
                        className="text-sm leading-relaxed"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        {STATUS_DESCRIPTIONS[status.trim().toUpperCase()] ?? ""}
                    </p>
                </div>

                {target && (
                    <AdminButton
                        type="button"
                        variant={closing ? "secondary" : "primary"}
                        onClick={onOpenDialog}
                        disabled={disabled}
                        className="shrink-0"
                    >
                        {closing ? "Cerrar evento" : "Reabrir evento"}
                    </AdminButton>
                )}
            </div>

            {feedback && (
                <AdminAlertBanner
                    type={feedback.type}
                    message={feedback.message}
                    onDismiss={onDismissFeedback}
                />
            )}

            {dialogOpen && target && (
                <AdminConfirmDialog
                    title={closing ? "¿Cerrar el evento?" : "¿Reabrir el evento?"}
                    description={closing ? CLOSE_DESCRIPTION : REOPEN_DESCRIPTION}
                    confirmLabel={closing ? "Cerrar evento" : "Reabrir evento"}
                    variant={closing ? "danger" : "primary"}
                    loading={dialogLoading}
                    error={dialogError}
                    onCancel={onCloseDialog}
                    onConfirm={() => onConfirm()}
                />
            )}
        </section>
    );
};
