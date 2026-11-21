"use client";

import { useId, useState } from "react";
import { Button } from "../ui/Button";
import { ModalDialog } from "../ui/ConfirmDialog";

// Diálogo con motivo y contador de caracteres. Con `required` el botón se
// deshabilita hasta que el motivo (sin espacios a los lados) cumple el rango.

type AdminReasonDialogProps = {
    title: string;
    description?: string;
    confirmLabel: string;
    tone?: "default" | "danger";
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    reasonLabel?: string;
    loading?: boolean;
    error?: string | null;
    // Bloquea la confirmación (por ejemplo, tras un 429).
    confirmDisabled?: boolean;
    onConfirm: (reason: string) => void | Promise<void>;
    onCancel: () => void;
};

export const AdminReasonDialog = ({
    title,
    description,
    confirmLabel,
    tone = "default",
    required = true,
    minLength = 3,
    maxLength = 500,
    reasonLabel = "Motivo",
    loading = false,
    error,
    confirmDisabled = false,
    onConfirm,
    onCancel,
}: AdminReasonDialogProps) => {
    const titleId = useId();
    const descriptionId = useId();
    const reasonId = useId();
    const counterId = useId();
    const [reason, setReason] = useState("");

    const trimmedLength = reason.trim().length;
    const min = required ? minLength : 0;
    const valid = trimmedLength >= min && trimmedLength <= maxLength;
    const hint = required
        ? `${trimmedLength}/${maxLength} · mínimo ${minLength}`
        : `${trimmedLength}/${maxLength} · opcional`;

    return (
        <ModalDialog
            titleId={titleId}
            descriptionId={description ? descriptionId : undefined}
            onClose={loading ? undefined : onCancel}
            className="space-y-4 p-6"
        >
            <div className="space-y-1.5">
                <h2
                    id={titleId}
                    className="font-heading text-lg font-bold text-[var(--text-primary)]"
                >
                    {title}
                </h2>
                {description && (
                    <p
                        id={descriptionId}
                        className="text-sm leading-relaxed text-[var(--text-secondary)]"
                    >
                        {description}
                    </p>
                )}
            </div>

            <div className="space-y-1.5">
                <label
                    htmlFor={reasonId}
                    className="block text-sm font-semibold text-[var(--text-primary)]"
                >
                    {reasonLabel}
                </label>
                <textarea
                    id={reasonId}
                    rows={3}
                    value={reason}
                    disabled={loading}
                    autoFocus
                    aria-required={required}
                    aria-invalid={!valid && trimmedLength > 0 ? true : undefined}
                    aria-describedby={counterId}
                    onChange={(event) => setReason(event.target.value)}
                    className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
                />
                <p
                    id={counterId}
                    className="text-xs"
                    style={{
                        color:
                            trimmedLength > maxLength
                                ? "var(--danger)"
                                : "var(--text-muted)",
                    }}
                >
                    {hint}
                </p>
            </div>

            {error && (
                <p role="alert" className="text-sm font-medium text-[var(--danger)]">
                    {error}
                </p>
            )}

            <div className="flex flex-col-reverse justify-end gap-3 pt-2 sm:flex-row">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onCancel}
                    disabled={loading}
                >
                    Cancelar
                </Button>
                <Button
                    type="button"
                    variant={tone === "danger" ? "danger" : "primary"}
                    loading={loading}
                    disabled={!valid || confirmDisabled}
                    onClick={() => void onConfirm(reason.trim())}
                >
                    {confirmLabel}
                </Button>
            </div>
        </ModalDialog>
    );
};
