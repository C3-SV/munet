"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { PostEditor } from "../../../../components/feed/PostEditor";
import { FeedFilters } from "../../../../components/feed/FeedFilters";
import { PostCard } from "../../../../components/feed/PostCard";
import type { Post } from "../../../../types/common";

const Feed = () => {
    const params = useParams();
    const muroParam =
        typeof params?.muro === "string" ? params.muro : "general";

    let currentMuro = "General";
    let headerTitle = "Muro General";

    if (muroParam === "avisos") {
        currentMuro = "Avisos";
        headerTitle = "Avisos Oficiales";
    } else if (muroParam.startsWith("comite-")) {
        const numero = muroParam.split("-")[1];
        currentMuro = `Comite ${numero}`;
        headerTitle = `Muro de Comité ${numero}`;
    }

    const showCommitteeFilter = currentMuro === "General";

    const [searchQuery, setSearchQuery] = useState<string>("");
    const [selectedCommittees, setSelectedCommittees] = useState<string[]>([]);
    const [sortOrder, setSortOrder] = useState<"recent" | "oldest">("recent");
    const comitesDisponibles = ["Comite 1", "Comite 2", "Comite 3"];

    const [posts, setPosts] = useState<Post[]>([
        {
            id: "1",
            user: {
                id: "u1",
                name: "Sarah Chen",
                avatar: "https://i.pravatar.cc/150?u=sarah",
                role: "DELEGADO",
            },
            content:
                "Bienvenidos delegados, estoy emocionada de comenzar las discusiones en el Comité de Seguridad. Espero que podamos abordar los desafíos globales con soluciones innovadoras y colaborativas. ¡Vamos a hacer de este un semestre productivo!",
            createdAt: "35 minutos",
            committeeId: "Comite 3",
            committeeTags: [],
            timestamp: Date.now() - 35 * 60000,
        },
        {
            id: "2",
            user: {
                id: "u2",
                name: "Rober Morán",
                avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
                role: "ADMIN",
            },
            content:
                "Recuerden que la primera sesión de debate iniciará puntualmente a las 8:00 AM. Revisen sus guías de estudio y preparen sus mociones.",
            createdAt: "2 horas",
            committeeId: "General",
            committeeTags: [],
            timestamp: Date.now() - 120 * 60000,
        },
        {
            id: "3",
            user: {
                id: "u3",
                name: "Elena Rojas",
                avatar: "https://i.pravatar.cc/150?u=elena",
                role: "DELEGADO",
            },
            content:
                "¿Alguien del Comité 1 tiene la resolución preliminar sobre la mesa para compartirla? Sería de gran ayuda revisarla antes del break.",
            createdAt: "3 horas",
            committeeId: "General",
            committeeTags: ["Comite 1"],
            timestamp: Date.now() - 180 * 60000,
        },
        {
            id: "4",
            user: {
                id: "u4",
                name: "Coordinación MUN",
                avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
                role: "ADMIN",
            },
            content:
                "📣 ¡Avisos Oficiales! Les recordamos a todas las delegaciones que la ceremonia de clausura será a las 18:00h en el auditorio principal. La vestimenta formal es estrictamente requerida.",
            createdAt: "4 horas",
            committeeId: "Avisos",
            committeeTags: [],
            timestamp: Date.now() - 240 * 60000,
        },
        {
            id: "5",
            user: {
                id: "u5",
                name: "Miguel Torres",
                avatar: "https://i.pravatar.cc/150?u=miguel",
                role: "DELEGADO",
            },
            content:
                "Delegados, adjunto la propuesta de enmienda para el artículo 4. Por favor revisenla antes de nuestra próxima sesión.",
            createdAt: "5 horas",
            committeeId: "Comite 1",
            committeeTags: [],
            timestamp: Date.now() - 300 * 60000,
        },
    ]);

    const handlePublishPost = (text: string) => {
        const newPost: Post = {
            id: Math.random().toString(),
            user: {
                id: "u2",
                name: "Rober Morán",
                avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
                role: "ADMIN",
            },
            content: text,
            createdAt: "Justo ahora",
            committeeId: currentMuro,
            committeeTags: [],
            timestamp: Date.now(),
        };
        setPosts([newPost, ...posts]);
    };

    const filteredPosts = posts.filter((post) => {
        const matchesSearch =
            post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            post.user.name.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCurrentMuro = post.committeeId === currentMuro;

        const matchesCommittee =
            selectedCommittees.length === 0 ||
            (post.committeeTags &&
                post.committeeTags.some((tag) =>
                    selectedCommittees.includes(tag),
                ));

        return matchesSearch && matchesCommittee && matchesCurrentMuro;
    });

    const sortedAndFilteredPosts = [...filteredPosts].sort((a, b) => {
        if (sortOrder === "recent") {
            return b.timestamp - a.timestamp;
        } else {
            return a.timestamp - b.timestamp;
        }
    });

    return (
        <div className="p-4 sm:p-6 lg:p-12">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <span className="text-[11px] font-bold uppercase tracking-[0.15em] font-heading" style={{ color: "var(--text-secondary)" }}>
                        Foro de discusión
                    </span>
                    <h1 className="text-3xl sm:text-4xl font-black font-heading mt-1 uppercase tracking-tight" style={{ color: "var(--text-accent)" }}>
                        {headerTitle}
                    </h1>
                </header>

                {currentMuro !== "Avisos" && (
                    <PostEditor onPublish={handlePublishPost} />
                )}

                <FeedFilters
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    selectedCommittees={selectedCommittees}
                    onCommitteeToggle={(comite) => {
                        if (selectedCommittees.includes(comite)) {
                            setSelectedCommittees(
                                selectedCommittees.filter((c) => c !== comite),
                            );
                        } else {
                            setSelectedCommittees([
                                ...selectedCommittees,
                                comite,
                            ]);
                        }
                    }}
                    onClearCommittees={() => setSelectedCommittees([])}
                    comitesDisponibles={comitesDisponibles}
                    sortOrder={sortOrder}
                    onSortChange={setSortOrder}
                    showCommitteeFilter={showCommitteeFilter}
                />

                <div className="space-y-4">
                    {sortedAndFilteredPosts.length > 0 ? (
                        sortedAndFilteredPosts.map((post) => (
                            <PostCard key={post.id} post={post} />
                        ))
                    ) : (
                        <div
                            className="flex justify-center py-12 rounded-xl"
                            style={{
                                backgroundColor: "var(--bg-surface)",
                                border: "2px dashed var(--border-color)",
                            }}
                        >
                            <span
                                className="font-body text-sm"
                                style={{ color: "var(--text-muted)" }}
                            >
                                No se encontraron publicaciones.
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Feed;
