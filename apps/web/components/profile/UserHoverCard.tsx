"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createConversation } from "../../lib/api/chat";
import { useAuthStore } from "../../stores/auth.store";

type UserHoverCardProps = {
    membershipId: string;
    name: string;
    role: string;
    children: ReactNode;
};

export const UserHoverCard = ({
    membershipId,
    name,
    role,
    children,
}: UserHoverCardProps) => {
    const router = useRouter();
    const token = useAuthStore((state) => state.token);
    const eventId = useAuthStore((state) => state.activeEventId);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const [isOpeningChat, setIsOpeningChat] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSelfProfile = activeMembershipId === membershipId;

    const openCard = () => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }

        setIsOpen(true);
    };

    const scheduleCloseCard = () => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
        }

        closeTimerRef.current = setTimeout(() => {
            setIsOpen(false);
            closeTimerRef.current = null;
        }, 140);
    };

    useEffect(() => {
        return () => {
            if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current);
            }
        };
    }, []);

    const handleOpenChat = async () => {
        if (!token || !eventId || isSelfProfile || isOpeningChat) {
            return;
        }

        try {
            setIsOpeningChat(true);
            const conversation = await createConversation(membershipId, {
                token,
                eventId,
            });
            router.push(`/chat/${conversation.id}`);
        } finally {
            setIsOpeningChat(false);
            setIsOpen(false);
        }
    };

    return (
        <div
            className="relative inline-block"
            onMouseEnter={openCard}
            onMouseLeave={scheduleCloseCard}
        >
            {children}

            <div
                className="absolute left-0 top-full z-30 w-64 rounded-xl p-4 transition-all duration-150"
                style={{
                    marginTop: "6px",
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? "auto" : "none",
                    transform: isOpen ? "translateY(0)" : "translateY(-2px)",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    boxShadow: "var(--shadow-md)",
                }}
            >
                <p
                    className="text-sm font-bold font-heading"
                    style={{ color: "var(--text-primary)" }}
                >
                    {name}
                </p>
                <p
                    className="text-[11px] font-extrabold uppercase tracking-widest mt-1"
                    style={{ color: "var(--text-secondary)" }}
                >
                    {role}
                </p>

                <div className="mt-3 flex items-center gap-2">
                    <Link
                        href={`/profile/${membershipId}`}
                        className="flex-1 rounded-lg px-3 py-2 text-xs font-heading font-semibold text-center"
                        style={{
                            backgroundColor: "var(--sidebar-active-bg)",
                            color: "var(--text-accent)",
                            border: "1px solid var(--border-color)",
                        }}
                    >
                        Ver perfil
                    </Link>
                    {isSelfProfile ? (
                        <button
                            type="button"
                            disabled
                            className="flex-1 rounded-lg px-3 py-2 text-xs font-heading font-semibold"
                            style={{
                                backgroundColor: "var(--bg-surface-secondary)",
                                color: "var(--text-muted)",
                                border: "1px solid var(--border-color)",
                                cursor: "not-allowed",
                            }}
                            title="Este es tu perfil"
                        >
                            Tu perfil
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => void handleOpenChat()}
                            disabled={isOpeningChat}
                            className="flex-1 rounded-lg px-3 py-2 text-xs font-heading font-semibold text-center"
                            style={{
                                backgroundColor: "var(--bubble-me-bg)",
                                color: "white",
                                border: "1px solid transparent",
                                cursor: isOpeningChat ? "wait" : "pointer",
                                opacity: isOpeningChat ? 0.8 : 1,
                            }}
                        >
                            {isOpeningChat ? "Abriendo..." : "Enviar mensaje"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
