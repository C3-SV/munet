"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../../components/layout/AdminSidebar";
import { isAdminRole, useAuthStore } from "../../stores/auth.store";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();

    const hydrateAuth = useAuthStore((state) => state.hydrateAuth);
    const hydrated = useAuthStore((state) => state.hydrated);
    const token = useAuthStore((state) => state.token);
    const activeEventId = useAuthStore((state) => state.activeEventId);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const memberships = useAuthStore((state) => state.memberships);

    const activeMembership = useMemo(
        () => memberships.find((m) => m.id === activeMembershipId) ?? null,
        [activeMembershipId, memberships],
    );

    useEffect(() => {
        hydrateAuth();
    }, [hydrateAuth]);

    useEffect(() => {
        if (!hydrated) {
            return;
        }

        // 1. Validar autenticación básica
        if (!token) {
            router.replace("/login");
            return;
        }

        // 2. Validar que tenga un evento seleccionado
        if (!activeEventId || !activeMembershipId) {
            router.replace("/select-event");
            return;
        }

        // 3. Validar que la membresía activa tenga rol de administrador
        if (!activeMembership || !isAdminRole(activeMembership.role)) {
            // Si no es administrador, lo expulsamos al feed común
            router.replace("/feed");
        }
    }, [activeEventId, activeMembershipId, hydrated, memberships, activeMembership, router, token]);

    if (!hydrated || !token || !activeEventId || !activeMembershipId || !activeMembership || !isAdminRole(activeMembership.role)) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-base)" }}>
                <span className="font-body text-sm" style={{ color: "var(--text-secondary)" }}>
                    Verificando credenciales de administrador...
                </span>
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg-base)" }}>
            <AdminSidebar />

            <main
                className="flex-1 overflow-y-auto relative flex flex-col pl-64"
                style={{ backgroundColor: "var(--bg-base)" }}
            >
                <div className="flex-1 p-8 sm:p-10">{children}</div>
            </main>
        </div>
    );
}
