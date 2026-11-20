import React from "react";
import Link from "next/link";
import type { Delegate } from "../../types/common";
import { buildPersonLabel } from "../../lib/person-label";
import { IconChevronLeft } from "../ui/icons";

interface ChatRoomHeaderProps {
    delegate: Delegate;
}

export const ChatRoomHeader = ({ delegate }: ChatRoomHeaderProps) => {
    const label = buildPersonLabel({ name: delegate.name, alias: delegate.alias });

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
                className="flex items-center justify-center size-11 -ml-2 rounded-lg transition-all shrink-0"
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
                <IconChevronLeft size={22} />
            </Link>

            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative shrink-0">
                    {delegate.avatar?.trim() ? (
                        // Avatar remoto de tamaño fijo; next/image exigiría dominios configurados.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={delegate.avatar}
                            alt={delegate.name}
                            className="size-10 rounded-full object-cover"
                            style={{ border: "2px solid var(--border-color)" }}
                        />
                    ) : (
                        <div
                            aria-hidden="true"
                            className="size-10 rounded-full flex items-center justify-center font-heading font-semibold"
                            style={{
                                backgroundColor: "var(--bg-surface-secondary)",
                                border: "2px solid var(--border-color)",
                                color: "var(--text-primary)",
                            }}
                        >
                            {label.initials}
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <h2
                        className="flex items-baseline gap-1.5 min-w-0 text-sm font-bold font-heading leading-tight"
                        style={{ color: "var(--text-primary)" }}
                    >
                        <span className="truncate">{label.primary}</span>
                        {label.alias && (
                            <span className="truncate font-normal" style={{ color: "var(--text-secondary)" }}>
                                {label.alias}
                            </span>
                        )}
                    </h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                            className="text-xs font-semibold font-heading truncate"
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
