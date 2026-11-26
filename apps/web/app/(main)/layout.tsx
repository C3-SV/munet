"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "../../components/layout/Sidebar";
import { Footer } from "../../components/layout/Footer";
import { NotificationsSync } from "../../components/notifications/NotificationsSync";
import { PracticeBanner } from "../../components/practice/PracticeBanner";
import { useAuthStore, userNeedsEventSelection } from "../../stores/auth.store";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    // Cambia al reiniciar la práctica para remontar el contenido de las páginas (ver el return).
    const [practiceEpoch, setPracticeEpoch] = useState(0);

    const hydrateAuth = useAuthStore((state) => state.hydrateAuth);
    const hydrated = useAuthStore((state) => state.hydrated);
    const token = useAuthStore((state) => state.token);
    const activeEventId = useAuthStore((state) => state.activeEventId);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const memberships = useAuthStore((state) => state.memberships);
    const setActiveMembership = useAuthStore((state) => state.setActiveMembership);

    const isChatRoom = useMemo(
        () => pathname?.match(/^\/chat\/[a-zA-Z0-9_-]+$/),
        [pathname],
    );

    useEffect(() => {
        // Recupera auth desde localStorage solo si aún no está hidratada. Volver a montar el layout
        // (p. ej. desde /guia) no debe sacar de la práctica, que vive solo en memoria.
        if (!hydrated) {
            hydrateAuth();
        }
    }, [hydrated, hydrateAuth]);

    useEffect(() => {
        if (!hydrated) {
            return;
        }

        if (!token) {
            router.replace("/login");
            return;
        }

        // Guard de evento activo: delegados con una sola membresía entran a su evento; admins y delegados
        // con varias membresías van al selector.
        if (!activeEventId || !activeMembershipId) {
            // La store deja las membresías en orden de selección: la primera es la del evento por defecto.
            const defaultMembership = memberships[0];

            if (!userNeedsEventSelection(memberships) && defaultMembership) {
                // Delegado con una sola membresía y sin contexto activo: se resuelve automáticamente.
                setActiveMembership(defaultMembership.id);
                router.replace("/feed");
                return;
            }

            // Admins, delegados con varias membresías o usuarios sin membresías quedan en el selector.
            router.replace("/select-event");
        }
    }, [activeEventId, activeMembershipId, hydrated, memberships, router, setActiveMembership, token]);

    if (!hydrated || !token || !activeEventId || !activeMembershipId) {
        // Pantalla de espera mientras se resuelve sesion/contexto activo.
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-base)" }}>
                <span className="font-body text-sm" style={{ color: "var(--text-secondary)" }}>
                    Cargando sesión...
                </span>
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg-base)" }}>
            {/* Al cambiar de evento la Sidebar se remonta: no conserva secciones abiertas del evento anterior. */}
            <Sidebar key={activeEventId} />
            {/* Mantiene al día los avisos y mensajes sin leer (indicadores del menú y la campana). */}
            <NotificationsSync />

            <main
                className={`flex-1 relative flex flex-col md:pl-64 ${isChatRoom ? "overflow-hidden" : "overflow-y-auto pt-16 md:pt-0"}`}
                style={{ backgroundColor: "var(--bg-base)" }}
            >
                {/* En la sala de chat la altura queda acotada para que solo la lista de mensajes haga scroll. */}
                <div className={isChatRoom ? "flex-1 min-h-0 flex flex-col" : "flex-1 shrink-0"}>
                    <PracticeBanner onReset={() => setPracticeEpoch((n) => n + 1)} />
                    {/* Al cambiar de evento (o de práctica) o reiniciarla se remonta el contenido: el feed y el chat
                        del evento anterior no conservan estado ni caché. El banner no cambia. */}
                    <React.Fragment key={`${activeEventId}:${practiceEpoch}`}>{children}</React.Fragment>
                </div>

                {!isChatRoom && <Footer />}
            </main>
        </div>
    );
}
