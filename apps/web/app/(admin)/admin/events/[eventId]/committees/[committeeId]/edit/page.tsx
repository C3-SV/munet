"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminAlertBanner } from "../../../../../../../../components/admin/AdminAlertBanner";
import { AdminButton } from "../../../../../../../../components/admin/AdminButton";
import { AdminEmptyState } from "../../../../../../../../components/admin/AdminEmptyState";
import { AdminFormInput } from "../../../../../../../../components/admin/AdminFormInput";
import { AdminFormTextarea } from "../../../../../../../../components/admin/AdminFormTextarea";
import { AdminPageHeader } from "../../../../../../../../components/admin/AdminPageHeader";
import {
    getCommittee,
    getEvent,
    updateCommittee,
    type AdminCommittee,
    type UpdateCommitteeBody,
} from "../../../../../../../../lib/api/admin";
import { ApiError } from "../../../../../../../../lib/api/client";
import { useAuthStore } from "../../../../../../../../stores/auth.store";

type FormState = {
    name: string;
    code: string;
    description: string;
    sort_order: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
    name: "",
    code: "",
    description: "",
    sort_order: "0",
};

const toFormState = (committee: AdminCommittee): FormState => ({
    name: committee.name,
    code: committee.code,
    description: committee.description ?? "",
    sort_order: String(committee.sort_order),
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

export default function EditCommitteePage() {
    const params = useParams<{ eventId: string; committeeId: string }>();
    const router = useRouter();
    const eventId = params?.eventId ?? "";
    const committeeId = params?.committeeId ?? "";
    const token = useAuthStore((state) => state.token);
    const memberships = useAuthStore((state) => state.memberships);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const membershipEventName =
        memberships.find((membership) => membership.eventId === eventId)?.eventName ??
        memberships.find((membership) => membership.id === activeMembershipId)?.eventName;

    const [eventName, setEventName] = useState(membershipEventName ?? "Evento");
    const [committee, setCommittee] = useState<AdminCommittee | null>(null);
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

        getEvent(token, eventId)
            .then((data) => {
                if (!cancelled) {
                    setEventName(data.event.name);
                }
            })
            .catch(() => {
                // Si falla, se mantiene el nombre de la membresía o "Evento".
            });

        return () => {
            cancelled = true;
        };
    }, [eventId, token]);

    useEffect(() => {
        if (!token || !committeeId) {
            return;
        }

        let cancelled = false;

        setLoading(true);
        setLoadError(null);

        getCommittee(token, committeeId)
            .then((data) => {
                if (cancelled) {
                    return;
                }

                if (data.committee.event_id !== eventId) {
                    setLoadError("El comité no pertenece al evento indicado.");
                    return;
                }

                setCommittee(data.committee);
                setForm(toFormState(data.committee));
            })
            .catch((loadFailure) => {
                if (!cancelled) {
                    setLoadError(
                        loadFailure instanceof ApiError
                            ? loadFailure.message
                            : "No se pudo cargar el comité.",
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
    }, [committeeId, reloadKey, token]);

    const handleChange = (field: keyof FormState, value: string) => {
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

        if (!form.code.trim()) {
            validationErrors.code = "El código es requerido.";
        } else if (!/^[A-Z0-9-]+$/.test(form.code)) {
            validationErrors.code =
                "Solo mayúsculas, números y guiones. Ej: CSNU";
        }

        const order = Number(form.sort_order);

        if (!form.sort_order.trim() || !Number.isSafeInteger(order) || order < 0) {
            validationErrors.sort_order =
                "Debe ser un número entero mayor o igual a 0.";
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
            const body: UpdateCommitteeBody = {
                name: form.name.trim(),
                code: form.code.trim().toUpperCase(),
                description: form.description.trim() ? form.description.trim() : null,
                sort_order: Number(form.sort_order),
            };

            const response = await updateCommittee(token, committeeId, body);
            setCommittee(response.committee);
            setForm(toFormState(response.committee));
            setSuccess("Comité actualizado correctamente.");
        } catch (saveError) {
            setApiError(
                saveError instanceof ApiError
                    ? saveError.message
                    : "No se pudo actualizar el comité. Intenta de nuevo.",
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <AdminPageHeader
                title={committee?.name ?? "Editar comité"}
                description={`Actualiza los datos del comité en ${eventName}.`}
                breadcrumb={[
                    { label: "Panel", href: "/admin" },
                    { label: "Eventos", href: "/admin/events" },
                    { label: eventName, href: `/admin/events/${eventId}` },
                    {
                        label: "Comités",
                        href: `/admin/events/${eventId}/committees`,
                    },
                    { label: "Editar comité" },
                ]}
                action={
                    <Link href={`/admin/events/${eventId}/committees`}>
                        <AdminButton variant="secondary">Volver a comités</AdminButton>
                    </Link>
                }
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
                        title="No se pudo cargar el comité"
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

            {!loading && !loadError && committee && (
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
                        id="committee-name"
                        label="Nombre del comité"
                        placeholder="Ej: Consejo de Seguridad de la ONU"
                        required
                        value={form.name}
                        onChange={(changeEvent) => handleChange("name", changeEvent.target.value)}
                        error={errors.name}
                        disabled={saving}
                    />

                    <AdminFormInput
                        id="committee-code"
                        label="Código"
                        placeholder="CSNU"
                        required
                        value={form.code}
                        onChange={(changeEvent) =>
                            handleChange("code", changeEvent.target.value.toUpperCase())
                        }
                        error={errors.code}
                        hint="Sigla corta del comité. Solo mayúsculas, números y guiones."
                        disabled={saving}
                    />

                    <AdminFormTextarea
                        id="committee-description"
                        label="Descripción"
                        placeholder="Descripción breve del comité (opcional)"
                        value={form.description}
                        onChange={(changeEvent) => handleChange("description", changeEvent.target.value)}
                        error={errors.description}
                        disabled={saving}
                    />

                    <AdminFormInput
                        id="committee-sort-order"
                        label="Orden de visualización"
                        type="number"
                        min={0}
                        value={form.sort_order}
                        onChange={(changeEvent) => handleChange("sort_order", changeEvent.target.value)}
                        error={errors.sort_order}
                        hint="Número que determina el orden del comité en el sidebar. 0 = primero."
                        disabled={saving}
                    />

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
                            onClick={() =>
                                router.push(`/admin/events/${eventId}/committees`)
                            }
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
