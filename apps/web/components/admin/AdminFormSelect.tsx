"use client";

import { type SelectHTMLAttributes, forwardRef } from "react";

// Select con label, helper text y estado de error para formularios del panel admin.

type AdminFormSelectOption = {
    value: string;
    label: string;
};

type AdminFormSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
    label: string;
    options: AdminFormSelectOption[];
    error?: string;
    hint?: string;
};

export const AdminFormSelect = forwardRef<
    HTMLSelectElement,
    AdminFormSelectProps
>(({ label, options, error, hint, id, ...props }, ref) => {
    const selectId = id ?? label.toLowerCase().replace(/\s+/g, "-");

    return (
        <div className="flex flex-col gap-1.5">
            <label
                htmlFor={selectId}
                className="text-sm font-semibold font-heading"
                style={{ color: "var(--text-primary)" }}
            >
                {label}
                {props.required && (
                    <span
                        className="ml-1 font-bold"
                        style={{ color: "var(--text-accent)" }}
                        aria-hidden
                    >
                        *
                    </span>
                )}
            </label>

            <select
                ref={ref}
                id={selectId}
                {...props}
                className={[
                    "w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all",
                    props.className ?? "",
                ].join(" ")}
                style={{
                    backgroundColor: "var(--input-bg)",
                    border: `1px solid ${error ? "#ef4444" : "var(--input-border)"}`,
                    color: "var(--text-primary)",
                    boxShadow: error
                        ? "0 0 0 3px rgba(239,68,68,0.12)"
                        : undefined,
                    ...props.style,
                }}
                onFocus={(e) => {
                    e.currentTarget.style.borderColor = error
                        ? "#ef4444"
                        : "var(--input-focus)";
                    e.currentTarget.style.boxShadow = error
                        ? "0 0 0 3px rgba(239,68,68,0.12)"
                        : "0 0 0 3px color-mix(in srgb, var(--input-focus) 15%, transparent)";
                    props.onFocus?.(e);
                }}
                onBlur={(e) => {
                    e.currentTarget.style.borderColor = error
                        ? "#ef4444"
                        : "var(--input-border)";
                    e.currentTarget.style.boxShadow = error
                        ? "0 0 0 3px rgba(239,68,68,0.12)"
                        : "none";
                    props.onBlur?.(e);
                }}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>

            {hint && !error && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {hint}
                </p>
            )}
            {error && (
                <p className="text-xs font-medium" style={{ color: "#ef4444" }}>
                    {error}
                </p>
            )}
        </div>
    );
});

AdminFormSelect.displayName = "AdminFormSelect";
