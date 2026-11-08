import {
    AuthUser,
    LoginPayload,
    LoginResponse,
    MembershipSummary,
} from "../../types/auth";
import { API_URL, buildApiUrl } from "./base-url";

export interface ActivateAccountPayload {
    participant_code: string;
    event_id: string;
    initial_password: string;
    new_password: string;
}

// Hace login con `participant_code + password` y devuelve contexto inicial.
export async function loginRequest(
    payload: LoginPayload,
): Promise<LoginResponse> {
    const res = await fetch(buildApiUrl(API_URL, "/auth/login"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || "Error al iniciar sesión");
    }

    return data;
}

// Obtiene contexto auth actualizado (usuario + memberships activas).
export async function authContextRequest(token: string): Promise<{
    user: AuthUser;
    memberships: MembershipSummary[];
}> {
    const res = await fetch(buildApiUrl(API_URL, "/auth/context"), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(
            data.error || "No se pudo refrescar el contexto de sesion",
        );
    }

    return data;
}

export type ActivationEvent = {
    event_id: string;
    event_name: string;
    membership_id: string;
};

type ActivationEventResponse = {
    event?: { id: string; name: string } | null;
    account_status: string;
    membership_id: string;
};

// Valida cuentas pendientes de activacion por codigo de participante.
export async function validateActivationRequest(
    participant_code: string,
): Promise<{ success: boolean; events: ActivationEvent[] }> {
    const res = await fetch(buildApiUrl(API_URL, `/auth/events-by-code/${participant_code}`), {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
        cache: "no-store",
    });

    const data = (await res.json()) as {
        error?: string;
        events?: ActivationEventResponse[];
    };

    if (!res.ok) {
        throw new Error(data.error || "Error al validar la cuenta");
    }

    const formattedEvents = (data.events ?? []).flatMap((item) => {
        if (item.account_status !== "PENDING_ACTIVATION" || !item.event) {
            return [];
        }

        return [
            {
                event_id: item.event.id,
                event_name: item.event.name,
                membership_id: item.membership_id,
            },
        ];
    });

    return {
        success: true,
        events: formattedEvents,
    };
}

// Completa activacion inicial de cuenta en un evento puntual.
export async function activateAccountRequest(
    payload: ActivateAccountPayload,
): Promise<{ success: boolean }> {
    const res = await fetch(buildApiUrl(API_URL, "/auth/activate"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || "Error al activar la cuenta");
    }

    return data;
}
