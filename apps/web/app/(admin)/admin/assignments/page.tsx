import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { AdminEmptyState } from "../../../../components/admin/AdminEmptyState";

// Seccion futura del panel: asignacion a comites y estado de cuentas.
export default function AdminAssignmentsPage() {
    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <AdminPageHeader
                title="Asignaciones"
                description="Asigna participantes a comités y gestiona sus cuentas."
                breadcrumb={[
                    { label: "Panel", href: "/admin" },
                    { label: "Asignaciones" },
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
                    icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/user-check.svg"
                    title="Sección en construcción"
                    description="La asignación de participantes a comités y la suspensión o reactivación de cuentas estarán disponibles en una próxima entrega."
                />
            </div>
        </div>
    );
}
