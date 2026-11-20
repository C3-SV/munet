"use client";

// Banner de feedback temporal para confirmar acciones exitosas en el panel admin.
// Se muestra brevemente y luego desaparece, o el padre lo puede desmontar.

import { IconCheckCircle, IconClose, IconXCircle } from "../ui/icons";

type AdminAlertBannerProps = {
    type: "success" | "error";
    message: string;
    onDismiss?: () => void;
};

export const AdminAlertBanner = ({
    type,
    message,
    onDismiss,
}: AdminAlertBannerProps) => {
    const isSuccess = type === "success";
    const tone = isSuccess ? "var(--success)" : "var(--danger)";

    return (
        <div
            className="flex items-start gap-3 rounded-xl px-4 py-3"
            role="alert"
            style={{
                backgroundColor: `color-mix(in srgb, ${tone} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${tone} 25%, transparent)`,
                color: tone,
            }}
        >
            {isSuccess ? (
                <IconCheckCircle size={20} className="mt-0.5 shrink-0" />
            ) : (
                <IconXCircle size={20} className="mt-0.5 shrink-0" />
            )}
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
