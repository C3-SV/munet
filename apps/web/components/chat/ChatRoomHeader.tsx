import React from "react";
import Link from "next/link";
import type { Delegate } from "../../types/common";

interface ChatRoomHeaderProps {
    delegate: Delegate;
    isOnline?: boolean;
}

export const ChatRoomHeader = ({ delegate, isOnline = true }: ChatRoomHeaderProps) => {
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
                    {isOnline && (
                        <span
                            className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500"
                            style={{ boxShadow: "0 0 0 2px var(--bg-surface)" }}
                        ></span>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <h2
                        className="text-sm font-bold font-heading leading-tight truncate"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {delegate.name}
                    </h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {isOnline && (
                            <span className="text-[11px] text-green-500 font-medium font-heading">
                                En línea
                            </span>
                        )}
                        {!isOnline && (
                            <span
                                className="text-[11px] font-medium font-heading"
                                style={{ color: "var(--text-muted)" }}
                            >
                                hace {delegate.lastActive}
                            </span>
                        )}
                        <span style={{ color: "var(--border-color)" }}>·</span>
                        <span
                            className="text-[10px] font-extrabold uppercase tracking-widest font-heading truncate"
                            style={{ color: "var(--text-accent)" }}
                        >
                            {delegate.role} · {delegate.committee}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
