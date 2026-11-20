import React from "react";
import type { EventCommittee } from "../../lib/api/events";
import { IconSearch } from "../ui/icons";

interface ChatSearchProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    committees: EventCommittee[];
    committeeId: string;
    onCommitteeChange: (value: string) => void;
}

export const ChatSearch = ({
    searchTerm,
    onSearchChange,
    committees,
    committeeId,
    onCommitteeChange,
}: ChatSearchProps) => {
    return (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
                <IconSearch
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }}
                />
                <input
                    type="text"
                    aria-label="Buscar por nombre o comité"
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Buscar por nombre o comité..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-body outline-none transition-all"
                    style={{
                        backgroundColor: "var(--bg-surface-secondary)",
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

            <select
                value={committeeId}
                aria-label="Filtrar destinatarios por comité"
                onChange={(e) => onCommitteeChange(e.target.value)}
                className="w-full sm:w-56 px-3 py-2.5 rounded-xl text-sm font-body outline-none transition-all"
                style={{
                    backgroundColor: "var(--bg-surface-secondary)",
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
    );
};
