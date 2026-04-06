"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../stores/auth.store";

const EVENT_ID = "8187a83d-fe08-443d-a878-69d158c374d4";  //para mientras

const Login = () => {
    const router = useRouter();

    const login = useAuthStore((state) => state.login);
    const loading = useAuthStore((state) => state.loading);
    const error = useAuthStore((state) => state.error);
    const clearError = useAuthStore((state) => state.clearError);

    const [participantCode, setParticipantCode] = useState("");
    const [password, setPassword] = useState("");

    useEffect(() => {
        clearError();
    }, [clearError]);

    const handleLogin = async () => {
        try {
            await login({
                participant_code: participantCode.trim(),
                event_id: EVENT_ID,
                password,
            });

            router.replace("/feed");
        } catch {
            // el error ya queda en el store
        }
    };

    return (
        <div
            className="flex min-h-screen flex-col justify-center px-4 sm:px-6 lg:px-8 py-10"
            style={{ backgroundColor: "var(--bg-base)" }}
        >
            <div className="mx-auto w-full max-w-[280px] sm:max-w-xs mb-8">
                <img
                    alt="MUNET"
                    src="/logo-munet.png"
                    className="mx-auto h-20 sm:h-24 w-auto"
                />
                <div className="mt-4 h-1.5 w-full rounded-full" style={{ backgroundColor: "var(--text-accent)" }}></div>
            </div>

            <div className="mx-auto w-full sm:max-w-lg">
                <div
                    className="rounded-2xl p-6 sm:p-10 lg:p-12"
                    style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-md)",
                    }}
                >
                    <h2
                        className="text-center text-2xl sm:text-3xl font-bold tracking-wide font-heading mb-8 sm:mb-10"
                        style={{ color: "var(--text-accent)" }}
                    >
                        Iniciar sesión
                    </h2>

                    <form onSubmit={(e) => {
                            e.preventDefault();
                            void handleLogin();
                        }} className="space-y-5 sm:space-y-6">
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-semibold font-heading mb-2"
                                style={{ color: "var(--text-primary)" }}
                            >
                                Código de delegado
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="text"
                                required
                                value={participantCode}
                                onChange={(e) => setParticipantCode(e.target.value)}
                                autoComplete="email"
                                className="font-body block w-full rounded-xl px-4 py-3 sm:py-3.5 text-base outline-none transition-all"
                                style={{
                                    backgroundColor: "var(--bg-input)",
                                    border: "1px solid var(--input-border)",
                                    color: "var(--text-primary)",
                                }}
                                onFocus={e => {
                                    e.currentTarget.style.borderColor = "var(--input-focus)";
                                    e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--input-focus) 15%, transparent)";
                                }}
                                onBlur={e => {
                                    e.currentTarget.style.borderColor = "var(--input-border)";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-semibold font-heading mb-2"
                                style={{ color: "var(--text-primary)" }}
                            >
                                Contraseña
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="font-body block w-full rounded-xl px-4 py-3 sm:py-3.5 text-base outline-none transition-all"
                                style={{
                                    backgroundColor: "var(--bg-input)",
                                    border: "1px solid var(--input-border)",
                                    color: "var(--text-primary)",
                                }}
                                onFocus={e => {
                                    e.currentTarget.style.borderColor = "var(--input-focus)";
                                    e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--input-focus) 15%, transparent)";
                                }}
                                onBlur={e => {
                                    e.currentTarget.style.borderColor = "var(--input-border)";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                            />
                        </div>

                        {error && (
                            <p className="text-sm text-center" style={{ color: "red" }}>
                                {error}
                            </p>
                        )}

                        <div className="pt-2 sm:pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full justify-center rounded-xl px-3 py-3.5 sm:py-4 text-base sm:text-lg font-heading font-semibold text-white shadow-md hover:scale-[1.01] active:scale-95 transition-all duration-200 disabled:opacity-70"
                                style={{ backgroundColor: "var(--bubble-me-bg)" }}
                            >
                                {loading ? "Ingresando..." : "Iniciar sesión"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
