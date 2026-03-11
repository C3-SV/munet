"use client";

import React, { useState } from "react";
import { ChatHeader } from "../../../components/chat/ChatHeader";
import { ChatSearch } from "../../../components/chat/ChatSearch";
import { ChatItem } from "../../../components/chat/ChatItem";
import type { Delegate } from "../../../types/common";

const Chats = () => {
    const [searchTerm, setSearchTerm] = useState("");

    const delegates: (Delegate & { lastMessage?: string; unreadCount?: number })[] = [
        {
            id: "1",
            name: "Sarah Chen",
            avatar: "https://i.pravatar.cc/150?u=sarah",
            role: "DELEGADO",
            committee: "Comité 1",
            lastActive: "2h",
            lastMessage: "Claro que sí, ¿en qué te puedo ayudar?",
            unreadCount: 2,
        },
        {
            id: "2",
            name: "Rober Morán",
            avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
            role: "DELEGADO",
            committee: "Comité 2",
            lastActive: "5m",
            lastMessage: "Revisé el documento, todo está bien.",
        },
        {
            id: "3",
            name: "Elena Rojas",
            avatar: "https://i.pravatar.cc/150?u=elena",
            role: "DELEGADO",
            committee: "Comité 1",
            lastActive: "1d",
        },
        {
            id: "4",
            name: "Miguel Torres",
            avatar: "https://i.pravatar.cc/150?u=miguel",
            role: "DELEGADO",
            committee: "Comité 3",
            lastActive: "3d",
            lastMessage: "¿Participarás en la sesión de mañana?",
            unreadCount: 1,
        },
    ];

    const filteredDelegates = delegates.filter(
        (delegate) =>
            delegate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            delegate.committee.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    return (
        <div className="p-4 sm:p-6 lg:p-10">
            <div className="max-w-2xl mx-auto">
                <ChatHeader />

                <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                >
                    <div className="p-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <ChatSearch
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                        />

                        <p
                            className="text-[11px] font-semibold uppercase tracking-widest font-heading px-1"
                            style={{ color: "var(--text-muted)" }}
                        >
                            {filteredDelegates.length} delegado{filteredDelegates.length !== 1 ? "s" : ""}
                        </p>
                    </div>

                    <div className="p-2">
                        {filteredDelegates.length > 0 ? (
                            filteredDelegates.map((delegate) => (
                                <ChatItem
                                    key={delegate.id}
                                    delegate={delegate}
                                    lastMessage={delegate.lastMessage}
                                    unreadCount={delegate.unreadCount}
                                />
                            ))
                        ) : (
                            <div
                                className="text-center py-12 text-sm rounded-xl mx-2 my-2"
                                style={{
                                    color: "var(--text-muted)",
                                    border: "2px dashed var(--border-color)",
                                    fontFamily: "var(--font-body)",
                                }}
                            >
                                No se encontraron delegados con ese nombre.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chats;
