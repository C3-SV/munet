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
    const hydrated = useAuthStore((state) => state.hydrated);
    const token = useAuthStore((state) => state.token);
    const memberships = useAuthStore((state) => state.memberships);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);

    const activeMembership = memberships.find((m) => m.id === activeMembershipId);
    const isAdmin = activeMembership ? isAdminRole(activeMembership.role) : false;

    useEffect(() => {
        if (!hydrated) return;

        if (!token) {
            router.replace("/login");
            return;
        }

        if (!isAdmin) {
            router.replace("/feed");
        }
    }, [hydrated, token, isAdmin, router]);

    if (!hydrated) {
        return (
            <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--bg-base)" }}>
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2" style={{ borderColor: "var(--text-accent)" }}></div>
            </div>
        );
    }

    if (!token || !isAdmin) {
        return null;
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: "var(--bg-base)" }}>
            <AdminSidebar />
            <div className="pl-64">
                <main className="py-10 px-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
