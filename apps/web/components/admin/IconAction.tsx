import Link from "next/link";
import type { ReactNode } from "react";

// Acción de fila solo con icono: enlace con nombre accesible y tooltip nativo.
// Zona táctil de 44 px en móvil y 36 px en escritorio.
type IconActionProps = {
    href: string;
    label: string;
    icon: ReactNode;
};

export const IconAction = ({ href, label, icon }: IconActionProps) => (
    <Link
        href={href}
        aria-label={label}
        title={label}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-color)] text-[var(--text-secondary)] no-underline hover:bg-[var(--bg-surface-secondary)] hover:text-[var(--text-accent)] md:min-h-9 md:min-w-9"
    >
        {icon}
    </Link>
);
