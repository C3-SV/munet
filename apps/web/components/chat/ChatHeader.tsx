import React from "react";

export const ChatHeader = () => {
    return (
        <header className="mb-6">
            <h1
                className="text-2xl sm:text-3xl font-black font-heading mt-1 uppercase tracking-tight"
                style={{ color: "var(--text-accent)" }}
            >
                Mensajes Directos
            </h1>
            <p
                className="font-body mt-1.5 text-sm"
                style={{ color: "var(--text-secondary)" }}
            >
                Inicia conversaciones privadas con otros delegados del evento.
            </p>
        </header>
    );
};
