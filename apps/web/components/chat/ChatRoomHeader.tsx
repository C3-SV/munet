import React from "react";
import Link from "next/link";
import type { Delegate } from "../../types/common";
import { BrandAttribution } from "../layout/BrandAttribution";

interface ChatRoomHeaderProps {
    delegate: Delegate;
}

export const ChatRoomHeader = ({ delegate }: ChatRoomHeaderProps) => {
    return (
        <div
            className="flex items-center gap-3 px-4 py-3 md:px-6 shrink-0"
            style={{
                backgroundColor: "var(--bg-surface)",
                borderBottom: "1px solid var(--border-color)",
            }}
        >
            <Link
                href="/chat"
                className="p-2 -ml-1 rounded-lg transition-all shrink-0"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                    e.currentTarget.style.color = "var(--text-primary)";
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                }}
                aria-label="Volver"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="15 18 9 12 15 6" />
                </svg>
            </Link>

            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative shrink-0">
                    <img
                        src={delegate.avatar}
                        alt={delegate.name}
                        className="size-10 rounded-full object-cover"
                        style={{ border: "2px solid var(--border-color)" }}
                    />
                </div>

                <div className="flex-1 min-w-0">
                    <h2
                        className="text-sm font-bold font-heading leading-tight truncate"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {delegate.name}
                    </h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                            className="text-[10px] font-extrabold uppercase tracking-widest font-heading truncate"
                            style={{ color: "var(--text-accent)" }}
                        >
                            {delegate.role} · {delegate.committee}
                        </span>
                    </div>
                </div>
            </div>
            <BrandAttribution compact className="shrink-0 gap-1.5" />
        </div>
    );
};
