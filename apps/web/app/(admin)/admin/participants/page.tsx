import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { AdminEmptyState } from "../../../../components/admin/AdminEmptyState";

// Seccion futura del panel: alta individual y carga masiva de participantes.
export default function AdminParticipantsPage() {
    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <AdminPageHeader
                title="Participantes"
                description="Registra y administra los participantes del evento."
                breadcrumb={[
                    { label: "Panel", href: "/admin" },
                    { label: "Participantes" },
                ]}
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
                    icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/users.svg"
                    title="Sección en construcción"
                    description="El alta individual y la importación CSV de participantes estarán disponibles en una próxima entrega."
                />
            </div>
        </div>
    );
}
