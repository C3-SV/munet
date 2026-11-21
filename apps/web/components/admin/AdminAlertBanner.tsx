"use client";

// Banner de feedback para confirmar acciones y mostrar advertencias en el panel admin.

import {
    IconAlertTriangle,
    IconCheckCircle,
    IconClose,
    IconXCircle,
} from "../ui/icons";

type AdminAlertBannerProps = {
    type: "success" | "error" | "warning";
    message: string;
    onDismiss?: () => void;
};

const TONES = {
    success: "var(--success)",
    error: "var(--danger)",
    warning: "var(--warning)",
} as const;

export const AdminAlertBanner = ({
    type,
    message,
    onDismiss,
}: AdminAlertBannerProps) => {
    const tone = TONES[type];
    const Icon =
        type === "success"
            ? IconCheckCircle
            : type === "error"
              ? IconXCircle
              : IconAlertTriangle;

    return (
        <div
            className="flex items-start gap-3 rounded-xl px-4 py-3"
            role={type === "error" ? "alert" : "status"}
            style={{
                backgroundColor: `color-mix(in srgb, ${tone} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${tone} 25%, transparent)`,
                color: tone,
            }}
        >
            <Icon size={20} className="mt-0.5 shrink-0" />
            <p className="text-sm font-medium flex-1">{message}</p>
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                    aria-label="Cerrar"
                >
                    <IconClose size={16} />
                </button>
            )}
        </div>
    );
};
