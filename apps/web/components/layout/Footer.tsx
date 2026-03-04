import React from "react";
import Link from "next/link";

export const Footer = () => {
    return (
        <footer className="w-full border-t border-gray-200 bg-white py-6 px-4 sm:px-6 lg:px-12 mt-auto shrink-0">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <img
                        src="/logo-munet.png"
                        alt="MUNET"
                        className="h-5 grayscale opacity-60"
                    />
                    <span className="text-xs font-body text-gray-400 font-medium">
                        © {new Date().getFullYear()} MUN ESEN. Plataforma
                        oficial.
                    </span>
                </div>
                <div className="flex items-center gap-6 text-xs font-body font-semibold text-gray-400">
                    <Link
                        href="#"
                        className="hover:text-primary transition-colors"
                    >
                        Soporte Técnico
                    </Link>
                    <Link
                        href="#"
                        className="hover:text-primary transition-colors"
                    >
                        Términos de Uso
                    </Link>
                </div>
            </div>
        </footer>
    );
};
