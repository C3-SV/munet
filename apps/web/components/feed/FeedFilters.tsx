import React, { useState } from "react";
import { Button } from "../ui/Button";
import { IconCheck, IconClose, IconSearch } from "../ui/icons";

interface FeedFiltersProps {
    searchQuery: string;
    onSearchChange: (q: string) => void;
    selectedCommittees: string[];
    onCommitteeToggle: (c: string) => void;
    onClearCommittees: () => void;
    comitesDisponibles: string[];
    sortOrder: "recent" | "oldest";
    onSortChange: (order: "recent" | "oldest") => void;
    showCommitteeFilter: boolean;
}

const SEARCH_INPUT_ID = "feed-search-input";

const SORT_OPTIONS: { value: "recent" | "oldest"; label: string }[] = [
    { value: "recent", label: "Recientes" },
    { value: "oldest", label: "Antiguos" },
];

export const FeedFilters = ({
    searchQuery,
    onSearchChange,
    selectedCommittees,
    onCommitteeToggle,
    onClearCommittees,
    comitesDisponibles,
    sortOrder,
    onSortChange,
    showCommitteeFilter,
}: FeedFiltersProps) => {
    // La búsqueda se muestra si el usuario la abre o si ya hay un texto filtrando.
    const [isSearchOpen, setIsSearchOpen] = useState(searchQuery.length > 0);
    const isSearchVisible = isSearchOpen || searchQuery.length > 0;
    const hasActiveFilters = selectedCommittees.length > 0 || searchQuery.trim().length > 0;

    const toggleSearch = () => {
        // Al cerrar la búsqueda se limpia el texto para no dejar un filtro oculto.
        if (isSearchVisible) {
            onSearchChange("");
            setIsSearchOpen(false);
            return;
        }

        setIsSearchOpen(true);
    };

    const clearAllFilters = () => {
        onClearCommittees();
        onSearchChange("");
        setIsSearchOpen(false);
    };

    return (
        <div className="mb-6 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={toggleSearch}
                    aria-label={isSearchVisible ? "Cerrar búsqueda" : "Abrir búsqueda"}
                    aria-expanded={isSearchVisible}
                    aria-controls={SEARCH_INPUT_ID}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-sm)]"
                    style={{
                        border: "1px solid var(--border-color)",
                        backgroundColor: "var(--bg-surface)",
                        color: isSearchVisible ? "var(--text-accent)" : "var(--text-secondary)",
                    }}
                >
                    {isSearchVisible ? <IconClose size={18} /> : <IconSearch size={18} />}
                </button>

                <div
                    role="group"
                    aria-label="Orden de publicaciones"
                    className="ml-auto inline-flex gap-1 rounded-[var(--radius-sm)] p-1"
                    style={{ border: "1px solid var(--border-color)" }}
                >
                    {SORT_OPTIONS.map((option) => (
                        <Button
                            key={option.value}
                            variant={sortOrder === option.value ? "secondary" : "ghost"}
                            size="sm"
                            aria-pressed={sortOrder === option.value}
                            onClick={() => onSortChange(option.value)}
                        >
                            {option.label}
                        </Button>
                    ))}
                </div>

                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                        Limpiar
                    </Button>
                )}
            </div>

            {isSearchVisible && (
                <div>
                    <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
                        Buscar publicaciones
                    </label>
                    <input
                        id={SEARCH_INPUT_ID}
                        type="search"
                        placeholder="Buscar por texto, nombre o alias"
                        value={searchQuery}
                        onChange={(event) => onSearchChange(event.target.value)}
                        className="w-full min-h-11 rounded-[var(--radius-sm)] px-4 font-body text-sm outline-none"
                        style={{
                            backgroundColor: "var(--bg-input)",
                            border: "1px solid var(--input-border)",
                            color: "var(--text-primary)",
                        }}
                    />
                </div>
            )}

            {showCommitteeFilter && comitesDisponibles.length > 0 && (
                <div
                    role="group"
                    aria-label="Filtrar por comité"
                    className="flex gap-2 overflow-x-auto pb-1"
                >
                    {comitesDisponibles.map((comite) => {
                        const isPressed = selectedCommittees.includes(comite);

                        return (
                            <button
                                key={comite}
                                type="button"
                                aria-pressed={isPressed}
                                onClick={() => onCommitteeToggle(comite)}
                                className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold font-heading"
                                style={{
                                    backgroundColor: isPressed
                                        ? "var(--sidebar-active-bg)"
                                        : "var(--bg-surface)",
                                    border: `1px solid ${
                                        isPressed ? "var(--text-accent)" : "var(--border-color)"
                                    }`,
                                    color: isPressed ? "var(--text-accent)" : "var(--text-secondary)",
                                }}
                            >
                                {isPressed && <IconCheck size={14} />}
                                {comite}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
