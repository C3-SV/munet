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

export async function loginRequest(
    payload: LoginPayload,
): Promise<LoginResponse> {
    console.log("AUTH REQUEST PAYLOAD:", payload);

    const res = await fetch(buildApiUrl(API_URL, "/auth/login"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const data = await res.json();

    console.log("AUTH RESPONSE STATUS:", res.status);
    console.log("AUTH RESPONSE BODY:", data);

    if (!res.ok) {
        throw new Error(data.error || "Error al iniciar sesión");
    }

    return data;
}

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

export async function validateActivationRequest(
    participant_code: string,
): Promise<{ success: boolean; events: any[] }> {
    const res = await fetch(buildApiUrl(API_URL, `/auth/events-by-code/${participant_code}`), {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
        cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || "Error al validar la cuenta");
    }

    const formattedEvents = (data.events || [])
        .filter((item: any) => item.account_status === 'PENDING_ACTIVATION')
        .map((item: any) => ({
            event_id: item.event.id,
            event_name: item.event.name,
            membership_id: item.membership_id
        }));

    return { 
        success: true, 
        events: formattedEvents 
    };
}

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
