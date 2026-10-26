"use client";

const STATUS_LABELS: Record<string, string> = {
    ACTIVE: "Activo",
    CLOSED: "Cerrado",
    ARCHIVED: "Archivado",
    INACTIVE: "Inactivo",
};

const STATUS_PALETTES: Record<string, { backgroundColor: string; color: string }> = {
    ACTIVE: {
        backgroundColor: "color-mix(in srgb, #22c55e 12%, transparent)",
        color: "#16a34a",
    },
    CLOSED: {
        backgroundColor: "color-mix(in srgb, #f59e0b 14%, transparent)",
        color: "#b45309",
    },
    ARCHIVED: {
        backgroundColor: "color-mix(in srgb, #94a3b8 14%, transparent)",
        color: "var(--text-secondary)",
    },
    INACTIVE: {
        backgroundColor: "color-mix(in srgb, #94a3b8 14%, transparent)",
        color: "var(--text-secondary)",
    },
};

const FALLBACK_PALETTE = {
    backgroundColor: "color-mix(in srgb, #94a3b8 12%, transparent)",
    color: "var(--text-secondary)",
};

export const AdminStatusBadge = ({ status }: { status: string }) => {
    const normalized = status.trim().toUpperCase();

    return (
        <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={STATUS_PALETTES[normalized] ?? FALLBACK_PALETTE}
        >
            {STATUS_LABELS[normalized] ?? status}
        </span>
    );
};
