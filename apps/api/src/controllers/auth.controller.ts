import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { supabaseAdmin, createAuthClient } from "../lib/supabase";
import { logAuthAttempt } from "../utils/auth.logger";
import { getMembershipsByUserId } from "../services/auth-context.service";

type ActivateAccountBody = {
    participant_code: string;
    event_id: string;
    initial_password: string;
    new_password: string;
};

// Flujo de activación:
// 1) valida membership pendiente por código + evento
// 2) verifica contraseña inicial de un solo uso
// 3) crea usuario en Supabase Auth
// 4) marca membership como ACTIVE
export const activateAccount = async (
    req: Request<{}, {}, ActivateAccountBody>,
    res: Response,
) => {
    try {
        const { participant_code, event_id, initial_password, new_password } =
            req.body;

        if (
            !participant_code ||
            !event_id ||
            !initial_password ||
            !new_password
        ) {
            return res.status(400).json({
                error: "participant_code, event_id, initial_password y new_password son requeridos",
            });
        }

        // 1. buscar membership
        const { data: membership, error: findError } = await supabaseAdmin
            .from("event_memberships")
            .select("*")
            .eq("participant_code", participant_code)
            .eq("event_id", event_id)
            .is("deleted_at", null)
            .maybeSingle();

        if (findError) {
            console.error(findError);
            return res
                .status(500)
                .json({ error: "Error consultando membership" });
        }

        if (!membership) {
            await logAuthAttempt({
                event_id,
                participant_code,
                attempt_type: "ACTIVATION",
                result: "FAILURE",
                failure_reason: "MEMBERSHIP_NOT_FOUND",
            });

            return res.status(404).json({ error: "Membership no encontrado" });
        }

        // 2. validar estado
        if (membership.account_status !== "PENDING_ACTIVATION") {
            await logAuthAttempt({
                event_id,
                participant_code,
                event_membership_id: membership.id,
                attempt_type: "ACTIVATION",
                result: "FAILURE",
                failure_reason: "ALREADY_ACTIVATED",
            });

            return res
                .status(400)
                .json({ error: "Cuenta ya activada o invalida" });
        }

        // 3. validar contraseña inicial
        if (!membership.initial_password_hash) {
            await logAuthAttempt({
                event_id,
                participant_code,
                event_membership_id: membership.id,
                attempt_type: "ACTIVATION",
                result: "FAILURE",
                failure_reason: "INITIAL_PASSWORD_NOT_CONFIGURED",
            });

            return res.status(400).json({
                error: "La cuenta no tiene contraseña inicial configurada",
            });
        }

        const isInitialPasswordValid = await bcrypt.compare(
            initial_password,
            membership.initial_password_hash,
        );

        if (!isInitialPasswordValid) {
            await logAuthAttempt({
                event_id,
                participant_code,
                event_membership_id: membership.id,
                attempt_type: "ACTIVATION",
                result: "FAILURE",
                failure_reason: "INVALID_INITIAL_PASSWORD",
            });

            return res.status(401).json({ error: "Credenciales invalidas" });
        }

        const { data: userRecord, error: userFindError } = await supabaseAdmin
            .from("users")
            .select("email")
            .eq("id", membership.user_id)
            .single();

        if (userFindError || !userRecord) {
            return res
                .status(500)
                .json({ error: "Error consultando el usuario base" });
        }

        // Usamos su correo real si existe, si no, usamos el fallback
        const resolvedEmail =
            userRecord.email || `${participant_code}@munet.local`;

        // 4. crear usuario en Supabase Auth
        const { data: authData, error: authError } =
            await supabaseAdmin.auth.admin.createUser({
                email: resolvedEmail,
                password: new_password,
                email_confirm: true,
            });

        if (authError) {
            await logAuthAttempt({
                event_id,
                participant_code,
                event_membership_id: membership.id,
                attempt_type: "ACTIVATION",
                result: "FAILURE",
                failure_reason: authError.message,
            });

            return res.status(400).json({ error: authError.message });
        }

        const authUserId = authData.user.id;

        // 5. actualizar users 
        const { error: userError } = await supabaseAdmin
            .from("users")
            .update({
                supabase_auth_user_id: authUserId,
                email: resolvedEmail,
                updated_at: new Date().toISOString(),
            })
            .eq("id", membership.user_id);

        if (userError) {
            return res.status(400).json({ error: userError.message });
        }

        // 6. actualizar membership
        const { error: membershipUpdateError } = await supabaseAdmin
            .from("event_memberships")
            .update({
                account_status: "ACTIVE",
                activated_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                initial_password_hash: null,
            })
            .eq("id", membership.id);

        if (membershipUpdateError) {
            return res
                .status(400)
                .json({ error: membershipUpdateError.message });
        }

        // 7. log intento
        await logAuthAttempt({
            event_id,
            participant_code,
            event_membership_id: membership.id,
            attempt_type: "ACTIVATION",
            result: "SUCCESS",
        });

        return res.json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error interno" });
    }
};

