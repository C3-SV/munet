export interface User {
    id: string;
    name: string;
    committeeName?: string | null;
    avatar: string;
    role: string;
}

export interface Post {
    id: string;
    postType?: "TEXT" | "POLL";
    user: User;
    title?: string | null;
    content: string;
    createdAt: string;
    updatedAt?: string;
    committeeId?: string;
    committeeTags?: string[];
    isDeleted?: boolean;
    deletedByActorType?: "AUTHOR" | "ADMIN" | null;
    canDelete?: boolean;
    poll?: PollData | null;
    timestamp: number;
}

export interface PollOption {
    id: string;
    text: string;
    votes: number;
    percentage: number;
    isSelectedByMe: boolean;
}

export interface PollData {
    id: string;
    status: "OPEN" | "CLOSED";
    isClosed: boolean;
    totalVotes: number;
    canVote: boolean;
    canClose: boolean;
    options: PollOption[];
}

export interface PostComment {
    id: string;
    postId: string;
    parentCommentId: string | null;
    user: User;
    content: string;
    createdAt: string;
    updatedAt?: string;
    isDeleted?: boolean;
    deletedByActorType?: "AUTHOR" | "ADMIN" | null;
    canDelete?: boolean;
    timestamp: number;
}

export interface EventWall {
    id: string;
    eventId: string;
    name: string;
    wallType: string;
    kind: "general" | "announcements" | "committee" | "other";
    slug: string;
    committeeId: string | null;
    committeeName: string | null;
    committeeCode: string | null;
    canAccess: boolean;
    canPublish: boolean;
}

export interface EventSummary {
    id: string;
    name: string;
    slug: string;
}

export interface PublicProfile {
    membershipId: string;
    eventId: string;
    role: string;
    delegationName: string | null;
    institutionName: string | null;
    committee: {
        id: string;
        name: string;
        code: string;
    } | null;
    profile: {
        id: string | null;
        firstName: string;
        lastName: string;
        displayName: string;
        bio: string;
        avatar: string;
    };
}

export interface MyProfile extends PublicProfile {
    accountStatus: string;
    participantCode: string;
    email: string | null;
}

export interface Delegate {
    id: string;
    name: string;
    avatar: string;
    role: string;
    committee: string;
    lastActive: string;
}

export interface Message {
    id: string;
    text: string;
    senderId: string;
    timestamp: string;
}
