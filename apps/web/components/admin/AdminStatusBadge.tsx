"use client";

// Estado de cuenta, evento o comité. Solo usa tokens de color (--success, --warning,
// --danger y --danger-bg): no contiene hexadecimales ni rgba propios.

const STATUS_LABELS: Record<string, string> = {
    ACTIVE: "Activo",
    CLOSED: "Cerrado",
    ARCHIVED: "Archivado",
    INACTIVE: "Inactivo",
    PENDING_ACTIVATION: "Pendiente de activación",
    SUSPENDED: "Suspendido",
};

type StatusTone = "success" | "warning" | "danger" | "neutral";

const STATUS_TONES: Record<string, StatusTone> = {
    ACTIVE: "success",
    CLOSED: "warning",
    PENDING_ACTIVATION: "warning",
    SUSPENDED: "danger",
    ARCHIVED: "neutral",
    INACTIVE: "neutral",
};

const TONE_STYLES: Record<StatusTone, { backgroundColor: string; color: string }> = {
    success: {
        backgroundColor: "color-mix(in srgb, var(--success) 8%, transparent)",
        color: "var(--success)",
    },
    warning: {
        backgroundColor: "color-mix(in srgb, var(--warning) 8%, transparent)",
        color: "var(--warning)",
    },
    danger: {
        backgroundColor: "var(--danger-bg)",
        color: "var(--danger)",
    },
    neutral: {
        backgroundColor: "color-mix(in srgb, var(--text-muted) 14%, transparent)",
        color: "var(--text-primary)",
    },
};

export const AdminStatusBadge = ({ status }: { status: string }) => {
    const normalized = status.trim().toUpperCase();
    const tone = STATUS_TONES[normalized] ?? "neutral";

    return (
        <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={TONE_STYLES[tone]}
        >
            {STATUS_LABELS[normalized] ?? status}
        </span>
    );
};
