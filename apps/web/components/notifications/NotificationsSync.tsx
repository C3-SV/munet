"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { getNotificationSummary } from "../../lib/api/notifications";
import { conversationIdsToWatch } from "../../lib/notifications";
import { isPracticeEvent } from "../../lib/practice/constants";
import { supabaseBrowser } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth.store";
import { useNotificationsStore } from "../../stores/notifications.store";

// Cada cuánto se recalculan los pendientes aunque no llegue ningún evento en tiempo real.
const POLL_INTERVAL_MS = 30_000;
// Agrupa ráfagas de eventos en una sola consulta.
const REFRESH_DEBOUNCE_MS = 700;

// Mantiene al día los pendientes (avisos y mensajes sin leer) sin recargar la página:
// los pide al entrar, cuando se vuelve a la pestaña, cada cierto tiempo y al instante cuando
// llega un aviso o un mensaje por Realtime. No dibuja nada.
export const NotificationsSync = () => {
    const token = useAuthStore((state) => state.token);
    const eventId = useAuthStore((state) => state.activeEventId);
    const summary = useNotificationsStore((state) => state.summary);
    const setSummary = useNotificationsStore((state) => state.setSummary);
    const reset = useNotificationsStore((state) => state.reset);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const enabled = Boolean(token && eventId && !isPracticeEvent(eventId));

    const refresh = useCallback(async () => {
        if (!token || !eventId || isPracticeEvent(eventId)) {
            return;
        }

        try {
            setSummary(await getNotificationSummary({ token, eventId }));
        } catch {
            // Un fallo puntual no debe molestar: se reintenta en el siguiente ciclo.
        }
    }, [eventId, setSummary, token]);

    const refreshSoon = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => void refresh(), REFRESH_DEBOUNCE_MS);
    }, [refresh]);

    useEffect(() => {
        // Al cambiar de evento o cerrar sesión se descartan los pendientes anteriores.
        reset();

        if (!enabled) {
            return;
        }

        void refresh();
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") {
                void refresh();
            }
        }, POLL_INTERVAL_MS);
        const onVisible = () => {
            if (document.visibilityState === "visible") {
                void refresh();
            }
        };

        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", onVisible);

        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", onVisible);

            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [enabled, refresh, reset]);

    // Realtime: avisos nuevos y mensajes en las conversaciones de la persona. Los eventos solo
    // avisan de que algo cambió; el resumen se vuelve a pedir a la API, que aplica los permisos.
    const wallId = summary?.announcements?.wallId ?? null;
    const watched = useMemo(() => conversationIdsToWatch(summary), [summary]);
    const watchedKey = watched.join(",");

    useEffect(() => {
        if (!enabled || !supabaseBrowser || !token) {
            return;
        }

        const ids = watchedKey ? watchedKey.split(",") : [];

        if (!wallId && ids.length === 0) {
            return;
        }

        const realtimeClient = supabaseBrowser;
        realtimeClient.realtime.setAuth(token);
        const channel = realtimeClient.channel("notifications");

        if (wallId) {
            channel.on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "posts", filter: `wall_id=eq.${wallId}` },
                refreshSoon,
            );
        }

        for (const id of ids) {
            channel.on(
                "postgres_changes",
                { event: "*", schema: "public", table: "dm_messages", filter: `conversation_id=eq.${id}` },
                refreshSoon,
            );
        }

        channel.subscribe();

        return () => {
            void realtimeClient.removeChannel(channel);
        };
    }, [enabled, refreshSoon, token, wallId, watchedKey]);

    return null;
};
