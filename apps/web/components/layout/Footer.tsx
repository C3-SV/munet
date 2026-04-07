"use client";

import React from "react";
import Link from "next/link";
import { useTheme } from "../../lib/theme-context";

export const Footer = () => {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    return (
        <footer
            className="w-full py-5 px-4 sm:px-6 lg:px-12 mt-auto shrink-0"
            style={{
                borderTop: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-surface)",
            }}
        >
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <img
                        src="/logo-munet.png"
                        alt="MUNET"
                        className="h-5"
                        style={{
                            opacity: isDark ? 0.72 : 0.6,
                            filter: isDark ? "brightness(0) invert(1)" : "none",
                        }}
                    />
                    <span
                        className="text-xs font-body font-medium"
                        style={{ color: "var(--text-muted)" }}
                    >
                        (c) {new Date().getFullYear()} MUN ESEN. Plataforma oficial.
                    </span>
                </div>
                <div
                    className="flex items-center gap-6 text-xs font-body font-semibold"
                    style={{ color: "var(--text-muted)" }}
                >
                    <Link
                        href="#"
                        className="transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "var(--text-accent)")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                        Soporte tecnico
                    </Link>
                    <Link
                        href="#"
                        className="transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "var(--text-accent)")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                        Terminos de uso
                    </Link>
                </div>
            </div>
        </footer>
    );
};
