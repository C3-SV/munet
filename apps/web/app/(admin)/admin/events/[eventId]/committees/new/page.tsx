"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "../../../../../../../stores/auth.store";
import {
    createCommittee,
    type CreateCommitteeBody,
} from "../../../../../../../lib/api/admin";
import { ApiError } from "../../../../../../../lib/api/client";
import { AdminPageHeader } from "../../../../../../../components/admin/AdminPageHeader";
import { AdminFormInput } from "../../../../../../../components/admin/AdminFormInput";
import { AdminFormTextarea } from "../../../../../../../components/admin/AdminFormTextarea";
import { AdminButton } from "../../../../../../../components/admin/AdminButton";
import { AdminAlertBanner } from "../../../../../../../components/admin/AdminAlertBanner";

// Convierte el nombre a un código de comité en mayúsculas (ej. "Consejo de Seguridad" → "CS").
const toCode = (value: string) =>
    value
        .trim()
        .split(/\s+/)
        .map((word) => word[0] ?? "")
        .join("")
        .toUpperCase()
        .slice(0, 6);

type FormState = {
    name: string;
    code: string;
    description: string;
    sort_order: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const INITIAL_FORM: FormState = {
    name: "",
    code: "",
    description: "",
    sort_order: "0",
};

// Página de creación de comité. Conecta con POST /admin/committees.
export default function NewCommitteePage() {
    const router = useRouter();
    const params = useParams<{ eventId: string }>();
    const eventId = params?.eventId ?? "";

    const token = useAuthStore((state) => state.token);
    const memberships = useAuthStore((state) => state.memberships);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);

    const eventName =
        memberships.find((m) => m.eventId === eventId)?.eventName ??
        memberships.find((m) => m.id === activeMembershipId)?.eventName ??
        "Evento";

    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [codeEdited, setCodeEdited] = useState(false);
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleChange = (field: keyof FormState, value: string) => {
        setForm((prev) => {
            const updated = { ...prev, [field]: value };
            // Auto-sugerir código desde el nombre mientras no lo hayan editado.
            if (field === "name" && !codeEdited) {
                updated.code = toCode(value);
            }
            return updated;
        });
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
        if (apiError) setApiError(null);
    };

    const validate = (): FormErrors => {
        const errs: FormErrors = {};

        if (!form.name.trim()) errs.name = "El nombre es requerido.";
        if (!form.code.trim()) {
            errs.code = "El código es requerido.";
        } else if (!/^[A-Z0-9-]+$/.test(form.code)) {
            errs.code = "Solo mayúsculas, números y guiones. Ej: CSNU";
        }

        const order = Number(form.sort_order);
        if (isNaN(order) || order < 0) {
            errs.sort_order = "Debe ser un número mayor o igual a 0.";
        }

        return errs;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setApiError(null);
        setSuccess(false);

        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

        if (!token || !eventId) {
            setApiError("Sesión o evento no válido. Recarga la página.");
            return;
        }

        setLoading(true);

        try {
            const body: CreateCommitteeBody = {
                event_id: eventId,
                name: form.name.trim(),
                code: form.code.trim().toUpperCase(),
                ...(form.description.trim() && {
                    description: form.description.trim(),
                }),
                sort_order: Number(form.sort_order),
            };

            await createCommittee(token, body);
            setSuccess(true);

            setTimeout(
                () => router.push(`/admin/events/${eventId}/committees`),
                1500,
            );
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : "Error al crear el comité. Intenta de nuevo.";
            setApiError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <AdminPageHeader
                title="Nuevo comité"
                description={`Crear un comité dentro de ${eventName}.`}
                breadcrumb={[
                    { label: "Panel", href: "/admin" },
                    { label: "Eventos", href: "/admin/events" },
                    {
                        label: eventName,
                        href: `/admin/events/${eventId}`,
                    },
                    {
                        label: "Comités",
                        href: `/admin/events/${eventId}/committees`,
                    },
                    { label: "Nuevo comité" },
                ]}
            />

            {success && (
                <AdminAlertBanner
                    type="success"
                    message="¡Comité creado correctamente! Redirigiendo..."
                />
            )}
            {apiError && (
                <AdminAlertBanner
                    type="error"
                    message={apiError}
                    onDismiss={() => setApiError(null)}
                />
            )}

            <form
                onSubmit={handleSubmit}
                className="rounded-2xl p-6 sm:p-8 space-y-6"
                style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    boxShadow: "var(--shadow-sm)",
                }}
                noValidate
            >
                {/* Nombre */}
                <AdminFormInput
                    id="committee-name"
                    label="Nombre del comité"
                    placeholder="Ej: Consejo de Seguridad de la ONU"
                    required
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    error={errors.name}
                    disabled={loading || success}
                />

                {/* Código */}
                <AdminFormInput
                    id="committee-code"
                    label="Código"
                    placeholder="CSNU"
                    required
                    value={form.code}
                    onChange={(e) => {
                        setCodeEdited(true);
                        handleChange("code", e.target.value.toUpperCase());
                    }}
                    error={errors.code}
                    hint="Sigla corta del comité. Solo mayúsculas, números y guiones."
                    disabled={loading || success}
                />

                {/* Descripción */}
                <AdminFormTextarea
                    id="committee-description"
                    label="Descripción"
                    placeholder="Descripción breve del comité (opcional)"
                    value={form.description}
                    onChange={(e) =>
                        handleChange("description", e.target.value)
                    }
                    error={errors.description}
                    disabled={loading || success}
                />

                {/* Orden */}
                <AdminFormInput
                    id="committee-sort-order"
                    label="Orden de visualización"
                    type="number"
                    min={0}
                    value={form.sort_order}
                    onChange={(e) =>
                        handleChange("sort_order", e.target.value)
                    }
                    error={errors.sort_order}
                    hint="Número que determina el orden del comité en el sidebar. 0 = primero."
                    disabled={loading || success}
                />

                {/* Acciones */}
                <div
                    className="flex flex-col sm:flex-row justify-end gap-3 pt-2"
                    style={{
                        borderTop: "1px solid var(--border-color)",
                        paddingTop: "1.25rem",
                        marginTop: "0.25rem",
                    }}
                >
                    <AdminButton
                        type="button"
                        variant="secondary"
                        onClick={() =>
                            router.push(
                                `/admin/events/${eventId}/committees`,
                            )
                        }
                        disabled={loading || success}
                    >
                        Cancelar
                    </AdminButton>
                    <AdminButton
                        type="submit"
                        loading={loading}
                        disabled={success}
                        icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/check.svg"
                    >
                        {loading ? "Creando comité..." : "Crear comité"}
                    </AdminButton>
                </div>
            </form>
        </div>
    );
}
