"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminAlertBanner } from "../../../../../../../components/admin/AdminAlertBanner";
import { AdminButton } from "../../../../../../../components/admin/AdminButton";
import {
    AdminCredentialsDialog,
    type AdminCredentialField,
} from "../../../../../../../components/admin/AdminCredentialsDialog";
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
import { formatRoleLabel, PARTICIPANT_ROLES } from "../../../../../../../lib/role-label";
import { IconCheck, IconPlus } from "../../../../../../../components/ui/icons";

type FormState = {
    participant_code: string;
    role: string;
    committee_id: string;
    delegation_name: string;
    institution_name: string;
    first_name: string;
    last_name: string;
    display_name: string;
    alias: string;
    bio: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const INITIAL_FORM: FormState = {
    participant_code: "",
    role: "PARTICIPANT",
    committee_id: "",
    delegation_name: "",
    institution_name: "",
    first_name: "",
    last_name: "",
    display_name: "",
    alias: "",
    bio: "",
};

type CreatedParticipant = {
    participantCode: string;
    delegationCode: string | null;
    membershipId: string;
    fullName: string;
};

type CredentialsState = {
    title: string;
    description?: string;
    fields: AdminCredentialField[];
    warnings?: string[];
};

const resolveCreateError = (failure: unknown) => {
    if (failure instanceof ApiError) {
        if (failure.status === 403) {
            return "No tienes permisos para administrar este evento.";
        }

        if (failure.status === 409) {
            return "El código de participante ya existe en este evento.";
        }

        return failure.message;
    }

    return "No se pudo crear el participante. Intenta de nuevo.";
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
    const [credentials, setCredentials] = useState<CredentialsState | null>(
        null,
    );

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
                ...(form.alias.trim() && { alias: form.alias.trim() }),
                ...(form.bio.trim() && { bio: form.bio.trim() }),
            };

            const response = await createAccount(token, body);
            const delegationCode =
                response.delegation_code ??
                response.membership.delegation_code ??
                null;
            const fullName = `${body.first_name} ${body.last_name}`.trim();

            setCreated({
                participantCode: response.membership.participant_code,
                delegationCode,
                membershipId: response.membership.id,
                fullName,
            });
            setCredentials({
                title: "Cuenta creada correctamente",
                description: `Guarda las credenciales de ${fullName}.`,
                fields: [
                    {
                        key: "login",
                        label: "Código de login",
                        value: response.membership.participant_code,
                    },
                    {
                        key: "delegation",
                        label: "Código #",
                        value: delegationCode ?? "Sin código",
                    },
                    {
                        key: "password",
                        label: "Contraseña inicial",
                        value: response.initial_password,
                    },
                ],
                warnings: response.warnings,
            });
        } catch (createError) {
            setApiError(resolveCreateError(createError));
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAnother = () => {
        setCreated(null);
        setCredentials(null);
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
                    <AdminButton
                        href={`/admin/events/${eventId}/participants`}
                        variant="secondary"
                    >
                        Volver a participantes
                    </AdminButton>
                }
            />

            {created ? (
                <div className="space-y-4">
                    <AdminAlertBanner
                        type="success"
                        message={`Cuenta creada: ${created.fullName} (${created.participantCode}).`}
                    />

                    <div
                        className="rounded-2xl p-6 space-y-4"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-sm)",
                        }}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p
                                    className="text-[10px] font-extrabold uppercase tracking-widest font-heading"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    Código de login
                                </p>
                                <p
                                    className="mt-1 text-sm font-semibold font-heading"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    {created.participantCode}
                                </p>
                            </div>
                            <div>
                                <p
                                    className="text-[10px] font-extrabold uppercase tracking-widest font-heading"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    Código #
                                </p>
                                <p
                                    className="mt-1 text-sm font-semibold font-heading"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    {created.delegationCode ?? "Sin código"}
                                </p>
                            </div>
                        </div>
                        <p
                            className="text-xs leading-relaxed"
                            style={{ color: "var(--text-muted)" }}
                        >
                            La contraseña inicial se mostró una sola vez. Si se
                            perdió, restablécala desde el detalle del
                            participante.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <AdminButton
                            href={`/admin/events/${eventId}/participants/${created.membershipId}`}
                        >
                            Ver participante
                        </AdminButton>
                        <AdminButton
                            type="button"
                            variant="secondary"
                            onClick={handleCreateAnother}
                            icon={<IconPlus size={16} />}
                        >
                            Registrar otro
                        </AdminButton>
                        <AdminButton
                            href={`/admin/events/${eventId}/participants`}
                            variant="secondary"
                        >
                            Volver a participantes
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
                            placeholder="Ej: ana.perez"
                            required
                            maxLength={50}
                            value={form.participant_code}
                            onChange={(event) =>
                                handleChange(
                                    "participant_code",
                                    event.target.value,
                                )
                            }
                            error={errors.participant_code}
                            hint="Se usa para iniciar sesión y no se puede modificar después."
                            disabled={loading}
                        />

                        <AdminFormSelect
                            id="participant-role"
                            label="Rol"
                            required
                            value={form.role}
                            onChange={(event) => handleChange("role", event.target.value)}
                            options={PARTICIPANT_ROLES.map((role) => ({
                                value: role,
                                label: formatRoleLabel(role),
                            }))}
                            error={errors.role}
                            disabled={loading}
                        />
                    </div>

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
                            maxLength={120}
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
                            maxLength={120}
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
                            maxLength={100}
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
                            maxLength={100}
                            value={form.last_name}
                            onChange={(event) =>
                                handleChange("last_name", event.target.value)
                            }
                            error={errors.last_name}
                            disabled={loading}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <AdminFormInput
                            id="participant-display-name"
                            label="Nombre para mostrar"
                            placeholder="Ej: María López (opcional)"
                            value={form.display_name}
                            onChange={(event) =>
                                handleChange(
                                    "display_name",
                                    event.target.value,
                                )
                            }
                            hint="Si lo dejas vacío, se mostrará el nombre y apellido."
                            disabled={loading}
                        />
                        <AdminFormInput
                            id="participant-alias"
                            label="Alias"
                            placeholder="Ej: Anita (opcional)"
                            maxLength={60}
                            value={form.alias}
                            onChange={(event) =>
                                handleChange("alias", event.target.value)
                            }
                            hint="Máximo 60 caracteres."
                            disabled={loading}
                        />
                    </div>

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
                            icon={<IconCheck size={16} />}
                        >
                            {loading ? "Creando cuenta..." : "Crear participante"}
                        </AdminButton>
                    </div>
                </form>
            )}

            {credentials && (
                <AdminCredentialsDialog
                    title={credentials.title}
                    description={credentials.description}
                    fields={credentials.fields}
                    warnings={credentials.warnings}
                    note="Guarda estas credenciales ahora. La contraseña inicial no se volverá a mostrar."
                    onClose={() => setCredentials(null)}
                />
            )}
        </div>
    );
}
