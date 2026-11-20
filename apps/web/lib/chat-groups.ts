import { formatDayLabel, isSameLocalDay } from "./format-datetime.ts";

export type ChatGroupMessage = {
    id: string;
    senderId: string;
    createdAt: string;
};

export type ChatGroupOptions = {
    timeZone?: string;
    now?: Date;
    windowMinutes?: number;
};

export type ChatRun = {
    senderId: string;
    messageIds: string[];
};

export type ChatDayGroup = {
    dayLabel: string | null;
    runs: ChatRun[];
};

const DEFAULT_WINDOW_MINUTES = 5;
const MINUTE_MS = 60_000;

const timestampOf = (iso: string): number | null => {
    const value = new Date(iso).getTime();
    return Number.isNaN(value) ? null : value;
};

// Agrupa mensajes por día local y, dentro de cada día, por autor consecutivo.
// Un run se corta al cambiar de autor, al cambiar de día o si el hueco con el
// mensaje anterior es de windowMinutes o más. Los ids repetidos se ignoran.
export const groupMessages = (
    messages: ChatGroupMessage[],
    options: ChatGroupOptions = {},
): ChatDayGroup[] => {
    const windowMs = (options.windowMinutes ?? DEFAULT_WINDOW_MINUTES) * MINUTE_MS;
    const dayOptions = { timeZone: options.timeZone, now: options.now };
    const seen = new Set<string>();
    const groups: ChatDayGroup[] = [];

    let previous: ChatGroupMessage | null = null;
    let group: ChatDayGroup | null = null;

    for (const message of messages) {
        if (seen.has(message.id)) continue;
        seen.add(message.id);

        const startsNewDay =
            previous === null || !isSameLocalDay(previous.createdAt, message.createdAt, dayOptions);

        if (group === null || startsNewDay) {
            group = {
                dayLabel: formatDayLabel(message.createdAt, dayOptions),
                runs: [],
            };
            groups.push(group);
        }

        const lastRun: ChatRun | undefined = group.runs[group.runs.length - 1];

        const previousTime = previous ? timestampOf(previous.createdAt) : null;
        const currentTime = timestampOf(message.createdAt);
        const withinWindow =
            previousTime !== null &&
            currentTime !== null &&
            Math.abs(currentTime - previousTime) < windowMs;

        const continuesRun =
            !startsNewDay &&
            lastRun !== undefined &&
            lastRun.senderId === message.senderId &&
            withinWindow;

        if (continuesRun) {
            lastRun.messageIds.push(message.id);
        } else {
            group.runs.push({ senderId: message.senderId, messageIds: [message.id] });
        }

        previous = message;
    }

    return groups;
};
