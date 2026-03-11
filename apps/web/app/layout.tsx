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
            <body className="font-body antialiased min-h-screen" style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}>
                <ThemeProvider>
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
