"use client";

// Estado vacío reutilizable para tablas y listas del panel admin.

type AdminEmptyStateProps = {
    icon?: React.ReactNode; // Icono inline de components/ui/icons (size 32)
    title: string;
    description?: string;
    action?: React.ReactNode;
};

export const AdminEmptyState = ({
    icon,
    title,
    description,
    action,
}: AdminEmptyStateProps) => {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            {icon && (
                <div
                    className="mb-4 flex items-center justify-center rounded-2xl p-5"
                    style={{
                        backgroundColor: "var(--bg-surface-secondary)",
                        border: "1px solid var(--border-color)",
                        color: "var(--text-muted)",
                    }}
                >
                    {icon}
                </div>
            )}
            <p
                className="text-base font-bold font-heading"
                style={{ color: "var(--text-primary)" }}
            >
                {title}
            </p>
            {description && (
                <p
                    className="mt-1 text-sm max-w-xs"
                    style={{ color: "var(--text-secondary)" }}
                >
                    {description}
                </p>
            )}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
};
