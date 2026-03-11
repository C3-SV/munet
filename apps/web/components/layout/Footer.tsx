import React from "react";
import Link from "next/link";

export const Footer = () => {
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
                        className="h-5 opacity-40"
                        style={{ filter: "grayscale(1)" }}
                    />
                    <span
                        className="text-xs font-body font-medium"
                        style={{ color: "var(--text-muted)" }}
                    >
                        © {new Date().getFullYear()} MUN ESEN. Plataforma oficial.
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
                        Soporte Técnico
                    </Link>
                    <Link
                        href="#"
                        className="transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "var(--text-accent)")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                        Términos de Uso
                    </Link>
                </div>
            </div>
        </footer>
    );
};
