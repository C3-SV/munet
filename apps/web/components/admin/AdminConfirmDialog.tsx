"use client";

import { useEffect, useId, useState } from "react";
import { AdminButton } from "./AdminButton";
import { AdminFormTextarea } from "./AdminFormTextarea";

// Diálogo de confirmación reutilizable para acciones sensibles del panel admin.
// Puede exigir un motivo obligatorio antes de enviar la petición.

type AdminConfirmDialogProps = {
    title: string;
    description?: string;
    confirmLabel: string;
    variant?: "primary" | "danger";
    requireReason?: boolean;
    reasonLabel?: string;
    loading?: boolean;
    error?: string | null;
    onCancel: () => void;
    onConfirm: (reason: string) => void;
};

export const AdminConfirmDialog = ({
    title,
    description,
    confirmLabel,
    variant = "primary",
    requireReason = false,
    reasonLabel = "Motivo",
    loading = false,
    error,
    onCancel,
    onConfirm,
}: AdminConfirmDialogProps) => {
    const titleId = useId();
    const descriptionId = useId();
    const [reason, setReason] = useState("");
    const [reasonError, setReasonError] = useState<string | null>(null);

    // Bloquea el scroll del fondo mientras el diálogo está montado.
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !loading) {
                onCancel();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [loading, onCancel]);

    const handleConfirm = () => {
        const trimmedReason = reason.trim();

        if (requireReason && !trimmedReason) {
            setReasonError("El motivo es requerido.");
            return;
        }

        onConfirm(trimmedReason);
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            role="presentation"
        >
            <div
                className="absolute inset-0 bg-black/50"
                onClick={() => {
                    if (!loading) {
                        onCancel();
                    }
                }}
                aria-hidden
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                className="relative w-full max-w-md rounded-2xl p-6 space-y-4"
                style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    boxShadow: "var(--shadow-md)",
                }}
            >
                <div className="space-y-1.5">
                    <h2
                        id={titleId}
                        className="text-lg font-bold font-heading"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {title}
                    </h2>
                    {description && (
                        <p
                            id={descriptionId}
                            className="text-sm leading-relaxed"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            {description}
                        </p>
                    )}
                </div>

                {requireReason && (
                    <AdminFormTextarea
                        id="admin-confirm-reason"
                        label={reasonLabel}
                        placeholder="Escribe el motivo de esta acción."
                        required
                        rows={3}
                        value={reason}
                        onChange={(event) => {
                            setReason(event.target.value);
                            if (reasonError) {
                                setReasonError(null);
                            }
                        }}
                        error={reasonError ?? undefined}
                        disabled={loading}
                        autoFocus
                    />
                )}

                {error && (
                    <p
                        className="text-sm font-medium"
                        style={{ color: "#ef4444" }}
                        role="alert"
                    >
                        {error}
                    </p>
                )}

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
                    <AdminButton
                        type="button"
                        variant="secondary"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancelar
                    </AdminButton>
                    <AdminButton
                        type="button"
                        variant={variant === "danger" ? "danger" : "primary"}
                        loading={loading}
                        onClick={handleConfirm}
                        autoFocus={!requireReason}
                    >
                        {confirmLabel}
                    </AdminButton>
                </div>
            </div>
        </div>
    );
};
