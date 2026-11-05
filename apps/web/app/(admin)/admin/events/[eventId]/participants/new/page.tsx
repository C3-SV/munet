"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminAlertBanner } from "../../../../../../../components/admin/AdminAlertBanner";
import { AdminButton } from "../../../../../../../components/admin/AdminButton";
import { AdminCredentialBanner } from "../../../../../../../components/admin/AdminCredentialBanner";
import { AdminFormInput } from "../../../../../../../components/admin/AdminFormInput";
import { AdminFormSelect } from "../../../../../../../components/admin/AdminFormSelect";
import { AdminFormTextarea } from "../../../../../../../components/admin/AdminFormTextarea";
import { AdminPageHeader } from "../../../../../../../components/admin/AdminPageHeader";
import {
    getEvent,
    listCommittees,
    type AdminCommittee,
} from "../../../../../../../lib/api/admin";
import { ApiError } from "../../../../../../../lib/api/client";
import {
    createAccount,
    type CreateAccountBody,
} from "../../../../../../../lib/api/participants";
import { useAuthStore } from "../../../../../../../stores/auth.store";

const ROLE_SUGGESTIONS = [
    "DELEGADO",
    "MODERADOR",
    "ORGANIZADOR",
    "COORDINADOR",
    "ADMIN",
];

