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
        const handleClickOutside = (event: MouseEvent) => {
            if (
                committeeRef.current &&
                !committeeRef.current.contains(event.target as Node)
            ) {
                setIsCommitteeFilterOpen(false);
            }
            if (
                sortRef.current &&
                !sortRef.current.contains(event.target as Node)
            ) {
                setIsSortOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <div className="relative flex-1">
                <img
                    src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/search.svg"
                    className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-body-secondary opacity-50"
                    alt=""
                />
                <input
                    type="text"
                    placeholder="Buscar posts"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-lg font-body text-sm text-body focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all placeholder:text-gray-400"
                />
            </div>

            <div className="flex gap-3">
                <div className="relative flex-1 sm:flex-none" ref={sortRef}>
                    <button
                        onClick={() => setIsSortOpen(!isSortOpen)}
                        className="flex items-center justify-between gap-3 w-full px-5 py-3 bg-white border border-gray-200 rounded-lg font-body text-sm text-body hover:bg-gray-50 shadow-sm transition-all"
                    >
                        <div className="flex items-center gap-2">
                            <img
                                src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/arrows-sort.svg"
                                className="size-4 opacity-70"
                                alt=""
                            />
                            <span>
                                {sortOrder === "recent"
                                    ? "Más recientes"
                                    : "Más antiguos"}
                            </span>
                        </div>
                        <img
                            src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/chevron-down.svg"
                            className={`size-4 opacity-50 transition-transform ${isSortOpen ? "rotate-180" : ""}`}
                            alt=""
                        />
                    </button>

                    {isSortOpen && (
                        <div className="absolute right-0 sm:left-auto left-0 mt-2 w-full sm:w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-2 overflow-hidden">
                            <button
                                onClick={() => {
                                    onSortChange("recent");
                                    setIsSortOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm font-body rounded-md hover:bg-gray-50 ${sortOrder === "recent" ? "text-primary font-semibold" : "text-body"}`}
                            >
                                Más recientes
                            </button>
                            <button
                                onClick={() => {
                                    onSortChange("oldest");
                                    setIsSortOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm font-body rounded-md hover:bg-gray-50 ${sortOrder === "oldest" ? "text-primary font-semibold" : "text-body"}`}
                            >
                                Más antiguos
                            </button>
                        </div>
                    )}
                </div>

                {showCommitteeFilter && (
                    <div
                        className="relative flex-1 sm:flex-none"
                        ref={committeeRef}
                    >
                        <button
                            onClick={() =>
                                setIsCommitteeFilterOpen(!isCommitteeFilterOpen)
                            }
                            className="flex items-center justify-between gap-3 w-full px-5 py-3 bg-white border border-gray-200 rounded-lg font-body text-sm text-body hover:bg-gray-50 shadow-sm transition-all"
                        >
                            <div className="flex items-center gap-2">
                                <img
                                    src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/filter.svg"
                                    className="size-4 opacity-70"
                                    alt=""
                                />
                                <span className="hidden sm:inline">
                                    Filtrar comités
                                </span>
                                <span className="sm:hidden">Filtros</span>
                                {selectedCommittees.length > 0 &&
                                    `(${selectedCommittees.length})`}
                            </div>
                            <img
                                src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/chevron-down.svg"
                                className={`size-4 opacity-50 transition-transform ${isCommitteeFilterOpen ? "rotate-180" : ""}`}
                                alt=""
                            />
                        </button>

                        {isCommitteeFilterOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-2 overflow-hidden">
                                <div className="flex flex-col gap-1">
                                    {comitesDisponibles.map((comite) => (
                                        <label
                                            key={comite}
                                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-md cursor-pointer transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-primary focus:ring-primary size-4"
                                                checked={selectedCommittees.includes(
                                                    comite,
                                                )}
                                                onChange={() =>
                                                    onCommitteeToggle(comite)
                                                }
                                            />
                                            <span className="text-sm font-body text-body">
                                                {comite}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                {selectedCommittees.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-100 px-2">
                                        <button
                                            onClick={onClearCommittees}
                                            className="text-xs text-primary font-medium hover:underline w-full text-left"
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
