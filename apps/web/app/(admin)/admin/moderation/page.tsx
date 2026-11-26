"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "../../../../stores/auth.store";

// Ruta anterior del marcador: la moderación vive ahora bajo el evento activo.
export default function AdminModerationRedirectPage() {
    const router = useRouter();
    const activeEventId = useAuthStore((state) => state.activeEventId);

    useEffect(() => {
        router.replace(
            activeEventId
                ? `/admin/events/${activeEventId}/moderation`
                : "/admin/events",
        );
    }, [activeEventId, router]);

    return null;
}
