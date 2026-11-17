"use client";

import { type ReactNode, useEffect, useId } from "react";

// Contenedor de diálogo reutilizable para el panel admin.

type AdminModalProps = {
    title: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    onClose: () => void;
    dismissible?: boolean;
    maxWidthClassName?: string;
};

export const AdminModal = ({
    title,
    description,
    children,
    footer,
    onClose,
    dismissible = true,
    maxWidthClassName = "max-w-lg",
}: AdminModalProps) => {
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    useEffect(() => {
        if (!dismissible) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [dismissible, onClose]);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            role="presentation"
        >
            <div
                className="absolute inset-0 bg-black/50"
                onClick={() => {
                    if (dismissible) {
                        onClose();
                    }
                }}
                aria-hidden
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                className={`relative w-full ${maxWidthClassName} max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-4`}
                style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    boxShadow: "var(--shadow-md)",
                }}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
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

                    {dismissible && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="shrink-0 rounded-lg p-1 opacity-60 transition-opacity hover:opacity-100"
                            aria-label="Cerrar"
                        >
                            <span
                                aria-hidden
                                className="block text-lg leading-none"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                ×
                            </span>
                        </button>
                    )}
                </div>

                {children}

                {footer && (
                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};
