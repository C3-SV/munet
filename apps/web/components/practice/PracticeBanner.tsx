"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { getPracticeStatus, resetPractice } from "../../lib/practice/gateway";
import { useAuthStore } from "../../stores/auth.store";

// Lee si el navegador conserva la práctica. Si la lectura falla, no se muestra el aviso.
const readPersistence = async (userId: string): Promise<boolean> => {
    try {
        const status = await getPracticeStatus(userId);
        return status.persistent;
    } catch {
        return true;
    }
};

type PracticeBannerProps = {
    // Se llama tras reiniciar: el contenedor usa esta señal para remontar la pantalla.
    onReset?: () => void;
};

// Aviso del modo práctica: indica dónde se guarda y permite reiniciarla o salir.
export const PracticeBanner = ({ onReset }: PracticeBannerProps = {}) => {
    const router = useRouter();
    const practice = useAuthStore((state) => state.practice);
    const user = useAuthStore((state) => state.user);
    const exitPractice = useAuthStore((state) => state.exitPractice);
    const userId = user?.id ?? null;

    const [persistent, setPersistent] = useState(true);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [resetting, setResetting] = useState(false);

    // Con la práctica activa se consulta si el almacén persiste. Si el aviso se desmonta antes, la lectura se descarta.
    useEffect(() => {
        if (!practice || !userId) {
            return;
        }

        let cancelled = false;

        void readPersistence(userId).then((value) => {
            if (!cancelled) {
                setPersistent(value);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [practice, userId]);

    if (!practice) {
        return null;
    }

    // Borra lo hecho en la práctica, vuelve a leer si el navegador la persiste y recarga la ruta.
    const handleReset = async () => {
        // Guarda de reentrada: un segundo clic mientras se reinicia no vuelve a borrar.
        if (resetting) {
            return;
        }

        if (!user) {
            setConfirmOpen(false);
            return;
        }

        setResetting(true);
        await resetPractice(user.id);
        setPersistent(await readPersistence(user.id));
        setResetting(false);
        setConfirmOpen(false);
        router.refresh();
        onReset?.();
    };

    // Sale de la práctica y vuelve al feed con el contexto real.
    const handleExit = () => {
        exitPractice();
        router.push("/feed");
    };

    return (
        <div
            className="shrink-0 border-b px-4 py-3 md:px-8"
            style={{
                backgroundColor: "var(--sidebar-active-bg)",
                borderColor: "var(--border-color)",
            }}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div
                    role="status"
                    className="min-w-0 text-sm font-body"
                    style={{ color: "var(--text-primary)" }}
                >
                    <p className="font-semibold">
                        Modo práctica: todo se guarda solo en tu navegador
                    </p>
                    {!persistent && (
                        <p className="mt-1 font-medium" style={{ color: "var(--warning)" }}>
                            Tu navegador no permite guardar la práctica: se borrará al cerrar la pestaña.
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 sm:shrink-0">
                    <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
                        Reiniciar práctica
                    </Button>
                    <Button variant="secondary" onClick={handleExit}>
                        Salir de la práctica
                    </Button>
                </div>
            </div>

            <ConfirmDialog
                open={confirmOpen}
                title="¿Reiniciar la práctica?"
                description="Se borrará todo lo que hiciste en el modo práctica de este navegador."
                confirmLabel="Reiniciar"
                tone="danger"
                loading={resetting}
                onConfirm={handleReset}
                onCancel={() => setConfirmOpen(false)}
            />
        </div>
    );
};
