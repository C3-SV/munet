"use client";

import { useEffect, useRef, useState } from "react";
import { AdminButton } from "./AdminButton";
import { AdminModal } from "./AdminModal";

// Modal para mostrar credenciales de un solo uso. No debe cerrarse por error.

export type AdminCredentialField = {
    key: string;
    label: string;
    value: string;
};

type AdminCredentialsDialogProps = {
    title: string;
    description?: string;
    fields: AdminCredentialField[];
    note?: string;
    warnings?: string[];
    onClose: () => void;
};

export const AdminCredentialsDialog = ({
    title,
    description,
    fields,
    note,
    warnings,
    onClose,
}: AdminCredentialsDialogProps) => {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [copyError, setCopyError] = useState(false);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);

            if (timeoutRef.current !== null) {
                window.clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleCopy = async (field: AdminCredentialField) => {
        try {
            await navigator.clipboard.writeText(field.value);
            setCopiedKey(field.key);
            setCopyError(false);

            if (timeoutRef.current !== null) {
                window.clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = window.setTimeout(() => {
                setCopiedKey(null);
            }, 2000);
        } catch {
            setCopiedKey(null);
            setCopyError(true);
        }
    };

    return (
        <AdminModal
            title={title}
            description={description}
            onClose={onClose}
            dismissible={false}
            maxWidthClassName="max-w-md"
            footer={
                <AdminButton type="button" onClick={onClose}>
                    Cerrar
                </AdminButton>
            }
        >
            <div className="space-y-2">
                {fields.map((field) => (
                    <div
                        key={field.key}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl p-3"
                        style={{
                            backgroundColor: "var(--bg-surface-secondary)",
                            border: "1px solid var(--border-color)",
                        }}
                    >
                        <div className="min-w-0 flex-1">
                            <p
                                className="text-[10px] font-extrabold uppercase tracking-widest font-heading"
                                style={{ color: "var(--text-muted)" }}
                            >
                                {field.label}
                            </p>
                            <code
                                className="mt-1 block text-sm font-semibold break-all"
                                style={{
                                    color: "var(--text-primary)",
                                    userSelect: "all",
                                }}
                            >
                                {field.value}
                            </code>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleCopy(field)}
                            className="shrink-0 text-xs font-semibold font-heading transition-opacity hover:opacity-70"
                            style={{ color: "var(--text-accent)" }}
                        >
                            {copiedKey === field.key ? "Copiado" : "Copiar"}
                        </button>
                    </div>
                ))}
            </div>

            {copyError && (
                <p className="text-xs font-medium" style={{ color: "var(--danger)" }}>
                    No se pudo copiar automáticamente. Selecciona el valor y
                    cópialo manualmente.
                </p>
            )}

            {warnings && warnings.length > 0 && (
                <div
                    className="rounded-xl p-3 space-y-1"
                    style={{
                        backgroundColor:
                            "color-mix(in srgb, var(--warning) 10%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
                    }}
                >
                    <p
                        className="text-xs font-bold font-heading"
                        style={{ color: "var(--warning)" }}
                    >
                        Advertencias
                    </p>
                    <ul
                        className="list-disc pl-4 space-y-1 text-xs"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        {warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                        ))}
                    </ul>
                </div>
            )}

            {note && (
                <p
                    className="text-xs leading-relaxed font-medium"
                    style={{ color: "var(--warning)" }}
                >
                    {note}
                </p>
            )}
        </AdminModal>
    );
};