type LoginBody = {
    participant_code: string;
    password: string;
};

// Login por participant_code:
// - localiza membership ACTIVE
// - resuelve usuario base y su email
// - autentica con Supabase Auth
// - devuelve sesión + memberships para contexto frontend
export const login = async (req: Request<{}, {}, LoginBody>, res: Response) => {
    try {
        const { participant_code, password } = req.body;

        if (!participant_code?.trim() || !password?.trim()) {
            return res
                .status(400)
                .json({ error: "participant_code y password son requeridos" });
        }

        // 1. buscar memberships activas por codigo participante
        const { data: memberships, error: membershipsError } =
            await supabaseAdmin
                .from("event_memberships")
                .select("id, event_id, user_id, account_status")
                .eq("participant_code", participant_code)
                .eq("account_status", "ACTIVE")
                .is("deleted_at", null);

        if (membershipsError || !memberships?.length) {
            await logAuthAttempt({
                participant_code,
                attempt_type: "LOGIN",
                result: "FAILURE",
                failure_reason: "MEMBERSHIP_NOT_FOUND",
            });
            return res.status(400).json({ error: "Membership no encontrado" });
        }

        const uniqueUserIds = [
            ...new Set(memberships.map((membership) => membership.user_id)),
        ];

        if (uniqueUserIds.length > 1) {
            return res.status(409).json({
                error: "El participant_code esta asociado a multiples usuarios. Contacta a soporte para corregirlo.",
            });
        }

        // 2. obtener usuario
        const { data: user, error: userError } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("id", uniqueUserIds[0])
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        if (!user.email) {
            return res.status(400).json({ error: "Usuario sin email" });
        }

        // 3. login con Supabase Auth
        const authClient = createAuthClient();

        const { data: authData, error: authError } =
            await authClient.auth.signInWithPassword({
                email: user.email,
                password,
            });

        if (authError || !authData.session || !authData.user) {
            await logAuthAttempt({
                event_id: memberships[0]?.event_id,
                participant_code,
                event_membership_id: memberships[0]?.id,
                attempt_type: "LOGIN",
                result: "FAILURE",
                failure_reason: "INVALID_CREDENTIALS",
            });
            return res.status(401).json({ error: "Credenciales invalidas" });
        }

        // 4. actualizar ultimo login
        await supabaseAdmin
            .from("event_memberships")
            .update({
                last_login_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                updated_by_user_id: user.id,
            })
            .eq("user_id", user.id)
            .eq("account_status", "ACTIVE")
            .is("deleted_at", null);

        // 5. obtener contexto de eventos
        const membershipContext = await getMembershipsByUserId(user.id);

        // 6. log intento
        await logAuthAttempt({
            event_id: memberships[0]?.event_id,
            participant_code,
            event_membership_id: memberships[0]?.id,
            attempt_type: "LOGIN",
            result: "SUCCESS",
        });

        return res.json({
            session: authData.session,
            user: authData.user,
            memberships: membershipContext,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error interno" });
    }
};

// Refresca contexto de sesión usando token bearer actual.
export const getAuthContext = async (req: Request, res: Response) => {
    try {
        if (!req.auth) {
            return res.status(401).json({ error: "No autorizado" });
        }

        const { data, error } = await supabaseAdmin.auth.getUser(
            req.auth.token,
        );

        if (error || !data.user) {
            return res.status(401).json({ error: "Sesion invalida" });
        }

        return res.json({
            user: data.user,
            memberships: req.auth.memberships,
        });
    } catch (error) {
        console.error(error);
        return res
            .status(500)
            .json({ error: "No se pudo cargar el contexto de sesion" });
    }
};
