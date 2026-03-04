"use client";

import React, { useState } from "react";
import { ChatHeader } from "../../../components/chat/ChatHeader";
import { ChatSearch } from "../../../components/chat/ChatSearch";
import { ChatItem } from "../../../components/chat/ChatItem";
import type { Delegate } from "../../../types/common";

const Chats = () => {
    const [searchTerm, setSearchTerm] = useState("");

    const delegates: Delegate[] = [
        {
            id: "1",
            name: "Sarah Chen",
            avatar: "https://i.pravatar.cc/150?u=sarah",
            role: "DELEGADO",
            committee: "Comité 1",
            lastActive: "2 horas",
        },
        {
            id: "2",
            name: "Rober Morán",
            avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
            role: "DELEGADO",
            committee: "Comité 2",
            lastActive: "5 minutos",
        },
        {
            id: "3",
            name: "Elena Rojas",
            avatar: "https://i.pravatar.cc/150?u=elena",
            role: "DELEGADO",
            committee: "Comité 1",
            lastActive: "1 día",
        },
        {
            id: "4",
            name: "Miguel Torres",
            avatar: "https://i.pravatar.cc/150?u=miguel",
            role: "DELEGADO",
            committee: "Comité 3",
            lastActive: "3 días",
        },
    ];

    const filteredDelegates = delegates.filter(
        (delegate) =>
            delegate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            delegate.committee.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    return (
        <div className="p-4 sm:p-6 lg:p-12">
            <div className="max-w-4xl mx-auto">
                <ChatHeader />

                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6 lg:p-8">
                    <ChatSearch
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                    />

                    <div className="space-y-1">
                        {filteredDelegates.length > 0 ? (
                            filteredDelegates.map((delegate) => (
                                <ChatItem
                                    key={delegate.id}
                                    delegate={delegate}
                                />
                            ))
                        ) : (
                            <div className="text-center py-10 text-body-secondary font-body text-sm border-2 border-dashed border-gray-100 rounded-lg">
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
