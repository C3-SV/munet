import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../lib/theme-context";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-heading",
});

// Resuelve el tema antes de hidratar (localStorage y prefers-color-scheme) para evitar el destello claro.
const themeInitScript = `(function(){try{var t=localStorage.getItem("munet-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export const metadata: Metadata = {
    title: "MUNET",
    description: "Comunicaciones seguras y foros para delegados.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="es"
            className={`${inter.variable} ${poppins.variable}`}
            suppressHydrationWarning
        >
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
            </head>
            <body className="font-body antialiased min-h-screen" style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}>
                <ThemeProvider>
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
