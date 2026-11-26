"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AdminAlertBanner } from "../../../../../../../components/admin/AdminAlertBanner";
import { AdminButton } from "../../../../../../../components/admin/AdminButton";
import { AdminModal } from "../../../../../../../components/admin/AdminModal";
import { AdminPageHeader } from "../../../../../../../components/admin/AdminPageHeader";
import { getEvent } from "../../../../../../../lib/api/admin";
import { ApiError } from "../../../../../../../lib/api/client";
import {
    confirmParticipantImport,
    previewParticipantImport,
    type ParticipantImportCreatedRow,
    type ParticipantImportFailedRow,
    type ParticipantImportPreview,
    type ParticipantImportRow,
} from "../../../../../../../lib/api/participants";
import { buildCsv, downloadCsv } from "../../../../../../../lib/csv";
import { buildCredentialsCsv } from "../../../../../../../lib/credentials-csv";
import { useAuthStore } from "../../../../../../../stores/auth.store";
import { IconCheck, IconDownload, IconRefresh } from "../../../../../../../components/ui/icons";

const DEFAULT_TEMPLATE_HEADERS = [
    "nombre",
    "apellido",
    "codigo_participante",
    "comite",
    "delegacion",
    "rol",
    "alias",
];

const TEMPLATE_EXAMPLE = [
    "Ana",
    "Pérez",
    "ana.perez",
    "AG",
    "México",
    "participante",
    "Anita",
];

const ROLE_LABELS: Record<string, string> = {
    PARTICIPANT: "Participante",
    MODERATOR: "Moderador",
    ADMIN_MUN: "Administrador MUN",
};

type ImportStep = "upload" | "review" | "result";
type ReviewTab = "valid" | "invalid" | "duplicates";

type ProgressState = {
    current: number;
    total: number;
};

const getActionErrorMessage = (failure: unknown) => {
    if (failure instanceof ApiError) {
        return failure.status === 403
            ? "No tienes permisos para administrar este evento."
            : failure.message;
    }

    return "No se pudo completar la importación. Intenta de nuevo.";
};

const formatValues = (values: Record<string, string>) => {
    const parts = Object.entries(values)
        .filter(([, value]) => value.trim())
        .map(([key, value]) => `${key}: ${value}`);

    return parts.length > 0 ? parts.join(" · ") : "Sin valores";
};

const formatDuplicateReason = (reason: "IN_FILE" | "IN_EVENT") =>
    reason === "IN_FILE"
        ? "Repetido dentro del archivo"
        : "Ya existe en el evento";

const LoadingSpinner = () => (
    <span
        className="inline-block animate-spin rounded-full border-2 border-t-transparent"
        style={{
            width: 16,
            height: 16,
            borderColor: "var(--text-accent)",
            borderTopColor: "transparent",
        }}
    />
);

