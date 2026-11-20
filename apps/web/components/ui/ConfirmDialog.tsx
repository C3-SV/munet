"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";

// Contenedor modal compartido: role="dialog", aria-modal, trampa de foco, Esc,
// bloqueo del scroll y devolución del foco al disparador al cerrar.
// Lo usan ConfirmDialog y otros modales de la web pública.

const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
].join(",");

const getFocusable = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

type ModalDialogProps = {
    titleId: string;
    descriptionId?: string;
    // Sin onClose el diálogo no se puede cerrar con Esc ni con el fondo.
    onClose?: () => void;
    closeOnBackdrop?: boolean;
    className?: string;
    children: ReactNode;
};

export const ModalDialog = ({
    titleId,
    descriptionId,
    onClose,
    closeOnBackdrop = true,
    className,
    children,
}: ModalDialogProps) => {
    const panelRef = useRef<HTMLDivElement>(null);
    // Se captura en el primer render, antes de que el foco entre en el diálogo.
    const [triggerElement] = useState<HTMLElement | null>(() =>
        typeof document !== "undefined" && document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null,
    );

    // Bloquea el scroll del fondo mientras el diálogo está montado.
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    // Foco inicial dentro del diálogo y devolución al disparador al desmontar.
    useEffect(() => {
        const panel = panelRef.current;

        if (panel && !panel.contains(document.activeElement)) {
            const [firstFocusable] = getFocusable(panel);
            (firstFocusable ?? panel).focus();
        }

        return () => {
            if (triggerElement?.isConnected) {
                triggerElement.focus();
            }
        };
    }, [triggerElement]);

    // Esc cierra y Tab no sale del diálogo.
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                if (onClose) {
                    event.preventDefault();
                    onClose();
                }
                return;
            }

            if (event.key !== "Tab") {
                return;
            }

            const panel = panelRef.current;

            if (!panel) {
                return;
            }

            const focusable = getFocusable(panel);
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (!first || !last) {
                event.preventDefault();
                panel.focus();
                return;
            }

            const active = document.activeElement;
            const insideDialog = active instanceof Node && panel.contains(active);

            if (event.shiftKey) {
                if (!insideDialog || active === first || active === panel) {
                    event.preventDefault();
                    last.focus();
                }
            } else if (!insideDialog || active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            role="presentation"
        >
            <div
                className="absolute inset-0 bg-black/50"
                aria-hidden="true"
                onClick={() => {
                    if (closeOnBackdrop && onClose) {
                        onClose();
                    }
                }}
            />

            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
                className={[
                    "relative w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border-color)] bg-[var(--bg-surface)] focus:outline-none",
                    className,
                ]
                    .filter(Boolean)
                    .join(" ")}
                style={{ boxShadow: "var(--shadow-md)" }}
            >
                {children}
            </div>
        </div>
    );
};

export type ConfirmDialogProps = {
    open: boolean;
    title: string;
    description?: string;
    confirmLabel: string;
    cancelLabel?: string;
    tone?: "default" | "danger";
    requireReason?: boolean;
    reasonLabel?: string;
    // Error de la acción, mostrado dentro del diálogo.
    error?: string | null;
    loading?: boolean;
    onConfirm: (reason?: string) => void | Promise<void>;
    onCancel: () => void;
};

type ConfirmDialogContentProps = Omit<ConfirmDialogProps, "open">;

const ConfirmDialogContent = ({
    title,
    description,
    confirmLabel,
    cancelLabel = "Cancelar",
    tone = "default",
    requireReason = false,
    reasonLabel = "Motivo",
    error,
    loading = false,
    onConfirm,
    onCancel,
}: ConfirmDialogContentProps) => {
    const titleId = useId();
    const descriptionId = useId();
    const reasonId = useId();
    const reasonErrorId = useId();
    const [reason, setReason] = useState("");
    const [reasonError, setReasonError] = useState<string | null>(null);

    const handleConfirm = () => {
        if (!requireReason) {
            void onConfirm();
            return;
        }

        const trimmedReason = reason.trim();

        if (!trimmedReason) {
            setReasonError("El motivo es requerido.");
            return;
        }

        void onConfirm(trimmedReason);
    };

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

            {requireReason && (
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
                        aria-required="true"
                        aria-invalid={reasonError ? true : undefined}
                        aria-describedby={reasonError ? reasonErrorId : undefined}
                        placeholder="Escribe el motivo de esta acción."
                        onChange={(event) => {
                            setReason(event.target.value);
                            if (reasonError) {
                                setReasonError(null);
                            }
                        }}
                        className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
                    />
                    {reasonError && (
                        <p
                            id={reasonErrorId}
                            className="text-sm font-medium text-[var(--danger)]"
                        >
                            {reasonError}
                        </p>
                    )}
                </div>
            )}

            {error && (
                <p role="alert" className="text-sm font-medium text-[var(--danger)]">
                    {error}
                </p>
            )}

            <div className="flex flex-col-reverse justify-end gap-3 pt-2 sm:flex-row">
                {/* En acciones destructivas sin motivo, el foco inicial va a Cancelar. */}
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onCancel}
                    disabled={loading}
                    autoFocus={tone === "danger" && !requireReason}
                >
                    {cancelLabel}
                </Button>
                <Button
                    type="button"
                    variant={tone === "danger" ? "danger" : "primary"}
                    loading={loading}
                    onClick={handleConfirm}
                    autoFocus={tone !== "danger" && !requireReason}
                >
                    {confirmLabel}
                </Button>
            </div>
        </ModalDialog>
    );
};

// Diálogo de confirmación compartido. Sustituye a window.confirm.
export const ConfirmDialog = ({ open, ...props }: ConfirmDialogProps) => {
    if (!open) {
        return null;
    }

    return <ConfirmDialogContent {...props} />;
};
