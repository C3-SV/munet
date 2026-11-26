"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore, canAccessAdminPanel, isAdminRole } from "../../stores/auth.store";
import { AdminSidebar } from "../../components/layout/AdminSidebar";
import { BrandAttribution } from "../../components/layout/BrandAttribution";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const hydrateAuth = useAuthStore((state) => state.hydrateAuth);
    const hydrated = useAuthStore((state) => state.hydrated);
    const token = useAuthStore((state) => state.token);
    const memberships = useAuthStore((state) => state.memberships);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);

    const activeMembership = memberships.find((m) => m.id === activeMembershipId);
    const isAdmin = activeMembership ? isAdminRole(activeMembership.role) : false;
    const canAccess = activeMembership ? canAccessAdminPanel(activeMembership.role) : false;
    // El moderador solo ve Moderación; cualquier otra ruta del panel lo redirige allí.
    const moderationPath = activeMembership
        ? `/admin/events/${activeMembership.eventId}/moderation`
        : null;
    const moderatorOutsideModeration =
        canAccess && !isAdmin && !!moderationPath && !pathname?.startsWith(moderationPath);

    useEffect(() => {
        hydrateAuth();
    }, [hydrateAuth]);

    useEffect(() => {
        if (!hydrated) return;

        if (!token) {
            router.replace("/login");
            return;
        }

        if (moderatorOutsideModeration && moderationPath) {
            router.replace(moderationPath);
            return;
        }

        if (!canAccess) {
            // Sin contexto activo, el selector resuelve el evento; con contexto
            // no administrativo, el usuario vuelve al feed de participantes.
            router.replace(activeMembershipId ? "/feed" : "/select-event");
        }
    }, [hydrated, token, canAccess, moderatorOutsideModeration, moderationPath, activeMembershipId, router]);

    if (!hydrated || !token || !canAccess || moderatorOutsideModeration) {
        return (
            <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--bg-base)" }}>
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2" style={{ borderColor: "var(--text-accent)" }}></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: "var(--bg-base)" }}>
            <AdminSidebar />
            <div className="md:pl-64 min-h-screen flex flex-col">
                <main className="px-4 pt-20 pb-10 sm:px-6 md:px-8 md:pt-10">
                    {children}
                </main>
                <footer className="mt-auto flex justify-center border-t px-4 py-4" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-surface)" }}>
                    <BrandAttribution />
                </footer>
            </div>
        </div>
    );
}