type FormState = {
    participant_code: string;
    role: string;
    committee_id: string;
    delegation_name: string;
    institution_name: string;
    first_name: string;
    last_name: string;
    display_name: string;
    bio: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const INITIAL_FORM: FormState = {
    participant_code: "",
    role: "DELEGADO",
    committee_id: "",
    delegation_name: "",
    institution_name: "",
    first_name: "",
    last_name: "",
    display_name: "",
    bio: "",
};

type CreatedParticipant = {
    participantCode: string;
    membershipId: string;
    password: string;
};

export default function NewParticipantPage() {
    const router = useRouter();
    const params = useParams<{ eventId: string }>();
    const eventId = params?.eventId ?? "";

    const token = useAuthStore((state) => state.token);
    const memberships = useAuthStore((state) => state.memberships);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const membershipEventName =
        memberships.find((membership) => membership.eventId === eventId)?.eventName ??
        memberships.find((membership) => membership.id === activeMembershipId)?.eventName;

    const [eventName, setEventName] = useState(membershipEventName ?? "Evento");
    const [committees, setCommittees] = useState<AdminCommittee[]>([]);
    const [committeesLoading, setCommitteesLoading] = useState(true);
    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [created, setCreated] = useState<CreatedParticipant | null>(null);

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
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;

        setCommitteesLoading(true);

        listCommittees(token, eventId)
            .then((data) => {
                if (!cancelled) {
                    setCommittees(data);
                }
            })
            .catch(() => {
                // El comité es opcional; el formulario sigue disponible.
            })
            .finally(() => {
                if (!cancelled) {
                    setCommitteesLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [eventId, token]);

    const committeeOptions = [
        {
            value: "",
            label: committeesLoading ? "Cargando comités..." : "Sin comité",
        },
        ...committees.map((committee) => ({
            value: committee.id,
            label: `${committee.code} — ${committee.name}`,
        })),
    ];

    const handleChange = (field: keyof FormState, value: string) => {
        setForm((previous) => ({ ...previous, [field]: value }));

        if (errors[field]) {
            setErrors((previous) => ({ ...previous, [field]: undefined }));
        }

        if (apiError) {
            setApiError(null);
        }
    };

    const validate = (): FormErrors => {
        const validationErrors: FormErrors = {};

        if (!form.participant_code.trim()) {
            validationErrors.participant_code =
                "El código de participante es requerido.";
        }

        if (!form.role.trim()) {
            validationErrors.role = "El rol es requerido.";
        }

        if (!form.first_name.trim()) {
            validationErrors.first_name = "El nombre es requerido.";
        }

        if (!form.last_name.trim()) {
            validationErrors.last_name = "El apellido es requerido.";
        }

        return validationErrors;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setApiError(null);

        const validationErrors = validate();

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        if (!token || !eventId) {
            setApiError("Sesión o evento no válido. Recarga la página.");
            return;
        }

        setLoading(true);

        try {
            const body: CreateAccountBody = {
                event_id: eventId,
                participant_code: form.participant_code.trim(),
                role: form.role.trim().toUpperCase(),
                ...(form.committee_id && {
                    committee_id: form.committee_id,
                }),
                ...(form.delegation_name.trim() && {
                    delegation_name: form.delegation_name.trim(),
                }),
                ...(form.institution_name.trim() && {
                    institution_name: form.institution_name.trim(),
                }),
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                ...(form.display_name.trim() && {
                    display_name: form.display_name.trim(),
                }),
                ...(form.bio.trim() && { bio: form.bio.trim() }),
            };

            const response = await createAccount(token, body);

            setCreated({
                participantCode: response.membership.participant_code,
                membershipId: response.membership.id,
                password: response.initial_password,
            });
        } catch (createError) {
            setApiError(
                createError instanceof ApiError
                    ? createError.message
                    : "No se pudo crear el participante. Intenta de nuevo.",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAnother = () => {
        setCreated(null);
        setForm(INITIAL_FORM);
        setErrors({});
        setApiError(null);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <AdminPageHeader
                title="Nuevo participante"
                description={`Registra una cuenta dentro de ${eventName}.`}
                breadcrumb={[
                    { label: "Panel", href: "/admin" },
                    { label: "Eventos", href: "/admin/events" },
                    { label: eventName, href: `/admin/events/${eventId}` },
                    {
                        label: "Participantes",
                        href: `/admin/events/${eventId}/participants`,
                    },
                    { label: "Nuevo participante" },
                ]}
                action={
                    <Link href={`/admin/events/${eventId}/participants`}>
                        <AdminButton variant="secondary">
                            Volver a participantes
                        </AdminButton>
                    </Link>
                }
            />

            {created ? (
                <div className="space-y-4">
                    <AdminCredentialBanner
                        title="Cuenta creada correctamente"
                        participantCode={created.participantCode}
                        password={created.password}
                        note="Entrega esta contraseña al participante. No se volverá a mostrar."
                    />

                    <div className="flex flex-col sm:flex-row gap-3">
                        <Link
                            href={`/admin/events/${eventId}/participants/${created.membershipId}`}
                        >
                            <AdminButton>Ver participante</AdminButton>
                        </Link>
                        <AdminButton
                            type="button"
                            variant="secondary"
                            onClick={handleCreateAnother}
                            icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/plus.svg"
                        >
                            Registrar otro
                        </AdminButton>
                    </div>
                </div>
            ) : (
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
                    {apiError && (
                        <AdminAlertBanner
                            type="error"
                            message={apiError}
                            onDismiss={() => setApiError(null)}
                        />
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <AdminFormInput
                            id="participant-code"
                            label="Código de participante"
                            placeholder="Ej: DEL-001"
                            required
                            value={form.participant_code}
                            onChange={(event) =>
                                handleChange(
                                    "participant_code",
                                    event.target.value,
                                )
                            }
                            error={errors.participant_code}
                            hint="El código no se puede modificar después de crear la cuenta."
                            disabled={loading}
                        />

                        <AdminFormInput
                            id="participant-role"
                            label="Rol"
                            placeholder="Ej: DELEGADO"
                            required
                            list="participant-role-options"
                            value={form.role}
                            onChange={(event) =>
                                handleChange(
                                    "role",
                                    event.target.value.toUpperCase(),
                                )
                            }
                            error={errors.role}
                            hint="Los roles administrativos se detectan por ADMIN, COORDINADOR u ORGANIZADOR."
                            disabled={loading}
                        />
                    </div>

                    <datalist id="participant-role-options">
                        {ROLE_SUGGESTIONS.map((role) => (
                            <option key={role} value={role} />
                        ))}
                    </datalist>

                    <AdminFormSelect
                        id="participant-committee"
                        label="Comité"
                        value={form.committee_id}
                        onChange={(event) =>
                            handleChange("committee_id", event.target.value)
                        }
                        options={committeeOptions}
                        hint="Puedes asignar el comité ahora o dejarlo para después."
                        disabled={loading || committeesLoading}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <AdminFormInput
                            id="participant-delegation"
                            label="Delegación"
                            placeholder="Ej: Francia"
                            value={form.delegation_name}
                            onChange={(event) =>
                                handleChange(
                                    "delegation_name",
                                    event.target.value,
                                )
                            }
                            disabled={loading}
                        />
                        <AdminFormInput
                            id="participant-institution"
                            label="Institución"
                            placeholder="Ej: Universidad ESEN"
                            value={form.institution_name}
                            onChange={(event) =>
                                handleChange(
                                    "institution_name",
                                    event.target.value,
                                )
                            }
                            disabled={loading}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <AdminFormInput
                            id="participant-first-name"
                            label="Nombre"
                            placeholder="Ej: María"
                            required
                            value={form.first_name}
                            onChange={(event) =>
                                handleChange("first_name", event.target.value)
                            }
                            error={errors.first_name}
                            disabled={loading}
                        />
                        <AdminFormInput
                            id="participant-last-name"
                            label="Apellido"
                            placeholder="Ej: López"
                            required
                            value={form.last_name}
                            onChange={(event) =>
                                handleChange("last_name", event.target.value)
                            }
                            error={errors.last_name}
                            disabled={loading}
                        />
                    </div>

                    <AdminFormInput
                        id="participant-display-name"
                        label="Nombre para mostrar"
                        placeholder="Ej: María López (opcional)"
                        value={form.display_name}
                        onChange={(event) =>
                            handleChange("display_name", event.target.value)
                        }
                        hint="Si lo dejas vacío, se mostrará el nombre y apellido."
                        disabled={loading}
                    />

                    <AdminFormTextarea
                        id="participant-bio"
                        label="Biografía"
                        placeholder="Breve biografía del participante (opcional)"
                        value={form.bio}
                        onChange={(event) =>
                            handleChange("bio", event.target.value)
                        }
                        disabled={loading}
                    />

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
                                    `/admin/events/${eventId}/participants`,
                                )
                            }
                            disabled={loading}
                        >
                            Cancelar
                        </AdminButton>
                        <AdminButton
                            type="submit"
                            loading={loading}
                            icon="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/check.svg"
                        >
                            {loading ? "Creando cuenta..." : "Crear participante"}
                        </AdminButton>
                    </div>
                </form>
            )}
        </div>
    );
}
