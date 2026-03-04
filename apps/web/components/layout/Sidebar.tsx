"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const Sidebar = () => {
    const pathname = usePathname();

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

    return (
        <>
            {!isChatRoom && (
                <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40 flex items-center justify-between px-4 md:hidden shadow-sm">
                    <Link href="/feed/general" className="shrink-0">
                        <img
                            src="/logo-munet.png"
                            alt="MUNET"
                            className="h-8 w-auto hover:opacity-80 transition-opacity"
                        />
                    </Link>
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 bg-gray-50 rounded-lg border border-gray-100 text-titles transition-transform active:scale-95"
                    >
                        <img
                            src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/menu-2.svg"
                            alt="Menú"
                            className="size-6 opacity-70"
                        />
                    </button>
                </div>
            )}

            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <aside
                className={`fixed inset-y-0 right-0 md:left-0 md:right-auto z-50 flex h-screen w-64 flex-col border-l md:border-l-0 md:border-r border-gray-200 bg-white px-6 shadow-xl md:shadow-sm transition-transform duration-300 ease-in-out ${
                    isMobileMenuOpen
                        ? "translate-x-0"
                        : "translate-x-full md:translate-x-0"
                }`}
            >
                <div className="flex flex-col mt-8 md:mt-10 shrink-0">
                    <div className="flex items-center justify-between">
                        <Link href="/feed/general" className="shrink-0">
                            <img
                                alt="MUNET"
                                src="/logo-munet.png"
                                className="h-10 w-auto hover:opacity-80 transition-opacity"
                            />
                        </Link>
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="md:hidden p-1.5 -mr-1.5 opacity-50 hover:opacity-100 hover:bg-gray-100 rounded-md transition-all"
                        >
                            <img
                                src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/x.svg"
                                alt="Cerrar"
                                className="size-6"
                            />
                        </button>
                    </div>
                    <div className="mt-5 bg-primary h-1.5 w-full rounded-full opacity-90"></div>
                </div>

                <nav className="flex flex-1 flex-col mt-8 overflow-y-auto">
                    <ul className="flex flex-1 flex-col gap-y-6">
                        <li className="space-y-2">
                            {navigation.map((item) => (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`group flex items-center gap-x-3 rounded-xl p-3 text-sm font-semibold font-heading transition-all ${item.current ? "bg-background text-primary" : "text-titles hover:bg-gray-50 hover:text-primary"}`}
                                >
                                    <img
                                        src={item.icon}
                                        className={`size-5 transition-opacity ${item.current ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}
                                        alt=""
                                    />
                                    {item.name}
                                </Link>
                            ))}
                        </li>

                        <li>
                            <button
                                onClick={() => setIsComitesOpen(!isComitesOpen)}
                                className="group flex w-full items-center gap-x-3 rounded-xl p-3 text-left transition-all hover:bg-gray-50"
                            >
                                <img
                                    src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/users.svg"
                                    className="size-5 opacity-60"
                                    alt=""
                                />
                                <span className="flex-1 text-sm font-semibold text-titles hover:text-primary transition-colors">
                                    Muros de comités
                                </span>
                                <img
                                    src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/chevron-right.svg"
                                    className={`size-4 transition-transform duration-200 opacity-40 ${isComitesOpen ? "rotate-90" : ""}`}
                                    alt=""
                                />
                            </button>

                            <div
                                className={`mt-1 overflow-hidden transition-all duration-300 ${isComitesOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}
                            >
                                <ul className="pl-11 space-y-1">
                                    {comites.map((comite) => {
                                        const isSelected =
                                            pathname === comite.href;
                                        return (
                                            <li key={comite.name}>
                                                <Link
                                                    href={comite.href}
                                                    className={`block rounded-lg py-2.5 px-3 -ml-3 text-sm font-heading font-medium transition-colors ${isSelected ? "text-primary bg-gray-50" : "text-gray-700 hover:text-primary hover:bg-gray-50"}`}
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
                                className={`group flex items-center gap-x-3 rounded-xl p-3 text-sm font-semibold font-heading transition-all ${pathname === "/chat" ? "bg-background text-primary" : "text-titles hover:bg-gray-50 hover:text-primary"}`}
                            >
                                <img
                                    src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/message-circle.svg"
                                    className={`size-5 transition-opacity ${pathname === "/chat" ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}
                                    alt=""
                                />
                                Mensajes Directos
                            </Link>
                        </li>
                    </ul>
                </nav>

                <div className="-mx-6 mt-auto border-t border-gray-100 p-4 bg-white">
                    <Link
                        href="/profile"
                        className="flex w-full items-center gap-x-3 rounded-2xl p-3 hover:bg-gray-50 transition-all group text-left"
                    >
                        <div className="relative">
                            <img
                                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                                alt="User Profile"
                                className="size-11 rounded-full border-2 border-primary/10 shadow-sm"
                            />
                            <span className="absolute bottom-0.5 right-0.5 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white"></span>
                        </div>
                        <div className="flex flex-1 flex-col">
                            <span className="text-sm font-bold text-titles font-heading leading-tight">
                                Rober Morán
                            </span>
                            <span className="text-[10px] font-extrabold text-primary uppercase tracking-widest">
                                DELEGADO
                            </span>
                        </div>
                        <img
                            src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/chevron-right.svg"
                            className="size-4 opacity-40 group-hover:translate-x-1 transition-transform"
                            alt=""
                        />
                    </Link>
                </div>
            </aside>
        </>
    );
};
