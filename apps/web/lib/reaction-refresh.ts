export const createDebouncedRefresh = (refresh: () => Promise<unknown>, delayMs = 200) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let queued = false;
    let cancelled = false;

    const run = async () => {
        timer = null;
        if (cancelled) return;
        if (inFlight) {
            queued = true;
            return;
        }

        inFlight = true;
        try {
            await refresh();
        } finally {
            inFlight = false;
            if (queued && !cancelled) {
                queued = false;
                schedule();
            }
        }
    };

    const schedule = () => {
        if (cancelled) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void run(), delayMs);
    };

    return {
        schedule,
        cancel: () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        },
    };
};
