"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "../../components/layout/Sidebar";
import { Footer } from "../../components/layout/Footer";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    const isChatRoom = pathname?.match(/^\/chat\/[a-zA-Z0-9_-]+$/);

    return (
        <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
            <Sidebar />

            <main
                className={`flex-1 overflow-y-auto relative flex flex-col md:pl-64 ${isChatRoom ? "" : "pt-16 md:pt-0"}`}
            >
                <div className="flex-1 shrink-0">{children}</div>

                {!isChatRoom && <Footer />}
            </main>
        </div>
    );
}
