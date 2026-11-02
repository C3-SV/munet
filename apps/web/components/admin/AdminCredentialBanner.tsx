"use client";

import { useEffect, useRef, useState } from "react";
import { AdminButton } from "./AdminButton";

// Banner para mostrar una contraseña temporal una sola vez con acción de copiar.
// El padre debe descartarla del estado cuando se oculte.

type AdminCredentialBannerProps = {
    title: string;
    password: string;
    participantCode?: string;
    note?: string;
    onDismiss?: () => void;
};

export const AdminCredentialBanner = ({
    title,
    password,
    participantCode,
    note,
    onDismiss,
}: AdminCredentialBannerProps) => {
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState(false);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current !== null) {
                window.clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(password);
            setCopied(true);
            setCopyError(false);

            if (timeoutRef.current !== null) {
                window.clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = window.setTimeout(() => {
                setCopied(false);
            }, 2000);
        } catch {
            setCopied(false);
            setCopyError(true);
        }
    };

    return (
        <section
            aria-label={title}
            className="rounded-2xl p-5 space-y-3"
            style={{
                backgroundColor: "color-mix(in srgb, #f59e0b 8%, var(--bg-surface))",
                border: "1px solid color-mix(in srgb, #f59e0b 35%, transparent)",
            }}
        >
            <div className="space-y-1">
                <p
                    className="text-sm font-bold font-heading"
                    style={{ color: "#b45309" }}
                >
                    {title}
                </p>
                {participantCode && (
                    <p
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Código de participante:{" "}
                        <span className="font-semibold">{participantCode}</span>
                    </p>
                )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <code
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold break-all"
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        color: "var(--text-primary)",
                        userSelect: "all",
                    }}
                >
                    {password}
                </code>
                <AdminButton
                    type="button"
                    variant="secondary"
                    onClick={handleCopy}
                    icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/copy.svg"
                >
                    {copied ? "Copiado" : "Copiar"}
                </AdminButton>
            </div>

            {copyError && (
                <p className="text-xs font-medium" style={{ color: "#ef4444" }}>
                    No se pudo copiar automáticamente. Selecciona la contraseña y
                    cópiala manualmente.
                </p>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                {note && (
                    <p
                        className="text-xs leading-relaxed"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        {note}
                    </p>
                )}
                {onDismiss && (
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="shrink-0 text-xs font-semibold font-heading transition-opacity hover:opacity-70"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Ocultar contraseña
                    </button>
                )}
            </div>
        </section>
    );
};
