import React from "react";
import Link from "next/link";
import type { Delegate } from "../../types/common";

interface ChatItemProps {
    delegate: Delegate;
}

export const ChatItem = ({ delegate }: ChatItemProps) => {
    return (
        <Link
            href={`/chat/${delegate.id}`}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group border border-transparent hover:border-gray-200"
        >
            <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                    <img
                        src={delegate.avatar}
                        alt={delegate.name}
                        className="size-12 rounded-full object-cover border border-gray-100 shadow-sm"
                    />
                    <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white"></span>
                </div>
                <div>
                    <h4 className="text-titles font-bold font-heading text-[15px]">
                        {delegate.name}
                    </h4>
                    <p className="text-[11px] font-semibold text-body-secondary font-heading uppercase tracking-wide mt-0.5">
                        {delegate.role}{" "}
                        <span className="text-primary opacity-70">
                            • {delegate.committee}
                        </span>
                    </p>
                </div>
            </div>

            <div className="mt-3 sm:mt-0 flex items-center sm:justify-end gap-1.5 text-xs text-gray-400 font-body ml-16 sm:ml-0">
                <img
                    src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/clock.svg"
                    className="size-3.5 opacity-60"
                    alt=""
                />
                <span>hace {delegate.lastActive}</span>
            </div>
        </Link>
    );
};
