"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
    listParticipantDirectory,
    type ParticipantDirectoryResponse,
} from "../../../lib/api/directory";
import { getEventCommittees, type EventCommittee } from "../../../lib/api/events";
import { PersonLabel } from "../../../components/ui/PersonLabel";
import { IconSearch } from "../../../components/ui/icons";
import { useAuthStore } from "../../../stores/auth.store";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const Directory = () => {
    const token = useAuthStore((state) => state.token);
    const eventId = useAuthStore((state) => state.activeEventId);

    const [searchInput, setSearchInput] = useState("");
    const [query, setQuery] = useState("");
    const [committeeId, setCommitteeId] = useState("");
    const [page, setPage] = useState(1);
    const [committees, setCommittees] = useState<EventCommittee[]>([]);
    const [directory, setDirectory] = useState<ParticipantDirectoryResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Un cambio de evento invalida el comité y la página seleccionados.
        setCommitteeId("");
        setPage(1);
    }, [eventId]);

    useEffect(() => {
        // Aplica la búsqueda tras una pausa al escribir y vuelve a la página 1 al cambiar el texto.
        const next = searchInput.trim();

        if (next === query) {
            return;
        }

        const timer = window.setTimeout(() => {
            setQuery(next);
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);

        return () => window.clearTimeout(timer);
    }, [query, searchInput]);

    useEffect(() => {
        // Carga el catálogo de comités del evento para el selector.
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;

        const loadCommittees = async () => {
            try {
                const response = await getEventCommittees({ token, eventId });

                if (!cancelled) {
                    setCommittees(response);
                }
            } catch {
                if (!cancelled) {
                    setCommittees([]);
                }
            }
        };

        // Al cambiar de evento no se conservan comités del anterior.
        setCommittees([]);
        void loadCommittees();

        return () => {
            cancelled = true;
        };
    }, [eventId, token]);

    useEffect(() => {
        // Carga la página activa; las respuestas de un contexto anterior se descartan.
        if (!token || !eventId) {
            return;
        }

        let cancelled = false;

        const loadDirectory = async () => {
            setIsLoading(true);

            try {
                const response = await listParticipantDirectory(
                    { token, eventId },
                    {
                        q: query,
                        committeeId: committeeId || undefined,
                        page,
                        limit: PAGE_SIZE,
                    },
                );

                if (!cancelled) {
                    setDirectory(response);
                    setError(null);
                }
            } catch (loadError) {
                if (!cancelled) {
                    setDirectory(null);
                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : "No se pudo cargar el directorio.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void loadDirectory();

        return () => {
            cancelled = true;
        };
    }, [committeeId, eventId, page, query, token]);

    const participants = directory?.participants ?? [];

    return (
        <div className="p-4 sm:p-6 lg:p-12">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <span
                        className="text-[11px] font-bold uppercase tracking-[0.15em] font-heading"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Participantes del evento
                    </span>
                    <h1
                        className="text-3xl sm:text-4xl font-black font-heading mt-1 uppercase tracking-tight"
                        style={{ color: "var(--text-accent)" }}
                    >
                        Directorio
                    </h1>
                </header>

                <div className="flex flex-col sm:flex-row gap-3 mb-8">
                    <div className="relative flex-1">
                        <IconSearch
                            size={16}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2"
                            style={{ color: "var(--text-muted)" }}
                        />
                        <input
                            type="search"
                            placeholder="Buscar por nombre, alias o delegación..."
                            aria-label="Buscar participantes"
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl font-body text-sm outline-none transition-all"
                            style={{
                                backgroundColor: "var(--bg-surface)",
                                border: "1px solid var(--border-color)",
                                color: "var(--text-primary)",
                            }}
                            onFocus={(event) => {
                                event.currentTarget.style.borderColor = "var(--input-focus)";
                                event.currentTarget.style.boxShadow =
                                    "0 0 0 3px color-mix(in srgb, var(--input-focus) 12%, transparent)";
                            }}
                            onBlur={(event) => {
                                event.currentTarget.style.borderColor = "var(--border-color)";
                                event.currentTarget.style.boxShadow = "none";
                            }}
                        />
                    </div>

                    <select
                        value={committeeId}
                        aria-label="Filtrar por comité"
                        onChange={(event) => {
                            setCommitteeId(event.target.value);
                            setPage(1);
                        }}
                        className="w-full sm:w-64 px-4 py-3 rounded-xl font-body text-sm outline-none transition-all"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-primary)",
                        }}
                    >
                        <option value="">Todos los comités</option>
                        {committees.map((committee) => (
                            <option key={committee.id} value={committee.id}>
                                {committee.name}
                            </option>
                        ))}
                    </select>
                </div>

                {error && (
                    <div
                        className="mb-6 rounded-xl px-4 py-3 text-sm font-body"
                        style={{
                            backgroundColor: "color-mix(in srgb, #ef4444 8%, white)",
                            border: "1px solid color-mix(in srgb, #ef4444 20%, transparent)",
                            color: "#991b1b",
                        }}
                    >
                        {error}
                    </div>
                )}

                {isLoading ? (
                    <div
                        className="flex justify-center py-12 rounded-xl"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                        }}
                    >
                        <span className="font-body text-sm" style={{ color: "var(--text-muted)" }}>
                            Cargando participantes...
                        </span>
                    </div>
                ) : error ? null : participants.length > 0 ? (
                    <ul className="space-y-3">
                        {participants.map((participant) => {
                            const fullName = [participant.firstName, participant.lastName]
                                .filter((part) => part.trim().length > 0)
                                .join(" ");

                            return (
                                <li key={participant.membershipId}>
                                    <Link
                                        href={`/profile/${participant.membershipId}`}
                                        className="flex items-center gap-4 rounded-xl p-4 transition-opacity hover:opacity-90"
                                        style={{
                                            backgroundColor: "var(--bg-surface)",
                                            border: "1px solid var(--border-color)",
                                            boxShadow: "var(--shadow-sm)",
                                        }}
                                    >
                                        <div className="flex flex-1 min-w-0">
                                            <PersonLabel
                                                person={{
                                                    name: fullName,
                                                    alias: participant.alias,
                                                    committeeName: participant.committee?.name ?? null,
                                                }}
                                            />
                                        </div>
                                        {participant.delegationCode && (
                                            <span
                                                className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold font-heading"
                                                style={{
                                                    backgroundColor: "var(--bg-surface-secondary)",
                                                    border: "1px solid var(--border-color)",
                                                    color: "var(--text-accent)",
                                                }}
                                            >
                                                {participant.delegationCode}
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div
                        className="flex justify-center py-12 rounded-xl"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "2px dashed var(--border-color)",
                        }}
                    >
                        <span className="font-body text-sm" style={{ color: "var(--text-muted)" }}>
                            No se encontraron participantes.
                        </span>
                    </div>
                )}

                <nav
                    className="mt-6 flex items-center justify-between gap-3"
                    aria-label="Paginación del directorio"
                >
                    <button
                        type="button"
                        onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                        disabled={page <= 1 || isLoading}
                        className="px-4 py-2.5 rounded-xl text-sm font-heading font-semibold transition-all disabled:opacity-40"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-primary)",
                        }}
                    >
                        Anterior
                    </button>
                    <span className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>
                        Página {page}
                    </span>
                    <button
                        type="button"
                        onClick={() => setPage((currentPage) => currentPage + 1)}
                        disabled={!directory?.hasMore || isLoading}
                        className="px-4 py-2.5 rounded-xl text-sm font-heading font-semibold transition-all disabled:opacity-40"
                        style={{
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-primary)",
                        }}
                    >
                        Siguiente
                    </button>
                </nav>
            </div>
        </div>
    );
};

export default Directory;
