"use client";

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Button, type ButtonProps, type ButtonVariant } from "../ui/Button";

// Botón del panel admin sobre el `Button` compartido. Con `href` renderiza un enlace.

type AdminButtonVariant = "primary" | "secondary" | "danger";

type AdminButtonBaseProps = {
    variant?: AdminButtonVariant;
    loading?: boolean;
    icon?: string; // URL de ícono Tabler
    children?: ReactNode;
    className?: string;
};

type AdminNativeButtonProps = AdminButtonBaseProps &
    ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type AdminLinkButtonProps = AdminButtonBaseProps &
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

export type AdminButtonProps = AdminNativeButtonProps | AdminLinkButtonProps;

const VARIANT_MAP: Record<AdminButtonVariant, ButtonVariant> = {
    primary: "primary",
    secondary: "secondary",
    danger: "danger",
};

export const AdminButton = ({
    variant = "primary",
    loading = false,
    icon,
    children,
    ...props
}: AdminButtonProps) => {
    // Iconos blancos sobre relleno primario o peligro; el resto sigue el tema.
    const iconFilter = variant === "secondary" ? "var(--theme-icon-filter)" : "invert(1)";

    const leadingIcon = icon ? (
        // Icono remoto de Tabler (URL externa): sin next/image porque el host no está en remotePatterns.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" className="size-4" style={{ filter: iconFilter }} />
    ) : undefined;

    return (
        <Button
            {...(props as ButtonProps)}
            variant={VARIANT_MAP[variant]}
            loading={loading}
            leadingIcon={leadingIcon}
        >
            {children}
        </Button>
    );
};