export default function ImportParticipantsPage() {
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
    const [step, setStep] = useState<ImportStep>("upload");
    const [fileName, setFileName] = useState<string | null>(null);
    const [preview, setPreview] = useState<ParticipantImportPreview | null>(
        null,
    );
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [encodingWarning, setEncodingWarning] = useState(false);
    const [templateHeaders, setTemplateHeaders] = useState(
        DEFAULT_TEMPLATE_HEADERS,
    );
    const [activeTab, setActiveTab] = useState<ReviewTab>("valid");

    const [confirming, setConfirming] = useState(false);
    const [progress, setProgress] = useState<ProgressState>({
        current: 0,
        total: 0,
    });
    const [createdRows, setCreatedRows] = useState<
        ParticipantImportCreatedRow[]
    >([]);
    const [failedRows, setFailedRows] = useState<ParticipantImportFailedRow[]>(
        [],
    );
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const [credentialsDownloaded, setCredentialsDownloaded] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

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
        const shouldWarn =
            confirming ||
            (step === "result" &&
                createdRows.length > 0 &&
                !credentialsDownloaded);

        if (!shouldWarn) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [confirming, createdRows.length, credentialsDownloaded, step]);

    const confirmLeave = () => {
        if (confirming) {
            window.alert("Espera a que termine la importación.");
            return false;
        }

        if (createdRows.length === 0 || credentialsDownloaded) {
            return true;
        }

        return window.confirm(
            "No has descargado las credenciales. Si sales ahora, las contraseñas iniciales se perderán. ¿Continuar?",
        );
    };

    const handleLeave = () => {
        if (!confirmLeave()) {
            return;
        }

        router.push(`/admin/events/${eventId}/participants`);
    };

    useEffect(() => {
        if (
            step !== "result" ||
            createdRows.length === 0 ||
            credentialsDownloaded
        ) {
            return;
        }

        const handleLinkClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;

            if (!target?.closest("a")) {
                return;
            }

            const shouldLeave = window.confirm(
                "No has descargado las credenciales. Si sales ahora, las contraseñas iniciales se perderán. ¿Continuar?",
            );

            if (!shouldLeave) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        document.addEventListener("click", handleLinkClick, true);

        return () => {
            document.removeEventListener("click", handleLinkClick, true);
        };
    }, [createdRows.length, credentialsDownloaded, step]);

    const handleDownloadTemplate = () => {
        downloadCsv(
            "plantilla-participantes.csv",
            buildCsv(templateHeaders, [TEMPLATE_EXAMPLE]),
        );
    };

    const handleFileChange = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        setFileName(file.name);
        setPreviewError(null);
        setPreview(null);
        setEncodingWarning(false);
        setConfirmError(null);
        setCreatedRows([]);
        setFailedRows([]);
        setCredentialsDownloaded(false);
        setPreviewLoading(true);

        try {
            const text = await file.text();

            if (!text.trim()) {
                setPreviewError("El archivo está vacío.");
                return;
            }

            setEncodingWarning(text.includes("\uFFFD"));

            if (!token || !eventId) {
                setPreviewError("Sesión o evento no válido. Recarga la página.");
                return;
            }

            const data = await previewParticipantImport(
                token,
                eventId,
                text,
            );

            setPreview(data);
            setTemplateHeaders(
                data.template_headers.length > 0
                    ? data.template_headers
                    : DEFAULT_TEMPLATE_HEADERS,
            );
            setActiveTab(
                data.valid.length > 0
                    ? "valid"
                    : data.invalid.length > 0
                      ? "invalid"
                      : "duplicates",
            );
            setStep("review");
        } catch (error) {
            if (error instanceof ApiError) {
                setPreviewError(getActionErrorMessage(error));

                const payload = (error.payload ?? {}) as {
                    template_headers?: unknown;
                };

                if (
                    Array.isArray(payload.template_headers) &&
                    payload.template_headers.every(
                        (header) => typeof header === "string",
                    )
                ) {
                    setTemplateHeaders(payload.template_headers);
                }
            } else {
                setPreviewError(
                    error instanceof Error
                        ? error.message
                        : "No se pudo leer el archivo.",
                );
            }
        } finally {
            setPreviewLoading(false);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const resetImport = () => {
        if (!confirmLeave()) {
            return;
        }

        setStep("upload");
        setFileName(null);
        setPreview(null);
        setPreviewError(null);
        setEncodingWarning(false);
        setTemplateHeaders(DEFAULT_TEMPLATE_HEADERS);
        setActiveTab("valid");
        setConfirming(false);
        setProgress({ current: 0, total: 0 });
        setCreatedRows([]);
        setFailedRows([]);
        setConfirmError(null);
        setCredentialsDownloaded(false);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleConfirmImport = async () => {
        if (!token || !eventId || !preview || preview.valid.length === 0) {
            return;
        }

        const batchSize = Math.max(
            1,
            Math.min(preview.limits.confirm_batch_max || 50, 50),
        );
        const batches: ParticipantImportRow[][] = [];

        for (let index = 0; index < preview.valid.length; index += batchSize) {
            batches.push(preview.valid.slice(index, index + batchSize));
        }

        setConfirming(true);
        setConfirmError(null);
        setProgress({ current: 0, total: batches.length });

        const created: ParticipantImportCreatedRow[] = [];
        const failed: ParticipantImportFailedRow[] = [];
        let confirmFailure: string | null = null;

        for (let index = 0; index < batches.length; index += 1) {
            const batch = batches[index];

            if (!batch) {
                continue;
            }

            setProgress({ current: index + 1, total: batches.length });

            try {
                const response = await confirmParticipantImport(
                    token,
                    eventId,
                    batch,
                );

                created.push(...response.created);
                failed.push(...response.failed);
            } catch (error) {
                confirmFailure = getActionErrorMessage(error);
                break;
            }
        }

        setCreatedRows(created);
        setFailedRows(failed);
        setConfirmError(confirmFailure);
        setConfirming(false);
        setStep("result");
    };

    const handleDownloadCredentials = () => {
        if (createdRows.length === 0) {
            return;
        }

        downloadCsv(
            `credenciales-participantes-${new Date()
                .toISOString()
                .slice(0, 10)}.csv`,
            buildCredentialsCsv(createdRows),
        );
        setCredentialsDownloaded(true);
    };

    const createdWarnings = createdRows.flatMap((row) =>
        row.warnings.map((message) => ({
            row: row.row,
            participantCode: row.participant_code,
            message,
        })),
    );
    const unprocessedRows = preview
        ? Math.max(
              0,
              preview.valid.length - createdRows.length - failedRows.length,
          )
        : 0;
    const progressPercent =
        progress.total > 0
            ? Math.round((progress.current / progress.total) * 100)
            : 0;

    const reviewTabs: { key: ReviewTab; label: string; count: number }[] =
        preview
            ? [
                  {
                      key: "valid",
                      label: "Válidas",
                      count: preview.valid.length,
                  },
                  {
                      key: "invalid",
                      label: "Con errores",
                      count: preview.invalid.length,
                  },
                  {
                      key: "duplicates",
                      label: "Duplicadas",
                      count: preview.duplicates.length,
                  },
              ]
            : [];

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <AdminPageHeader
                title="Importar participantes"
                description={`Carga masiva de cuentas para ${eventName}.`}
                breadcrumb={[
                    { label: "Panel", href: "/admin" },
                    { label: "Eventos", href: "/admin/events" },
                    { label: eventName, href: `/admin/events/${eventId}` },
                    {
                        label: "Participantes",
                        href: `/admin/events/${eventId}/participants`,
                    },
                    { label: "Importar CSV" },
                ]}
                action={
                    <AdminButton
                        type="button"
                        variant="secondary"
                        onClick={handleLeave}
                    >
                        Volver a participantes
                    </AdminButton>
                }
            />

            {step === "upload" && (
                <>
                    <div
                        className="rounded-2xl p-6 sm:p-8 space-y-4"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-sm)",
                        }}
                    >
                        <div>
                            <h2
                                className="text-lg font-bold font-heading"
                                style={{ color: "var(--text-primary)" }}
                            >
                                1. Descarga la plantilla
                            </h2>
                            <p
                                className="mt-1 text-sm"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                Usa estas columnas. Puedes separar con coma o
                                punto y coma.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {templateHeaders.map((header) => (
                                <span
                                    key={header}
                                    className="rounded-lg px-2 py-1 text-xs font-semibold font-heading"
                                    style={{
                                        backgroundColor:
                                            "var(--bg-surface-secondary)",
                                        border: "1px solid var(--border-color)",
                                        color: "var(--text-secondary)",
                                    }}
                                >
                                    {header}
                                </span>
                            ))}
                        </div>

                        <AdminButton
                            type="button"
                            variant="secondary"
                            onClick={handleDownloadTemplate}
                            icon={<IconDownload size={16} />}
                        >
                            Descargar plantilla CSV
                        </AdminButton>

                        <ul
                            className="list-disc pl-5 space-y-1 text-xs"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            <li>
                                <strong>nombre</strong> y{" "}
                                <strong>apellido</strong> son obligatorios
                                (hasta 100 caracteres).
                            </li>
                            <li>
                                <strong>codigo_participante</strong> es
                                obligatorio, de 3 a 50 caracteres y único en el
                                evento.
                            </li>
                            <li>
                                <strong>comite</strong> acepta código o nombre.
                                Si no existe en el evento se crea al importar;
                                vacío significa sin comité.
                            </li>
                            <li>
                                <strong>rol</strong> acepta participante,
                                moderador o administrador MUN. El administrador
                                técnico se crea uno por uno.
                            </li>
                            <li>
                                <strong>alias</strong> es opcional, máximo 60
                                caracteres.
                            </li>
                            <li>
                                La plantilla incluye una fila de ejemplo:
                                reemplázala por tus datos.
                            </li>
                        </ul>
                    </div>

                    <div
                        className="rounded-2xl p-6 sm:p-8 space-y-4"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-sm)",
                        }}
                    >
                        <div>
                            <h2
                                className="text-lg font-bold font-heading"
                                style={{ color: "var(--text-primary)" }}
                            >
                                2. Sube el archivo
                            </h2>
                            <p
                                className="mt-1 text-sm"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                Máximo 1000 filas de datos. Acepta archivos con
                                BOM y separador coma o punto y coma.
                            </p>
                        </div>

                        <label
                            className="flex flex-col items-center justify-center gap-1 rounded-xl px-6 py-8 text-center cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                            style={{
                                backgroundColor: "var(--bg-surface-secondary)",
                                border: "1px dashed var(--border-color)",
                            }}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,text/csv"
                                onChange={handleFileChange}
                                disabled={previewLoading}
                                className="sr-only"
                            />
                            {previewLoading ? (
                                <LoadingSpinner />
                            ) : (
                                <span
                                    className="text-xs font-extrabold uppercase tracking-widest font-heading"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    CSV
                                </span>
                            )}
                            <span
                                className="text-sm font-semibold font-heading"
                                style={{ color: "var(--text-primary)" }}
                            >
                                {previewLoading
                                    ? "Procesando archivo..."
                                    : "Seleccionar archivo CSV"}
                            </span>
                            <span
                                className="text-xs"
                                style={{ color: "var(--text-muted)" }}
                            >
                                {fileName ?? "Haz clic para elegir un archivo"}
                            </span>
                        </label>

                        {encodingWarning && (
                            <AdminAlertBanner
                                type="warning"
                                message="El archivo parece no estar en UTF-8. En Excel, usa Guardar como → CSV UTF-8 (delimitado por comas) para conservar tildes y eñes."
                            />
                        )}

                        {previewError && (
                            <AdminAlertBanner
                                type="error"
                                message={previewError}
                                onDismiss={() => setPreviewError(null)}
                            />
                        )}
                    </div>
                </>
            )}

            {step === "review" && preview && (
                <div
                    className="rounded-2xl p-6 sm:p-8 space-y-5"
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                >
                    <div>
                        <h2
                            className="text-lg font-bold font-heading"
                            style={{ color: "var(--text-primary)" }}
                        >
                            3. Revisar archivo
                        </h2>
                        <p
                            className="mt-1 text-sm"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            {fileName ?? "Archivo CSV"} ·{" "}
                            {preview.total_rows}{" "}
                            {preview.total_rows === 1 ? "fila" : "filas"}{" "}
                            detectadas.
                        </p>
                    </div>

                    {encodingWarning && (
                        <AdminAlertBanner
                            type="warning"
                            message="El archivo parece no estar en UTF-8. Si ves caracteres raros, guarda el archivo como CSV UTF-8 en Excel y vuelve a subirlo."
                        />
                    )}

                    {preview.new_committees.length > 0 && (
                        <AdminAlertBanner
                            type="warning"
                            message={`Se crearán ${preview.new_committees.length} comité(s) que no existen en el evento: ${preview.new_committees.join(", ")}.`}
                        />
                    )}

                    <div className="flex flex-wrap gap-2">
                        {reviewTabs.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveTab(tab.key)}
                                className="rounded-lg px-3 py-2 text-xs font-semibold font-heading transition-colors"
                                style={{
                                    backgroundColor:
                                        activeTab === tab.key
                                            ? "var(--sidebar-active-bg)"
                                            : "var(--bg-surface-secondary)",
                                    border: "1px solid var(--border-color)",
                                    color:
                                        activeTab === tab.key
                                            ? "var(--sidebar-active-text)"
                                            : "var(--text-secondary)",
                                }}
                            >
                                {tab.label} ({tab.count})
                            </button>
                        ))}
                    </div>

                    {activeTab === "valid" && (
                        <div className="overflow-x-auto">
                            {preview.valid.length === 0 ? (
                                <p
                                    className="py-8 text-center text-sm"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    No hay filas válidas.
                                </p>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr
                                            style={{
                                                borderBottom:
                                                    "1px solid var(--border-color)",
                                            }}
                                        >
                                            {[
                                                "Fila",
                                                "Nombre",
                                                "Código de login",
                                                "Comité",
                                                "Rol",
                                                "Alias",
                                            ].map((column) => (
                                                <th
                                                    key={column}
                                                    className="px-3 py-2 text-xs font-extrabold uppercase tracking-widest font-heading"
                                                    style={{
                                                        color: "var(--text-muted)",
                                                        backgroundColor:
                                                            "var(--bg-surface-secondary)",
                                                    }}
                                                >
                                                    {column}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.valid.map((row) => (
                                            <tr
                                                key={`${row.row}-${row.participant_code}`}
                                                style={{
                                                    borderBottom:
                                                        "1px solid var(--border-light)",
                                                }}
                                            >
                                                <td
                                                    className="px-3 py-2 text-xs tabular-nums"
                                                    style={{
                                                        color: "var(--text-muted)",
                                                    }}
                                                >
                                                    {row.row}
                                                </td>
                                                <td
                                                    className="px-3 py-2 text-sm"
                                                    style={{
                                                        color: "var(--text-primary)",
                                                    }}
                                                >
                                                    {row.first_name}{" "}
                                                    {row.last_name}
                                                </td>
                                                <td
                                                    className="px-3 py-2 text-xs font-semibold font-heading"
                                                    style={{
                                                        color: "var(--text-accent)",
                                                    }}
                                                >
                                                    {row.participant_code}
                                                </td>
                                                <td
                                                    className="px-3 py-2 text-sm"
                                                    style={{
                                                        color: "var(--text-secondary)",
                                                    }}
                                                >
                                                    {row.committee_label ?? "—"}
                                                    {row.new_committee_name &&
                                                        " (nuevo)"}
                                                </td>
                                                <td
                                                    className="px-3 py-2 text-xs"
                                                    style={{
                                                        color: "var(--text-secondary)",
                                                    }}
                                                >
                                                    {ROLE_LABELS[row.role] ??
                                                        row.role}
                                                </td>
                                                <td
                                                    className="px-3 py-2 text-sm"
                                                    style={{
                                                        color: "var(--text-secondary)",
                                                    }}
                                                >
                                                    {row.alias ?? "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {activeTab === "invalid" && (
                        <div className="space-y-2">
                            {preview.invalid.length === 0 ? (
                                <p
                                    className="py-8 text-center text-sm"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    No hay filas con errores.
                                </p>
                            ) : (
                                preview.invalid.map((row) => (
                                    <div
                                        key={row.row}
                                        className="rounded-xl p-3"
                                        style={{
                                            backgroundColor:
                                                "var(--bg-surface-secondary)",
                                            border: "1px solid var(--border-color)",
                                        }}
                                    >
                                        <p
                                            className="text-sm font-semibold font-heading"
                                            style={{
                                                color: "var(--text-primary)",
                                            }}
                                        >
                                            Fila {row.row}
                                        </p>
                                        <p
                                            className="mt-1 text-xs break-words"
                                            style={{
                                                color: "var(--text-muted)",
                                            }}
                                        >
                                            {formatValues(row.values)}
                                        </p>
                                        <ul
                                            className="mt-1 list-disc pl-4 text-xs"
                                            style={{ color: "var(--danger)" }}
                                        >
                                            {row.errors.map((error) => (
                                                <li key={error}>{error}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === "duplicates" && (
                        <div className="space-y-2">
                            {preview.duplicates.length === 0 ? (
                                <p
                                    className="py-8 text-center text-sm"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    No hay filas duplicadas.
                                </p>
                            ) : (
                                preview.duplicates.map((row) => (
                                    <div
                                        key={row.row}
                                        className="rounded-xl p-3"
                                        style={{
                                            backgroundColor:
                                                "var(--bg-surface-secondary)",
                                            border: "1px solid var(--border-color)",
                                        }}
                                    >
                                        <p
                                            className="text-sm font-semibold font-heading"
                                            style={{
                                                color: "var(--text-primary)",
                                            }}
                                        >
                                            Fila {row.row}:{" "}
                                            {row.participant_code}
                                        </p>
                                        <p
                                            className="mt-1 text-xs"
                                            style={{ color: "var(--warning)" }}
                                        >
                                            {formatDuplicateReason(row.reason)}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    <div
                        className="rounded-xl p-3 text-xs"
                        style={{
                            backgroundColor:
                                "color-mix(in srgb, var(--warning) 8%, transparent)",
                            border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
                            color: "var(--text-secondary)",
                        }}
                    >
                        Las filas con errores o duplicadas no se importan.
                        Corrige el archivo y vuelve a subirlo.
                    </div>

                    {previewError && (
                        <AdminAlertBanner
                            type="error"
                            message={previewError}
                            onDismiss={() => setPreviewError(null)}
                        />
                    )}

                    <div className="flex flex-col sm:flex-row justify-end gap-3">
                        <AdminButton
                            type="button"
                            variant="secondary"
                            onClick={resetImport}
                            disabled={confirming}
                            icon={<IconRefresh size={16} />}
                        >
                            Volver a subir
                        </AdminButton>
                        <AdminButton
                            type="button"
                            onClick={handleConfirmImport}
                            loading={confirming}
                            disabled={
                                confirming || preview.valid.length === 0
                            }
                            icon={<IconCheck size={16} />}
                        >
                            Importar {preview.valid.length}{" "}
                            {preview.valid.length === 1 ? "válida" : "válidas"}
                        </AdminButton>
                    </div>
                </div>
            )}

            {step === "result" && preview && (
                <div
                    className="rounded-2xl p-6 sm:p-8 space-y-5"
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                >
                    <div>
                        <h2
                            className="text-lg font-bold font-heading"
                            style={{ color: "var(--text-primary)" }}
                        >
                            4. Resultado de la importación
                        </h2>
                        <p
                            className="mt-1 text-sm"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            Revisa el resumen y descarga las credenciales antes
                            de salir.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div
                            className="rounded-xl p-4"
                            style={{
                                backgroundColor:
                                    "color-mix(in srgb, var(--success) 8%, var(--bg-surface))",
                                border: "1px solid color-mix(in srgb, var(--success) 25%, transparent)",
                            }}
                        >
                            <p
                                className="text-[10px] font-extrabold uppercase tracking-widest font-heading"
                                style={{ color: "var(--success)" }}
                            >
                                Creadas
                            </p>
                            <p
                                className="mt-1 text-2xl font-extrabold font-heading"
                                style={{ color: "var(--success)" }}
                            >
                                {createdRows.length}
                            </p>
                        </div>
                        <div
                            className="rounded-xl p-4"
                            style={{
                                backgroundColor:
                                    "color-mix(in srgb, var(--danger) 8%, var(--bg-surface))",
                                border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
                            }}
                        >
                            <p
                                className="text-[10px] font-extrabold uppercase tracking-widest font-heading"
                                style={{ color: "var(--danger)" }}
                            >
                                Fallidas
                            </p>
                            <p
                                className="mt-1 text-2xl font-extrabold font-heading"
                                style={{ color: "var(--danger)" }}
                            >
                                {failedRows.length}
                            </p>
                        </div>
                        <div
                            className="rounded-xl p-4"
                            style={{
                                backgroundColor: "var(--bg-surface-secondary)",
                                border: "1px solid var(--border-color)",
                            }}
                        >
                            <p
                                className="text-[10px] font-extrabold uppercase tracking-widest font-heading"
                                style={{ color: "var(--text-muted)" }}
                            >
                                Sin procesar
                            </p>
                            <p
                                className="mt-1 text-2xl font-extrabold font-heading"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                {unprocessedRows}
                            </p>
                        </div>
                    </div>

                    {confirmError && (
                        <AdminAlertBanner
                            type="error"
                            message={`${confirmError} La importación se detuvo. Las cuentas ya creadas conservan sus credenciales; verifica la tabla antes de reintentar.`}
                        />
                    )}

                    {createdWarnings.length > 0 && (
                        <div className="space-y-2">
                            <AdminAlertBanner
                                type="warning"
                                message={`${createdWarnings.length} advertencia(s) durante la creación de cuentas.`}
                            />
                            <ul
                                className="list-disc pl-5 space-y-1 text-xs"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                {createdWarnings.map((warning, index) => (
                                    <li
                                        key={`${warning.row}-${warning.participantCode}-${index}`}
                                    >
                                        Fila {warning.row} (
                                        {warning.participantCode}):{" "}
                                        {warning.message}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {failedRows.length > 0 && (
                        <div className="space-y-2">
                            <h3
                                className="text-sm font-bold font-heading"
                                style={{ color: "var(--text-primary)" }}
                            >
                                Filas fallidas
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr
                                            style={{
                                                borderBottom:
                                                    "1px solid var(--border-color)",
                                            }}
                                        >
                                            {["Fila", "Código", "Errores"].map(
                                                (column) => (
                                                    <th
                                                        key={column}
                                                        className="px-3 py-2 text-xs font-extrabold uppercase tracking-widest font-heading"
                                                        style={{
                                                            color: "var(--text-muted)",
                                                            backgroundColor:
                                                                "var(--bg-surface-secondary)",
                                                        }}
                                                    >
                                                        {column}
                                                    </th>
                                                ),
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {failedRows.map((row) => (
                                            <tr
                                                key={`${row.row}-${row.participant_code ?? "sin-codigo"}`}
                                                style={{
                                                    borderBottom:
                                                        "1px solid var(--border-light)",
                                                }}
                                            >
                                                <td
                                                    className="px-3 py-2 text-xs tabular-nums"
                                                    style={{
                                                        color: "var(--text-muted)",
                                                    }}
                                                >
                                                    {row.row}
                                                </td>
                                                <td
                                                    className="px-3 py-2 text-xs font-semibold font-heading"
                                                    style={{
                                                        color: "var(--text-primary)",
                                                    }}
                                                >
                                                    {row.participant_code ??
                                                        "—"}
                                                </td>
                                                <td
                                                    className="px-3 py-2 text-xs"
                                                    style={{ color: "var(--danger)" }}
                                                >
                                                    {row.errors.join("; ")}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {createdRows.length > 0 ? (
                        <div className="space-y-3">
                            <AdminAlertBanner
                                type="warning"
                                message="Descarga las credenciales ahora. Las contraseñas iniciales no se pueden volver a obtener."
                            />
                            <div
                                className="rounded-xl p-3 text-xs space-y-1"
                                style={{
                                    backgroundColor: "var(--bg-surface-secondary)",
                                    border: "1px solid var(--border-color)",
                                    color: "var(--text-secondary)",
                                }}
                            >
                                <p>
                                    <strong>Cómo entra cada persona:</strong> en la pantalla de
                                    inicio de sesión toca «¿Es tu primera vez? Activa tu cuenta
                                    aquí» y usa el <strong>código para iniciar sesión</strong> y la{" "}
                                    <strong>contraseña temporal</strong> del archivo, escritos tal
                                    cual (respetando mayúsculas).
                                </p>
                                <p>
                                    El <strong>número de delegación (#)</strong> es solo un
                                    identificador público; no sirve para iniciar sesión.
                                </p>
                            </div>
                            <AdminButton
                                type="button"
                                onClick={handleDownloadCredentials}
                                icon={<IconDownload size={16} />}
                                style={{
                                    width: "100%",
                                    justifyContent: "center",
                                    padding: "0.875rem 1.25rem",
                                    fontSize: "1rem",
                                }}
                            >
                                Descargar credenciales (CSV)
                            </AdminButton>
                            {credentialsDownloaded && (
                                <p
                                    className="text-xs font-semibold"
                                    style={{ color: "var(--success)" }}
                                >
                                    Credenciales descargadas. Ya puedes salir o
                                    descargarlas de nuevo.
                                </p>
                            )}
                        </div>
                    ) : (
                        <p
                            className="text-sm"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            No se creó ninguna cuenta en esta importación.
                        </p>
                    )}

                    <div className="flex flex-col sm:flex-row justify-end gap-3">
                        <AdminButton
                            type="button"
                            variant="secondary"
                            onClick={resetImport}
                            icon={<IconRefresh size={16} />}
                        >
                            Importar otro CSV
                        </AdminButton>
                        <AdminButton
                            type="button"
                            variant="secondary"
                            onClick={handleLeave}
                        >
                            Volver a participantes
                        </AdminButton>
                    </div>
                </div>
            )}

            {confirming && (
                <AdminModal
                    title="Importando participantes"
                    description="No cierres ni recargues esta pestaña hasta que termine."
                    onClose={() => undefined}
                    dismissible={false}
                    maxWidthClassName="max-w-sm"
                >
                    <div className="space-y-3">
                        <p
                            className="text-sm font-semibold font-heading"
                            style={{ color: "var(--text-primary)" }}
                        >
                            Lote {progress.current} de {progress.total}
                        </p>
                        <div
                            className="h-2 w-full overflow-hidden rounded-full"
                            style={{
                                backgroundColor: "var(--bg-surface-secondary)",
                            }}
                        >
                            <div
                                className="h-full rounded-full transition-all"
                                style={{
                                    width: `${progressPercent}%`,
                                    backgroundColor: "var(--text-accent)",
                                }}
                            />
                        </div>
                        <p
                            className="text-xs"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            Estamos creando las cuentas y guardando las
                            credenciales. Al terminar podrás descargarlas.
                        </p>
                    </div>
                </AdminModal>
            )}
        </div>
    );
}
