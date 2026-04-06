export interface User {
    id: string;
    name: string;
    avatar: string;
    role: string;
}

export interface Post {
    id: string;
    user: User;
    title?: string | null;
    content: string;
    createdAt: string;
    updatedAt?: string;
    committeeId?: string;
    committeeTags?: string[];
    timestamp: number;
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
