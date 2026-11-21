import Link from "next/link";
import type { ReactNode } from "react";

// Acción de fila solo con icono: enlace (href) o botón (onClick) con nombre accesible
// y tooltip nativo. Zona táctil de 44 px en móvil y 36 px en escritorio.
type IconActionProps = {
    label: string;
    icon: ReactNode;
    href?: string;
    onClick?: () => void;
    tone?: "default" | "danger";
    disabled?: boolean;
};

const BASE_CLASS =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-color)] no-underline hover:bg-[var(--bg-surface-secondary)] disabled:cursor-not-allowed disabled:opacity-50 md:min-h-9 md:min-w-9";

export const IconAction = ({
    label,
    icon,
    href,
    onClick,
    tone = "default",
    disabled = false,
}: IconActionProps) => {
    const className = `${BASE_CLASS} ${
        tone === "danger"
            ? "text-[var(--danger)] hover:bg-[var(--danger-bg)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-accent)]"
    }`;

    if (href) {
        return (
            <Link href={href} aria-label={label} title={label} className={className}>
                {icon}
            </Link>
        );
    }

    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            className={className}
            onClick={onClick}
            disabled={disabled}
        >
            {icon}
        </button>
    );
};
