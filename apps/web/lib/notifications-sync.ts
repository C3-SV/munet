export const notificationRequestKey = (
    token: string | null,
    eventId: string | null,
    enabled: boolean,
) => enabled && token && eventId ? JSON.stringify([token, eventId]) : null;

export const createNotificationRefresh = <T>(params: {
    getSummary: () => Promise<T>;
    getKey: () => string | null;
    setSummary: (summary: T) => void;
}) => {
    let inFlight = false;
    let refreshQueued = false;

    return async () => {
        if (!params.getKey()) {
            return;
        }

        if (inFlight) {
            refreshQueued = true;
            return;
        }

        inFlight = true;
        try {
            do {
                refreshQueued = false;
                const requestKey = params.getKey();
                if (!requestKey) break;
                try {
                    const summary = await params.getSummary();
                    if (params.getKey() === requestKey) params.setSummary(summary);
                } catch {
                    // The next poll retries a failed refresh.
                }
            } while (refreshQueued);
        } finally {
            inFlight = false;
        }
    };
};
