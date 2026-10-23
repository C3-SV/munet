"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../../../stores/auth.store";
import { createEvent, type CreateEventBody } from "../../../../../lib/api/admin";
import { ApiError } from "../../../../../lib/api/client";
import { AdminPageHeader } from "../../../../../components/admin/AdminPageHeader";
import { AdminFormInput } from "../../../../../components/admin/AdminFormInput";
import { AdminFormTextarea } from "../../../../../components/admin/AdminFormTextarea";
import { AdminButton } from "../../../../../components/admin/AdminButton";
import { AdminAlertBanner } from "../../../../../components/admin/AdminAlertBanner";

// Genera un slug limpio a partir del nombre del evento.
const toSlug = (value: string) =>
    value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");

type FormState = {
    name: string;
    slug: string;
    description: string;
    start_date: string;
    end_date: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const INITIAL_FORM: FormState = {
    name: "",
    slug: "",
    description: "",
    start_date: "",
    end_date: "",
};

// Página de creación de evento. Conecta con POST /admin/events.
export default function NewEventPage() {
    const router = useRouter();
    const token = useAuthStore((state) => state.token);

    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [slugEdited, setSlugEdited] = useState(false);
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Actualiza el campo y auto-genera slug si el usuario aún no lo ha editado.
    const handleChange = (
        field: keyof FormState,
        value: string,
    ) => {
        setForm((prev) => {
            const updated = { ...prev, [field]: value };
            if (field === "name" && !slugEdited) {
                updated.slug = toSlug(value);
            }
            return updated;
        });

        // Limpiar el error del campo al escribir.
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: undefined }));
        }

        if (apiError) setApiError(null);
    };

    const validate = (): FormErrors => {
        const errs: FormErrors = {};

        if (!form.name.trim()) errs.name = "El nombre es requerido.";
        if (!form.slug.trim()) {
            errs.slug = "El slug es requerido.";
        } else if (!/^[a-z0-9-]+$/.test(form.slug)) {
            errs.slug =
                "Solo minúsculas, números y guiones. Ej: mun-esen-2026";
        }
        if (
            form.start_date &&
            form.end_date &&
            form.start_date > form.end_date
        ) {
            errs.end_date =
                "La fecha de fin debe ser posterior a la de inicio.";
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

        if (!token) {
            setApiError("Sesión no válida. Recarga la página.");
            return;
        }

        setLoading(true);

        try {
            const body: CreateEventBody = {
                name: form.name.trim(),
                slug: form.slug.trim(),
                ...(form.description.trim() && {
                    description: form.description.trim(),
                }),
                ...(form.start_date && { start_date: form.start_date }),
                ...(form.end_date && { end_date: form.end_date }),
            };

            await createEvent(token, body);
            setSuccess(true);

            // Redirigir al listado de eventos después de un breve feedback.
            setTimeout(() => router.push("/admin/events"), 1500);
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : "Error al crear el evento. Intenta de nuevo.";
            setApiError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <AdminPageHeader
                title="Nuevo evento"
                description="Completa los datos para crear un evento."
                breadcrumb={[
                    { label: "Panel", href: "/admin" },
                    { label: "Eventos", href: "/admin/events" },
                    { label: "Nuevo evento" },
                ]}
            />

            {success && (
                <AdminAlertBanner
                    type="success"
                    message="¡Evento creado correctamente! Redirigiendo..."
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
                    id="event-name"
                    label="Nombre del evento"
                    placeholder="Ej: MUN ESEN 2026"
                    required
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    error={errors.name}
                    disabled={loading || success}
                />

                {/* Slug */}
                <AdminFormInput
                    id="event-slug"
                    label="Slug (identificador URL)"
                    placeholder="mun-esen-2026"
                    required
                    value={form.slug}
                    onChange={(e) => {
                        setSlugEdited(true);
                        handleChange("slug", e.target.value.toLowerCase());
                    }}
                    error={errors.slug}
                    hint="Solo minúsculas, números y guiones. Se genera automáticamente desde el nombre."
                    disabled={loading || success}
                />

                {/* Descripción */}
                <AdminFormTextarea
                    id="event-description"
                    label="Descripción"
                    placeholder="Breve descripción del evento (opcional)"
                    value={form.description}
                    onChange={(e) =>
                        handleChange("description", e.target.value)
                    }
                    error={errors.description}
                    disabled={loading || success}
                />

                {/* Fechas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <AdminFormInput
                        id="event-start-date"
                        label="Fecha de inicio"
                        type="date"
                        value={form.start_date}
                        onChange={(e) =>
                            handleChange("start_date", e.target.value)
                        }
                        error={errors.start_date}
                        disabled={loading || success}
                    />
                    <AdminFormInput
                        id="event-end-date"
                        label="Fecha de fin"
                        type="date"
                        value={form.end_date}
                        onChange={(e) =>
                            handleChange("end_date", e.target.value)
                        }
                        error={errors.end_date}
                        disabled={loading || success}
                    />
                </div>

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
                        onClick={() => router.push("/admin/events")}
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
                        {loading ? "Creando evento..." : "Crear evento"}
                    </AdminButton>
                </div>
            </form>
        </div>
    );
}
