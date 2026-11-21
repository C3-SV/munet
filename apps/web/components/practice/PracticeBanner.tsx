"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import {
    acknowledgePracticeReset,
    getPracticeStatus,
    resetPractice,
} from "../../lib/practice/gateway";
import { useAuthStore } from "../../stores/auth.store";

type PracticeStatusView = { persistent: boolean; wasReset: boolean };

// Lee si el navegador conserva la práctica y si se reinició por una actualización. Si la lectura falla,
// no se muestra ningún aviso.
const readStatus = async (userId: string): Promise<PracticeStatusView> => {
    try {
        const status = await getPracticeStatus(userId);
        return { persistent: status.persistent, wasReset: status.wasReset };
    } catch {
        return { persistent: true, wasReset: false };
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
    const [resetNotice, setResetNotice] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [resetting, setResetting] = useState(false);

    // Con la práctica activa se consulta si el almacén persiste y si hubo un reinicio por actualización.
    // Si el aviso se desmonta antes, la lectura se descarta.
    useEffect(() => {
        if (!practice || !userId) {
            return;
        }

        let cancelled = false;

        void readStatus(userId).then((status) => {
            if (!cancelled) {
                setPersistent(status.persistent);
                setResetNotice(status.wasReset);
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
        const status = await readStatus(user.id);
        setPersistent(status.persistent);
        setResetNotice(status.wasReset);
        setResetting(false);
        setConfirmOpen(false);
        router.refresh();
        onReset?.();
    };

    // Cierra el aviso de reinicio y vuelve a leer el estado para refrescar la vista.
    const handleAcknowledgeReset = async () => {
        if (!user) {
            return;
        }

        acknowledgePracticeReset(user.id);
        const status = await readStatus(user.id);
        setPersistent(status.persistent);
        setResetNotice(status.wasReset);
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
                    {resetNotice && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <p className="font-medium">Actualizamos la práctica y empezó de cero</p>
                            <Button variant="secondary" size="sm" onClick={handleAcknowledgeReset}>
                                Entendido
                            </Button>
                        </div>
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
