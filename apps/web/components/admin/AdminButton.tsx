"use client";

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Button, type ButtonProps, type ButtonVariant } from "../ui/Button";

// Botón del panel admin sobre el `Button` compartido. Con `href` renderiza un enlace.

type AdminButtonVariant = "primary" | "secondary" | "danger";

type AdminButtonBaseProps = {
    variant?: AdminButtonVariant;
    loading?: boolean;
    icon?: ReactNode; // Icono inline de components/ui/icons (hereda currentColor)
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
    return (
        <Button
            {...(props as ButtonProps)}
            variant={VARIANT_MAP[variant]}
            loading={loading}
            leadingIcon={icon}
        >
            {children}
        </Button>
    );
};
