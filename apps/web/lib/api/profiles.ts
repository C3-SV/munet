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
