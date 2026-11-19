import React, { type ReactNode } from "react";
import { buildPersonLabel, type PersonLabelInput } from "../../lib/person-label";

export type PersonLabelPerson = PersonLabelInput & {
    avatar?: string | null;
};

interface PersonLabelProps {
    person: PersonLabelPerson;
    size?: "sm" | "md";
    showSecondary?: boolean;
    showAvatar?: boolean;
    // Línea adicional bajo el comité o rol (por ejemplo, la fecha de una publicación).
    children?: ReactNode;
}

const AVATAR_CLASS = {
    sm: "size-8 text-xs",
    md: "size-11 text-sm",
} as const;

const NAME_CLASS = {
    sm: "text-sm",
    md: "text-base",
} as const;

// Etiqueta unificada de persona: avatar, nombre, alias y comité (o rol) con caja normal.
export const PersonLabel = ({
    person,
    size = "md",
    showSecondary = true,
    showAvatar = true,
    children,
}: PersonLabelProps) => {
    const { primary, alias, secondary, initials } = buildPersonLabel(person);
    const avatar = person.avatar?.trim();

    return (
        <div className="flex items-center gap-3 min-w-0">
            {showAvatar &&
                (avatar ? (
                    // Avatares externos de la API: sin next/image porque el host no está en remotePatterns.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={avatar}
                        alt=""
                        className={`${AVATAR_CLASS[size]} shrink-0 rounded-full object-cover`}
                        style={{ border: "2px solid var(--border-color)" }}
                    />
                ) : (
                    <div
                        aria-hidden="true"
                        className={`${AVATAR_CLASS[size]} shrink-0 rounded-full flex items-center justify-center font-heading font-semibold`}
                        style={{
                            backgroundColor: "var(--bg-surface-secondary)",
                            border: "2px solid var(--border-color)",
                            color: "var(--text-primary)",
                        }}
                    >
                        {initials}
                    </div>
                ))}

            <div className="min-w-0 flex-1">
                <p className={`flex items-baseline gap-1.5 min-w-0 font-body ${NAME_CLASS[size]}`}>
                    <span
                        className="min-w-0 shrink truncate font-semibold font-heading"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {primary}
                    </span>
                    {alias && (
                        <span
                            className="min-w-0 shrink truncate font-normal"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            {alias}
                        </span>
                    )}
                </p>
                {showSecondary && secondary && (
                    <p
                        className="text-xs font-body truncate"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        {secondary}
                    </p>
                )}
                {children}
            </div>
        </div>
    );
};
