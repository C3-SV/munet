"use client";

import { useRouter } from "next/navigation";

const Login = () => {
    const router = useRouter();

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

                    <form action="#" method="POST" className="space-y-5 sm:space-y-6">
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-semibold font-heading mb-2"
                                style={{ color: "var(--text-primary)" }}
                            >
                                Correo electrónico / Código de delegado
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
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

                        <div className="pt-2 sm:pt-4">
                            <button
                                type="button"
                                onClick={() => router.replace("/feed")}
                                className="flex w-full justify-center rounded-xl px-3 py-3.5 sm:py-4 text-base sm:text-lg font-heading font-semibold text-white shadow-md hover:scale-[1.01] active:scale-95 transition-all duration-200"
                                style={{ backgroundColor: "var(--bubble-me-bg)" }}
                            >
                                Iniciar sesión
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
