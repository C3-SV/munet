"use client";

// Banner de feedback temporal para confirmar acciones exitosas en el panel admin.
// Se muestra brevemente y luego desaparece, o el padre lo puede desmontar.

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

    return (
        <div
            className="flex items-start gap-3 rounded-xl px-4 py-3"
            role="alert"
            style={{
                backgroundColor: isSuccess
                    ? "color-mix(in srgb, #22c55e 10%, transparent)"
                    : "color-mix(in srgb, #ef4444 10%, transparent)",
                border: `1px solid ${isSuccess ? "color-mix(in srgb, #22c55e 25%, transparent)" : "color-mix(in srgb, #ef4444 25%, transparent)"}`,
                color: isSuccess ? "#16a34a" : "#ef4444",
            }}
        >
            <img
                src={
                    isSuccess
                        ? "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/circle-check.svg"
                        : "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/circle-x.svg"
                }
                className="size-5 mt-0.5 shrink-0"
                style={{
                    filter: isSuccess
                        ? "invert(40%) sepia(80%) saturate(400%) hue-rotate(100deg)"
                        : "invert(30%) sepia(80%) saturate(600%) hue-rotate(330deg)",
                }}
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
                        style={{
                            filter: isSuccess
                                ? "invert(40%) sepia(80%) saturate(400%) hue-rotate(100deg)"
                                : "invert(30%) sepia(80%) saturate(600%) hue-rotate(330deg)",
                        }}
                        alt=""
                    />
                </button>
            )}
        </div>
    );
};
