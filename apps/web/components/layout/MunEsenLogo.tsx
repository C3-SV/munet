"use client";

import { useTheme } from "../../lib/theme-context";

interface MunEsenLogoProps {
    className?: string;
}

// Logotipo de MUN ESEN según tema. Provisional: sustituir por los archivos aprobados por MUN ESEN.
export const MunEsenLogo = ({ className = "h-10 w-auto" }: MunEsenLogoProps) => {
    const { theme } = useTheme();
    const src = theme === "dark" ? "/mun-esen-oscuro.jpg" : "/mun-esen-claro.jpg";

    return <img src={src} alt="MUN ESEN" className={className} loading="lazy" />;
};
