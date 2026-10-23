"use client";

import Link from "next/link";
import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { AdminButton } from "../../../../components/admin/AdminButton";
import { AdminEmptyState } from "../../../../components/admin/AdminEmptyState";

// Página de listado de eventos del panel admin.
// Los datos de listado requieren endpoints GET del backend (pendientes de Sprint BE).
// Por ahora muestra un estado informativo y permite navegar a "Nuevo evento".

export default function AdminEventsPage() {
    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <AdminPageHeader
                title="Eventos"
                description="Crea y configura los eventos del MUN."
                breadcrumb={[{ label: "Panel", href: "/admin" }, { label: "Eventos" }]}
                action={
                    <Link href="/admin/events/new">
                        <AdminButton
                            icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/plus.svg"
                        >
                            Nuevo evento
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
                    title="Listado de eventos próximamente"
                    description="El listado de eventos estará disponible una vez que el backend implemente el endpoint GET /admin/events. Por ahora puedes crear nuevos eventos."
                    action={
                        <Link href="/admin/events/new">
                            <AdminButton
                                icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/plus.svg"
                            >
                                Crear primer evento
                            </AdminButton>
                        </Link>
                    }
                />
            </div>
        </div>
    );
}
