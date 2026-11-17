"use client";

// Banner de feedback para confirmar acciones y mostrar advertencias en el panel admin.

type AdminAlertBannerProps = {
    type: "success" | "error" | "warning";
    message: string;
    onDismiss?: () => void;
};

const PALETTES = {
    success: {
        color: "#16a34a",
        backgroundColor: "color-mix(in srgb, #22c55e 10%, transparent)",
        border: "1px solid color-mix(in srgb, #22c55e 25%, transparent)",
        icon: "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/circle-check.svg",
        iconFilter:
            "invert(40%) sepia(80%) saturate(400%) hue-rotate(100deg)",
    },
    error: {
        color: "#ef4444",
        backgroundColor: "color-mix(in srgb, #ef4444 10%, transparent)",
        border: "1px solid color-mix(in srgb, #ef4444 25%, transparent)",
        icon: "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/circle-x.svg",
        iconFilter:
            "invert(30%) sepia(80%) saturate(600%) hue-rotate(330deg)",
    },
    warning: {
        color: "#b45309",
        backgroundColor: "color-mix(in srgb, #f59e0b 10%, transparent)",
        border: "1px solid color-mix(in srgb, #f59e0b 30%, transparent)",
        icon: "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/alert-triangle.svg",
        iconFilter:
            "invert(55%) sepia(90%) saturate(800%) hue-rotate(345deg) brightness(85%)",
    },
} as const;

export const AdminAlertBanner = ({
    type,
    message,
    onDismiss,
}: AdminAlertBannerProps) => {
    const palette = PALETTES[type];

    return (
        <div
            className="flex items-start gap-3 rounded-xl px-4 py-3"
            role={type === "error" ? "alert" : "status"}
            style={{
                backgroundColor: palette.backgroundColor,
                border: palette.border,
                color: palette.color,
            }}
        >
            <img
                src={palette.icon}
                className="size-5 mt-0.5 shrink-0"
                style={{ filter: palette.iconFilter }}
                alt=""
            />
            <p className="text-sm font-medium flex-1">{message}</p>
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                    aria-label="Cerrar"
                >
                    <img
                        src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/x.svg"
                        className="size-4"
                        style={{ filter: palette.iconFilter }}
                        alt=""
                    />
                </button>
            )}
        </div>
    );
};
