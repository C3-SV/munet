import { AvatarImage } from "../ui/AvatarImage";
import React from "react";
import Link from "next/link";
import type { Delegate } from "../../types/common";
import { buildInitials } from "../../lib/api/chat-recipient-search";
import { buildPersonLabel } from "../../lib/person-label";

interface ChatItemProps {
    delegate: Delegate;
    href?: string;
    onSelect?: () => void;
    lastMessage?: string | null;
    lastMessageIsMine?: boolean;
    unreadCount?: number;
}

export const ChatItem = ({
    delegate,
    href,
    onSelect,
    lastMessage,
    lastMessageIsMine = false,
    unreadCount,
}: ChatItemProps) => {
    // Contenido comun para modo `Link` (inbox) y modo `button` (busqueda).
    const label = buildPersonLabel({ name: delegate.name, alias: delegate.alias });
    const content = (
        <>
            <div className="relative shrink-0">
                <AvatarImage
                    src={delegate.avatar}
                    alt={delegate.name}
                    className="size-11 rounded-full object-cover"
                    style={{ border: "2px solid var(--border-color)" }}
                    fallback={
                        <div
                            role="img"
                            aria-label={delegate.name}
                            className="size-11 rounded-full flex items-center justify-center font-heading font-bold text-[13px]"
                            style={{
                                backgroundColor: "var(--bg-surface-secondary)",
                                border: "2px solid var(--border-color)",
                                color: "var(--text-primary)",
                            }}
                        >
                            {buildInitials(delegate.name)}
                        </div>
                    }
                />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <h4
                        className="flex items-baseline gap-1.5 min-w-0 font-bold font-heading text-[14px]"
                        style={{ color: "var(--text-primary)" }}
                    >
                        <span className="truncate">{label.primary}</span>
                        {label.alias && (
                            <span className="truncate font-normal" style={{ color: "var(--text-secondary)" }}>
                                {label.alias}
                            </span>
                        )}
                    </h4>
                    <span
                        className="text-xs shrink-0 font-medium"
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
                        {lastMessage ? (
                            <>
                                {lastMessageIsMine && (
                                    <span className="font-semibold">Tú: </span>
                                )}
                                {lastMessage}
                            </>
                        ) : (
                            <span className="italic" style={{ color: "var(--text-muted)" }}>
                                {delegate.role} - {delegate.committee}
                            </span>
                        )}
                    </p>
                    {unreadCount && unreadCount > 0 ? (
                        <span
                            className="shrink-0 flex items-center justify-center size-5 rounded-full text-xs font-bold"
                            style={{
                                backgroundColor: "var(--bubble-me-bg)",
                                color: "var(--text-on-accent)",
                            }}
                        >
                            {unreadCount}
                        </span>
                    ) : null}
                </div>
            </div>
        </>
    );

    const className =
        "flex w-full items-center gap-3 p-3 rounded-xl transition-[opacity,transform,background-color,border-color,color] cursor-pointer group text-left";
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
