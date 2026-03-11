"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "../../lib/theme-context";

export const Sidebar = () => {
    const pathname = usePathname();
    const { theme, toggleTheme } = useTheme();

    const isChatRoom = pathname?.match(/^\/chat\/[a-zA-Z0-9_-]+$/);

    const [isComitesOpen, setIsComitesOpen] = useState(
        pathname?.includes("comite") || false,
    );
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (pathname?.includes("comite")) {
            setIsComitesOpen(true);
        }
    }, [pathname]);

    const navigation = [
        {
            name: "Muro General",
            href: "/feed/general",
            icon: "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/world.svg",
            current: pathname === "/feed/general" || pathname === "/feed",
        },
        {
            name: "Avisos",
            href: "/feed/avisos",
            icon: "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/bell.svg",
            current: pathname === "/feed/avisos",
        },
    ];

    const comites = [
        { name: "Comite 1", href: "/feed/comite-1" },
        { name: "Comite 2", href: "/feed/comite-2" },
        { name: "Comite 3", href: "/feed/comite-3" },
    ];

    const isDark = theme === "dark";

    return (
        <>
            {!isChatRoom && (
                <div
                    className="fixed top-0 left-0 right-0 h-16 z-40 flex items-center justify-between px-4 md:hidden shadow-sm"
                    style={{
                        backgroundColor: "var(--bg-sidebar)",
                        borderBottom: "1px solid var(--border-color)",
                    }}
                >
                    <Link href="/feed/general" className="shrink-0">
                        <img
                            src="/logo-munet.png"
                            alt="MUNET"
                            className="h-8 w-auto hover:opacity-80 transition-opacity"
                            style={{ filter: isDark ? "brightness(0) invert(1)" : "none" }}
                        />
                    </Link>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-lg transition-all"
                            style={{
                                backgroundColor: "var(--bg-surface-secondary)",
                                border: "1px solid var(--border-color)",
                                color: "var(--text-secondary)",
                            }}
                            aria-label="Toggle theme"
                        >
                            {isDark ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                                </svg>
                            )}
                        </button>
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 rounded-lg transition-all active:scale-95"
                            style={{
                                backgroundColor: "var(--bg-surface-secondary)",
                                border: "1px solid var(--border-color)",
                                color: "var(--text-primary)",
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <aside
                className={`fixed inset-y-0 right-0 md:left-0 md:right-auto z-50 flex h-screen w-64 flex-col px-5 transition-transform duration-300 ease-in-out ${
                    isMobileMenuOpen
                        ? "translate-x-0"
                        : "translate-x-full md:translate-x-0"
                }`}
                style={{
                    backgroundColor: "var(--bg-sidebar)",
                    borderRight: "1px solid var(--border-color)",
                    boxShadow: isMobileMenuOpen ? "var(--shadow-md)" : "var(--shadow-sm)",
                }}
            >
                <div className="flex flex-col mt-8 md:mt-10 shrink-0">
                    <div className="flex items-center justify-between">
                        <Link href="/feed/general" className="shrink-0">
                            <img
                                alt="MUNET"
                                src="/logo-munet.png"
                                className="h-9 w-auto hover:opacity-80 transition-opacity"
                                style={{ filter: isDark ? "brightness(0) invert(1)" : "none" }}
                            />
                        </Link>
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="md:hidden p-1.5 rounded-md transition-all"
                            style={{ color: "var(--text-muted)" }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    <div className="mt-5 h-0.5 w-full rounded-full" style={{ backgroundColor: "var(--text-accent)", opacity: 0.6 }}></div>
                </div>

                <nav className="flex flex-1 flex-col mt-8 overflow-y-auto">
                    <ul className="flex flex-1 flex-col gap-y-6">
                        <li className="space-y-1">
                            {navigation.map((item) => (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className="group flex items-center gap-x-3 rounded-xl p-3 text-sm font-semibold font-heading transition-all"
                                    style={{
                                        backgroundColor: item.current ? "var(--sidebar-active-bg)" : "transparent",
                                        color: item.current ? "var(--sidebar-active-text)" : "var(--text-primary)",
                                    }}
                                >
                                    <img
                                        src={item.icon}
                                        className="size-5 transition-opacity"
                                        style={{
                                            opacity: item.current ? 1 : 0.5,
                                            filter: isDark ? "invert(1)" : "none",
                                        }}
                                        alt=""
                                    />
                                    {item.name}
                                </Link>
                            ))}
                        </li>

                        <li>
                            <button
                                onClick={() => setIsComitesOpen(!isComitesOpen)}
                                className="group flex w-full items-center gap-x-3 rounded-xl p-3 text-left transition-all"
                                style={{ color: "var(--text-primary)" }}
                            >
                                <img
                                    src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/users.svg"
                                    className="size-5"
                                    style={{ opacity: 0.5, filter: isDark ? "invert(1)" : "none" }}
                                    alt=""
                                />
                                <span className="flex-1 text-sm font-semibold font-heading">
                                    Muros de comités
                                </span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="transition-transform duration-200"
                                    style={{
                                        opacity: 0.4,
                                        transform: isComitesOpen ? "rotate(90deg)" : "rotate(0deg)",
                                        color: "var(--text-secondary)",
                                    }}
                                >
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>

                            <div
                                className="mt-1 overflow-hidden transition-all duration-300"
                                style={{ maxHeight: isComitesOpen ? "200px" : "0", opacity: isComitesOpen ? 1 : 0 }}
                            >
                                <ul className="pl-11 space-y-1">
                                    {comites.map((comite) => {
                                        const isSelected = pathname === comite.href;
                                        return (
                                            <li key={comite.name}>
                                                <Link
                                                    href={comite.href}
                                                    className="block rounded-lg py-2.5 px-3 -ml-3 text-sm font-heading font-medium transition-colors"
                                                    style={{
                                                        color: isSelected ? "var(--sidebar-active-text)" : "var(--text-secondary)",
                                                        backgroundColor: isSelected ? "var(--sidebar-active-bg)" : "transparent",
                                                    }}
                                                >
                                                    {comite.name}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </li>

                        <li>
                            <Link
                                href="/chat"
                                className="group flex items-center gap-x-3 rounded-xl p-3 text-sm font-semibold font-heading transition-all"
                                style={{
                                    backgroundColor: pathname?.startsWith("/chat") ? "var(--sidebar-active-bg)" : "transparent",
                                    color: pathname?.startsWith("/chat") ? "var(--sidebar-active-text)" : "var(--text-primary)",
                                }}
                            >
                                <img
                                    src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/message-circle.svg"
                                    className="size-5 transition-opacity"
                                    style={{
                                        opacity: pathname?.startsWith("/chat") ? 1 : 0.5,
                                        filter: isDark ? "invert(1)" : "none",
                                    }}
                                    alt=""
                                />
                                Mensajes Directos
                            </Link>
                        </li>
                    </ul>
                </nav>

                {/* Bottom: Theme toggle + User profile */}
                <div
                    className="-mx-5 mt-auto p-4"
                    style={{ borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-sidebar)" }}
                >
                    {/* Theme toggle */}
                    <button
                        onClick={toggleTheme}
                        className="flex w-full items-center gap-x-3 rounded-xl p-3 mb-2 text-sm font-medium font-heading transition-all"
                        style={{
                            color: "var(--text-secondary)",
                            backgroundColor: "transparent",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                        <span
                            className="size-8 flex items-center justify-center rounded-lg"
                            style={{
                                backgroundColor: "var(--bg-surface-secondary)",
                                border: "1px solid var(--border-color)",
                                color: "var(--text-secondary)",
                            }}
                        >
                            {isDark ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                                </svg>
                            )}
                        </span>
                        {isDark ? "Modo claro" : "Modo oscuro"}
                    </button>

                    {/* User profile */}
                    <Link
                        href="/profile"
                        className="flex w-full items-center gap-x-3 rounded-2xl p-3 transition-all group text-left"
                        style={{ color: "var(--text-primary)" }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                        <div className="relative shrink-0">
                            <img
                                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                                alt="User Profile"
                                className="size-10 rounded-full object-cover"
                                style={{ border: "2px solid var(--border-color)" }}
                            />
                            <span
                                className="absolute bottom-0.5 right-0.5 block h-2.5 w-2.5 rounded-full bg-green-500"
                                style={{ boxShadow: "0 0 0 2px var(--bg-sidebar)" }}
                            ></span>
                        </div>
                        <div className="flex flex-1 flex-col min-w-0">
                            <span className="text-sm font-bold font-heading leading-tight truncate" style={{ color: "var(--text-primary)" }}>
                                Rober Morán
                            </span>
                            <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-accent)" }}>
                                DELEGADO
                            </span>
                        </div>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ opacity: 0.3, color: "var(--text-secondary)" }}
                        >
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </Link>
                </div>
            </aside>
        </>
    );
};
