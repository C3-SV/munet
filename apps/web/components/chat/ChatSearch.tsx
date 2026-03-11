import React from "react";

interface ChatSearchProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
}

export const ChatSearch = ({ searchTerm, onSearchChange }: ChatSearchProps) => {
    return (
        <div className="relative mb-3">
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
    );
};
