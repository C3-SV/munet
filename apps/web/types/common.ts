export interface User {
    id: string;
    name: string;
    avatar: string;
    role: "ADMIN" | "DELEGADO" | "STAFF";
}

export interface Post {
    id: string;
    user: User;
    content: string;
    createdAt: string;
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
