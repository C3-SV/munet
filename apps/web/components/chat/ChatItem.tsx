import React from "react";
import Link from "next/link";
import type { Delegate } from "../../types/common";

interface ChatItemProps {
    delegate: Delegate;
    href?: string;
    onSelect?: () => void;
    lastMessage?: string | null;
    unreadCount?: number;
}

export const ChatItem = ({
    delegate,
    href,
    onSelect,
    lastMessage,
    unreadCount,
}: ChatItemProps) => {
    const content = (
        <>
            <div className="relative shrink-0">
                <img
                    src={delegate.avatar}
                    alt={delegate.name}
                    className="size-11 rounded-full object-cover"
                    style={{ border: "2px solid var(--border-color)" }}
                />
                <span
                    className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500"
                    style={{ boxShadow: "0 0 0 2.5px var(--bg-surface)" }}
                />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <h4
                        className="font-bold font-heading text-[14px] truncate"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {delegate.name}
                    </h4>
                    <span
                        className="text-[11px] shrink-0 font-medium"
                        style={{ color: "var(--text-muted)" }}
                    >
                        {delegate.lastActive}
                    </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p
                        className="text-[13px] truncate font-body"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        {lastMessage || (
                            <span className="italic" style={{ color: "var(--text-muted)" }}>
                                {delegate.role} - {delegate.committee}
                            </span>
                        )}
                    </p>
                    {unreadCount && unreadCount > 0 ? (
                        <span
                            className="shrink-0 flex items-center justify-center size-5 rounded-full text-[11px] font-bold text-white"
                            style={{ backgroundColor: "var(--bubble-me-bg)" }}
                        >
                            {unreadCount}
                        </span>
                    ) : null}
                </div>
            </div>
        </>
    );

    const className =
        "flex w-full items-center gap-3 p-3 rounded-xl transition-all cursor-pointer group text-left";
    const hoverProps = {
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) =>
            (e.currentTarget.style.backgroundColor = "var(--bg-hover)"),
        onMouseLeave: (e: React.MouseEvent<HTMLElement>) =>
            (e.currentTarget.style.backgroundColor = "transparent"),
    };

    if (onSelect) {
        return (
            <button
                type="button"
                onClick={onSelect}
                className={className}
                style={{ color: "var(--text-primary)" }}
                {...hoverProps}
            >
                {content}
            </button>
        );
    }

    return (
        <Link
            href={href ?? `/chat/${delegate.id}`}
            className={className}
            style={{ color: "var(--text-primary)" }}
            {...hoverProps}
        >
            {content}
        </Link>
    );
};
