import type { MyProfile, PublicProfile } from "../../types/common";
import { requestApi } from "./client";

type ProfileContext = {
    token: string;
    eventId: string;
};

export const getMyProfile = async (context: ProfileContext): Promise<MyProfile> => {
    const payload = await requestApi<{ profile: MyProfile }>("/profiles/me", {
        method: "GET",
        token: context.token,
        eventId: context.eventId,
    });

    return payload.profile;
};

export const updateMyProfile = async (
    context: ProfileContext & {
        displayName?: string;
        bio?: string;
        avatar?: string;
    },
): Promise<MyProfile> => {
    const payload = await requestApi<{ profile: MyProfile }>("/profiles/me", {
        method: "PATCH",
        token: context.token,
        eventId: context.eventId,
        body: {
            display_name: context.displayName,
            bio: context.bio,
            profile_image_path: context.avatar,
        },
    });

    return payload.profile;
};

export const uploadMyAvatar = async (
    file: File,
    context: ProfileContext,
): Promise<MyProfile> => {
    const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            if (typeof reader.result !== "string") {
                reject(new Error("No se pudo leer la imagen seleccionada"));
                return;
            }

            const separator = reader.result.indexOf(",");
            resolve(separator >= 0 ? reader.result.slice(separator + 1) : reader.result);
        };

        reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada"));
        reader.readAsDataURL(file);
    });

    const payload = await requestApi<{ profile: MyProfile }>("/profiles/me/avatar", {
        method: "POST",
        token: context.token,
        eventId: context.eventId,
        body: {
            file_name: file.name,
            mime_type: file.type,
            base64_data: base64Data,
        },
    });

    return payload.profile;
};

export const updatePublicProfileAsAdmin = async (
    membershipId: string,
    context: ProfileContext & {
        firstName?: string;
        lastName?: string;
        displayName?: string | null;
        bio?: string | null;
        delegationName?: string | null;
        institutionName?: string | null;
        committeeId?: string | null;
    },
): Promise<PublicProfile> => {
    const payload = await requestApi<{ profile: PublicProfile }>(
        `/profiles/${membershipId}`,
        {
            method: "PATCH",
            token: context.token,
            eventId: context.eventId,
            body: {
                first_name: context.firstName,
                last_name: context.lastName,
                display_name: context.displayName,
                bio: context.bio,
                delegation_name: context.delegationName,
                institution_name: context.institutionName,
                committee_id: context.committeeId,
            },
        },
    );

    return payload.profile;
};

export const uploadPublicAvatarAsAdmin = async (
    membershipId: string,
    file: File,
    context: ProfileContext,
): Promise<PublicProfile> => {
    const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            if (typeof reader.result !== "string") {
                reject(new Error("No se pudo leer la imagen seleccionada"));
                return;
            }

            const separator = reader.result.indexOf(",");
            resolve(separator >= 0 ? reader.result.slice(separator + 1) : reader.result);
        };

        reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada"));
        reader.readAsDataURL(file);
    });

    const payload = await requestApi<{ profile: PublicProfile }>(
        `/profiles/${membershipId}/avatar`,
        {
            method: "POST",
            token: context.token,
            eventId: context.eventId,
            body: {
                file_name: file.name,
                mime_type: file.type,
                base64_data: base64Data,
            },
        },
    );

    return payload.profile;
};

export const getPublicProfile = async (
    membershipId: string,
    context: ProfileContext,
): Promise<PublicProfile> => {
    const payload = await requestApi<{ profile: PublicProfile }>(
        `/profiles/${membershipId}`,
        {
            method: "GET",
            token: context.token,
            eventId: context.eventId,
            cache: "no-store",
        },
    );

    return payload.profile;
};
