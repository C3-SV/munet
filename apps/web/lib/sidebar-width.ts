// Ancho y estado (expandida o contraída) de la barra lateral en escritorio.
// La preferencia se guarda por persona en localStorage; en móvil el menú sigue siendo un cajón.

export const SIDEBAR_MIN_WIDTH = 224;
export const SIDEBAR_MAX_WIDTH = 420;
export const SIDEBAR_DEFAULT_WIDTH = 256;
// Ancho de la barra contraída: solo iconos.
export const SIDEBAR_COLLAPSED_WIDTH = 72;
// Paso de las flechas del teclado; con Mayús es más grande.
export const SIDEBAR_KEY_STEP = 16;
export const SIDEBAR_KEY_STEP_LARGE = 48;

export type SidebarPreference = {
    width: number;
    collapsed: boolean;
};

export const DEFAULT_SIDEBAR_PREFERENCE: SidebarPreference = {
    width: SIDEBAR_DEFAULT_WIDTH,
    collapsed: false,
};

// Clave de almacenamiento por persona (cada una conserva su propio ajuste).
export const sidebarStorageKey = (userId: string | null | undefined): string =>
    `munet-sidebar:${userId || "anon"}`;

// Mantiene el ancho dentro de los límites; un valor no numérico vuelve al predeterminado.
export const clampSidebarWidth = (value: number): number => {
    if (!Number.isFinite(value)) {
        return SIDEBAR_DEFAULT_WIDTH;
    }

    return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(value)));
};

// Ancho que ocupa la barra según su estado (el contenido principal se ajusta a él).
export const effectiveSidebarWidth = (preference: SidebarPreference): number =>
    preference.collapsed ? SIDEBAR_COLLAPSED_WIDTH : clampSidebarWidth(preference.width);

// Lee la preferencia guardada; cualquier dato dañado o ausente da el valor predeterminado.
export const parseSidebarPreference = (raw: string | null | undefined): SidebarPreference => {
    if (!raw) {
        return DEFAULT_SIDEBAR_PREFERENCE;
    }

    try {
        const parsed = JSON.parse(raw) as Partial<SidebarPreference> | null;

        if (!parsed || typeof parsed !== "object") {
            return DEFAULT_SIDEBAR_PREFERENCE;
        }

        return {
            width: typeof parsed.width === "number" ? clampSidebarWidth(parsed.width) : SIDEBAR_DEFAULT_WIDTH,
            collapsed: parsed.collapsed === true,
        };
    } catch {
        return DEFAULT_SIDEBAR_PREFERENCE;
    }
};

export const serializeSidebarPreference = (preference: SidebarPreference): string =>
    JSON.stringify({ width: clampSidebarWidth(preference.width), collapsed: preference.collapsed });

// Nuevo ancho tras pulsar una tecla sobre el borde ajustable, o null si la tecla no aplica.
export const widthAfterKey = (key: string, width: number, shiftKey = false): number | null => {
    const step = shiftKey ? SIDEBAR_KEY_STEP_LARGE : SIDEBAR_KEY_STEP;

    switch (key) {
        case "ArrowLeft":
            return clampSidebarWidth(width - step);
        case "ArrowRight":
            return clampSidebarWidth(width + step);
        case "Home":
            return SIDEBAR_MIN_WIDTH;
        case "End":
            return SIDEBAR_MAX_WIDTH;
        default:
            return null;
    }
};

// Ancho al arrastrar: posición horizontal del puntero menos el borde izquierdo de la barra.
export const widthFromPointer = (clientX: number, sidebarLeft = 0): number =>
    clampSidebarWidth(clientX - sidebarLeft);
