import React from "react";

interface ChatSearchProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
}

export const ChatSearch = ({ searchTerm, onSearchChange }: ChatSearchProps) => {
    return (
        <div className="relative mb-6">
            <img
                src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/search.svg"
                className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-body-secondary opacity-50"
                alt="Buscar"
            />
            <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar delegado por nombre o comité..."
                className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-lg font-body text-sm text-body focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all placeholder:text-gray-400"
            />
        </div>
    );
};
