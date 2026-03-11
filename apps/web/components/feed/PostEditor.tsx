import React, { useState } from "react";

interface PostEditorProps {
    onPublish: (text: string) => void;
}

export const PostEditor = ({ onPublish }: PostEditorProps) => {
    const [postText, setPostText] = useState<string>("");

    const handlePublish = () => {
        if (postText.trim()) {
            onPublish(postText);
            setPostText("");
        }
    };

    return (
        <div
            className="mb-8 rounded-2xl overflow-hidden"
            style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                boxShadow: "var(--shadow-sm)",
            }}
        >
            <textarea
                value={postText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setPostText(e.target.value)
                }
                placeholder="¿Qué estás pensando?"
                maxLength={500}
                className="w-full min-h-28 p-5 text-[15px] font-body focus:outline-none resize-none bg-transparent"
                style={{
                    color: "var(--text-primary)",
                }}
            />

            <div
                className="flex justify-between items-center px-5 py-3"
                style={{
                    borderTop: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-surface-secondary)",
                }}
            >
                <span
                    className="text-xs font-medium font-body"
                    style={{ color: "var(--text-muted)" }}
                >
                    {postText.length}/500
                </span>
                <button
                    onClick={handlePublish}
                    disabled={!postText.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-body font-semibold transition-all text-sm active:scale-95"
                    style={{
                        backgroundColor: postText.trim() ? "var(--bubble-me-bg)" : "var(--bg-surface-secondary)",
                        color: postText.trim() ? "white" : "var(--text-muted)",
                        border: `1px solid ${postText.trim() ? "transparent" : "var(--border-color)"}`,
                        cursor: postText.trim() ? "pointer" : "not-allowed",
                    }}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Publicar
                </button>
            </div>
        </div>
    );
};
