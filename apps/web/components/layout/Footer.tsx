"use client";

import Image from "next/image";
import Link from "next/link";
import { useTheme } from "../../lib/theme-context";
import { BrandAttribution } from "./BrandAttribution";
import { MunEsenLogo } from "./MunEsenLogo";

// Footer global: marca MUNET y MUN ESEN a la izquierda; guía y crédito de C3 a la derecha.
export const Footer = () => {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    return (
        <footer
            className="w-full py-6 px-4 sm:px-6 lg:px-12 mt-auto shrink-0"
            style={{
                borderTop: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-surface)",
            }}
        >
            <div className="max-w-4xl mx-auto flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 md:justify-start">
                    <Image
                        src="/logo-munet.png"
                        alt="MUNET"
                        className="h-6 w-auto shrink-0"
                        style={{
                            opacity: isDark ? 0.8 : 0.9,
                            filter: isDark ? "brightness(0) invert(1)" : "none",
                        }}
                        width={954}
                        height={299}
                        unoptimized
                    />
                    <span aria-hidden="true" className="h-6 w-px" style={{ backgroundColor: "var(--border-color)" }} />
                    <MunEsenLogo className="h-9 w-auto shrink-0 rounded-md" />
                    <span
                        className="text-xs font-body font-medium whitespace-nowrap"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        © {new Date().getFullYear()} MUN ESEN
                    </span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 md:justify-end">
                    <Link
                        href="/guia"
                        className="text-xs font-body font-semibold whitespace-nowrap hover:underline"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Guía de uso
                    </Link>
                    <BrandAttribution />
                </div>
            </div>
        </footer>
    );
};
