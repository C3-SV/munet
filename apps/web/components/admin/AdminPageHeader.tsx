"use client";

// Encabezado de sección reutilizable para páginas del panel admin.
// Acepta título, descripción opcional, breadcrumb y slot para acción (botón).

type AdminPageHeaderProps = {
    title: string;
    description?: string;
    breadcrumb?: { label: string; href?: string }[];
    action?: React.ReactNode;
};

export const AdminPageHeader = ({
    title,
    description,
    breadcrumb,
    action,
}: AdminPageHeaderProps) => {
    return (
        <div
            className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 mb-8"
            style={{ borderBottom: "1px solid var(--border-color)" }}
        >
            <div className="flex-1 min-w-0">
                {breadcrumb && breadcrumb.length > 0 && (
                    <nav className="flex items-center gap-1.5 mb-2 flex-wrap">
                        {breadcrumb.map((crumb, i) => (
                            <span key={i} className="flex items-center gap-1.5">
                                {i > 0 && (
                                    <span
                                        className="text-xs"
                                        style={{ color: "var(--text-muted)" }}
                                    >
                                        /
                                    </span>
                                )}
                                {crumb.href ? (
                                    <a
                                        href={crumb.href}
                                        className="text-xs font-semibold hover:underline transition-opacity hover:opacity-80"
                                        style={{ color: "var(--text-accent)" }}
                                    >
                                        {crumb.label}
                                    </a>
                                ) : (
                                    <span
                                        className="text-xs font-semibold"
                                        style={{ color: "var(--text-secondary)" }}
                                    >
                                        {crumb.label}
                                    </span>
                                )}
                            </span>
                        ))}
                    </nav>
                )}
                <h1
                    className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading"
                    style={{ color: "var(--text-primary)" }}
                >
                    {title}
                </h1>
                {description && (
                    <p
                        className="mt-2 text-sm leading-relaxed"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        {description}
                    </p>
                )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
};
