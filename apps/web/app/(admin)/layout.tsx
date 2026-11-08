"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, isAdminRole } from "../../stores/auth.store";
import { AdminSidebar } from "../../components/layout/AdminSidebar";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const hydrateAuth = useAuthStore((state) => state.hydrateAuth);
    const hydrated = useAuthStore((state) => state.hydrated);
    const token = useAuthStore((state) => state.token);
    const memberships = useAuthStore((state) => state.memberships);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);

    const activeMembership = memberships.find((m) => m.id === activeMembershipId);
    const isAdmin = activeMembership ? isAdminRole(activeMembership.role) : false;

    useEffect(() => {
        hydrateAuth();
    }, [hydrateAuth]);

    useEffect(() => {
        if (!hydrated) return;

        if (!token) {
            router.replace("/login");
            return;
        }

        if (!isAdmin) {
            // Sin contexto activo, el selector resuelve el evento; con contexto
            // no administrativo, el usuario vuelve al feed de participantes.
            router.replace(activeMembershipId ? "/feed" : "/select-event");
        }
    }, [hydrated, token, isAdmin, activeMembershipId, router]);

    if (!hydrated || !token || !isAdmin) {
        return (
            <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--bg-base)" }}>
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2" style={{ borderColor: "var(--text-accent)" }}></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: "var(--bg-base)" }}>
            <AdminSidebar />
            <div className="md:pl-64">
                <main className="px-4 pt-20 pb-10 sm:px-6 md:px-8 md:pt-10">
                    {children}
                </main>
            </div>
        </div>
    );
}
