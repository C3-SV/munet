import type { Post } from "../../types/common";

const API_URL =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
    "http://localhost:3002";

export type FeedWall = {
    wall: {
        id: string;
        eventId: string;
        name: string;
    };
};

export type FeedResponse = FeedWall & {
    posts: Post[];
};

type CreatePostInput = {
    muro: string;
    content: string;
    authorMembershipId?: string;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo completar la solicitud");
    }

    return payload as T;
};

export const getFeedPosts = async (muro: string): Promise<FeedResponse> => {
    const response = await fetch(
        `${API_URL}/posts?muro=${encodeURIComponent(muro)}`,
        {
            cache: "no-store",
        },
    );

    return parseResponse<FeedResponse>(response);
};

export const publishFeedPost = async ({
    muro,
    content,
    authorMembershipId,
}: CreatePostInput): Promise<Post> => {
    const body: {
        muro: string;
        content: string;
        authorMembershipId?: string;
    } = {
        muro,
        content,
    };

    if (authorMembershipId?.trim()) {
        body.authorMembershipId = authorMembershipId;
    }

    const response = await fetch(`${API_URL}/posts`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    const payload = await parseResponse<{ post: Post }>(response);
    return payload.post;
};
