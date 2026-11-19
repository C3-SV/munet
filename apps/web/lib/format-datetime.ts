export interface FormatDateTimeOptions {
    timeZone?: string;
    now?: Date;
}

const EMPTY = "—";

const parseIso = (iso: string | null | undefined): Date | null => {
    if (!iso) return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
};

const partsOf = (date: Date, options: FormatDateTimeOptions | undefined) => {
    const formatter = new Intl.DateTimeFormat("es", {
        timeZone: options?.timeZone,
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    const map: Record<string, string> = {};
    for (const part of formatter.formatToParts(date)) {
        map[part.type] = part.value;
    }
    // Algunos ICU devuelven "24" a medianoche con hour12: false.
    const hour = map.hour === "24" ? "00" : map.hour;
    return {
        day: map.day ?? "",
        month: (map.month ?? "").replace(/\.$/, ""),
        year: map.year ?? "",
        hour: hour ?? "",
        minute: map.minute ?? "",
    };
};

const dayKey = (date: Date, options: FormatDateTimeOptions | undefined) => {
    const parts = partsOf(date, options);
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const dayNumber = (date: Date, options: FormatDateTimeOptions | undefined) => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: options?.timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const [year = 0, month = 1, day = 1] = formatter.format(date).split("-").map(Number);
    return Date.UTC(year, month - 1, day) / 86_400_000;
};

export const formatDateTime = (
    iso: string | null | undefined,
    options?: FormatDateTimeOptions,
): string => {
    const date = parseIso(iso);
    if (!date) return EMPTY;
    const p = partsOf(date, options);
    return `${p.day} ${p.month} ${p.year} · ${p.hour}:${p.minute}`;
};

export const formatTime = (
    iso: string | null | undefined,
    options?: FormatDateTimeOptions,
): string => {
    const date = parseIso(iso);
    if (!date) return EMPTY;
    const p = partsOf(date, options);
    return `${p.hour}:${p.minute}`;
};

export const formatDayLabel = (
    iso: string | null | undefined,
    options?: FormatDateTimeOptions,
): string => {
    const date = parseIso(iso);
    if (!date) return EMPTY;
    const now = options?.now ?? new Date();
    const diff = dayNumber(now, options) - dayNumber(date, options);
    if (diff === 0) return "Hoy";
    if (diff === 1) return "Ayer";
    const p = partsOf(date, options);
    return `${p.day} ${p.month} ${p.year}`;
};

export const isSameLocalDay = (
    a: string,
    b: string,
    options?: FormatDateTimeOptions,
): boolean => {
    const first = parseIso(a);
    const second = parseIso(b);
    if (!first || !second) return false;
    return dayKey(first, options) === dayKey(second, options);
};
