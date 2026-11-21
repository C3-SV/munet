import React from "react";

export const ChatHeader = () => {
    return (
        <header className="mb-6">
            <h1
                className="text-2xl sm:text-3xl font-bold font-heading mt-1 tracking-tight"
                style={{ color: "var(--text-accent)" }}
            >
                Mensajes directos
            </h1>
        </header>
    );
};
