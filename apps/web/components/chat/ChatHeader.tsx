import React from "react";

export const ChatHeader = () => {
    return (
        <header className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-black text-primary font-heading mt-1 uppercase tracking-tight">
                Mensajes Directos
            </h1>
            <p className="font-body mt-2 text-body-secondary text-sm">
                Inicia conversaciones privadas con otros delegados del evento.
            </p>
        </header>
    );
};
