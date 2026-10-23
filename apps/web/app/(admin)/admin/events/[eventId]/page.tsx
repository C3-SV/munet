"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthStore } from "../../../../../stores/auth.store";
import { AdminPageHeader } from "../../../../../components/admin/AdminPageHeader";
import { AdminButton } from "../../../../../components/admin/AdminButton";
import { AdminEmptyState } from "../../../../../components/admin/AdminEmptyState";

// Página de detalle/edición de un evento.
// Requiere GET /admin/events/:eventId y PATCH /admin/events/:eventId (pendiente en BE).
// Por ahora muestra acceso directo a los comités del evento.
export default function EventDetailPage() {
    const params = useParams<{ eventId: string }>();
    const eventId = params?.eventId ?? "";

    const memberships = useAuthStore((state) => state.memberships);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);

    const eventName =
        memberships.find((m) => m.eventId === eventId)?.eventName ??
        memberships.find((m) => m.id === activeMembershipId)?.eventName ??
        "Evento";

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <AdminPageHeader
                title={eventName}
                breadcrumb={[
                    { label: "Panel", href: "/admin" },
                    { label: "Eventos", href: "/admin/events" },
                    { label: eventName },
                ]}
                action={
                    <Link href={`/admin/events/${eventId}/committees`}>
                        <AdminButton
                            variant="secondary"
                            icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/building.svg"
                        >
                            Ver comités
                        </AdminButton>
                    </Link>
                }
            />

            <div
                className="rounded-2xl overflow-hidden"
                style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    boxShadow: "var(--shadow-sm)",
                }}
            >
                <AdminEmptyState
                    icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/calendar-event.svg"
                    title="Edición de evento próximamente"
                    description="La edición de eventos estará disponible una vez que el backend implemente GET y PATCH para /admin/events/:id."
                    action={
                        <Link href={`/admin/events/${eventId}/committees`}>
                            <AdminButton
                                icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/building.svg"
                            >
                                Gestionar comités
                            </AdminButton>
                        </Link>
                    }
                />
            </div>
        </div>
    );
}
