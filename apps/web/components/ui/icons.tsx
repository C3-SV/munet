import type { CSSProperties, ReactNode } from "react";

// Set único de iconos inline. Trazo y color heredados: `currentColor`, grosor 1.75.
// Son decorativos (`aria-hidden`); el control que los contiene debe llevar `aria-label`.

export type IconProps = {
    size?: number;
    className?: string;
    style?: CSSProperties;
};

type IconBaseProps = IconProps & {
    children: ReactNode;
};

const IconBase = ({ size = 24, className, style, children }: IconBaseProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
        focusable="false"
    >
        {children}
    </svg>
);

// Navegación y muros.
export const IconAnnouncements = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M4 10v4h3l8 4V6L7 10H4z" />
        <path d="M18 9a4 4 0 0 1 0 6" />
    </IconBase>
);

export const IconGeneral = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M4 6h9a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
        <path d="M17 10h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3-3h-2" />
    </IconBase>
);

export const IconCommittees = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M5 21V4" />
        <path d="M5 4h11l-2 3.5 2 3.5H5" />
    </IconBase>
);

export const IconDirectory = (props: IconProps) => (
    <IconBase {...props}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
        <path d="M18 14.3A6.5 6.5 0 0 1 21.5 20" />
    </IconBase>
);

export const IconChat = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M20 11.5a7.5 7.5 0 0 1-11.1 6.6L4 19.5l1.4-4.3A7.5 7.5 0 1 1 20 11.5z" />
    </IconBase>
);

export const IconProfile = (props: IconProps) => (
    <IconBase {...props}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
    </IconBase>
);

export const IconDashboard = (props: IconProps) => (
    <IconBase {...props}>
        <rect x="3" y="3" width="7.5" height="9" rx="1.5" />
        <rect x="13.5" y="3" width="7.5" height="5" rx="1.5" />
        <rect x="13.5" y="11" width="7.5" height="10" rx="1.5" />
        <rect x="3" y="15" width="7.5" height="6" rx="1.5" />
    </IconBase>
);

export const IconCalendar = (props: IconProps) => (
    <IconBase {...props}>
        <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
        <path d="M3 9.5h18M8 3v3M16 3v3" />
    </IconBase>
);

export const IconShield = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M12 3l8 3v5.5c0 4.7-3.2 8.3-8 9.5-4.8-1.2-8-4.8-8-9.5V6z" />
        <path d="M12 8.5v4M12 15.5h.01" />
    </IconBase>
);

export const IconUserCheck = (props: IconProps) => (
    <IconBase {...props}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M16 11l2 2 4-4" />
    </IconBase>
);

export const IconUserOff = (props: IconProps) => (
    <IconBase {...props}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M16 11l5 5M21 11l-5 5" />
    </IconBase>
);

export const IconKey = (props: IconProps) => (
    <IconBase {...props}>
        <circle cx="7.5" cy="15.5" r="3.5" />
        <path d="M10 13l10-10M17 6l3 3M14 9l2 2" />
    </IconBase>
);

export const IconCopy = (props: IconProps) => (
    <IconBase {...props}>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </IconBase>
);

// Navegación y controles generales.
export const IconMenu = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M4 7h16M4 12h16M4 17h16" />
    </IconBase>
);

export const IconClose = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M6 6l12 12M18 6L6 18" />
    </IconBase>
);

export const IconChevronDown = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M6 9l6 6 6-6" />
    </IconBase>
);

export const IconChevronRight = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M9 6l6 6-6 6" />
    </IconBase>
);

export const IconChevronLeft = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M15 6l-6 6 6 6" />
    </IconBase>
);

export const IconSearch = (props: IconProps) => (
    <IconBase {...props}>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4.3-4.3" />
    </IconBase>
);

export const IconSend = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M22 2L11 13" />
        <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </IconBase>
);

export const IconFilter = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z" />
    </IconBase>
);

export const IconSort = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M3 6h18M6 12h12M9 18h6" />
    </IconBase>
);

export const IconTheme = (props: IconProps) => (
    <IconBase {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
    </IconBase>
);

export const IconLogout = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
    </IconBase>
);

export const IconSwitchEvent = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M7 4L3 8l4 4" />
        <path d="M3 8h13" />
        <path d="M17 20l4-4-4-4" />
        <path d="M21 16H8" />
    </IconBase>
);

export const IconPlus = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M12 5v14M5 12h14" />
    </IconBase>
);

export const IconCheck = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
    </IconBase>
);

export const IconRefresh = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M20 11a8 8 0 0 0-14.6-4.6L4 8" />
        <path d="M4 4v4h4" />
        <path d="M4 13a8 8 0 0 0 14.6 4.6L20 16" />
        <path d="M20 20v-4h-4" />
    </IconBase>
);

// Estados y avisos.
export const IconCheckCircle = (props: IconProps) => (
    <IconBase {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </IconBase>
);

export const IconXCircle = (props: IconProps) => (
    <IconBase {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9l6 6M15 9l-6 6" />
    </IconBase>
);

export const IconAlertCircle = (props: IconProps) => (
    <IconBase {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4.5M12 16h.01" />
    </IconBase>
);

export const IconAlertTriangle = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M10.3 4.2L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
        <path d="M12 9.5v4M12 17h.01" />
    </IconBase>
);

// Contraseñas.
export const IconEye = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
    </IconBase>
);

export const IconEyeOff = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M3 3l18 18" />
        <path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1" />
        <path d="M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6" />
        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </IconBase>
);

// Acciones de fila del panel admin.
export const IconSettings = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M4 7h10" />
        <path d="M18 7h2" />
        <circle cx="16" cy="7" r="2" />
        <path d="M4 17h2" />
        <path d="M10 17h10" />
        <circle cx="8" cy="17" r="2" />
    </IconBase>
);

export const IconEdit = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
        <path d="M13.5 6.5l4 4" />
    </IconBase>
);

// Adjuntos.
export const IconPaperclip = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />
    </IconBase>
);

export const IconFile = (props: IconProps) => (
    <IconBase {...props}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
    </IconBase>
);
