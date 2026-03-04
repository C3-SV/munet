"use client";

import { useRouter } from "next/navigation";

const Login = () => {
    const router = useRouter();

    return (
        <>
            <div className="flex min-h-screen flex-col justify-center px-4 sm:px-6 lg:px-8 bg-background py-10">
                <div className="mx-auto w-full max-w-70 sm:max-w-xs mb-8">
                    <img
                        alt="MUNET"
                        src="/logo-munet.png"
                        className="mx-auto h-20 sm:h-24 w-auto"
                    />
                    <div className="mt-4 bg-primary h-1.5 w-full rounded-full"></div>
                </div>

                <div className="mx-auto w-full sm:max-w-lg">
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-xl p-6 sm:p-10 lg:p-12">
                        <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-wide font-heading text-primary mb-8 sm:mb-10">
                            Iniciar sesión
                        </h2>

                        <form
                            action="#"
                            method="POST"
                            className="space-y-5 sm:space-y-6"
                        >
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-sm sm:text-md font-semibold font-heading text-titles mb-2"
                                >
                                    Correo electrónico / Código de delegado
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        required
                                        autoComplete="email"
                                        className="font-body block w-full rounded-lg bg-white px-4 py-3 sm:py-3.5 text-base text-body border border-gray-300 focus:ring-2 focus:ring-primary focus:outline-none shadow-sm transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label
                                        htmlFor="password"
                                        className="block text-sm sm:text-md font-semibold font-heading text-titles"
                                    >
                                        Contraseña
                                    </label>
                                </div>
                                <div className="mt-1">
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        required
                                        autoComplete="current-password"
                                        className="font-body block w-full rounded-lg bg-white px-4 py-3 sm:py-3.5 text-base text-body border border-gray-300 focus:ring-2 focus:ring-primary focus:outline-none shadow-sm transition-all"
                                    />
                                </div>
                            </div>

                            <div className="pt-2 sm:pt-4">
                                <button
                                    type="button"
                                    onClick={() => router.replace("/feed")}
                                    className="flex w-full justify-center rounded-lg bg-primary px-3 py-3.5 sm:py-4 text-base sm:text-lg font-heading font-semibold text-white shadow-md hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent hover:scale-[1.01] active:scale-95 transition duration-300"
                                >
                                    Iniciar sesión
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Login;
