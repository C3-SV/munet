import React from "react";
import Link from "next/link";
import type { Delegate } from "../../types/common";

interface ChatRoomHeaderProps {
    delegate: Delegate;
}

export const ChatRoomHeader = ({ delegate }: ChatRoomHeaderProps) => {
    return (
        <div className="flex items-center gap-4 p-4 md:p-6 bg-white border-b border-gray-100 shrink-0">
            <Link
                href="/chat"
                className="p-2 -ml-2 text-gray-400 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
            >
                <img
                    src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/chevron-left.svg"
                    className="size-6"
                    alt="Volver"
                />
            </Link>

            <div className="flex items-center gap-3">
                <img
                    src={delegate.avatar}
                    alt={delegate.name}
                    className="size-10 rounded-full border border-gray-100 object-cover shadow-sm"
                />
                <div>
                    <h2 className="text-titles font-bold font-heading text-base leading-tight">
                        {delegate.name}
                    </h2>
                    <span className="text-[10px] font-extrabold text-body-secondary uppercase tracking-widest font-heading">
                        {delegate.role} • {delegate.committee}
                    </span>
                </div>
            </div>
        </div>
    );
};
