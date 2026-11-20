"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: "light",
    toggleTheme: () => {},
});

// Provider global del tema; sincroniza estado React + clase `dark` + localStorage.
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [theme, setTheme] = useState<Theme>("light");

    useEffect(() => {
        // El script inline de layout.tsx ya aplicó la clase `dark`; aquí solo se sincroniza el estado.
        setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    }, []);

    // Alterna tema y persiste preferencia para futuros inicios de sesion.
    const toggleTheme = () => {
        const next = theme === "light" ? "dark" : "light";
        setTheme(next);
        localStorage.setItem("munet-theme", next);
        document.documentElement.classList.toggle("dark", next === "dark");
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

// Hook de conveniencia para acceder al contexto de tema en componentes.
export const useTheme = () => useContext(ThemeContext);
