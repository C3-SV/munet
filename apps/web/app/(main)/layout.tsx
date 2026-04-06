"use client";

import React, { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "../../components/layout/Sidebar";
import { Footer } from "../../components/layout/Footer";
import { useAuthStore } from "../../stores/auth.store";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();

    const hydrateAuth = useAuthStore((state) => state.hydrateAuth);
    const hydrated = useAuthStore((state) => state.hydrated);
    const token = useAuthStore((state) => state.token);
    const activeEventId = useAuthStore((state) => state.activeEventId);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);

    const isChatRoom = useMemo(
        () => pathname?.match(/^\/chat\/[a-zA-Z0-9_-]+$/),
        [pathname],
    );

    useEffect(() => {
        hydrateAuth();
    }, [hydrateAuth]);

    useEffect(() => {
        if (!hydrated) {
            return;
        }

        if (!token) {
            router.replace("/login");
            return;
        }

        if (!activeEventId || !activeMembershipId) {
            router.replace("/select-event");
        }
    }, [activeEventId, activeMembershipId, hydrated, router, token]);

    if (!hydrated || !token || !activeEventId || !activeMembershipId) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-base)" }}>
                <span className="font-body text-sm" style={{ color: "var(--text-secondary)" }}>
                    Cargando sesion...
                </span>
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg-base)" }}>
            <Sidebar />

            <main
                className={`flex-1 overflow-y-auto relative flex flex-col md:pl-64 ${isChatRoom ? "" : "pt-16 md:pt-0"}`}
                style={{ backgroundColor: "var(--bg-base)" }}
            >
                <div className="flex-1 shrink-0">{children}</div>

                {!isChatRoom && <Footer />}
            </main>
        </div>
    );
}
