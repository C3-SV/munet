"use client";

import Image from "next/image";
import Link from "next/link";
import { useTheme } from "../../lib/theme-context";

interface BrandAttributionProps {
    compact?: boolean;
    className?: string;
}

export const BrandAttribution = ({
    compact = false,
    className = "",
}: BrandAttributionProps) => {
    const { theme } = useTheme();
    const logo = theme === "dark" ? "/c3-logo-blanco.png" : "/c3-logo-azul.png";

    return (
        <Link
            href="https://c3.com.sv"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Desarrollado por C3 — abre c3.com.sv en una pestaña nueva"
            className={`inline-flex items-center gap-2 rounded-md transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 ${className}`}
            style={{ color: "var(--text-secondary)" }}
        >
            <span className="text-xs font-body font-medium whitespace-nowrap">
                Desarrollado por C3
            </span>
            <Image
                src={logo}
                alt="C3"
                className={compact ? "h-3.5 w-auto" : "h-4 w-auto sm:h-5"}
                loading="lazy"
                width={2920} height={1234} unoptimized
            />
        </Link>
    );
};
