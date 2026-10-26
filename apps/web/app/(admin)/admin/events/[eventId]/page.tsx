"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminAlertBanner } from "../../../../../components/admin/AdminAlertBanner";
import { AdminButton } from "../../../../../components/admin/AdminButton";
import { AdminEmptyState } from "../../../../../components/admin/AdminEmptyState";
import { AdminFormInput } from "../../../../../components/admin/AdminFormInput";
import { AdminFormTextarea } from "../../../../../components/admin/AdminFormTextarea";
import { AdminPageHeader } from "../../../../../components/admin/AdminPageHeader";
import {
    getEvent,
    updateEvent,
    type AdminEvent,
    type AdminEventStatus,
    type UpdateEventBody,
} from "../../../../../lib/api/admin";
import { ApiError } from "../../../../../lib/api/client";
import { useAuthStore } from "../../../../../stores/auth.store";

type FormState = {
    name: string;
    slug: string;
    description: string;
    start_date: string;
    end_date: string;
    status: AdminEventStatus;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const STATUS_OPTIONS: { value: AdminEventStatus; label: string }[] = [
    { value: "ACTIVE", label: "Activo" },
    { value: "CLOSED", label: "Cerrado" },
    { value: "ARCHIVED", label: "Archivado" },
];

const EMPTY_FORM: FormState = {
    name: "",
    slug: "",
    description: "",
    start_date: "",
    end_date: "",
    status: "ACTIVE",
};

const toFormState = (event: AdminEvent): FormState => ({
    name: event.name,
    slug: event.slug,
    description: event.description ?? "",
    start_date: event.start_date?.slice(0, 10) ?? "",
    end_date: event.end_date?.slice(0, 10) ?? "",
    status: event.status,
});

const LoadingState = () => (
    <div className="flex items-center justify-center py-20">
        <span
            className="animate-spin rounded-full border-2 border-t-transparent"
            style={{
                width: 32,
                height: 32,
                borderColor: "var(--text-accent)",
                borderTopColor: "transparent",
            }}
        />
    </div>
);

export default function EventDetailPage() {
    const params = useParams<{ eventId: string }>();
    const router = useRouter();
    const eventId = params?.eventId ?? "";
    const token = useAuthStore((state) => state.token);

    const [event, setEvent] = useState<AdminEvent | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;

        setLoading(true);
        setLoadError(null);

        getEvent(token, eventId)
            .then((data) => {
                if (!cancelled) {
                    setEvent(data.event);
                    setForm(toFormState(data.event));
                }
            })
            .catch((loadFailure) => {
                if (!cancelled) {
                    setLoadError(
                        loadFailure instanceof ApiError
                            ? loadFailure.message
                            : "No se pudo cargar el evento.",
                    );
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [eventId, reloadKey, token]);

    const handleChange = <K extends keyof FormState>(
        field: K,
        value: FormState[K],
    ) => {
        setForm((previous) => ({ ...previous, [field]: value }));

        if (errors[field]) {
            setErrors((previous) => ({ ...previous, [field]: undefined }));
        }

        if (apiError) {
            setApiError(null);
        }

        if (success) {
            setSuccess(null);
        }
    };

    const validate = (): FormErrors => {
        const validationErrors: FormErrors = {};

        if (!form.name.trim()) {
            validationErrors.name = "El nombre es requerido.";
        }

        if (!form.slug.trim()) {
            validationErrors.slug = "El slug es requerido.";
        } else if (!/^[a-z0-9-]+$/.test(form.slug)) {
            validationErrors.slug =
                "Solo minúsculas, números y guiones. Ej: mun-esen-2026";
        }

        if (form.start_date && form.end_date && form.start_date > form.end_date) {
            validationErrors.end_date =
                "La fecha de fin debe ser posterior a la de inicio.";
        }

        return validationErrors;
    };

    const handleSubmit = async (request: React.FormEvent) => {
        request.preventDefault();
        setApiError(null);
        setSuccess(null);

        const validationErrors = validate();

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        if (!token) {
            setApiError("Sesión no válida. Recarga la página.");
            return;
        }

        setSaving(true);

        try {
            const body: UpdateEventBody = {
                name: form.name.trim(),
                slug: form.slug.trim(),
                description: form.description.trim() ? form.description.trim() : null,
                start_date: form.start_date || null,
                end_date: form.end_date || null,
                status: form.status,
            };

            const response = await updateEvent(token, eventId, body);
            setEvent(response.event);
            setForm(toFormState(response.event));
            setSuccess("Cambios guardados correctamente.");
        } catch (saveError) {
            setApiError(
                saveError instanceof ApiError
                    ? saveError.message
                    : "No se pudo actualizar el evento. Intenta de nuevo.",
            );
        } finally {
            setSaving(false);
        }
    };

    const headerAction = event ? (
        <Link href={`/admin/events/${eventId}/committees`}>
            <AdminButton
                variant="secondary"
                icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/building.svg"
            >
                Gestionar comités
            </AdminButton>
        </Link>
    ) : undefined;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <AdminPageHeader
                title={event?.name ?? "Configurar evento"}
                description="Actualiza los datos y el estado del evento."
                breadcrumb={[
                    { label: "Panel", href: "/admin" },
                    { label: "Eventos", href: "/admin/events" },
                    { label: event?.name ?? "Configurar evento" },
                ]}
                action={headerAction}
            />

            {loading && (
                <div
                    className="rounded-2xl"
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                >
                    <LoadingState />
                </div>
            )}

            {!loading && loadError && (
                <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                >
                    <AdminEmptyState
                        icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/alert-triangle.svg"
                        title="No se pudo cargar el evento"
                        description={loadError}
                        action={
                            <AdminButton
                                variant="secondary"
                                onClick={() => setReloadKey((value) => value + 1)}
                                icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/refresh.svg"
                            >
                                Reintentar
                            </AdminButton>
                        }
                    />
                </div>
            )}

            {!loading && !loadError && event && (
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
                    {success && (
                        <AdminAlertBanner
                            type="success"
                            message={success}
                            onDismiss={() => setSuccess(null)}
                        />
                    )}

                    {apiError && (
                        <AdminAlertBanner
                            type="error"
                            message={apiError}
                            onDismiss={() => setApiError(null)}
                        />
                    )}

                    <AdminFormInput
                        id="event-name"
                        label="Nombre del evento"
                        placeholder="Ej: MUN ESEN 2026"
                        required
                        value={form.name}
                        onChange={(changeEvent) => handleChange("name", changeEvent.target.value)}
                        error={errors.name}
                        disabled={saving}
                    />

                    <AdminFormInput
                        id="event-slug"
                        label="Slug (identificador URL)"
                        placeholder="mun-esen-2026"
                        required
                        value={form.slug}
                        onChange={(changeEvent) =>
                            handleChange("slug", changeEvent.target.value.toLowerCase())
                        }
                        error={errors.slug}
                        hint="Solo minúsculas, números y guiones."
                        disabled={saving}
                    />

                    <AdminFormTextarea
                        id="event-description"
                        label="Descripción"
                        placeholder="Breve descripción del evento (opcional)"
                        value={form.description}
                        onChange={(changeEvent) => handleChange("description", changeEvent.target.value)}
                        error={errors.description}
                        disabled={saving}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <AdminFormInput
                            id="event-start-date"
                            label="Fecha de inicio"
                            type="date"
                            value={form.start_date}
                            onChange={(changeEvent) => handleChange("start_date", changeEvent.target.value)}
                            error={errors.start_date}
                            disabled={saving}
                        />
                        <AdminFormInput
                            id="event-end-date"
                            label="Fecha de fin"
                            type="date"
                            value={form.end_date}
                            onChange={(changeEvent) => handleChange("end_date", changeEvent.target.value)}
                            error={errors.end_date}
                            disabled={saving}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="event-status"
                            className="text-sm font-semibold font-heading"
                            style={{ color: "var(--text-primary)" }}
                        >
                            Estado
                        </label>
                        <select
                            id="event-status"
                            value={form.status}
                            onChange={(changeEvent) =>
                                handleChange(
                                    "status",
                                    changeEvent.target.value as AdminEventStatus,
                                )
                            }
                            disabled={saving}
                            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                            style={{
                                backgroundColor: "var(--input-bg)",
                                border: "1px solid var(--input-border)",
                                color: "var(--text-primary)",
                            }}
                        >
                            {STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            Los eventos cerrados o archivados no permiten crear
                            nuevos comités.
                        </p>
                    </div>

                    <div
                        className="flex flex-col sm:flex-row justify-end gap-3"
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
                            disabled={saving}
                        >
                            Cancelar
                        </AdminButton>
                        <AdminButton
                            type="submit"
                            loading={saving}
                            icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/check.svg"
                        >
                            {saving ? "Guardando..." : "Guardar cambios"}
                        </AdminButton>
                    </div>
                </form>
            )}
        </div>
    );
}
