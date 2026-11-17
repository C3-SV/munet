"use client";

import { useEffect, useRef } from "react";

// Notificación breve para confirmar acciones del panel admin.

type AdminToastProps = {
    type: "success" | "error";
    message: string;
    onDismiss: () => void;
};

const PALETTES = {
    success: {
        color: "#16a34a",
        backgroundColor: "color-mix(in srgb, #22c55e 12%, var(--bg-surface))",
        border: "1px solid color-mix(in srgb, #22c55e 30%, transparent)",
    },
    error: {
        color: "#ef4444",
        backgroundColor: "color-mix(in srgb, #ef4444 12%, var(--bg-surface))",
        border: "1px solid color-mix(in srgb, #ef4444 30%, transparent)",
    },
} as const;

export const AdminToast = ({ type, message, onDismiss }: AdminToastProps) => {
    const onDismissRef = useRef(onDismiss);

    useEffect(() => {
        onDismissRef.current = onDismiss;
    }, [onDismiss]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            onDismissRef.current();
        }, 4500);

        return () => {
            window.clearTimeout(timer);
        };
    }, []);

    const palette = PALETTES[type];

    return (
        <div
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:w-96 z-[120] flex items-start gap-3 rounded-xl px-4 py-3"
            role={type === "error" ? "alert" : "status"}
            style={{
                backgroundColor: palette.backgroundColor,
                border: palette.border,
                color: palette.color,
                boxShadow: "var(--shadow-md)",
            }}
        >
            <p className="text-sm font-medium flex-1">{message}</p>
            <button
                type="button"
                onClick={onDismiss}
                className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
                aria-label="Cerrar notificación"
            >
                ×
            </button>
        </div>
    );
};
