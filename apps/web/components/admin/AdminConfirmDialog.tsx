"use client";

import { ConfirmDialog } from "../ui/ConfirmDialog";

// Envoltorio del diálogo compartido con la API del panel admin.
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
}: AdminConfirmDialogProps) => (
    <ConfirmDialog
        open
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        tone={variant === "danger" ? "danger" : "default"}
        requireReason={requireReason}
        reasonLabel={reasonLabel}
        loading={loading}
        error={error}
        onCancel={onCancel}
        onConfirm={(reason) => onConfirm(reason ?? "")}
    />
);
