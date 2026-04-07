"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminRole, useAuthStore } from "../../../stores/auth.store";

const Login = () => {
    const router = useRouter();

    // --- ESTADOS Y FUNCIONES DEL STORE ---
    const login = useAuthStore((state) => state.login);
    const loading = useAuthStore((state) => state.loading);
    const error = useAuthStore((state) => state.error);
    const clearError = useAuthStore((state) => state.clearError);
    const hydrateAuth = useAuthStore((state) => state.hydrateAuth);
    const hydrated = useAuthStore((state) => state.hydrated);
    const token = useAuthStore((state) => state.token);
    const activeEventId = useAuthStore((state) => state.activeEventId);
    const activeMembershipId = useAuthStore((state) => state.activeMembershipId);
    const memberships = useAuthStore((state) => state.memberships);
    const setActiveMembership = useAuthStore((state) => state.setActiveMembership);
    
    // Funciones de activación importadas del store
    const validateActivation = useAuthStore((state) => state.validateActivation);
    const activateAccount = useAuthStore((state) => state.activateAccount);

    // --- ESTADOS LOCALES ---
    const [participantCode, setParticipantCode] = useState("");
    const [password, setPassword] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Estados para ocultar/mostrar contraseñas
    const [showPassword, setShowPassword] = useState(false);
    const [showOneTimePassword, setShowOneTimePassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Estados del modal de activación
    const [showActivationModal, setShowActivationModal] = useState(false);
    const [activationStep, setActivationStep] = useState(1);
    const [activationCode, setActivationCode] = useState("");
    const [oneTimePassword, setOneTimePassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [availableEvents, setAvailableEvents] = useState<any[]>([]);
    const [activationEventId, setActivationEventId] = useState("");
    const [activationError, setActivationError] = useState("");

    useEffect(() => {
        hydrateAuth();
        clearError();
    }, [clearError, hydrateAuth]);

    useEffect(() => {
        if (!hydrated) return;
        if (!token) return;

        const hasAdminMembership = memberships.some((membership) => isAdminRole(membership.role));
        const firstMembership = memberships[0];

        if (activeEventId && activeMembershipId) {
            router.replace("/feed");
            return;
        }

        if (!hasAdminMembership && firstMembership) {
            setActiveMembership(firstMembership.id);
            router.replace("/feed");
            return;
        }

        router.replace("/select-event");
    }, [activeEventId, activeMembershipId, hydrated, memberships, router, setActiveMembership, token]);

    const handleLogin = async () => {
        try {
            setSuccessMessage("");
            await login({
                participant_code: participantCode.trim(),
                password,
            });

            const state = useAuthStore.getState();
            const hasAdminMembership = state.memberships.some((membership) =>
                isAdminRole(membership.role),
            );
            const firstMembership = state.memberships[0];

            if (!(state.activeEventId && state.activeMembershipId)) {
                if (!hasAdminMembership && firstMembership) {
                    state.setActiveMembership(firstMembership.id);
                    router.replace("/feed");
                    return;
                }

                router.replace("/select-event");
                return;
            }

            router.replace("/feed");
        } catch {
            // El error es gestionado globalmente en el store
        }
    };

    // --- FUNCIONES DE ACTIVACIÓN ---
    const resetActivationModal = () => {
        setShowActivationModal(false);
        setActivationStep(1);
        setActivationCode("");
        setOneTimePassword("");
        setNewPassword("");
        setConfirmPassword("");
        setAvailableEvents([]);
        setActivationEventId("");
        setActivationError("");
        // Reseteamos las visibilidades de las contraseñas
        setShowOneTimePassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        clearError();
    };

    // PASO 1: Validar cuenta pendiente a través del store
    const handleValidateActivation = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        setActivationError("");

        try {
            const events = await validateActivation(activationCode.trim());

            if (events && events.length > 0) {
                setAvailableEvents(events);
                setActivationEventId(events[0].event_id);
                setActivationStep(2);
            } else {
                setActivationError("No se encontró ninguna cuenta por activar con este código.");
            }
        } catch (err) {
        }
    };

    // PASO 2: Confirmar activación a través del store
    const handleCompleteActivation = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        setActivationError("");

        if (newPassword !== confirmPassword) {
            setActivationError("Las contraseñas no coinciden.");
            return;
        }

        if (newPassword.length < 6) {
            setActivationError("La contraseña debe tener al menos 6 caracteres.");
            return;
        }

        try {
            await activateAccount({
                participant_code: activationCode.trim(),
                event_id: activationEventId,
                initial_password: oneTimePassword,
                new_password: newPassword,
            });

            resetActivationModal();
            setParticipantCode(activationCode.trim());
            setSuccessMessage("¡Cuenta activada con éxito! Ya puedes iniciar sesión.");
        } catch (err) {
        }
    };

    // --- ICONOS REUTILIZABLES ---
    const EyeIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );

    const EyeSlashIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
    );

    return (
        <div
            className="flex min-h-screen flex-col justify-center px-4 sm:px-6 lg:px-8 py-10 relative"
            style={{ backgroundColor: "var(--bg-base)" }}
        >
            <div className="mx-auto w-full max-w-70 sm:max-w-xs mb-8">
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

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void handleLogin();
                        }}
                        className="space-y-5 sm:space-y-6"
                    >
                        <div>
                            <label
                                htmlFor="participant_code"
                                className="block text-sm font-semibold font-heading mb-2"
                                style={{ color: "var(--text-primary)" }}
                            >
                                Código de delegado
                            </label>
                            <input
                                id="participant_code"
                                name="participant_code"
                                type="text"
                                required
                                value={participantCode}
                                onChange={(e) => setParticipantCode(e.target.value)}
                                className="font-body block w-full rounded-xl px-4 py-3 sm:py-3.5 text-base outline-none transition-all"
                                style={{
                                    backgroundColor: "var(--bg-input)",
                                    border: "1px solid var(--input-border)",
                                    color: "var(--text-primary)",
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = "var(--input-focus)";
                                    e.currentTarget.style.boxShadow =
                                        "0 0 0 3px color-mix(in srgb, var(--input-focus) 15%, transparent)";
                                }}
                                onBlur={(e) => {
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
                            <div className="relative">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="font-body block w-full rounded-xl pl-4 pr-12 py-3 sm:py-3.5 text-base outline-none transition-all"
                                    style={{
                                        backgroundColor: "var(--bg-input)",
                                        border: "1px solid var(--input-border)",
                                        color: "var(--text-primary)",
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = "var(--input-focus)";
                                        e.currentTarget.style.boxShadow =
                                            "0 0 0 3px color-mix(in srgb, var(--input-focus) 15%, transparent)";
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = "var(--input-border)";
                                        e.currentTarget.style.boxShadow = "none";
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 sm:pr-4 opacity-50 hover:opacity-100 transition-opacity"
                                    style={{ color: "var(--text-primary)" }}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                                </button>
                            </div>
                        </div>

                        {/* Mensaje de éxito tras activar la cuenta */}
                        {!showActivationModal && successMessage && (
                            <div className="flex items-center justify-center gap-2 text-sm font-medium" style={{ color: "#10b981" }}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-center">{successMessage}</p>
                            </div>
                        )}

                        {/* Error de Login principal */}
                        {!showActivationModal && error && (
                            <div className="flex items-center justify-center gap-2 text-sm font-medium" style={{ color: "#ef4444" }}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-center">{error}</p>
                            </div>
                        )}

                        <div className="pt-2 sm:pt-4">
                            <button
                                type="submit"
                                disabled={loading && !showActivationModal}
                                className="flex w-full justify-center rounded-xl px-3 py-3.5 sm:py-4 text-base sm:text-lg font-heading font-semibold text-white shadow-md hover:scale-[1.01] active:scale-95 transition-all duration-200 disabled:opacity-70"
                                style={{ backgroundColor: "var(--bubble-me-bg)" }}
                            >
                                {loading && !showActivationModal ? "Ingresando..." : "Iniciar sesión"}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                clearError();
                                setSuccessMessage("");
                                setShowActivationModal(true);
                            }}
                            className="text-sm font-semibold hover:underline"
                            style={{ color: "var(--text-accent)" }}
                        >
                            ¿Es tu primera vez? Activa tu cuenta aquí
                        </button>
                    </div>
                </div>
            </div>

            {/* --- MODAL DE ACTIVACIÓN --- */}
            {showActivationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div 
                        className="w-full max-w-md rounded-2xl p-6 sm:p-8 relative shadow-2xl"
                        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)" }}
                    >
                        <button
                            onClick={resetActivationModal}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <h3 className="text-xl sm:text-2xl font-bold font-heading mb-6" style={{ color: "var(--text-accent)" }}>
                            Activar Cuenta
                        </h3>

                        {/* Error de Activación dentro del modal con icono y estilo limpio */}
                        {(activationError || error) && (
                            <div className="mb-6 flex items-center justify-center gap-2 text-sm font-medium" style={{ color: "#ef4444" }}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-left">{activationError || error}</p>
                            </div>
                        )}

                        {/* PASO 1: Validar Código */}
                        {activationStep === 1 && (
                            <form onSubmit={handleValidateActivation} className="space-y-5">
                                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                                    Ingresa tu código de delegado para verificar si tienes una cuenta pendiente de activación.
                                </p>
                                
                                <div>
                                    <label className="block text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                                        Código de delegado
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={activationCode}
                                        onChange={(e) => setActivationCode(e.target.value)}
                                        className="w-full rounded-xl px-4 py-3 outline-none border transition-all"
                                        style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full rounded-xl px-4 py-3 text-white font-semibold shadow-md disabled:opacity-70 transition-all duration-200 hover:scale-[1.01] active:scale-95"
                                    style={{ backgroundColor: "var(--bubble-me-bg)" }}
                                >
                                    {loading ? "Validando..." : "Continuar"}
                                </button>
                            </form>
                        )}

                        {/* PASO 2: Contraseña de 1 uso y Nueva Contraseña */}
                        {activationStep === 2 && (
                            <form onSubmit={handleCompleteActivation} className="space-y-4">
                                <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                                    Ingresa la contraseña de 1 solo uso proporcionada por tu comité y define tu nueva contraseña.
                                </p>

                                {/* Selector de evento (Solo se muestra si hay más de 1) */}
                                {availableEvents.length > 1 && (
                                    <div>
                                        <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                                            Selecciona tu evento
                                        </label>
                                        <select
                                            value={activationEventId}
                                            onChange={(e) => setActivationEventId(e.target.value)}
                                            className="w-full rounded-xl px-4 py-2.5 outline-none border"
                                            style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}
                                            required
                                        >
                                            {availableEvents.map((ev) => (
                                                <option key={ev.event_id} value={ev.event_id}>
                                                    {ev.event_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                                        Contraseña de 1 uso
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showOneTimePassword ? "text" : "password"}
                                            required
                                            value={oneTimePassword}
                                            onChange={(e) => setOneTimePassword(e.target.value)}
                                            className="w-full rounded-xl pl-4 pr-12 py-2.5 outline-none border transition-all"
                                            style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowOneTimePassword(!showOneTimePassword)}
                                            className="absolute inset-y-0 right-0 flex items-center pr-3 sm:pr-4 opacity-50 hover:opacity-100 transition-opacity"
                                            style={{ color: "var(--text-primary)" }}
                                            tabIndex={-1}
                                        >
                                            {showOneTimePassword ? <EyeSlashIcon /> : <EyeIcon />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                                        Nueva contraseña
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showNewPassword ? "text" : "password"}
                                            required
                                            minLength={6}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full rounded-xl pl-4 pr-12 py-2.5 outline-none border transition-all"
                                            style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute inset-y-0 right-0 flex items-center pr-3 sm:pr-4 opacity-50 hover:opacity-100 transition-opacity"
                                            style={{ color: "var(--text-primary)" }}
                                            tabIndex={-1}
                                        >
                                            {showNewPassword ? <EyeSlashIcon /> : <EyeIcon />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                                        Confirmar nueva contraseña
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? "text" : "password"}
                                            required
                                            minLength={6}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full rounded-xl pl-4 pr-12 py-2.5 outline-none border transition-all"
                                            style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute inset-y-0 right-0 flex items-center pr-3 sm:pr-4 opacity-50 hover:opacity-100 transition-opacity"
                                            style={{ color: "var(--text-primary)" }}
                                            tabIndex={-1}
                                        >
                                            {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full mt-4 rounded-xl px-4 py-3 text-white font-semibold shadow-md disabled:opacity-70 transition-all duration-200 hover:scale-[1.01] active:scale-95"
                                    style={{ backgroundColor: "var(--text-accent)" }}
                                >
                                    {loading ? "Activando cuenta..." : "Activar Cuenta"}
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActivationStep(1);
                                        setActivationError(""); 
                                        clearError(); 
                                        // Restablecemos visibilidad al volver atrás
                                        setShowOneTimePassword(false);
                                        setShowNewPassword(false);
                                        setShowConfirmPassword(false);
                                    }}
                                    className="w-full text-sm font-semibold mt-2 opacity-60 hover:opacity-100 transition-opacity"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    Volver atrás
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;
