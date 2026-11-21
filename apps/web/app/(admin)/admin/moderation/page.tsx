import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { AdminEmptyState } from "../../../../components/admin/AdminEmptyState";
import { IconShield } from "../../../../components/ui/icons";

// Seccion futura del panel: supervision de muros y contenido.
export default function AdminModerationPage() {
    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <AdminPageHeader
                title="Moderación"
                description="Supervisa los muros y el contenido publicado en el evento."
                breadcrumb={[
                    { label: "Panel", href: "/admin" },
                    { label: "Moderación" },
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
                    icon={<IconShield size={32} />}
                    title="Sección en construcción"
                    description="La supervisión de muros y la eliminación de contenido estarán disponibles en una próxima entrega."
                />
            </div>
        </div>
    );
}
