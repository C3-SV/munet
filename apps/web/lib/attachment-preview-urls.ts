export type AttachmentPreviewRequest = { postId: string; attachmentId: string };
export type AttachmentPreviewContext = { token: string; eventId: string };
type AttachmentPreviewResult = { index: number; url?: string; expiresAt?: string; error?: string };

// Agrupa activaciones cercanas del IntersectionObserver. Solo guarda firmas exitosas mientras
// conservan al menos cinco segundos de vida; el token y el evento aíslan cada sesión.
export const createAttachmentPreviewUrlLoader = (options: {
    requestBatch: (context: AttachmentPreviewContext, items: AttachmentPreviewRequest[]) => Promise<AttachmentPreviewResult[]>;
    requestSingle?: (context: AttachmentPreviewContext, item: AttachmentPreviewRequest) => Promise<string>;
    now?: () => number;
}) => {
    const now = options.now ?? Date.now;
    const cache = new Map<string, { url: string; expiresAt: number }>();
    const pending = new Map<string, { promise: Promise<string>; resolve: (url: string) => void; reject: (error: Error) => void }>();
    const queued = new Map<string, { context: AttachmentPreviewContext; items: AttachmentPreviewRequest[]; keys: string[] }>();
    let scheduled = false;

    const keyFor = (context: AttachmentPreviewContext, item: AttachmentPreviewRequest) =>
        JSON.stringify([context.token, context.eventId, item.postId, item.attachmentId]);

    const flush = async () => {
        scheduled = false;
        const groups = [...queued.values()];
        queued.clear();

        for (const group of groups) {
            for (let offset = 0; offset < group.items.length; offset += 40) {
                const items = group.items.slice(offset, offset + 40);
                const keys = group.keys.slice(offset, offset + 40);

                try {
                    const results = await options.requestBatch(group.context, items);
                    for (let index = 0; index < items.length; index += 1) {
                        const key = keys[index];
                        if (key === undefined) continue;
                        const result = results.find((candidate) => candidate.index === index);
                        const entry = pending.get(key);
                        const expiry = result?.expiresAt ? Date.parse(result.expiresAt) : NaN;

                        if (!entry) continue;
                        if (result?.url && Number.isFinite(expiry) && expiry > now() + 5_000) {
                            cache.set(key, { url: result.url, expiresAt: expiry });
                            entry.resolve(result.url);
                        } else {
                            entry.reject(new Error(result?.error ?? "No se pudo cargar el adjunto."));
                        }
                        pending.delete(key);
                    }
                } catch (error) {
                    if ((error as { status?: number } | null)?.status === 404 && options.requestSingle) {
                        await Promise.all(keys.map(async (key, index) => {
                            const item = items[index];
                            const entry = pending.get(key);
                            if (!entry || !item) return;
                            try {
                                entry.resolve(await options.requestSingle!(group.context, item));
                            } catch (singleError) {
                                entry.reject(singleError instanceof Error ? singleError : new Error("No se pudo cargar el adjunto."));
                            }
                            pending.delete(key);
                        }));
                    } else {
                        for (const key of keys) {
                            pending.get(key)?.reject(error instanceof Error ? error : new Error("No se pudo cargar el adjunto."));
                            pending.delete(key);
                        }
                    }
                }
            }
        }
    };

    return (context: AttachmentPreviewContext, item: AttachmentPreviewRequest, refresh = false): Promise<string> => {
        for (const [key, value] of cache) {
            if (value.expiresAt <= now() + 5_000) cache.delete(key);
        }
        const key = keyFor(context, item);
        const cached = cache.get(key);
        if (!refresh && cached && cached.expiresAt > now() + 5_000) return Promise.resolve(cached.url);
        if (cached) cache.delete(key);
        const existing = pending.get(key);
        if (existing) return existing.promise;

        let resolve!: (url: string) => void;
        let reject!: (error: Error) => void;
        const promise = new Promise<string>((accept, fail) => { resolve = accept; reject = fail; });
        pending.set(key, { promise, resolve, reject });

        const scope = JSON.stringify([context.token, context.eventId]);
        const group = queued.get(scope) ?? { context, items: [], keys: [] };
        group.items.push(item);
        group.keys.push(key);
        queued.set(scope, group);

        if (!scheduled) {
            scheduled = true;
            setTimeout(() => { void flush(); }, 0);
        }

        return promise;
    };
};
