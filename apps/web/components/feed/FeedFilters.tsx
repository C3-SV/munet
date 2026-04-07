import React, { useState, useRef, useEffect } from "react";

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

const filterBtnStyle = {
    backgroundColor: "var(--bg-surface)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
};

const dropdownStyle = {
    backgroundColor: "var(--bg-surface)",
    border: "1px solid var(--border-color)",
    boxShadow: "var(--shadow-md)",
};

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
    const [isCommitteeFilterOpen, setIsCommitteeFilterOpen] = useState(false);
    const [isSortOpen, setIsSortOpen] = useState(false);

    const committeeRef = useRef<HTMLDivElement>(null);
    const sortRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Cierra dropdowns al hacer click fuera de cada panel.
        const handleClickOutside = (event: MouseEvent) => {
            if (committeeRef.current && !committeeRef.current.contains(event.target as Node)) {
                setIsCommitteeFilterOpen(false);
            }
            if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
                setIsSortOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <div className="relative flex-1">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }}
                >
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                    type="text"
                    placeholder="Buscar posts..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl font-body text-sm outline-none transition-all"
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        color: "var(--text-primary)",
                    }}
                    onFocus={e => {
                        e.currentTarget.style.borderColor = "var(--input-focus)";
                        e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--input-focus) 12%, transparent)";
                    }}
                    onBlur={e => {
                        e.currentTarget.style.borderColor = "var(--border-color)";
                        e.currentTarget.style.boxShadow = "none";
                    }}
                />
            </div>

            <div className="flex gap-3">
                <div className="relative flex-1 sm:flex-none" ref={sortRef}>
                    <button
                        onClick={() => setIsSortOpen(!isSortOpen)}
                        className="flex items-center justify-between gap-3 w-full px-4 py-3 rounded-xl font-body text-sm transition-all"
                        style={filterBtnStyle}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--bg-surface)")}
                    >
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-secondary)" }}>
                                <line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/>
                            </svg>
                            <span>
                                {sortOrder === "recent" ? "Recientes" : "Antiguos"}
                            </span>
                        </div>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                                opacity: 0.4,
                                transform: isSortOpen ? "rotate(180deg)" : "rotate(0deg)",
                                transition: "transform 0.2s",
                            }}
                        >
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>

                    {isSortOpen && (
                        <div
                            className="absolute right-0 sm:left-auto left-0 mt-2 w-full sm:w-44 rounded-xl z-50 p-2"
                            style={dropdownStyle}
                        >
                            {(["recent", "oldest"] as const).map((order) => (
                                <button
                                    key={order}
                                    onClick={() => { onSortChange(order); setIsSortOpen(false); }}
                                    className="w-full text-left px-3 py-2.5 text-sm font-body rounded-lg transition-colors"
                                    style={{
                                        color: sortOrder === order ? "var(--text-accent)" : "var(--text-primary)",
                                        fontWeight: sortOrder === order ? "600" : "400",
                                        backgroundColor: sortOrder === order ? "color-mix(in srgb, var(--text-accent) 8%, transparent)" : "transparent",
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = sortOrder === order ? "color-mix(in srgb, var(--text-accent) 8%, transparent)" : "transparent")}
                                >
                                    {order === "recent" ? "Más recientes" : "Más antiguos"}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {showCommitteeFilter && (
                    <div className="relative flex-1 sm:flex-none" ref={committeeRef}>
                        <button
                            onClick={() => setIsCommitteeFilterOpen(!isCommitteeFilterOpen)}
                            className="flex items-center justify-between gap-3 w-full px-4 py-3 rounded-xl font-body text-sm transition-all"
                            style={{
                                ...filterBtnStyle,
                                color: selectedCommittees.length > 0 ? "var(--text-accent)" : "var(--text-primary)",
                                borderColor: selectedCommittees.length > 0 ? "var(--text-accent)" : "var(--border-color)",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--bg-surface)")}
                        >
                            <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                                </svg>
                                <span className="hidden sm:inline">Comités</span>
                                <span className="sm:hidden">Filtros</span>
                                {selectedCommittees.length > 0 && (
                                    <span
                                        className="inline-flex items-center justify-center size-5 rounded-full text-[11px] font-bold text-white"
                                        style={{ backgroundColor: "var(--text-accent)" }}
                                    >
                                        {selectedCommittees.length}
                                    </span>
                                )}
                            </div>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                    opacity: 0.4,
                                    transform: isCommitteeFilterOpen ? "rotate(180deg)" : "rotate(0deg)",
                                    transition: "transform 0.2s",
                                }}
                            >
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </button>

                        {isCommitteeFilterOpen && (
                            <div
                                className="absolute right-0 mt-2 w-52 rounded-xl z-50 p-2"
                                style={dropdownStyle}
                            >
                                <div className="flex flex-col gap-0.5">
                                    {comitesDisponibles.map((comite) => (
                                        <label
                                            key={comite}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                                            style={{ color: "var(--text-primary)" }}
                                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                                        >
                                            <input
                                                type="checkbox"
                                                className="size-4 rounded"
                                                checked={selectedCommittees.includes(comite)}
                                                onChange={() => onCommitteeToggle(comite)}
                                            />
                                            <span className="text-sm font-body">{comite}</span>
                                        </label>
                                    ))}
                                </div>
                                {selectedCommittees.length > 0 && (
                                    <div
                                        className="mt-2 pt-2 px-2"
                                        style={{ borderTop: "1px solid var(--border-color)" }}
                                    >
                                        <button
                                            onClick={onClearCommittees}
                                            className="text-xs font-medium w-full text-left transition-colors"
                                            style={{ color: "var(--text-accent)" }}
                                        >
                                            Limpiar filtros
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
